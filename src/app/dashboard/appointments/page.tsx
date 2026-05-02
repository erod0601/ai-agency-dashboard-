import { redirect } from 'next/navigation'
import { getCurrentUser, getProfile, getAllClients, getAppointmentsForPage } from '@/lib/queries'
import { AppointmentsPanel } from './_components/AppointmentsPanel'

export default async function AppointmentsPage(props: {
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

  const appointments = await getAppointmentsForPage(clientId)
  return <AppointmentsPanel appointments={appointments} />
}
