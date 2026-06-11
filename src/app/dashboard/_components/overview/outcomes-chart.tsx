'use client'

import { DonutChart, Legend } from '@tremor/react'
import type { CallOutcome } from '@/types/database'

// Fixed color mapping per outcome — consistent regardless of data order
const OUTCOME_MAP: Record<string, { label: string; tremor: string }> = {
  booked:           { label: 'Booked',             tremor: 'emerald' },
  voicemail:        { label: 'Voicemail',           tremor: 'sky'     },
  hung_up:          { label: 'Hung Up',             tremor: 'rose'    },
  follow_up_needed: { label: 'Follow Up Needed',    tremor: 'amber'   },
  info_only:        { label: 'Info Only',           tremor: 'slate'   },
}
const FALLBACK_TREMOR = ['indigo', 'violet', 'fuchsia', 'cyan', 'teal']

interface OutcomesChartProps {
  data: CallOutcome[]
  outcomeLabels?: Record<string, string>
}

export function OutcomesChart({ data, outcomeLabels }: OutcomesChartProps) {
  if (!data.length) {
    return (
      <p className="flex h-52 items-center justify-center text-sm text-muted-foreground">
        No outcome data for the last 30 days.
      </p>
    )
  }

  let fallbackIdx = 0
  const enriched = data.map(d => {
    const config = OUTCOME_MAP[d.outcome]
    const tremor = config?.tremor ?? FALLBACK_TREMOR[fallbackIdx++ % FALLBACK_TREMOR.length]
    // Industry-specific label takes priority, then OUTCOME_MAP, then auto-format the key
    const label =
      outcomeLabels?.[d.outcome] ??
      config?.label ??
      d.outcome.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    return { label, count: d.count, tremor }
  })

  const chartData = enriched.map(e => ({ outcome: e.label, count: e.count }))
  const colors = enriched.map(e => e.tremor)

  return (
    <div className="space-y-4">
      <DonutChart
        className="h-44"
        data={chartData}
        index="outcome"
        category="count"
        colors={colors}
        showAnimation
        valueFormatter={(v: number) => `${v} call${v !== 1 ? 's' : ''}`}
      />
      <Legend
        categories={enriched.map(e => e.label)}
        colors={colors}
        className="text-xs"
      />
    </div>
  )
}
