import { redirect } from 'next/navigation'
import { getCurrentUser, getProfile, getCallsForPage, getMessageThreads } from '@/lib/queries'
import { resolveActiveClient } from '@/lib/active-client'
import { InboxPanel } from './_components/InboxPanel'

export default async function InboxPage() {
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

  const [calls, threads] = await Promise.all([
    getCallsForPage(clientId),
    getMessageThreads(clientId),
  ])

  return <InboxPanel calls={calls} threads={threads} clientId={clientId} />
}
