import { cookies } from 'next/headers'
import { getAllClients, getClient } from './queries'
import { ACTIVE_CLIENT_COOKIE, DEFAULT_CLIENT_ID } from './active-client-constants'
import type { Client, Profile } from '@/types/database'

export interface ActiveClient {
  clientId: string | null
  client: Client | null
  clients: Client[]
}

// Single source of truth for which client's data a server page should show.
//
// Agency users: the activeClientId cookie (written by ClientProvider when the
// header switcher changes), validated against the accessible client list,
// falling back to the demo client, then the first accessible client.
// Client users: always their own client_id — the cookie is ignored.
export async function resolveActiveClient(profile: Profile): Promise<ActiveClient> {
  if (profile.role !== 'agency') {
    const client = profile.client_id ? await getClient(profile.client_id) : null
    return { clientId: profile.client_id ?? null, client, clients: [] }
  }

  const clients = await getAllClients()
  const saved = (await cookies()).get(ACTIVE_CLIENT_COOKIE)?.value

  const client =
    clients.find(c => c.id === saved) ??
    clients.find(c => c.id === DEFAULT_CLIENT_ID) ??
    clients[0] ??
    null

  return { clientId: client?.id ?? null, client, clients }
}
