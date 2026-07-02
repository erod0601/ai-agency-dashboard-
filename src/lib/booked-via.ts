// ── Booked-via breakdown ──────────────────────────────────────────────────────
// How appointments actually get onto the calendar: booked live on an AI call
// (call_id), over an AI SMS thread (conversation_id), or entered by hand
// (neither). Direct proof the Operate pillar is doing real scheduling work.

const DAY_MS = 24 * 60 * 60 * 1000

// On-the-books tiers, consistent with the revenue split — 'booked' and
// 'confirmed' are the same tier in this schema.
const COUNTED_STATUSES = new Set(['confirmed', 'completed', 'booked'])

export type BookedVia = 'call' | 'sms' | 'manual'

export interface BookedViaAppointment {
  status: string | null
  call_id?: string | null
  conversation_id?: string | null
  created_at?: string | null
  scheduled_at?: string | null
}

export interface BookedViaSlice {
  key: BookedVia
  /** client-facing label — the raw 'unknown' provenance never reaches the UI */
  label: string
  count: number
  /** whole-number percentage; slices always sum to 100 when total > 0 */
  pct: number
}

export function bookedVia(a: Pick<BookedViaAppointment, 'call_id' | 'conversation_id'>): BookedVia {
  if (a.call_id) return 'call'
  if (a.conversation_id) return 'sms'
  return 'manual'
}

const LABELS: Record<BookedVia, string> = {
  call: 'AI — phone call',
  sms: 'AI — text thread',
  manual: 'Manual / Other',
}

/**
 * Counts + percentages of confirmed/completed appointments by booking
 * channel over the trailing window (0 disables windowing). Percentages are
 * largest-remainder rounded so they sum to exactly 100.
 */
export function computeBookedViaBreakdown(
  appointments: BookedViaAppointment[],
  windowDays = 30,
  now: Date = new Date()
): BookedViaSlice[] {
  const windowStart = now.getTime() - windowDays * DAY_MS
  const counts: Record<BookedVia, number> = { call: 0, sms: 0, manual: 0 }

  for (const a of appointments) {
    if (!(a.status != null && COUNTED_STATUSES.has(a.status))) continue
    if (windowDays > 0) {
      const stamp = a.created_at ?? a.scheduled_at
      if (!stamp) continue
      const t = new Date(stamp).getTime()
      if (!Number.isFinite(t) || t < windowStart) continue
    }
    counts[bookedVia(a)]++
  }

  const total = counts.call + counts.sms + counts.manual
  const keys: BookedVia[] = ['call', 'sms', 'manual']
  if (total === 0) {
    return keys.map(key => ({ key, label: LABELS[key], count: 0, pct: 0 }))
  }

  // largest-remainder rounding → percentages sum to exactly 100
  const exact = keys.map(key => (counts[key] / total) * 100)
  const floors = exact.map(Math.floor)
  let leftover = 100 - floors.reduce((s, f) => s + f, 0)
  const order = keys
    .map((_, i) => i)
    .sort((a, b) => (exact[b] - floors[b]) - (exact[a] - floors[a]))
  for (const idx of order) {
    if (leftover <= 0) break
    floors[idx]++
    leftover--
  }

  return keys.map((key, i) => ({ key, label: LABELS[key], count: counts[key], pct: floors[i] }))
}
