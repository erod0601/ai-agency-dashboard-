import { createClient } from '@/lib/supabase/server'

export default async function TestPage() {
  const supabase = await createClient()
  const { data: clients, error } = await supabase.from('clients').select('*')

  if (error) {
    return (
      <main className="p-8">
        <h1 className="text-xl font-bold mb-4">Supabase Connection Test</h1>
        <div className="rounded bg-red-50 border border-red-200 p-4 text-red-700">
          <p className="font-semibold">Error fetching clients:</p>
          <pre className="mt-2 text-sm whitespace-pre-wrap">{error.message}</pre>
          {!process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('https') && (
            <p className="mt-3 text-sm">
              Hint: Make sure you&apos;ve set real values in <code>.env.local</code>.
            </p>
          )}
        </div>
      </main>
    )
  }

  return (
    <main className="p-8">
      <h1 className="text-xl font-bold mb-4">Supabase Connection Test</h1>
      <p className="mb-4 text-green-700 font-medium">
        ✓ Connected — {clients?.length ?? 0} client(s) found
      </p>
      {clients && clients.length > 0 ? (
        <ul className="space-y-2">
          {clients.map((client: Record<string, unknown>) => (
            <li
              key={String(client.id)}
              className="rounded border p-3 text-sm font-mono"
            >
              <pre>{JSON.stringify(client, null, 2)}</pre>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-500 text-sm">
          No rows in the clients table yet — but the connection works.
        </p>
      )}
    </main>
  )
}
