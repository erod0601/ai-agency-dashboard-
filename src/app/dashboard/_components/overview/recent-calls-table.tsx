import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { RecentCall } from '@/types/database'

// ── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diffMs / 60_000)
  if (m < 1)   return 'just now'
  if (m < 60)  return `${m}m ago`
  if (m < 1440) return `${Math.floor(m / 60)}h ago`
  return `${Math.floor(m / 1440)}d ago`
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

// Outcome → { label, className } for the badge
const OUTCOME_STYLES: Record<string, { label: string; className: string }> = {
  booked:           { label: 'Booked',          className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800' },
  voicemail:        { label: 'Voicemail',        className: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800' },
  hung_up:          { label: 'Hung Up',          className: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800' },
  follow_up_needed: { label: 'Follow Up',        className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' },
  info_only:        { label: 'Info Only',        className: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' },
}

function OutcomeBadge({ outcome }: { outcome: string | null }) {
  if (!outcome) return <span className="text-muted-foreground">—</span>
  const style = OUTCOME_STYLES[outcome]
  const label = style?.label ?? outcome.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  return (
    <Badge variant="outline" className={cn('font-normal', style?.className)}>
      {label}
    </Badge>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

interface RecentCallsTableProps {
  calls: RecentCall[]
}

export function RecentCallsTable({ calls }: RecentCallsTableProps) {
  if (!calls.length) {
    return (
      <p className="px-4 py-8 text-center text-sm text-muted-foreground">
        No recent calls found.
      </p>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-4">Time</TableHead>
          <TableHead>Caller</TableHead>
          <TableHead>Duration</TableHead>
          <TableHead>Outcome</TableHead>
          <TableHead className="pr-4">Intent</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {calls.map((call) => (
          <TableRow key={call.id}>
            <TableCell className="pl-4 text-muted-foreground">
              {relativeTime(call.started_at)}
            </TableCell>
            <TableCell>
              <div className="leading-snug">
                <p className="font-medium">{call.contact_name ?? 'Unknown'}</p>
                {call.contact_phone && (
                  <p className="text-xs text-muted-foreground">{call.contact_phone}</p>
                )}
              </div>
            </TableCell>
            <TableCell className="tabular-nums">
              {formatDuration(call.duration_seconds)}
            </TableCell>
            <TableCell>
              <OutcomeBadge outcome={call.outcome} />
            </TableCell>
            <TableCell className="pr-4 max-w-[160px] truncate text-muted-foreground">
              {call.intent ?? '—'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
