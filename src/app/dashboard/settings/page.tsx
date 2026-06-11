import { redirect } from 'next/navigation'
import {
  getCurrentUser, getProfile,
  getClientFull, getClientSettingsFull,
} from '@/lib/queries'
import { resolveActiveClient } from '@/lib/active-client'
import { SettingsPanel } from './_components/SettingsPanel'

export default async function SettingsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const profile = await getProfile(user.id)
  if (!profile) redirect('/login')

  const { clientId } = await resolveActiveClient(profile)

  if (!clientId) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-muted-foreground">No client selected.</p>
      </div>
    )
  }

  const [client, settings] = await Promise.all([
    getClientFull(clientId),
    getClientSettingsFull(clientId),
  ])

  return (
    <SettingsPanel
      clientId={clientId}
      role={profile.role}
      client={client}
      settings={settings}
    />
  )
}
