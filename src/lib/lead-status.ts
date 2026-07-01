// ─── Derived lead status ─────────────────────────────────────────────────────
//
// A contact's conversion status is NOT stored in the database — it is derived on
// the fly from that contact's calls + appointments. This keeps the model free of
// schema migrations and always consistent with the underlying activity.
//
// A human-in-the-loop override lives in the existing `contacts.metadata` jsonb
// column (key: `lead_status_override`). When present and valid it wins over all
// derivation, letting the owner record things the automation can't know yet
// (e.g. "quote accepted verbally").

export type LeadStatus =
  | 'new'
  | 'engaged'
  | 'booked'
  | 'won'
  | 'lost'
  | 'reactivated'

export const LEAD_STATUSES: LeadStatus[] = [
  'new',
  'engaged',
  'booked',
  'won',
  'lost',
  'reactivated',
]

// ── Tunable thresholds ───────────────────────────────────────────────────────
// Surfaced here so the verification step can sanity-check and adjust them.

// Gap between an early call and a later one that marks the contact as "dormant".
const DORMANCY_DAYS = 30
// A call within this window counts as a "recent" interaction.
const RECENT_DAYS = 14
// Dead-end-only contacts older than this with no appointment are "lost".
const LOST_DAYS = 14

const DAY_MS = 24 * 60 * 60 * 1000

// Call outcomes that signal active interest.
const ENGAGED_OUTCOMES = new Set(['booked', 'follow_up_needed'])
// Call outcomes that signal a dead end (no engagement).
const DEAD_END_OUTCOMES = new Set(['voicemail', 'hung_up', 'info_only'])

// ── Minimal input shapes ─────────────────────────────────────────────────────

export interface StatusCall {
  started_at: string
  outcome?: string | null
}

export interface StatusAppointment {
  status?: string | null
}

// SMS threads aren't part of the calls/appointments inputs, so callers that know
// about them pass the signal here (a "two-way" thread = at least one inbound and
// one outbound message with this contact).
export interface DeriveOptions {
  hasTwoWaySms?: boolean
  now?: number
}

// ── Badge config ─────────────────────────────────────────────────────────────
// Reuses the badge-color patterns already used on the contacts page
// (`bg-*-500/15 text-*-400 border-*-500/20`), aligned with appointment colors:
// confirmed → emerald, completed → sky.

export const LEAD_STATUS_CONFIG: Record<LeadStatus, { label: string; className: string }> = {
  new:         { label: 'New',         className: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20' },
  engaged:     { label: 'Engaged',     className: 'bg-amber-500/15 text-amber-400 border-amber-500/20' },
  booked:      { label: 'Booked',      className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
  won:         { label: 'Won',         className: 'bg-sky-500/15 text-sky-400 border-sky-500/20' },
  lost:        { label: 'Lost',        className: 'bg-red-500/15 text-red-400 border-red-500/20' },
  reactivated: { label: 'Reactivated', className: 'bg-violet-500/15 text-violet-400 border-violet-500/20' },
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isLeadStatus(v: unknown): v is LeadStatus {
  return typeof v === 'string' && (LEAD_STATUSES as string[]).includes(v)
}

// Pull a valid override out of the metadata jsonb, if any.
function readOverride(metadata: Record<string, unknown> | null | undefined): LeadStatus | null {
  const raw = metadata?.lead_status_override
  return isLeadStatus(raw) ? raw : null
}

// ── Core derivation ──────────────────────────────────────────────────────────

// Rules are evaluated in priority order; the first match wins.
export function deriveLeadStatus(
  calls: StatusCall[] | null | undefined,
  appointments: StatusAppointment[] | null | undefined,
  metadata: Record<string, unknown> | null | undefined,
  opts: DeriveOptions = {},
): LeadStatus {
  // Human override beats everything.
  const override = readOverride(metadata)
  if (override) return override

  const now = opts.now ?? Date.now()
  const appts = appointments ?? []
  // Sort calls oldest → newest so gap analysis is straightforward.
  const sortedCalls = [...(calls ?? [])]
    .filter((c) => c && c.started_at)
    .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime())

  // "No appointment" in the engaged/lost rules means no *live* booking —
  // cancelled / no_show appointments are dead ends, not a reason to treat a
  // contact who booked-then-cancelled as brand new. (After rules 1–2 return,
  // this is always false, but it keeps the intent explicit.)
  const hasLiveAppointment = appts.some(
    (a) => a.status === 'confirmed' || a.status === 'completed',
  )

  // 1. Any completed appointment → won.
  if (appts.some((a) => a.status === 'completed')) return 'won'

  // 2. Any confirmed appointment → booked.
  if (appts.some((a) => a.status === 'confirmed')) return 'booked'

  // 3. Dormant gap that has since re-engaged → reactivated.
  //    The most recent call is recent AND the gap before it exceeds the
  //    dormancy window (an earlier call, then a long silence, now activity).
  if (sortedCalls.length >= 2) {
    const last = new Date(sortedCalls[sortedCalls.length - 1].started_at).getTime()
    const prev = new Date(sortedCalls[sortedCalls.length - 2].started_at).getTime()
    const lastIsRecent = now - last <= RECENT_DAYS * DAY_MS
    const gapIsDormant = last - prev > DORMANCY_DAYS * DAY_MS
    if (lastIsRecent && gapIsDormant) return 'reactivated'
  }

  // 4. Active interest (engaging call outcome or a two-way SMS thread) with no
  //    appointment yet → engaged.
  const hasEngagedCall = sortedCalls.some((c) => ENGAGED_OUTCOMES.has(c.outcome ?? ''))
  if (!hasLiveAppointment && (hasEngagedCall || opts.hasTwoWaySms)) return 'engaged'

  // 5. Only dead-end calls, all older than the lost window, no appointment → lost.
  if (!hasLiveAppointment && sortedCalls.length > 0) {
    const allDeadEnd = sortedCalls.every((c) => DEAD_END_OUTCOMES.has(c.outcome ?? ''))
    const newest = new Date(sortedCalls[sortedCalls.length - 1].started_at).getTime()
    const isStale = now - newest > LOST_DAYS * DAY_MS
    if (allDeadEnd && isStale) return 'lost'
  }

  // 6. Nothing else matched.
  return 'new'
}
