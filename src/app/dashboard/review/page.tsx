import { redirect } from 'next/navigation'
import { getCurrentUser, getProfile, getCallsForPage } from '@/lib/queries'
import { resolveActiveClient } from '@/lib/active-client'
import { ReviewPanel } from './_components/ReviewPanel'

export default async function NeedsReviewPage() {
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

  // Flagged for human attention: explicit follow-up, or a negative experience.
  const allCalls = await getCallsForPage(clientId)
  const flagged = allCalls.filter(
    c => c.outcome === 'follow_up_needed' || c.sentiment === 'negative'
  )

  return <ReviewPanel calls={flagged} clientId={clientId} />
}
