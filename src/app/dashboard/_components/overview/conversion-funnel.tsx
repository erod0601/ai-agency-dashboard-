import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { LEAD_STATUS_CONFIG, type LeadStatus } from '@/lib/lead-status'

interface ConversionFunnelProps {
  /** contact counts per derived status */
  distribution: Record<LeadStatus, number>
}

// The four forward stages of the funnel. A contact counts toward a stage if it
// has reached AT LEAST that stage (won ⊂ booked ⊂ engaged ⊂ contacted), so the
// bars always narrow monotonically the way a funnel should.
const STAGES: Array<{ key: string; label: string; barClass: string; statuses: LeadStatus[] }> = [
  { key: 'contacted', label: 'Contacted', barClass: 'bg-zinc-400/70 dark:bg-zinc-500/70',    statuses: ['new', 'lost', 'reactivated', 'engaged', 'booked', 'won'] },
  { key: 'engaged',   label: 'Engaged',   barClass: 'bg-amber-500/80',                        statuses: ['reactivated', 'engaged', 'booked', 'won'] },
  { key: 'booked',    label: 'Booked',    barClass: 'bg-sky-500/80',                          statuses: ['booked', 'won'] },
  { key: 'won',       label: 'Won',       barClass: 'bg-emerald-500/80',                      statuses: ['won'] },
]

export function ConversionFunnel({ distribution }: ConversionFunnelProps) {
  const stageCounts = STAGES.map(s => ({
    ...s,
    count: s.statuses.reduce((sum, st) => sum + distribution[st], 0),
  }))
  const max = stageCounts[0].count

  if (max === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No contacts yet — the funnel fills in as calls come in.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2.5">
        {stageCounts.map((stage, i) => {
          const pctOfTop = Math.round((stage.count / max) * 100)
          const prev = i > 0 ? stageCounts[i - 1].count : null
          const stepRate = prev ? Math.round((stage.count / prev) * 100) : null
          return (
            <div key={stage.key} className="flex items-center gap-3">
              <p className="w-20 shrink-0 text-xs font-medium text-muted-foreground">{stage.label}</p>
              <div className="relative h-7 flex-1 overflow-hidden rounded-md bg-muted/50">
                <div
                  className={cn('h-full rounded-md transition-all', stage.barClass)}
                  style={{ width: `${Math.max(pctOfTop, 2)}%` }}
                />
                <p className="absolute inset-y-0 left-2.5 flex items-center text-xs font-semibold tabular-nums text-foreground">
                  {stage.count.toLocaleString()}
                </p>
              </div>
              <p className="w-14 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                {stepRate !== null ? `${stepRate}%` : '—'}
              </p>
            </div>
          )
        })}
      </div>

      {/* Off-funnel states — context, not stages */}
      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        {(['lost', 'reactivated'] as const).map(st =>
          distribution[st] > 0 ? (
            <Badge key={st} variant="outline" className={cn('font-normal', LEAD_STATUS_CONFIG[st].className)}>
              {distribution[st].toLocaleString()} {LEAD_STATUS_CONFIG[st].label.toLowerCase()}
            </Badge>
          ) : null
        )}
        <p className="ml-auto text-[11px] text-muted-foreground">
          % shows conversion from the previous stage
        </p>
      </div>
    </div>
  )
}
