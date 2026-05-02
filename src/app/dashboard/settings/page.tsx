import { redirect } from 'next/navigation'
import {
  getCurrentUser, getProfile, getAllClients,
  getClientFull, getClientSettingsFull,
} from '@/lib/queries'
import { SettingsPanel } from './_components/SettingsPanel'

export default async function SettingsPage(props: {
  searchParams: Promise<{ client_id?: string }>
}) {
  const searchParams = await props.searchParams

  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const profile = await getProfile(user.id)
  if (!profile) redirect('/login')

  let clientId: string | null = null

  if (profile.role === 'agency') {
    const clients = await getAllClients()
    const requested = searchParams.client_id
    const match = requested ? clients.find(c => c.id === requested) : null
    const resolved = match ?? clients[0] ?? null
    clientId = resolved?.id ?? null
  } else {
    clientId = profile.client_id
  }

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
