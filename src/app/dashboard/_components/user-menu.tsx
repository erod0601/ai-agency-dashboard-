'use client'

import { ChevronDown, LogOut } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

interface UserMenuProps {
  fullName: string | null
  email: string
}

function getInitials(name: string | null, email: string): string {
  if (name?.trim()) {
    return name
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

export function UserMenu({ fullName, email }: UserMenuProps) {
  const initials = getInitials(fullName, email)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-lg p-1.5 outline-none hover:bg-muted transition-colors">
        <Avatar>
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        {/* User info header — non-interactive */}
        <div className="px-2 py-2">
          <p className="text-sm font-medium leading-none truncate">
            {fullName ?? email}
          </p>
          {fullName && (
            <p className="mt-1 text-xs text-muted-foreground truncate">{email}</p>
          )}
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="gap-2 text-muted-foreground cursor-pointer"
          onClick={() => { window.location.href = '/auth/signout' }}
        >
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
