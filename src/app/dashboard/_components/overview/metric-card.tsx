import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import type { LucideIcon } from 'lucide-react'

interface MetricCardProps {
  label: string
  value: string
  subtitle?: string
  delta?: number | null   // percent change vs prior period, null = not calculable
  icon: LucideIcon
}

export function MetricCard({ label, value, subtitle, delta, icon: Icon }: MetricCardProps) {
  const hasDelta = delta !== null && delta !== undefined

  return (
    <Card>
      <CardContent>
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground leading-none mt-0.5">
            {label}
          </p>
          <Icon className="size-4 shrink-0 text-muted-foreground" />
        </div>

        <p className="mt-3 text-2xl font-bold tabular-nums leading-none">{value}</p>

        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
          {hasDelta && (
            <p className={cn(
              'text-xs font-medium',
              delta >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            )}>
              {delta >= 0 ? '↑' : '↓'} {Math.abs(delta)}% vs prior 30d
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
