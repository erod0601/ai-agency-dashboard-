'use client'

import { BarList } from '@tremor/react'
import type { ServiceCount } from '@/types/database'

interface ServicesWidgetProps {
  data: ServiceCount[]
}

export function ServicesWidget({ data }: ServicesWidgetProps) {
  if (!data.length) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        No service data yet.
      </p>
    )
  }

  const barData = data.map(d => ({
    name: d.name
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase()),
    value: d.count,
  }))

  return (
    <BarList
      data={barData}
      className="text-sm"
      valueFormatter={(v: number) => `${v.toLocaleString()}`}
    />
  )
}
