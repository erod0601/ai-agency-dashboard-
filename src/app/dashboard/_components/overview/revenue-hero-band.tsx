import { DollarSign, TrendingUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatMoney, type RevenueEstimate } from '@/lib/revenue'

interface RevenueHeroBandProps {
  revenue: RevenueEstimate
  avgTicket: number
  /** true when avg_ticket_value is unset and the placeholder default is in use */
  usingDefaultTicket: boolean
}

// Hero band: the single revenue headline for the client — everything here is
// derived from src/lib/revenue, so it always agrees with the funnel and the
// contact timeline. All numbers are estimates → "Est." prefix throughout.
export function RevenueHeroBand({ revenue, avgTicket, usingDefaultTicket }: RevenueHeroBandProps) {
  const total = revenue.realized + revenue.pipeline

  return (
    <Card className="border-violet-200 bg-gradient-to-br from-violet-50 via-background to-sky-50 dark:border-violet-900/70 dark:from-violet-950/40 dark:via-background dark:to-sky-950/30">
      <CardContent>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300">
              <DollarSign className="size-3.5" />
              Est. revenue recovered — last 30 days
            </p>
            <p className="mt-2 text-4xl font-bold tabular-nums tracking-tight">
              {formatMoney(total)}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Based on {usingDefaultTicket ? 'an industry-average' : 'this client’s'} job value of{' '}
              <span className="font-medium text-foreground">{formatMoney(avgTicket)}</span>
              {usingDefaultTicket && ' — set the real number in Settings'}
            </p>
          </div>

          <div className="flex gap-8">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Realized</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatMoney(revenue.realized)}
              </p>
              <p className="text-[11px] text-muted-foreground">completed jobs</p>
            </div>
            <div>
              <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <TrendingUp className="size-3" />
                Pipeline
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-sky-600 dark:text-sky-400">
                {formatMoney(revenue.pipeline)}
              </p>
              <p className="text-[11px] text-muted-foreground">booked, not yet done</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
