// Shared between server (active-client.ts) and client (client-context.tsx) code,
// so it must not import next/headers or anything client-only.

export const ACTIVE_CLIENT_COOKIE = 'activeClientId'

// Glow Med Spa (Demo) — the client shown when nothing has been selected yet
export const DEFAULT_CLIENT_ID = '04fb3e4a-7022-4c12-ac0b-230997d0e46b'
