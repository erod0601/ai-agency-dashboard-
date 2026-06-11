'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Menu as MenuIcon, X, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SidebarNav } from './sidebar-nav'
import { UserMenu } from './user-menu'
import { useClientContext } from '@/lib/client-context'
import { ClientSwitcher } from './client-switcher'
import { ThemeToggle } from '@/components/theme-toggle'
import type { Profile, ClientSettings } from '@/types/database'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':              'Overview',
  '/dashboard/calls':        'Calls',
  '/dashboard/messages':     'Messages',
  '/dashboard/appointments': 'Appointments',
  '/dashboard/contacts':     'Contacts',
  '/dashboard/settings':     'Settings',
  '/dashboard/inbox':        'Inbox',
  '/dashboard/leads':        'New Leads',
  '/dashboard/booked':       'Booked',
  '/dashboard/missed':       'Missed Calls',
  '/dashboard/review':       'Needs Review',
  '/dashboard/analytics':    'Analytics',
}

interface DashboardShellProps {
  profile: Profile
  userEmail: string
  clientSettings: ClientSettings | null
  children: React.ReactNode
}

export function DashboardShell({
  profile,
  userEmail,
  clientSettings,
  children,
}: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const pageTitle = PAGE_TITLES[pathname] ?? 'Dashboard'

  const { activeClient } = useClientContext()

  // Brand color: prefer context activeClient (includes per-client primary_color),
  // fall back to server-fetched clientSettings (for client-role users), then neutral default
  const primaryColor =
    activeClient?.primary_color ??
    clientSettings?.primary_color ??
    'oklch(0.205 0 0)'

  const logoUrl = clientSettings?.logo_url
  const displayName = clientSettings?.display_name ?? 'AI Voice Dashboard'

  return (
    <div
      className="relative flex h-screen overflow-hidden bg-background"
      style={{ '--brand': primaryColor } as React.CSSProperties}
    >
      {/* ── Mobile backdrop ─────────────────────────────────────────── */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 md:hidden',
          sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col',
          'border-r border-[#1e2d45] bg-[#0f1623]',
          'transition-transform duration-200 ease-in-out',
          'md:static md:translate-x-0 md:transition-none',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo / branding */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-[#1e2d45] px-4">
          {logoUrl ? (
            <img src={logoUrl} alt={displayName} className="h-7 max-w-[140px] object-contain" />
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="size-4 shrink-0 text-blue-400" />
              <span className="truncate text-sm font-semibold text-white">{displayName}</span>
            </div>
          )}
          <button
            type="button"
            className="rounded-md p-1 text-slate-400 hover:bg-[#1e2d45] hover:text-white transition-colors md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X className="size-4" />
          </button>
        </div>

        <SidebarNav />

        {/* AI activity card */}
        <div className="mx-3 mb-3 shrink-0 rounded-lg bg-[#1a2740] border border-[#1e3a5f] px-3 py-2.5">
          <p className="text-xs font-medium text-slate-200">AI handled 12 calls today</p>
          <a href="/dashboard/analytics" className="mt-0.5 text-xs text-blue-400 hover:text-blue-300 transition-colors">
            View Activity →
          </a>
        </div>

        <div className="shrink-0 border-t border-[#1e2d45] px-4 py-3">
          <p className="text-xs text-slate-500">
            {profile.role === 'agency' ? 'Agency View' : 'Client View'}
          </p>
        </div>
      </aside>

      {/* ── Main area ───────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4">
          <button
            type="button"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors md:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <MenuIcon className="size-5" />
          </button>

          <h1 className="text-sm font-semibold">{pageTitle}</h1>

          <div className="ml-auto flex items-center gap-2">
            {/* Client switcher — agency users only */}
            {profile.role === 'agency' && (
              <ClientSwitcher />
            )}

            <ThemeToggle />

            <UserMenu fullName={profile.full_name} email={userEmail} />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
