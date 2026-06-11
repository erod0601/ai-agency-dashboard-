import { redirect } from 'next/navigation'
import { getCurrentUser, getProfile, getAppointmentsForPage } from '@/lib/queries'
import { resolveActiveClient } from '@/lib/active-client'
import { AppointmentsPanel } from './_components/AppointmentsPanel'

export default async function AppointmentsPage() {
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

  const appointments = await getAppointmentsForPage(clientId)
  return <AppointmentsPanel appointments={appointments} />
}
