import { redirect } from 'next/navigation'
import { getCurrentUser, getProfile, getMessageThreads } from '@/lib/queries'
import { resolveActiveClient } from '@/lib/active-client'
import { MessagesPanel } from './_components/MessagesPanel'

export default async function MessagesPage() {
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

  const threads = await getMessageThreads(clientId)

  return <MessagesPanel threads={threads} clientId={clientId} />
}
