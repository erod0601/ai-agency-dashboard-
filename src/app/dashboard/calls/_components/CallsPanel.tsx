'use client'

import { useState, useMemo } from 'react'
import { Moon, X, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { RecentCall } from '@/types/database'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return (
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ', ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  )
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

// ── Outcome badge ─────────────────────────────────────────────────────────────

const OUTCOME_STYLES: Record<string, { label: string; className: string }> = {
  booked:           { label: 'Booked',          className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  voicemail:        { label: 'Voicemail',        className: 'bg-sky-50 text-sky-700 border-sky-200' },
  hung_up:          { label: 'Hung Up',          className: 'bg-rose-50 text-rose-700 border-rose-200' },
  follow_up_needed: { label: 'Follow Up',        className: 'bg-amber-50 text-amber-700 border-amber-200' },
  info_only:        { label: 'Info Only',        className: 'bg-slate-100 text-slate-600 border-slate-200' },
}

function OutcomeBadge({ outcome }: { outcome: string | null }) {
  if (!outcome) return <span className="text-xs text-muted-foreground">—</span>
  const style = OUTCOME_STYLES[outcome]
  const label = style?.label ?? outcome.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  return (
    <Badge variant="outline" className={cn('font-normal', style?.className)}>
      {label}
    </Badge>
  )
}

// ── Filter config ─────────────────────────────────────────────────────────────

type DateRange = '7d' | '30d' | '90d' | 'all'

const DATE_RANGE_LABELS: Record<DateRange, string> = {
  '7d':  'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  'all': 'All time',
}

const OUTCOME_OPTIONS = [
  { value: 'all',              label: 'All Outcomes'      },
  { value: 'booked',           label: 'Booked'            },
  { value: 'hung_up',          label: 'Hung Up'           },
  { value: 'voicemail',        label: 'Voicemail'         },
  { value: 'info_only',        label: 'Info Only'         },
  { value: 'follow_up_needed', label: 'Follow Up Needed'  },
]

// ── Detail panel ──────────────────────────────────────────────────────────────

function DetailPanel({ call, onClose }: { call: RecentCall; onClose: () => void }) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">Call Details</h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        <Field label="Caller">
          <p className="text-sm font-medium">{call.contact_name ?? 'Unknown'}</p>
          {call.contact_phone && (
            <p className="text-xs text-muted-foreground">{call.contact_phone}</p>
          )}
        </Field>

        <Field label="Time">
          <p className="text-sm">{formatDateTime(call.started_at)}</p>
        </Field>

        <Field label="Duration">
          <p className="text-sm tabular-nums">{formatDuration(call.duration_seconds)}</p>
        </Field>

        <Field label="Outcome">
          <OutcomeBadge outcome={call.outcome} />
        </Field>

        <Field label="Intent">
          <p className="text-sm">{formatIntent(call.intent)}</p>
        </Field>

        <Field label="After Hours">
          <p className="flex items-center gap-1.5 text-sm">
            {call.after_hours ? (
              <>
                <Moon className="size-3.5 text-indigo-500" />
                Yes
              </>
            ) : (
              'No'
            )}
          </p>
        </Field>

        {call.sentiment && (
          <Field label="Sentiment">
            <p className="text-sm capitalize">{call.sentiment}</p>
          </Field>
        )}

        {call.summary && (
          <Field label="Summary">
            <p className="text-sm leading-relaxed text-muted-foreground">{call.summary}</p>
          </Field>
        )}

        {call.recording_url && (
          <Field label="Recording">
            <a
              href={call.recording_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline"
            >
              Listen to recording →
            </a>
          </Field>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface CallsPanelProps {
  calls: RecentCall[]
}

export function CallsPanel({ calls }: CallsPanelProps) {
  const [dateRange, setDateRange] = useState<DateRange>('30d')
  const [outcomeFilter, setOutcomeFilter] = useState('all')
  const [intentFilter, setIntentFilter] = useState('all')
  const [selectedCall, setSelectedCall] = useState<RecentCall | null>(null)

  // Unique intents derived from the full dataset (not filtered)
  const intents = useMemo(
    () =>
      Array.from(
        new Set(calls.map(c => c.intent).filter((i): i is string => !!i))
      ).sort(),
    [calls]
  )

  // Client-side filtering
  const filtered = useMemo(() => {
    let result = calls

    if (dateRange !== 'all') {
      const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - days)
      result = result.filter(c => new Date(c.started_at) >= cutoff)
    }

    if (outcomeFilter !== 'all') result = result.filter(c => c.outcome === outcomeFilter)
    if (intentFilter !== 'all')  result = result.filter(c => c.intent  === intentFilter)

    return result
  }, [calls, dateRange, outcomeFilter, intentFilter])

  const outcomeLabel = OUTCOME_OPTIONS.find(o => o.value === outcomeFilter)?.label ?? 'All Outcomes'
  const intentLabel  = intentFilter === 'all' ? 'All Intents' : formatIntent(intentFilter)

  return (
    <div className="flex items-start gap-4">
      {/* ── Left: filters + table ───────────────────────────────────── */}
      <div
        className={cn(
          'min-w-0 flex-1 space-y-4',
          selectedCall && 'hidden md:block'
        )}
      >
        {/* Filters row */}
        <div className="flex flex-wrap items-center gap-2">
          <Select value={dateRange} onValueChange={v => setDateRange(v as DateRange)}>
            <SelectTrigger className="h-8 w-36">
              <SelectValue>{DATE_RANGE_LABELS[dateRange]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(DATE_RANGE_LABELS) as [DateRange, string][]).map(([v, label]) => (
                <SelectItem key={v} value={v}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={outcomeFilter} onValueChange={v => setOutcomeFilter(v ?? 'all')}>
            <SelectTrigger className="h-8 w-44">
              <SelectValue>{outcomeLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {OUTCOME_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={intentFilter} onValueChange={v => setIntentFilter(v ?? 'all')}>
            <SelectTrigger className="h-8 w-36">
              <SelectValue>{intentLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Intents</SelectItem>
              {intents.map(i => (
                <SelectItem key={i} value={i}>{formatIntent(i)}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="ml-auto text-xs text-muted-foreground">
            {filtered.length} call{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Table */}
        <Card className="py-0">
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-sm text-muted-foreground">No calls match the selected filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Time</TableHead>
                    <TableHead>Caller</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead>Intent</TableHead>
                    <TableHead className="pr-4 text-center">
                      <Moon className="inline size-3.5 text-muted-foreground" />
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(call => (
                    <TableRow
                      key={call.id}
                      onClick={() => setSelectedCall(call)}
                      className={cn(
                        'cursor-pointer',
                        selectedCall?.id === call.id && 'bg-muted'
                      )}
                    >
                      <TableCell className="pl-4 whitespace-nowrap text-muted-foreground">
                        {formatDateTime(call.started_at)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {call.contact_name ?? 'Unknown'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {call.contact_phone ?? '—'}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatDuration(call.duration_seconds)}
                      </TableCell>
                      <TableCell>
                        <OutcomeBadge outcome={call.outcome} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatIntent(call.intent)}
                      </TableCell>
                      <TableCell className="pr-4 text-center">
                        {call.after_hours && (
                          <Moon className="inline size-3.5 text-indigo-400" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>

      {/* ── Right: detail panel ─────────────────────────────────────── */}
      {selectedCall && (
        <div className="w-full md:w-80 shrink-0">
          {/* Mobile: back button above card */}
          <button
            type="button"
            onClick={() => setSelectedCall(null)}
            className="mb-3 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors md:hidden"
          >
            <ArrowLeft className="size-4" />
            Back to calls
          </button>

          <Card
            className="py-0 md:sticky md:top-6"
            style={{ maxHeight: 'calc(100vh - 10rem)', overflow: 'hidden' }}
          >
            <DetailPanel call={selectedCall} onClose={() => setSelectedCall(null)} />
          </Card>
        </div>
      )}
    </div>
  )
}
