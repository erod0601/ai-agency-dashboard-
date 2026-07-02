// ── Derived lead status ───────────────────────────────────────────────────────
// There is intentionally NO stored lead_status column. Status is computed from
// a contact's calls + appointments at read time, so it can never drift from
// the underlying activity. The only persisted input is the human-in-the-loop
// override in contacts.metadata.lead_status_override (existing jsonb column —
// no migration), which lets the owner mark e.g. "quote accepted verbally"
// before the automation can know.

export type LeadStatus = 'new' | 'engaged' | 'booked' | 'won' | 'lost' | 'reactivated'

const LEAD_STATUSES: readonly LeadStatus[] = ['new', 'engaged', 'booked', 'won', 'lost', 'reactivated']

// Tunable thresholds — surfaced as exports so the funnel brief can adjust
// them after sanity-checking real status distributions.
export const DORMANCY_GAP_DAYS = 30 // gap between calls that counts as "went dormant"
export const LOST_WINDOW_DAYS = 14  // dead-end calls older than this → lost
export const RECENT_DAYS = 30       // how fresh the post-gap interaction must be for "reactivated"

const DAY_MS = 24 * 60 * 60 * 1000

// Call outcomes that signal active interest.
const ENGAGED_OUTCOMES = new Set(['booked', 'follow_up_needed'])
// Dead-end outcomes: on their own they never make a contact "engaged".
const DEAD_END_OUTCOMES = new Set(['voicemail', 'hung_up', 'no_answer', 'info_only'])

// Minimal input shapes so the helper works with LeadCall, RecentCall, or any
// query subset that carries these fields.
export interface StatusCall {
  started_at: string
  outcome: string | null
}
export interface StatusAppointment {
  status: string | null // confirmed | cancelled | completed | no_show
}

export interface DeriveLeadStatusOptions {
  /** True when the contact has an SMS thread with at least one inbound AND one outbound message. */
  hasTwoWaySms?: boolean
  /** Injectable clock for tests / deterministic verification. */
  now?: Date
}

/**
 * Derivation rules, first match wins:
 *  1. any completed appointment                                    → won
 *  2. any confirmed appointment                                    → booked
 *  3. dormant gap (>30d between calls) then a recent engaged call  → reactivated
 *  4. engaged call outcome OR two-way SMS                          → engaged
 *  5. only dead-end calls, all older than 14 days                  → lost
 *  6. otherwise                                                    → new
 *
 * Note on "no appointment" in rules 4/5: cancelled and no_show appointments
 * are treated as inactive — they were already passed over by rules 1–2 and do
 * not block or demote engagement (a contact who cancelled but keeps calling
 * is engaged, not new).
 */
export function deriveLeadStatus(
  calls: StatusCall[],
  appointments: StatusAppointment[],
  metadata: Record<string, unknown> | null | undefined,
  options: DeriveLeadStatusOptions = {}
): LeadStatus {
  // Human override wins over all derivation.
  const override = metadata?.lead_status_override
  if (typeof override === 'string' && (LEAD_STATUSES as readonly string[]).includes(override)) {
    return override as LeadStatus
  }

  // 1 & 2 — appointment-driven states. Live data uses both 'confirmed' and
  // 'booked' for an appointment that's on the books.
  if (appointments.some(a => a.status === 'completed')) return 'won'
  if (appointments.some(a => a.status === 'confirmed' || a.status === 'booked')) return 'booked'

  const now = (options.now ?? new Date()).getTime()
  const sorted = [...calls]
    .map(c => ({ ...c, t: new Date(c.started_at).getTime() }))
    .filter(c => Number.isFinite(c.t))
    .sort((a, b) => a.t - b.t)
  const latest = sorted[sorted.length - 1]

  const latestIsEngaged =
    (latest?.outcome != null && ENGAGED_OUTCOMES.has(latest.outcome)) || options.hasTwoWaySms === true

  // 3 — reactivated: went dormant (>30d between consecutive calls), and the
  // interaction after the gap is recent and engaged.
  if (latest && latestIsEngaged && now - latest.t <= RECENT_DAYS * DAY_MS) {
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].t - sorted[i - 1].t > DORMANCY_GAP_DAYS * DAY_MS) return 'reactivated'
    }
  }

  // 4 — engaged: any interested call, or a real two-way SMS conversation.
  if (calls.some(c => c.outcome != null && ENGAGED_OUTCOMES.has(c.outcome))) return 'engaged'
  if (options.hasTwoWaySms) return 'engaged'

  // 5 — lost: nothing but dead ends, and the trail has gone cold.
  if (
    sorted.length > 0 &&
    sorted.every(c => c.outcome != null && DEAD_END_OUTCOMES.has(c.outcome)) &&
    now - (latest?.t ?? 0) > LOST_WINDOW_DAYS * DAY_MS
  ) {
    return 'lost'
  }

  // 6 — new: recent activity that hasn't resolved into anything yet.
  return 'new'
}

// ── Client-wide distribution ──────────────────────────────────────────────────
// Groups raw funnel inputs by contact and runs the derivation over each one.
// Shared by the Analytics funnel and the ROI report so they can never
// disagree. Also returns which contacts derived as reactivated — the
// reactivation callout values them individually.

export interface StatusDistributionInputs {
  contacts: Array<{ id: string; metadata: Record<string, unknown> | null }>
  calls: Array<{ contact_id: string | null; started_at: string; outcome: string | null }>
  appointments: Array<{ contact_id: string | null; status: string | null }>
  twoWaySmsContactIds: Set<string>
}

export function computeStatusDistribution(inputs: StatusDistributionInputs): {
  distribution: Record<LeadStatus, number>
  reactivatedIds: string[]
} {
  const callsByContact = new Map<string, StatusDistributionInputs['calls']>()
  for (const c of inputs.calls) {
    if (!c.contact_id) continue
    const arr = callsByContact.get(c.contact_id)
    if (arr) arr.push(c)
    else callsByContact.set(c.contact_id, [c])
  }
  const apptsByContact = new Map<string, StatusDistributionInputs['appointments']>()
  for (const a of inputs.appointments) {
    if (!a.contact_id) continue
    const arr = apptsByContact.get(a.contact_id)
    if (arr) arr.push(a)
    else apptsByContact.set(a.contact_id, [a])
  }

  const distribution: Record<LeadStatus, number> = {
    new: 0, engaged: 0, booked: 0, won: 0, lost: 0, reactivated: 0,
  }
  const reactivatedIds: string[] = []
  for (const contact of inputs.contacts) {
    const status = deriveLeadStatus(
      callsByContact.get(contact.id) ?? [],
      apptsByContact.get(contact.id) ?? [],
      contact.metadata,
      { hasTwoWaySms: inputs.twoWaySmsContactIds.has(contact.id) }
    )
    distribution[status]++
    if (status === 'reactivated') reactivatedIds.push(contact.id)
  }
  return { distribution, reactivatedIds }
}

// Badge styling per status — same accent-palette pattern as the outcome and
// sentiment badges in contacts/page.tsx and LeadsPanel.tsx (light + dark).
export const LEAD_STATUS_CONFIG: Record<LeadStatus, { label: string; className: string }> = {
  new: {
    label: 'New',
    className: 'bg-muted text-muted-foreground border-border',
  },
  engaged: {
    label: 'Engaged',
    className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900',
  },
  booked: {
    label: 'Booked',
    className: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-900',
  },
  won: {
    label: 'Won',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900',
  },
  lost: {
    label: 'Lost',
    className: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900',
  },
  reactivated: {
    label: 'Reactivated',
    className: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-900',
  },
}
