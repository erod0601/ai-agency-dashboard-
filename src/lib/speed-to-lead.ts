// ── Speed to lead ─────────────────────────────────────────────────────────────
// Time from a missed inbound call to the first outbound follow-up (call or
// SMS) on the same contact. Instant beats human — this is the number that
// answers "we already have a receptionist."
//
// "Missed" means the call never connected: outcome voicemail or hung_up.
// After-hours calls the AI answered are deliberately NOT missed — the AI
// picked up; that's the capture pillar working, not a lead going cold.

const DAY_MS = 24 * 60 * 60 * 1000

// Call outcomes that mean the caller never got a conversation.
const MISSED_OUTCOMES = new Set(['voicemail', 'hung_up'])

export function isMissedCall(call: { outcome: string | null }): boolean {
  return call.outcome != null && MISSED_OUTCOMES.has(call.outcome)
}

/**
 * Delta in seconds from the earliest missed timestamp to the first outbound
 * event after it. Null when there's nothing missed or no follow-up yet.
 */
export function computeContactSpeedToLead(
  missedTimestamps: string[],
  outboundTimestamps: string[]
): number | null {
  const missedMs = missedTimestamps
    .map(t => new Date(t).getTime())
    .filter(Number.isFinite)
  if (missedMs.length === 0) return null
  const firstMissed = Math.min(...missedMs)

  let firstFollowUp = Infinity
  for (const t of outboundTimestamps) {
    const ms = new Date(t).getTime()
    if (Number.isFinite(ms) && ms > firstMissed && ms < firstFollowUp) firstFollowUp = ms
  }
  if (!Number.isFinite(firstFollowUp)) return null
  return Math.round((firstFollowUp - firstMissed) / 1000)
}

export interface SpeedToLeadInputs {
  /** inbound calls that never connected (voicemail / hung up) */
  missedCalls: Array<{ contact_id: string | null; started_at: string }>
  /** any outbound touch — call or SMS — keyed by contact */
  outboundEvents: Array<{ contact_id: string | null; ts: string }>
}

export interface SpeedToLeadResult {
  avgSeconds: number
  /** contacts with a missed call AND a follow-up (the ones averaged) */
  sampleSize: number
  /** contacts with a missed call still awaiting follow-up (omitted from avg) */
  excludedNoFollowUp: number
}

/**
 * Average speed-to-lead across contacts whose earliest missed call fell in
 * the trailing window. Contacts with no follow-up yet are excluded from the
 * average (an unresolved case shouldn't drag it toward infinity) and
 * reported via excludedNoFollowUp. Null when nothing in the window
 * qualifies.
 */
export function computeAvgSpeedToLead(
  inputs: SpeedToLeadInputs,
  windowDays = 30,
  now: Date = new Date()
): SpeedToLeadResult | null {
  const windowStart = now.getTime() - windowDays * DAY_MS

  const missedByContact = new Map<string, string[]>()
  for (const c of inputs.missedCalls) {
    if (!c.contact_id) continue
    const arr = missedByContact.get(c.contact_id)
    if (arr) arr.push(c.started_at)
    else missedByContact.set(c.contact_id, [c.started_at])
  }
  const outboundByContact = new Map<string, string[]>()
  for (const e of inputs.outboundEvents) {
    if (!e.contact_id) continue
    const arr = outboundByContact.get(e.contact_id)
    if (arr) arr.push(e.ts)
    else outboundByContact.set(e.contact_id, [e.ts])
  }

  let sum = 0
  let sampleSize = 0
  let excludedNoFollowUp = 0
  for (const [contactId, missed] of missedByContact) {
    // window on the contact's earliest miss — the moment the lead went cold
    const earliest = Math.min(...missed.map(t => new Date(t).getTime()).filter(Number.isFinite))
    if (!Number.isFinite(earliest) || earliest < windowStart) continue

    const delta = computeContactSpeedToLead(missed, outboundByContact.get(contactId) ?? [])
    if (delta === null) excludedNoFollowUp++
    else {
      sum += delta
      sampleSize++
    }
  }

  if (sampleSize === 0) return null
  return { avgSeconds: Math.round(sum / sampleSize), sampleSize, excludedNoFollowUp }
}

/** "47 sec" under 2 minutes, "12 min" under 2 hours, then "3.4 hr". */
export function formatSpeedToLead(seconds: number): string {
  if (seconds < 120) return `${seconds} sec`
  const minutes = seconds / 60
  if (minutes < 120) return `${Math.round(minutes)} min`
  return `${(minutes / 60).toFixed(1)} hr`
}
