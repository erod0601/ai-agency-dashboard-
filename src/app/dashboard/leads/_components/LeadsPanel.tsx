'use client'

import { useEffect, useMemo, useState } from 'react'
import { Phone, PhoneOutgoing, MessageSquare, CalendarPlus, Mail, Moon, ArrowLeft, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { getIndustryConfig } from '@/lib/industry-config'
import type { Lead, LeadCall } from '@/types/database'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return (
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ', ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  )
}

function formatRelative(iso: string | null): string {
  if (!iso) return '—'
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return formatDateTime(iso).split(',')[0]
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

function titleCase(s: string | null): string {
  if (!s) return '—'
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function isToday(iso: string | null): boolean {
  if (!iso) return false
  const d = new Date(iso)
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

// Accent palettes carry explicit dark: variants — semantic tokens cover the
// surfaces, but colored chips need both themes spelled out.
const OUTCOME_STYLES: Record<string, { label: string; className: string }> = {
  booked:           { label: 'Booked',    className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900' },
  voicemail:        { label: 'Voicemail', className: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-900' },
  hung_up:          { label: 'Hung Up',   className: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900' },
  no_answer:        { label: 'No Answer', className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900' },
  follow_up_needed: { label: 'Follow Up', className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900' },
  info_only:        { label: 'Info Only', className: 'bg-muted text-muted-foreground border-border' },
}

const SENTIMENT_STYLES: Record<string, string> = {
  positive: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900',
  negative: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900',
  neutral:  'bg-muted text-muted-foreground border-border',
}

const BADGE_HIGH = 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400'
const BADGE_AH   = 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-400'

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  )
}

// ── Metric card ───────────────────────────────────────────────────────────────

function MetricCard({ label, value, hint, hintClass }: {
  label: string
  value: number
  hint: string
  hintClass?: string
}) {
  return (
    <Card className="gap-0 px-4 py-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-[27px] font-semibold leading-none tracking-tight tabular-nums">{value}</p>
      <p className={cn('mt-1.5 text-[11.5px]', hintClass ?? 'text-muted-foreground')}>{hint}</p>
    </Card>
  )
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ message }: { message: string }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 rounded-lg border border-border bg-foreground px-4 py-2.5 text-sm text-background shadow-lg">
      {message}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface LeadsPanelProps {
  leads: Lead[]
  calls: LeadCall[]
  businessType?: string
}

export function LeadsPanel({ leads, calls, businessType }: LeadsPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const config = getIndustryConfig(businessType)
  const outcomeStyles: typeof OUTCOME_STYLES = {
    ...OUTCOME_STYLES,
    booked:    { ...OUTCOME_STYLES.booked,    label: config.callOutcomeLabels.booked },
    voicemail: { ...OUTCOME_STYLES.voicemail, label: config.callOutcomeLabels.voicemail },
  }

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast])

  // Group calls by contact (calls arrive newest-first, so [0] is the latest)
  const callsByContact = useMemo(() => {
    const map = new Map<string, LeadCall[]>()
    for (const c of calls) {
      if (!c.contact_id) continue
      const arr = map.get(c.contact_id)
      if (arr) arr.push(c)
      else map.set(c.contact_id, [c])
    }
    return map
  }, [calls])

  // Metrics over the full lead set
  const metrics = useMemo(() => {
    let newToday = 0, afterHours = 0, highIntent = 0
    for (const lead of leads) {
      if (isToday(lead.first_seen_at)) newToday++
      const latest = callsByContact.get(lead.id)?.[0]
      if (latest?.after_hours) afterHours++
      if (latest?.sentiment === 'positive') highIntent++
    }
    return { newToday, afterHours, highIntent, total: leads.length }
  }, [leads, callsByContact])

  // Default-select the first lead
  const selected = useMemo(
    () => leads.find(l => l.id === selectedId) ?? leads[0] ?? null,
    [leads, selectedId]
  )
  const selectedCalls = selected ? callsByContact.get(selected.id) ?? [] : []
  const latestCall = selectedCalls[0]

  return (
    <div className="space-y-4">
      {toast && <Toast message={toast} />}

      {/* ── Metric cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="New Today"   value={metrics.newToday}   hint="↑ first seen today"      hintClass="text-emerald-600 dark:text-emerald-400" />
        <MetricCard label="After-Hours" value={metrics.afterHours} hint="AI caught while closed"  hintClass="text-violet-600 dark:text-violet-400" />
        <MetricCard label="High Intent" value={metrics.highIntent} hint="positive sentiment"      hintClass="text-amber-600 dark:text-amber-400" />
        <MetricCard label="Total Leads" value={metrics.total}      hint="awaiting booking" />
      </div>

      {leads.length === 0 ? (
        <Card className="gap-0 py-0">
          <div className="flex flex-col items-center gap-1 px-4 py-16 text-center">
            <Users className="size-5 text-muted-foreground" />
            <p className="text-sm font-medium">No leads yet</p>
            <p className="text-xs text-muted-foreground">
              Callers who haven&apos;t booked an appointment will show up here.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[300px_minmax(0,1fr)_280px]">

          {/* Left: incoming leads list */}
          <Card className={cn('gap-0 overflow-hidden py-0', selected && 'hidden lg:block')}>
            <div className="border-b border-border px-4 py-3">
              <SectionHeading>
                Incoming Leads <span className="font-normal normal-case tracking-normal">{leads.length}</span>
              </SectionHeading>
            </div>

            <div className="max-h-[calc(100vh-22rem)] overflow-y-auto">
              {leads.map(lead => {
                const latest = callsByContact.get(lead.id)?.[0]
                const isSelected = selected?.id === lead.id
                return (
                  <button
                    key={lead.id}
                    type="button"
                    onClick={() => setSelectedId(lead.id)}
                    className={cn(
                      'block w-full border-b border-border border-l-2 border-l-transparent px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/60',
                      isSelected && 'border-l-primary bg-muted/80'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn('truncate text-sm font-semibold', !isSelected && 'text-foreground/80')}>
                        {lead.full_name ?? 'Unknown'}
                      </p>
                      <div className="flex shrink-0 gap-1">
                        {latest?.sentiment === 'positive' && (
                          <Badge variant="outline" className={cn('px-1.5 text-[10px] font-semibold', BADGE_HIGH)}>
                            HIGH
                          </Badge>
                        )}
                        {latest?.after_hours && (
                          <Badge variant="outline" className={cn('px-1.5 text-[10px] font-semibold', BADGE_AH)}>
                            A/H
                          </Badge>
                        )}
                      </div>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {titleCase(latest?.intent ?? null)} · {lead.call_count} call{lead.call_count !== 1 ? 's' : ''}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground/70">{formatRelative(lead.last_seen_at)}</p>
                  </button>
                )
              })}
            </div>
          </Card>

          {/* Center: selected lead detail */}
          <Card className="gap-0 overflow-hidden py-0">
            {!selected ? (
              <div className="flex items-center justify-center py-24">
                <p className="text-sm text-muted-foreground">Select a lead to view activity.</p>
              </div>
            ) : (
              <div className="space-y-4 px-5 py-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    className="text-muted-foreground transition-colors hover:text-foreground lg:hidden"
                    aria-label="Back to leads"
                  >
                    <ArrowLeft className="size-4" />
                  </button>
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold">{selected.full_name ?? 'Unknown'}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {selected.phone ?? 'No phone'} · source: {selected.source ? titleCase(selected.source) : 'unknown'}
                    </p>
                  </div>
                </div>

                {/* AI summary of the latest call */}
                <div className="rounded-lg border border-violet-200 bg-gradient-to-br from-violet-50 to-sky-50 px-4 py-3.5 dark:border-violet-900/70 dark:from-violet-950/40 dark:to-sky-950/30">
                  <p className="mb-1.5 flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300">
                    <span aria-hidden>✦</span>
                    AI Summary
                  </p>
                  <p className="text-[13px] leading-relaxed text-violet-950 dark:text-violet-100/90">
                    {latestCall?.summary ?? 'No call summary available for this lead yet.'}
                  </p>
                </div>

                {/* Call activity feed (newest first) */}
                <div>
                  <div className="mb-3">
                    <SectionHeading>Call Activity</SectionHeading>
                  </div>
                  {selectedCalls.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">No calls recorded.</p>
                  ) : (
                    <div className="space-y-3.5">
                      {selectedCalls.map(call => {
                        const oc = call.outcome ? outcomeStyles[call.outcome] : undefined
                        return (
                          <div key={call.id} className="flex gap-3">
                            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                              <Phone className="size-3.5 text-muted-foreground" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline justify-between gap-2">
                                <p className="truncate text-[13px] font-semibold">
                                  Inbound call · {formatDuration(call.duration_seconds)}
                                </p>
                                <p className="shrink-0 text-[11px] text-muted-foreground/70">{formatDateTime(call.started_at)}</p>
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                                {call.outcome && (
                                  <Badge variant="outline" className={cn('font-normal', oc?.className)}>
                                    {oc?.label ?? titleCase(call.outcome)}
                                  </Badge>
                                )}
                                {call.intent && <span>{titleCase(call.intent)}</span>}
                                {call.sentiment && (
                                  <Badge variant="outline" className={cn('font-normal capitalize', SENTIMENT_STYLES[call.sentiment] ?? SENTIMENT_STYLES.neutral)}>
                                    {call.sentiment}
                                  </Badge>
                                )}
                                {call.after_hours && (
                                  <span className="flex items-center gap-1 text-violet-600 dark:text-violet-400">
                                    <Moon className="size-3" />
                                    after-hours
                                  </span>
                                )}
                              </div>
                              {call.summary && (
                                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{call.summary}</p>
                              )}
                              {call.recording_url && (
                                <a
                                  href={call.recording_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mt-1 inline-block text-xs text-primary hover:underline"
                                >
                                  Listen to recording →
                                </a>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>

          {/* Right: details + quick actions */}
          <div className={cn('space-y-4', !selected && 'hidden lg:block')}>
            <Card className="gap-0 py-0">
              <div className="border-b border-border px-4 py-3">
                <SectionHeading>Lead Details</SectionHeading>
              </div>
              {selected ? (
                <dl className="space-y-3 px-4 py-3.5">
                  <DetailRow label="Phone" value={selected.phone ?? '—'} />
                  <DetailRow label="Email" value={selected.email ?? '—'} />
                  <DetailRow label="First seen" value={selected.first_seen_at ? formatDateTime(selected.first_seen_at) : '—'} />
                  <DetailRow label="Calls" value={String(selected.call_count)} />
                  <DetailRow label="Source" value={selected.source ? titleCase(selected.source) : '—'} />
                </dl>
              ) : (
                <p className="px-4 py-6 text-sm text-muted-foreground">No lead selected.</p>
              )}
            </Card>

            <Card className="gap-0 py-0">
              <div className="border-b border-border px-4 py-3">
                <SectionHeading>Quick Actions</SectionHeading>
              </div>
              <div className="space-y-2 px-4 py-3.5">
                <ActionButton
                  icon={CalendarPlus}
                  label="Book Appointment"
                  variant="primary"
                  onClick={() => setToast('Booking from the dashboard is coming soon.')}
                  disabled={!selected}
                />
                <ActionButton
                  icon={PhoneOutgoing}
                  label="Call Back"
                  href={selected?.phone ? `tel:${selected.phone}` : undefined}
                  disabled={!selected?.phone}
                />
                <ActionButton
                  icon={MessageSquare}
                  label="Send SMS"
                  onClick={() => setToast('SMS from the dashboard is coming soon.')}
                  disabled={!selected}
                />
                <ActionButton
                  icon={Mail}
                  label="Email"
                  href={selected?.email ? `mailto:${selected.email}` : undefined}
                  disabled={!selected?.email}
                />
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-[13px]">{value}</dd>
    </div>
  )
}

const ACTION_BASE =
  'flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50'

const ACTION_VARIANTS = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
  outline: 'border border-border bg-background hover:bg-muted',
}

function ActionButton({ icon: Icon, label, onClick, href, disabled, variant = 'outline' }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  onClick?: () => void
  href?: string
  disabled?: boolean
  variant?: keyof typeof ACTION_VARIANTS
}) {
  const className = cn(ACTION_BASE, ACTION_VARIANTS[variant])
  if (href && !disabled) {
    return (
      <a href={href} className={className}>
        <Icon className="size-4" />
        {label}
      </a>
    )
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      <Icon className="size-4" />
      {label}
    </button>
  )
}
