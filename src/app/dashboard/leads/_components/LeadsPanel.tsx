'use client'

import { useMemo, useState, useEffect } from 'react'
import {
  Sparkles, Phone, PhoneOutgoing, MessageSquare, CalendarPlus,
  Search, Moon, ArrowLeft, Users, Flame, Clock, UserPlus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { sendSms, startCall } from '@/lib/integrations'
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
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatIntent(intent: string | null): string {
  if (!intent) return '—'
  return intent.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function initials(name: string | null): string {
  if (!name) return '?'
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')
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

// ── Lead status derivation ────────────────────────────────────────────────────

type LeadStatus = 'high_intent' | 'needs_response' | 'new' | 'active'

const HIGH_INTENT_RE = /book|appoint|schedul|consult|quote|estimate|pricing/i

function deriveStatus(lead: Lead, latestCall: LeadCall | undefined): LeadStatus {
  if (latestCall?.intent && HIGH_INTENT_RE.test(latestCall.intent)) return 'high_intent'
  if (latestCall?.outcome === 'follow_up_needed' || latestCall?.outcome === 'voicemail') return 'needs_response'
  if (isToday(lead.first_seen_at)) return 'new'
  return 'active'
}

const STATUS_STYLES: Record<LeadStatus, { label: string; className: string }> = {
  high_intent:    { label: 'High Intent',    className: 'bg-violet-50 text-violet-700 border-violet-200' },
  needs_response: { label: 'Needs Response', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  new:            { label: 'New',            className: 'bg-sky-50 text-sky-700 border-sky-200' },
  active:         { label: 'Active',         className: 'bg-slate-100 text-slate-600 border-slate-200' },
}

function StatusBadge({ status }: { status: LeadStatus }) {
  const s = STATUS_STYLES[status]
  return (
    <Badge variant="outline" className={cn('font-normal', s.className)}>
      {s.label}
    </Badge>
  )
}

const OUTCOME_STYLES: Record<string, { label: string; className: string }> = {
  booked:           { label: 'Booked',    className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  voicemail:        { label: 'Voicemail', className: 'bg-sky-50 text-sky-700 border-sky-200' },
  hung_up:          { label: 'Hung Up',   className: 'bg-rose-50 text-rose-700 border-rose-200' },
  follow_up_needed: { label: 'Follow Up', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  info_only:        { label: 'Info Only', className: 'bg-slate-100 text-slate-600 border-slate-200' },
}

// ── Metric card ───────────────────────────────────────────────────────────────

function MetricCard({ icon: Icon, label, value, hint }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
  hint: string
}) {
  return (
    <Card className="gap-1 px-4 py-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
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

type SortKey = 'newest' | 'most_calls'

interface LeadsPanelProps {
  leads: Lead[]
  calls: LeadCall[]
  clientId: string
}

export function LeadsPanel({ leads, calls, clientId }: LeadsPanelProps) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('newest')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast])

  // Group calls by contact (calls arrive newest-first)
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

  const statusById = useMemo(() => {
    const map = new Map<string, LeadStatus>()
    for (const lead of leads) {
      map.set(lead.id, deriveStatus(lead, callsByContact.get(lead.id)?.[0]))
    }
    return map
  }, [leads, callsByContact])

  // Metrics over the full lead set (not filtered)
  const metrics = useMemo(() => {
    let newToday = 0, unassigned = 0, needsResponse = 0, highIntent = 0
    for (const lead of leads) {
      if (isToday(lead.first_seen_at)) newToday++
      if (!lead.metadata || !('assigned_to' in lead.metadata)) unassigned++
      const status = statusById.get(lead.id)
      if (status === 'needs_response') needsResponse++
      if (status === 'high_intent') highIntent++
    }
    return { newToday, unassigned, needsResponse, highIntent }
  }, [leads, statusById])

  const filtered = useMemo(() => {
    let result = leads
    const q = search.trim().toLowerCase()
    if (q) {
      result = result.filter(l =>
        (l.full_name ?? '').toLowerCase().includes(q) ||
        (l.phone ?? '').toLowerCase().includes(q) ||
        (l.email ?? '').toLowerCase().includes(q)
      )
    }
    if (sortKey === 'most_calls') {
      result = [...result].sort((a, b) => b.call_count - a.call_count)
    }
    return result
  }, [leads, search, sortKey])

  const selected = useMemo(
    () => leads.find(l => l.id === selectedId) ?? filtered[0] ?? null,
    [leads, selectedId, filtered]
  )
  const selectedCalls = selected ? callsByContact.get(selected.id) ?? [] : []
  const latestSummary = selectedCalls.find(c => c.summary)?.summary ?? null

  async function handleSendText() {
    if (!selected) return
    const res = await sendSms({ clientId, toPhone: selected.phone ?? '', contactId: selected.id, body: '' })
    setToast(res.ok ? 'Text sent' : res.message)
  }

  async function handleStartCall() {
    if (!selected) return
    const res = await startCall({ clientId, toPhone: selected.phone ?? '', contactId: selected.id })
    setToast(res.ok ? 'Call started' : res.message)
  }

  return (
    <div className="space-y-4">
      {toast && <Toast message={toast} />}

      {/* ── Metric cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard icon={UserPlus} label="New Today"      value={metrics.newToday}      hint="first seen today" />
        <MetricCard icon={Users}    label="Unassigned"     value={metrics.unassigned}    hint="no owner yet" />
        <MetricCard icon={Clock}    label="Needs Response" value={metrics.needsResponse} hint="follow-up or voicemail" />
        <MetricCard icon={Flame}    label="High Intent"    value={metrics.highIntent}    hint="booking-ready" />
      </div>

      {/* ── 3-column workspace ───────────────────────────────────────── */}
      <div className="grid items-start gap-4 lg:grid-cols-[300px_minmax(0,1fr)_280px]">

        {/* Left: lead list */}
        <Card className={cn('gap-0 overflow-hidden py-0', selected && 'hidden lg:block')}>
          <div className="space-y-2 border-b border-border px-3 py-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                Leads <span className="font-normal text-muted-foreground">{filtered.length}</span>
              </h3>
              <Select value={sortKey} onValueChange={v => setSortKey(v as SortKey)}>
                <SelectTrigger className="h-7 w-28 text-xs">
                  <SelectValue>{sortKey === 'newest' ? 'Newest' : 'Most calls'}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="most_calls">Most calls</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name, phone, email"
                className="h-8 pl-8 text-sm"
              />
            </div>
          </div>

          <div className="max-h-[calc(100vh-22rem)] overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-10 text-center text-sm text-muted-foreground">No leads found.</p>
            ) : (
              filtered.map(lead => {
                const status = statusById.get(lead.id) ?? 'active'
                const isSelected = selected?.id === lead.id
                return (
                  <button
                    key={lead.id}
                    type="button"
                    onClick={() => setSelectedId(lead.id)}
                    className={cn(
                      'block w-full border-b border-border px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-muted/60',
                      isSelected && 'bg-muted'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">{lead.full_name ?? 'Unknown'}</p>
                      <StatusBadge status={status} />
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {lead.phone ?? lead.email ?? '—'} · {formatRelative(lead.last_seen_at)}
                    </p>
                  </button>
                )
              })
            )}
          </div>
        </Card>

        {/* Center: conversation / activity */}
        <Card className="gap-0 overflow-hidden py-0">
          {!selected ? (
            <div className="flex items-center justify-center py-24">
              <p className="text-sm text-muted-foreground">Select a lead to view activity.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="text-muted-foreground transition-colors hover:text-foreground lg:hidden"
                  aria-label="Back to leads"
                >
                  <ArrowLeft className="size-4" />
                </button>
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-semibold text-violet-700">
                  {initials(selected.full_name)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{selected.full_name ?? 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground">
                    {selected.call_count} call{selected.call_count !== 1 ? 's' : ''} · last {formatRelative(selected.last_seen_at)}
                  </p>
                </div>
              </div>

              <div className="space-y-4 px-4 py-4">
                {/* AI summary */}
                <div className="rounded-lg border border-violet-200 bg-violet-50 px-3.5 py-3 dark:border-violet-900 dark:bg-violet-950/40">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-violet-700 dark:text-violet-300">
                    <Sparkles className="size-3.5" />
                    AI Summary
                  </p>
                  <p className="text-sm leading-relaxed text-violet-900 dark:text-violet-200">
                    {latestSummary ?? 'No call summary available for this lead yet.'}
                  </p>
                </div>

                {/* Activity feed */}
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Activity</p>
                  {selectedCalls.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">No calls recorded.</p>
                  ) : (
                    <div className="space-y-3">
                      {selectedCalls.map(call => {
                        const oc = call.outcome ? OUTCOME_STYLES[call.outcome] : undefined
                        return (
                          <div key={call.id} className="flex gap-3">
                            <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
                              <Phone className="size-3.5 text-muted-foreground" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                                <span className="font-medium text-foreground">{formatDateTime(call.started_at)}</span>
                                <span className="tabular-nums">{formatDuration(call.duration_seconds)}</span>
                                {call.outcome && (
                                  <Badge variant="outline" className={cn('font-normal', oc?.className)}>
                                    {oc?.label ?? formatIntent(call.outcome)}
                                  </Badge>
                                )}
                                {call.intent && <span>{formatIntent(call.intent)}</span>}
                                {call.after_hours && <Moon className="size-3 text-indigo-400" />}
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
            </>
          )}
        </Card>

        {/* Right: details + quick actions */}
        <div className={cn('space-y-4', !selected && 'hidden lg:block')}>
          <Card className="gap-0 py-0">
            <div className="border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold">Lead Details</h3>
            </div>
            {selected ? (
              <dl className="space-y-2.5 px-4 py-3 text-sm">
                <DetailRow label="Phone" value={selected.phone ?? '—'} />
                <DetailRow label="Email" value={selected.email ?? '—'} />
                <DetailRow label="Source" value={selected.source ? formatIntent(selected.source) : '—'} />
                <DetailRow label="First seen" value={selected.first_seen_at ? formatDateTime(selected.first_seen_at) : '—'} />
                <DetailRow label="Last seen" value={selected.last_seen_at ? formatDateTime(selected.last_seen_at) : '—'} />
                <DetailRow label="Calls" value={String(selected.call_count)} />
              </dl>
            ) : (
              <p className="px-4 py-6 text-sm text-muted-foreground">No lead selected.</p>
            )}
          </Card>

          <Card className="gap-0 py-0">
            <div className="border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold">Quick Actions</h3>
            </div>
            <div className="space-y-2 px-4 py-3">
              <ActionButton icon={MessageSquare} label="Send Text" onClick={handleSendText} disabled={!selected} />
              <ActionButton icon={PhoneOutgoing} label="Start Call" onClick={handleStartCall} disabled={!selected} />
              <ActionButton
                icon={CalendarPlus}
                label="Mark Booked"
                onClick={() => setToast('Booking from the dashboard is coming soon.')}
                disabled={!selected}
              />
              <p className="pt-1 text-xs text-muted-foreground">
                Texting and calling go live once messaging integrations are connected.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="truncate text-right text-sm">{value}</dd>
    </div>
  )
}

function ActionButton({ icon: Icon, label, onClick, disabled }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Icon className="size-4" />
      {label}
    </button>
  )
}
