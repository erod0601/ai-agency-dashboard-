import { redirect } from 'next/navigation'
import { getCurrentUser, getProfile, getCallsForPage } from '@/lib/queries'
import { resolveActiveClient } from '@/lib/active-client'
import { CallsPanel } from './_components/CallsPanel'

export default async function CallsPage() {
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

  const calls = await getCallsForPage(clientId)
  return <CallsPanel calls={calls} />
}
