'use client'

import { DonutChart, Legend } from '@tremor/react'
import type { BookedViaSlice } from '@/lib/booked-via'

// Fixed color per channel — consistent regardless of data order. Emerald for
// the AI call channel (the flagship), violet for AI SMS, slate for manual.
const VIA_TREMOR: Record<string, string> = {
  call: 'emerald',
  sms: 'violet',
  manual: 'slate',
}

interface BookedViaChartProps {
  data: BookedViaSlice[]
}

export function BookedViaChart({ data }: BookedViaChartProps) {
  const active = data.filter(d => d.count > 0)
  if (active.length === 0) {
    return (
      <p className="flex h-52 items-center justify-center text-sm text-muted-foreground">
        No appointments booked in the last 30 days.
      </p>
    )
  }

  const chartData = active.map(d => ({ channel: d.label, count: d.count }))
  const colors = active.map(d => VIA_TREMOR[d.key] ?? 'indigo')

  return (
    <div className="space-y-4">
      <DonutChart
        className="h-44"
        data={chartData}
        index="channel"
        category="count"
        colors={colors}
        showAnimation
        valueFormatter={(v: number) => `${v} appointment${v !== 1 ? 's' : ''}`}
      />
      <Legend
        categories={active.map(d => `${d.label} — ${d.pct}%`)}
        colors={colors}
        className="text-xs"
      />
    </div>
  )
}
