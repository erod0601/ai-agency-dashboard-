import { DollarSign, TrendingUp, CalendarRange, Flame, Zap } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import {
  formatMoney,
  ANSWER_RATE_THRESHOLD,
  type RevenueEstimate,
  type AnswerRateStreak,
} from '@/lib/revenue'
import { formatSpeedToLead, type SpeedToLeadResult } from '@/lib/speed-to-lead'

interface RevenueHeroBandProps {
  /** trailing-30d estimate (realized/pipeline split) */
  revenue: RevenueEstimate
  /** realized total since the baseline date — only ever goes up */
  cumulative: number
  /** the baseline in effect (locked, or client created_at fallback) */
  baselineDate: Date
  /** whether the baseline came from the locked setting or the fallback */
  baselineLocked: boolean
  streak: AnswerRateStreak
  /** trailing-30d missed-call → follow-up average; null = nothing qualifying */
  speedToLead: SpeedToLeadResult | null
  avgTicket: number
  /** true when avg_ticket_value is unset and the placeholder default is in use */
  usingDefaultTicket: boolean
}

// Shared with the proof-point cards so "hero prominence" stays one visual language.
export const heroCardClass =
  'border-violet-200 bg-gradient-to-br from-violet-50 via-background to-sky-50 dark:border-violet-900/70 dark:from-violet-950/40 dark:via-background dark:to-sky-950/30'

function TileLabel({ icon: Icon, children }: { icon: typeof DollarSign; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300">
      <Icon className="size-3.5" />
      {children}
    </p>
  )
}

// The value-story band: three tiles that keep talking indefinitely —
// this month's recovery, the all-time total since onboarding, and the
// consistency streak. All revenue flows through src/lib/revenue ("Est."
// everywhere: these are estimates by construction).
export function RevenueHeroBand({
  revenue,
  cumulative,
  baselineDate,
  baselineLocked,
  streak,
  speedToLead,
  avgTicket,
  usingDefaultTicket,
}: RevenueHeroBandProps) {
  const total = revenue.realized + revenue.pipeline
  const baselineLabel = baselineDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const thresholdPct = Math.round(ANSWER_RATE_THRESHOLD * 100)
  const latestRatePct = streak.latestRate !== null ? Math.round(streak.latestRate * 100) : null

  return (
    <div className="space-y-2">
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {/* Tile 1 — This Month */}
        <Card className={heroCardClass}>
          <CardContent>
            <TileLabel icon={DollarSign}>This Month</TileLabel>
            <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight">
              Est. {formatMoney(total)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">revenue recovered, trailing 30 days</p>
            <div className="mt-3 flex gap-6">
              <div>
                <p className="text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatMoney(revenue.realized)}
                </p>
                <p className="text-[11px] text-muted-foreground">realized</p>
              </div>
              <div>
                <p className="text-sm font-semibold tabular-nums text-sky-600 dark:text-sky-400">
                  {formatMoney(revenue.pipeline)}
                </p>
                <p className="text-[11px] text-muted-foreground">pipeline</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tile 2 — Since Onboarding (cumulative, only goes up) */}
        <Card className={heroCardClass}>
          <CardContent>
            <TileLabel icon={CalendarRange}>Since Onboarding</TileLabel>
            <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight">
              Est. {formatMoney(cumulative)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              total revenue recovered since {baselineLabel}
            </p>
            <p className="mt-3 flex items-center gap-1 text-[11px] text-muted-foreground">
              <TrendingUp className="size-3 text-emerald-600 dark:text-emerald-400" />
              cumulative — this number only goes up
            </p>
          </CardContent>
        </Card>

        {/* Tile 3 — Consistency Streak */}
        <Card className={heroCardClass}>
          <CardContent>
            <TileLabel icon={Flame}>Consistency Streak</TileLabel>
            {streak.monthsOfData < 2 ? (
              <>
                <p className="mt-2 text-3xl font-bold tracking-tight">Month 1</p>
                <p className="mt-1 text-xs text-muted-foreground">building your streak</p>
                {latestRatePct !== null && (
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    answer rate so far:{' '}
                    <span className="font-medium text-foreground">{latestRatePct}%</span>
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight">
                  {latestRatePct !== null ? `${latestRatePct}%` : '—'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">answer rate this month</p>
                <p className="mt-3 text-[11px] text-muted-foreground">
                  {streak.streakMonths > 0 ? (
                    <>
                      <span className="font-medium text-amber-600 dark:text-amber-400">
                        {streak.streakMonths} consecutive month{streak.streakMonths === 1 ? '' : 's'}
                      </span>{' '}
                      at or above {thresholdPct}%
                    </>
                  ) : (
                    <>working back toward {thresholdPct}%</>
                  )}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Tile 4 — Speed to Lead */}
        <Card className={heroCardClass}>
          <CardContent>
            <TileLabel icon={Zap}>Speed to Lead</TileLabel>
            {speedToLead === null ? (
              <>
                <p className="mt-2 text-3xl font-bold tracking-tight">—</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  no missed-call recoveries in the last 30 days
                </p>
              </>
            ) : (
              <>
                <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight">
                  {formatSpeedToLead(speedToLead.avgSeconds)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  avg. missed call → AI follow-up ({speedToLead.sampleSize} recover
                  {speedToLead.sampleSize === 1 ? 'y' : 'ies'}
                  {speedToLead.excludedNoFollowUp > 0 &&
                    `, ${speedToLead.excludedNoFollowUp} pending`})
                </p>
                <p className="mt-3 text-[11px] text-muted-foreground">
                  human callbacks typically take hours — if they happen at all
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Provenance small print */}
      <p className="text-[11px] text-muted-foreground">
        Estimates use {usingDefaultTicket ? 'an industry-average' : 'this client’s'} job value of{' '}
        <span className="font-medium text-foreground">{formatMoney(avgTicket)}</span>
        {usingDefaultTicket && ' (set the real number in Settings)'} where an appointment has no
        recorded value. Onboarding and streak figures measure from{' '}
        <span className="font-medium text-foreground">{baselineLabel}</span>
        {baselineLocked ? ' (locked baseline)' : ' (client start date — lock a baseline in Settings)'}.
      </p>
    </div>
  )
}
