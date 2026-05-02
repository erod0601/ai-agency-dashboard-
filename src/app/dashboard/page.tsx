import { redirect } from 'next/navigation'
import { Phone, TrendingUp, DollarSign, CalendarDays } from 'lucide-react'
import {
  getCurrentUser, getProfile, getAllClients, getClient,
  getDailyCallMetrics, getBookingConversion30d, getEstimatedRevenue30d,
  getRecentCalls, getCallOutcomes30d, getAppointments30d, getTopServicesOrIntents,
} from '@/lib/queries'
import { getIndustryConfig } from '@/lib/industry-config'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MetricCard } from './_components/overview/metric-card'
import { CallVolumeChart } from './_components/overview/call-volume-chart'
import { OutcomesChart } from './_components/overview/outcomes-chart'
import { RecentCallsTable } from './_components/overview/recent-calls-table'
import { ServicesWidget } from './_components/overview/services-widget'

export default async function DashboardPage(props: {
  searchParams: Promise<{ client_id?: string }>
}) {
  const searchParams = await props.searchParams

  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const profile = await getProfile(user.id)
  if (!profile) redirect('/login')

  // ── Resolve which client's data to display ────────────────────────────────
  // Agency: prefer ?client_id= URL param (set by switcher); fall back to first client
  // Client user: always their own client_id — URL param is ignored
  let clientId: string | null = null
  let clientName: string | null = null
  let clientBusinessType: string | null = null

  if (profile.role === 'agency') {
    const clients = await getAllClients()
    // Validate the requested id is in the accessible client list (RLS already enforces
    // this on the DB side, but we double-check to avoid querying with a garbage value)
    const requested = searchParams.client_id
    const match = requested ? clients.find(c => c.id === requested) : null
    const resolved = match ?? clients[0] ?? null
    clientId = resolved?.id ?? null
    clientName = resolved?.name ?? null
    clientBusinessType = resolved?.business_type ?? null
  } else {
    clientId = profile.client_id
    if (clientId) {
      const clientData = await getClient(clientId)
      clientBusinessType = clientData?.business_type ?? null
    }
  }

  const config = getIndustryConfig(clientBusinessType ?? undefined)

  // Log the resolved client_id so it's visible in the dev-server terminal.
  console.log('[dashboard/page] resolved clientId=%s (user role=%s)', clientId, profile.role)

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
    getEstimatedRevenue30d(clientId),
    getRecentCalls(clientId, 10),
    getCallOutcomes30d(clientId),
    getAppointments30d(clientId),
    getTopServicesOrIntents(clientId),
  ])

  settled.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error('[dashboard/page] query index=%d threw: %s', i, r.reason)
    }
  })

  const [
    dailyMetrics,
    bookingConversion,
    estimatedRevenue,
    recentCalls,
    callOutcomes,
    appointments30d,
    topServices,
  ] = [
    settled[0].status === 'fulfilled' ? settled[0].value : [],
    settled[1].status === 'fulfilled' ? settled[1].value : null,
    settled[2].status === 'fulfilled' ? settled[2].value : null,
    settled[3].status === 'fulfilled' ? settled[3].value : [],
    settled[4].status === 'fulfilled' ? settled[4].value : [],
    settled[5].status === 'fulfilled' ? settled[5].value : 0,
    settled[6].status === 'fulfilled' ? settled[6].value : [],
  ] as const

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

  const estimatedRev = estimatedRevenue?.estimated_revenue_30d ?? null

  // Chart data: last 30 days only (view column is "day", not "date")
  const chartData = current30d.map(d => ({
    date: new Date(d.day).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
    'Total Calls': d.total_calls ?? 0,
    'After Hours': d.after_hours_calls ?? 0,
  }))

  const usd = (n: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(n)

  return (
    <div className="space-y-6">
      {/* Agency context banner */}
      {profile.role === 'agency' && clientName && (
        <p className="text-xs text-muted-foreground">
          Showing data for{' '}
          <span className="font-medium text-foreground">{clientName}</span>
          {' '}— use the client switcher in the header to change (Phase 5).
        </p>
      )}

      {/* ── Row 1: Metric tiles ─────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          label="Est. revenue (30d)"
          value={estimatedRev !== null ? usd(estimatedRev) : '—'}
          subtitle="projected from bookings"
          icon={DollarSign}
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

      {/* ── Row 2: Call volume + Outcomes ───────────────────────────────────── */}
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
