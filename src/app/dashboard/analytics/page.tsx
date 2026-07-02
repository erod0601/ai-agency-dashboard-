import { redirect } from 'next/navigation'
import { Phone, TrendingUp, CalendarDays } from 'lucide-react'
import {
  getCurrentUser, getProfile,
  getDailyCallMetrics, getBookingConversion30d,
  getRecentCalls, getCallOutcomes30d, getAppointments30d, getTopServicesOrIntents,
  getClientSettingsFull, getFunnelInputs, getSpeedToLeadInputs, type FunnelInputs,
} from '@/lib/queries'
import { resolveActiveClient } from '@/lib/active-client'
import { getIndustryConfig } from '@/lib/industry-config'
import {
  getAvgTicket,
  estimateClientRevenue30d,
  estimateCumulativeRevenue,
  computeAnswerRateStreak,
} from '@/lib/revenue'
import { deriveLeadStatus, type LeadStatus } from '@/lib/lead-status'
import { computeAvgSpeedToLead } from '@/lib/speed-to-lead'
import { computeBookedViaBreakdown } from '@/lib/booked-via'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MetricCard } from '../_components/overview/metric-card'
import { CallVolumeChart } from '../_components/overview/call-volume-chart'
import { OutcomesChart } from '../_components/overview/outcomes-chart'
import { RecentCallsTable } from '../_components/overview/recent-calls-table'
import { ServicesWidget } from '../_components/overview/services-widget'
import { RevenueHeroBand } from '../_components/overview/revenue-hero-band'
import { ConversionFunnel } from '../_components/overview/conversion-funnel'
import { BookedViaChart } from '../_components/overview/booked-via-chart'

// Group funnel inputs by contact and run the shared derivation over each one.
function computeStatusDistribution(inputs: FunnelInputs): Record<LeadStatus, number> {
  const callsByContact = new Map<string, FunnelInputs['calls']>()
  for (const c of inputs.calls) {
    if (!c.contact_id) continue
    const arr = callsByContact.get(c.contact_id)
    if (arr) arr.push(c)
    else callsByContact.set(c.contact_id, [c])
  }
  const apptsByContact = new Map<string, FunnelInputs['appointments']>()
  for (const a of inputs.appointments) {
    if (!a.contact_id) continue
    const arr = apptsByContact.get(a.contact_id)
    if (arr) arr.push(a)
    else apptsByContact.set(a.contact_id, [a])
  }

  const distribution: Record<LeadStatus, number> = {
    new: 0, engaged: 0, booked: 0, won: 0, lost: 0, reactivated: 0,
  }
  for (const contact of inputs.contacts) {
    const status = deriveLeadStatus(
      callsByContact.get(contact.id) ?? [],
      apptsByContact.get(contact.id) ?? [],
      contact.metadata,
      { hasTwoWaySms: inputs.twoWaySmsContactIds.has(contact.id) }
    )
    distribution[status]++
  }
  return distribution
}

export default async function AnalyticsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const profile = await getProfile(user.id)
  if (!profile) redirect('/login')

  // Active client comes from the shared cookie-based resolver — the same one
  // every dashboard page and the header switcher use.
  const { clientId, client } = await resolveActiveClient(profile)
  const clientName = client?.name ?? null

  const config = getIndustryConfig(client?.business_type ?? undefined)

  // Log the resolved client_id so it's visible in the dev-server terminal.
  console.log('[analytics/page] resolved clientId=%s (user role=%s)', clientId, profile.role)

  if (!clientId) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-sm font-medium text-muted-foreground">No client data available.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Add a client in Supabase to start seeing metrics here.
        </p>
      </div>
    )
  }

  // ── Parallel data fetch ───────────────────────────────────────────────────
  // Promise.allSettled so one failed query doesn't mask others.
  // Individual query functions already console.error their own failures.
  const settled = await Promise.allSettled([
    getDailyCallMetrics(clientId),
    getBookingConversion30d(clientId),
    getClientSettingsFull(clientId),
    getRecentCalls(clientId, 10),
    getCallOutcomes30d(clientId),
    getAppointments30d(clientId),
    getTopServicesOrIntents(clientId),
    getFunnelInputs(clientId),
    getSpeedToLeadInputs(clientId),
  ])

  settled.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error('[dashboard/page] query index=%d threw: %s', i, r.reason)
    }
  })

  const emptyFunnel: FunnelInputs = {
    contacts: [], calls: [], appointments: [], twoWaySmsContactIds: new Set(),
  }
  const [
    dailyMetrics,
    bookingConversion,
    clientSettings,
    recentCalls,
    callOutcomes,
    appointments30d,
    topServices,
    funnelInputs,
    speedToLeadInputs,
  ] = [
    settled[0].status === 'fulfilled' ? settled[0].value : [],
    settled[1].status === 'fulfilled' ? settled[1].value : null,
    settled[2].status === 'fulfilled' ? settled[2].value : null,
    settled[3].status === 'fulfilled' ? settled[3].value : [],
    settled[4].status === 'fulfilled' ? settled[4].value : [],
    settled[5].status === 'fulfilled' ? settled[5].value : 0,
    settled[6].status === 'fulfilled' ? settled[6].value : [],
    settled[7].status === 'fulfilled' ? settled[7].value : emptyFunnel,
    settled[8].status === 'fulfilled'
      ? settled[8].value
      : { missedCalls: [], outboundEvents: [] },
  ] as const

  // ── Derived revenue + funnel (src/lib/revenue, src/lib/lead-status) ────────
  const avgTicket = getAvgTicket(clientSettings)
  const usingDefaultTicket = clientSettings?.avg_ticket_value == null
  const revenue30d = estimateClientRevenue30d(funnelInputs.appointments, avgTicket)
  const statusDistribution = computeStatusDistribution(funnelInputs)

  // Value-story baseline: locked at onboarding, else the client's start date.
  const baselineLocked = clientSettings?.baseline_locked_at != null
  const baselineDate = new Date(
    clientSettings?.baseline_locked_at ?? client?.created_at ?? Date.now()
  )
  const cumulative = estimateCumulativeRevenue(funnelInputs.appointments, avgTicket, baselineDate)
  const streak = computeAnswerRateStreak(funnelInputs.calls)
  const speedToLead = computeAvgSpeedToLead(speedToLeadInputs)
  const bookedViaBreakdown = computeBookedViaBreakdown(funnelInputs.appointments)

  // ── Derive 30d vs prior-30d metrics from the 61-day daily_call_metrics ────
  const thirtyDaysAgoStr = (() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().split('T')[0]
  })()

  const current30d = dailyMetrics.filter(d => d.day >= thirtyDaysAgoStr)
  const prior30d   = dailyMetrics.filter(d => d.day < thirtyDaysAgoStr)

  const totalCalls30d      = current30d.reduce((s, d) => s + (d.total_calls ?? 0), 0)
  const afterHoursCalls30d = current30d.reduce((s, d) => s + (d.after_hours_calls ?? 0), 0)
  const totalCallsPrior    = prior30d.reduce((s, d) => s + (d.total_calls ?? 0), 0)

  const callsDelta = totalCallsPrior > 0
    ? Math.round(((totalCalls30d - totalCallsPrior) / totalCallsPrior) * 100)
    : null

  // conversion_rate_pct is stored as a percentage (0–100); round to nearest integer
  const rawRate = bookingConversion?.conversion_rate_pct ?? null
  const bookingRate = rawRate !== null ? Math.round(rawRate) : null

  // Chart data: last 30 days only (view column is "day", not "date")
  const chartData = current30d.map(d => ({
    date: new Date(d.day).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
    'Total Calls': d.total_calls ?? 0,
    'After Hours': d.after_hours_calls ?? 0,
  }))

  return (
    <div className="space-y-6">
      {/* Agency context banner */}
      {profile.role === 'agency' && clientName && (
        <p className="text-xs text-muted-foreground">
          Showing data for{' '}
          <span className="font-medium text-foreground">{clientName}</span>
          {' '}— use the client switcher in the header to change.
        </p>
      )}

      {/* ── Row 1: Value-story hero band (three tiles) ──────────────────────── */}
      <RevenueHeroBand
        revenue={revenue30d}
        cumulative={cumulative}
        baselineDate={baselineDate}
        baselineLocked={baselineLocked}
        streak={streak}
        speedToLead={speedToLead}
        avgTicket={avgTicket}
        usingDefaultTicket={usingDefaultTicket}
      />

      {/* ── Row 2: Metric tiles ─────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label={config.metricLabels.totalCalls}
          value={totalCalls30d.toLocaleString()}
          subtitle={afterHoursCalls30d > 0 ? `${afterHoursCalls30d} after hours` : undefined}
          delta={callsDelta}
          icon={Phone}
        />
        <MetricCard
          label={config.metricLabels.conversionRate}
          value={bookingRate !== null ? `${bookingRate}%` : '—'}
          subtitle={bookingConversion?.total_calls_30d ? `of ${bookingConversion.total_calls_30d.toLocaleString()} calls` : 'from inbound calls'}
          icon={TrendingUp}
        />
        <MetricCard
          label={config.metricLabels.bookings}
          value={appointments30d.toLocaleString()}
          subtitle={bookingConversion?.booked_30d != null && appointments30d === 0
            ? `${bookingConversion.booked_30d} booked calls`
            : 'booked this period'}
          icon={CalendarDays}
        />
      </div>

      {/* ── Row 3: Conversion funnel + Booked-via breakdown ─────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Conversion funnel — all contacts</CardTitle>
          </CardHeader>
          <CardContent>
            <ConversionFunnel distribution={statusDistribution} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How appointments get booked</CardTitle>
          </CardHeader>
          <CardContent>
            <BookedViaChart data={bookedViaBreakdown} />
          </CardContent>
        </Card>
      </div>

      {/* ── Row 4: Call volume + Call outcomes ──────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Call volume — last 30 days</CardTitle>
          </CardHeader>
          <CardContent>
            <CallVolumeChart data={chartData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Call outcomes — last 30 days</CardTitle>
          </CardHeader>
          <CardContent>
            <OutcomesChart data={callOutcomes} outcomeLabels={config.callOutcomeLabels} />
          </CardContent>
        </Card>
      </div>

      {/* ── Row 3: Recent calls ─────────────────────────────────────────────── */}
      <Card className="py-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-medium">Recent calls</h2>
          <a
            href="/dashboard/calls"
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            View all →
          </a>
        </div>
        <RecentCallsTable calls={recentCalls} />
      </Card>

      {/* ── Row 4: Top services / intents (only shown if data exists) ──────── */}
      {topServices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top services — last 30 days</CardTitle>
          </CardHeader>
          <CardContent>
            <ServicesWidget data={topServices} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
