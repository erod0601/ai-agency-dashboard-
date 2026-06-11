import { redirect } from 'next/navigation'
import { getCurrentUser, getProfile, getCallsForPage } from '@/lib/queries'
import { resolveActiveClient } from '@/lib/active-client'
import { MissedPanel } from './_components/MissedPanel'

const MISSED_OUTCOMES = ['hung_up', 'no_answer']

export default async function MissedCallsPage() {
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

  const allCalls = await getCallsForPage(clientId)
  const missed = allCalls.filter(c => c.outcome && MISSED_OUTCOMES.includes(c.outcome))

  return <MissedPanel calls={missed} clientId={clientId} />
}
