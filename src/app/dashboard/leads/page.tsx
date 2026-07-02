import { redirect } from 'next/navigation'
import { getCurrentUser, getProfile, getLeadsForPage, getCallsForContacts } from '@/lib/queries'
import { resolveActiveClient } from '@/lib/active-client'
import { LeadsPanel } from './_components/LeadsPanel'

export default async function LeadsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const profile = await getProfile(user.id)
  if (!profile) redirect('/login')

  const { clientId, client } = await resolveActiveClient(profile)

  if (!clientId) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-muted-foreground">No client selected.</p>
      </div>
    )
  }

  const leads = await getLeadsForPage(clientId)
  const calls = await getCallsForContacts(clientId, leads.map(l => l.id))

  return <LeadsPanel leads={leads} calls={calls} businessType={client?.business_type ?? undefined} />
}
