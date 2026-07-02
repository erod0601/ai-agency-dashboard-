import { MoonStar, RotateCcw } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatMoney, type AfterHoursStats } from '@/lib/revenue'
import { heroCardClass } from './revenue-hero-band'

// Standalone proof points, hero-tile prominence: "we caught calls a human
// wouldn't have been there for" and "we brought back leads you'd written
// off." Factual copy only — the numbers do the selling.

export function AfterHoursCard({ stats }: { stats: AfterHoursStats }) {
  return (
    <Card className={heroCardClass}>
      <CardContent>
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300">
          <MoonStar className="size-3.5" />
          After-Hours Capture
        </p>
        {stats.answeredAfterHours === 0 ? (
          <>
            <p className="mt-2 text-3xl font-bold tracking-tight">—</p>
            <p className="mt-1 text-xs text-muted-foreground">
              no after-hours calls answered in the last 30 days
            </p>
          </>
        ) : (
          <>
            <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight">
              {stats.answeredAfterHours.toLocaleString()}
              <span className="ml-2 text-base font-semibold text-muted-foreground">
                ({stats.pctOfTotal}% of all calls)
              </span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              after-hours calls answered, last 30 days
            </p>
            <p className="mt-3 text-[11px] text-muted-foreground">
              caught outside business hours — when a human receptionist wouldn&apos;t be there
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export function ReactivationCard({ count, value }: { count: number; value: number }) {
  return (
    <Card className={heroCardClass}>
      <CardContent>
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300">
          <RotateCcw className="size-3.5" />
          Dormant Leads Reactivated
        </p>
        {count === 0 ? (
          <>
            <p className="mt-2 text-3xl font-bold tracking-tight">—</p>
            <p className="mt-1 text-xs text-muted-foreground">
              no dormant leads have re-engaged yet
            </p>
          </>
        ) : (
          <>
            <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight">
              {count.toLocaleString()}
              <span className="mx-2 text-base font-semibold text-muted-foreground">→</span>
              <span className="text-sky-600 dark:text-sky-400">Est. {formatMoney(value)}</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              leads back in play after going quiet 30+ days
            </p>
            <p className="mt-3 text-[11px] text-muted-foreground">
              valued at this client&apos;s average job until each one books
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
