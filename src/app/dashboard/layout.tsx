import { redirect } from 'next/navigation'
import { getCurrentUser, getProfile, getClientSettings } from '@/lib/queries'
import { ClientProvider } from '@/lib/client-context'
import { DashboardShell } from './_components/dashboard-shell'
import { BrandingApplier } from './_components/branding-applier'
import type { ClientSettings } from '@/types/database'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const profile = await getProfile(user.id)
  if (!profile) redirect('/login')

  let clientSettings: ClientSettings | null = null

  if (profile.role !== 'agency' && profile.client_id) {
    clientSettings = await getClientSettings(profile.client_id)
  }

  return (
    <ClientProvider>
      <BrandingApplier />
      <DashboardShell
        profile={profile}
        userEmail={user.email ?? ''}
        clientSettings={clientSettings}
      >
        {children}
      </DashboardShell>
    </ClientProvider>
  )
}
