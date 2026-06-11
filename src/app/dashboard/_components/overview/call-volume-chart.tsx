'use client'

import { AreaChart } from '@tremor/react'

interface ChartPoint {
  date: string
  'Total Calls': number
  'After Hours': number
}

interface CallVolumeChartProps {
  data: ChartPoint[]
}

export function CallVolumeChart({ data }: CallVolumeChartProps) {
  if (!data.length) {
    return (
      <p className="flex h-52 items-center justify-center text-sm text-muted-foreground">
        No call data for the last 30 days.
      </p>
    )
  }

  return (
    <AreaChart
      className="h-52"
      data={data}
      index="date"
      categories={['Total Calls', 'After Hours']}
      colors={['indigo', 'violet']}
      showLegend
      showAnimation
      connectNulls
      valueFormatter={(v: number) => String(v)}
      showGradient
    />
  )
}
