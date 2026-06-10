'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Inbox,
  UserPlus,
  CalendarCheck,
  PhoneMissed,
  AlertCircle,
  BarChart2,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { label: 'Inbox',        href: '/dashboard/inbox',     icon: Inbox,         disabled: false, preservesClient: true  },
  { label: 'New Leads',    href: '/dashboard/leads',     icon: UserPlus,      disabled: false, preservesClient: true  },
  { label: 'Booked',       href: '/dashboard/booked',    icon: CalendarCheck, disabled: false, preservesClient: true  },
  { label: 'Missed Calls', href: '/dashboard/missed',    icon: PhoneMissed,   disabled: false, preservesClient: true  },
  { label: 'Needs Review', href: '/dashboard/review',    icon: AlertCircle,   disabled: false, preservesClient: true  },
  { label: 'Analytics',   href: '/dashboard/analytics', icon: BarChart2,     disabled: false, preservesClient: true  },
  { label: 'Settings',     href: '/dashboard/settings',  icon: Settings,      disabled: false, preservesClient: true  },
]

interface SidebarNavProps {
  // Resolved client ID from DashboardShell — available from render 1 via server-fetched
  // props, updated when the context activeClient changes. Avoids relying on async context.
  clientId: string | null
}

export function SidebarNav({ clientId }: SidebarNavProps) {
  const pathname = usePathname()

  function buildHref(href: string, preservesClient: boolean): string {
    if (preservesClient && clientId) return `${href}?client_id=${clientId}`
    return href
  }

  return (
    <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
      {NAV_ITEMS.map(({ label, href, icon: Icon, disabled, preservesClient }) => {
        const isActive = pathname === href || pathname.startsWith(href + '/')

        if (disabled) {
          return (
            <div
              key={href}
              className="flex cursor-not-allowed select-none items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-600"
            >
              <Icon className="size-4 shrink-0" />
              <span>{label}</span>
            </div>
          )
        }

        return (
          <Link
            key={href}
            href={buildHref(href, preservesClient)}
            style={
              isActive
                ? { backgroundColor: 'var(--brand-color)', color: '#fff' }
                : undefined
            }
            className={cn(
              'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors text-slate-300',
              !isActive && 'hover:bg-[#1e2d45] hover:text-white'
            )}
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
