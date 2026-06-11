import { createClient } from '@/lib/supabase/server'
import type { Client } from '@/types/database'

export default async function TestPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <main className="p-8">
        <h1 className="text-xl font-bold mb-4">Supabase Connection Test</h1>
        <p className="text-sm text-muted-foreground">
          Not signed in —{' '}
          <a href="/login" className="underline text-foreground">
            sign in
          </a>{' '}
          to test the authenticated connection.
        </p>
      </main>
    )
  }

  const { data: clientsData, error } = await supabase
    .from('clients')
    .select('*')

  const clients = clientsData as Client[] | null

  if (error) {
    return (
      <main className="p-8">
        <h1 className="text-xl font-bold mb-4">Supabase Connection Test</h1>
        <div className="rounded bg-red-50 border border-red-200 p-4 text-red-700">
          <p className="font-semibold">Error fetching clients:</p>
          <pre className="mt-2 text-sm whitespace-pre-wrap">{error.message}</pre>
        </div>
      </main>
    )
  }

  return (
    <main className="p-8">
      <h1 className="text-xl font-bold mb-4">Supabase Connection Test</h1>
      <p className="mb-1 text-green-700 font-medium">
        ✓ Connected as {user.email}
      </p>
      <p className="mb-4 text-sm text-muted-foreground">
        {clients?.length ?? 0} client(s) visible under your RLS policy
      </p>
      {clients && clients.length > 0 ? (
        <ul className="space-y-2">
          {clients.map((client) => (
            <li
              key={client.id}
              className="rounded border p-3 text-sm font-mono"
            >
              <pre>{JSON.stringify(client, null, 2)}</pre>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">
          No rows visible — check your RLS policies or add some clients.
        </p>
      )}
    </main>
  )
}
