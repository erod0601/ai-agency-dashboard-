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
  { label: 'Inbox',        href: '/dashboard/inbox',     icon: Inbox,         disabled: false },
  { label: 'New Leads',    href: '/dashboard/leads',     icon: UserPlus,      disabled: false },
  { label: 'Booked',       href: '/dashboard/booked',    icon: CalendarCheck, disabled: false },
  { label: 'Missed Calls', href: '/dashboard/missed',    icon: PhoneMissed,   disabled: false },
  { label: 'Needs Review', href: '/dashboard/review',    icon: AlertCircle,   disabled: false },
  { label: 'Analytics',   href: '/dashboard/analytics', icon: BarChart2,     disabled: false },
  { label: 'Settings',     href: '/dashboard/settings',  icon: Settings,      disabled: false },
]

// The active client travels via the activeClientId cookie (see lib/active-client.ts),
// so nav links no longer need to carry a ?client_id= param.
export function SidebarNav() {
  const pathname = usePathname()

  return (
    <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
      {NAV_ITEMS.map(({ label, href, icon: Icon, disabled }) => {
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
            href={href}
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
