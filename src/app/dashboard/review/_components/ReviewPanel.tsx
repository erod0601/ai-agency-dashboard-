'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Frown, Moon, Sparkles, MessageSquare, PhoneOutgoing, CheckCheck, ArrowLeft, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { sendSms, startCall } from '@/lib/integrations'
import type { RecentCall } from '@/types/database'

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return (
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ', ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  )
}

function daysAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

function titleCase(s: string | null): string {
  if (!s) return '—'
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function initials(name: string | null): string {
  if (!name) return '?'
  return name.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
}

type Reason = 'follow_up' | 'negative'

function reasonsFor(call: RecentCall): Reason[] {
  const r: Reason[] = []
  if (call.outcome === 'follow_up_needed') r.push('follow_up')
  if (call.sentiment === 'negative') r.push('negative')
  return r
}

const REASON_STYLES: Record<Reason, { label: string; className: string }> = {
  follow_up: { label: 'Follow Up Needed',  className: 'bg-amber-50 text-amber-700 border-amber-200' },
  negative:  { label: 'Negative Sentiment', className: 'bg-rose-50 text-rose-700 border-rose-200' },
}

function MetricCard({ icon: Icon, label, value, hint }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number | string
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

type ReasonFilter = 'all' | Reason

interface ReviewPanelProps {
  calls: RecentCall[]
  clientId: string
}

export function ReviewPanel({ calls, clientId }: ReviewPanelProps) {
  const [filter, setFilter] = useState<ReasonFilter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reviewed, setReviewed] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast])

  const open = useMemo(() => calls.filter(c => !reviewed.has(c.id)), [calls, reviewed])

  const metrics = useMemo(() => ({
    open: open.length,
    negative: open.filter(c => c.sentiment === 'negative').length,
    afterHours: open.filter(c => c.after_hours).length,
    oldest: open.length ? Math.max(...open.map(c => daysAgo(c.started_at))) : 0,
  }), [open])

  const filtered = useMemo(() => {
    if (filter === 'all') return open
    return open.filter(c => reasonsFor(c).includes(filter))
  }, [open, filter])

  const selected = useMemo(
    () => filtered.find(c => c.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId]
  )

  async function handleSendText() {
    if (!selected) return
    const res = await sendSms({ clientId, toPhone: selected.contact_phone ?? '', body: '' })
    setToast(res.ok ? 'Text sent' : res.message)
  }

  async function handleStartCall() {
    if (!selected) return
    const res = await startCall({ clientId, toPhone: selected.contact_phone ?? '' })
    setToast(res.ok ? 'Call started' : res.message)
  }

  function handleMarkReviewed() {
    if (!selected) return
    setReviewed(prev => new Set(prev).add(selected.id))
    setSelectedId(null)
    setToast('Marked as reviewed (saved for this session — persistence coming soon).')
  }

  const FILTERS: { id: ReasonFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'follow_up', label: 'Follow Up' },
    { id: 'negative', label: 'Negative' },
  ]

  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg border border-border bg-foreground px-4 py-2.5 text-sm text-background shadow-lg">
          {toast}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard icon={AlertTriangle} label="Awaiting Review" value={metrics.open}       hint="flagged calls" />
        <MetricCard icon={Frown}         label="Negative"        value={metrics.negative}   hint="unhappy callers" />
        <MetricCard icon={Moon}          label="After Hours"     value={metrics.afterHours} hint="outside business hours" />
        <MetricCard icon={Clock}         label="Oldest Waiting"  value={`${metrics.oldest}d`} hint="time in queue" />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* Left: flagged list */}
        <Card className={cn('gap-0 overflow-hidden py-0', selected && 'hidden lg:block')}>
          <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
            <h3 className="text-sm font-semibold">
              Needs Review <span className="font-normal text-muted-foreground">{filtered.length}</span>
            </h3>
            <div className="flex gap-1">
              {FILTERS.map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs transition-colors',
                    filter === f.id
                      ? 'bg-muted font-medium text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-[calc(100vh-22rem)] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-1 px-4 py-12 text-center">
                <CheckCheck className="size-5 text-emerald-500" />
                <p className="text-sm font-medium">All clear</p>
                <p className="text-xs text-muted-foreground">Nothing needs your attention right now.</p>
              </div>
            ) : (
              filtered.map(call => (
                <button
                  key={call.id}
                  type="button"
                  onClick={() => setSelectedId(call.id)}
                  className={cn(
                    'block w-full border-b border-border px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-muted/60',
                    selected?.id === call.id && 'bg-muted'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{call.contact_name ?? 'Unknown'}</p>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(call.started_at)}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {reasonsFor(call).map(r => (
                      <Badge key={r} variant="outline" className={cn('font-normal', REASON_STYLES[r].className)}>
                        {REASON_STYLES[r].label}
                      </Badge>
                    ))}
                  </div>
                </button>
              ))
            )}
          </div>
        </Card>

        {/* Right: detail */}
        <Card className="gap-0 overflow-hidden py-0">
          {!selected ? (
            <div className="flex items-center justify-center py-24">
              <p className="text-sm text-muted-foreground">Select a call to review.</p>
            </div>
          ) : (
            <div className="flex flex-col">
              <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="text-muted-foreground transition-colors hover:text-foreground lg:hidden"
                  aria-label="Back to review queue"
                >
                  <ArrowLeft className="size-4" />
                </button>
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-semibold text-amber-700">
                  {initials(selected.contact_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{selected.contact_name ?? 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground">
                    {selected.contact_phone ?? 'No phone'} · {formatDateTime(selected.started_at)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleMarkReviewed}
                  className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
                >
                  <CheckCheck className="size-3.5" />
                  Mark Reviewed
                </button>
              </div>

              <div className="space-y-4 px-4 py-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {reasonsFor(selected).map(r => (
                    <Badge key={r} variant="outline" className={cn('font-normal', REASON_STYLES[r].className)}>
                      {REASON_STYLES[r].label}
                    </Badge>
                  ))}
                  {selected.intent && <span>{titleCase(selected.intent)}</span>}
                  {selected.after_hours && <Moon className="size-3 text-indigo-400" />}
                  <span>{daysAgo(selected.started_at)}d in queue</span>
                </div>

                <div className="rounded-lg border border-violet-200 bg-violet-50 px-3.5 py-3 dark:border-violet-900 dark:bg-violet-950/40">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-violet-700 dark:text-violet-300">
                    <Sparkles className="size-3.5" />
                    AI Summary
                  </p>
                  <p className="text-sm leading-relaxed text-violet-900 dark:text-violet-200">
                    {selected.summary ?? 'No summary available for this call.'}
                  </p>
                </div>

                {selected.recording_url && (
                  <a
                    href={selected.recording_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-sm text-primary hover:underline"
                  >
                    Listen to recording →
                  </a>
                )}
              </div>

              <div className="flex gap-2 border-t border-border px-4 py-3">
                <button
                  type="button"
                  onClick={handleSendText}
                  className="flex flex-1 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
                >
                  <MessageSquare className="size-4" />
                  Send Text
                </button>
                <button
                  type="button"
                  onClick={handleStartCall}
                  className="flex flex-1 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
                >
                  <PhoneOutgoing className="size-4" />
                  Start Call
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
