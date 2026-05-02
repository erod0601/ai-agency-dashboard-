'use client'

import { useEffect } from 'react'
import { useClientContext } from '@/lib/client-context'

export function BrandingApplier() {
  const { activeClient } = useClientContext()
  useEffect(() => {
    if (activeClient?.primary_color) {
      document.documentElement.style.setProperty(
        '--brand-color',
        activeClient.primary_color
      )
    }
  }, [activeClient])
  return null
}
