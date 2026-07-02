// ── Revenue estimation ────────────────────────────────────────────────────────
// Single source of truth for revenue math. Nothing outside this file should
// hardcode dollar amounts or re-implement the realized/pipeline split.
//
// UI labeling rule: every number derived from these helpers must be prefixed
// "Est." in the UI, UNLESS it comes from a completed appointment carrying a
// real estimated_value (see hasExactValue).

import type { ClientSettings } from '@/types/database'

// HVAC placeholder default. Always fall back so the dashboard shows honest
// estimates before the owner provides their real number in Settings.
export const DEFAULT_AVG_TICKET = 350

const DAY_MS = 24 * 60 * 60 * 1000
const REVENUE_WINDOW_DAYS = 30

// Statuses that count toward revenue. cancelled / no_show are excluded.
// Live data carries both 'confirmed' and 'booked' for on-the-books
// appointments, so both count as pipeline.
const REALIZED_STATUS = 'completed'
const PIPELINE_STATUSES = new Set(['confirmed', 'booked'])

export interface RevenueEstimate {
  /** Sum over completed appointments — money (estimated to be) collected. */
  realized: number
  /** Sum over confirmed appointments — money on the books, not yet collected. */
  pipeline: number
}

// Minimal shape so helpers accept both full Appointment rows and lighter
// query results (e.g. a select of just status/estimated_value/scheduled_at).
export interface RevenueAppointment {
  status: string | null
  estimated_value: number | null
  scheduled_at?: string | null
  created_at?: string | null
  contact_id?: string | null
}

/** The client's average ticket value, falling back to the placeholder default. */
export function getAvgTicket(
  settings: Pick<ClientSettings, 'avg_ticket_value'> | null | undefined
): number {
  const v = settings?.avg_ticket_value
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : DEFAULT_AVG_TICKET
}

/** Dollar value of a single appointment: its real estimated_value if set, else the avg ticket. */
export function appointmentValue(appointment: RevenueAppointment, avgTicket: number): number {
  const v = appointment.estimated_value
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : avgTicket
}

/**
 * True when the number is a real recorded value rather than an estimate —
 * a completed appointment carrying its own estimated_value. Only these may
 * be shown without the "Est." prefix.
 */
export function hasExactValue(appointment: RevenueAppointment): boolean {
  return (
    appointment.status === REALIZED_STATUS &&
    typeof appointment.estimated_value === 'number' &&
    Number.isFinite(appointment.estimated_value)
  )
}

function sumRevenue(appointments: RevenueAppointment[], avgTicket: number): RevenueEstimate {
  let realized = 0
  let pipeline = 0
  for (const a of appointments) {
    if (a.status === REALIZED_STATUS) realized += appointmentValue(a, avgTicket)
    else if (a.status != null && PIPELINE_STATUSES.has(a.status)) pipeline += appointmentValue(a, avgTicket)
    // cancelled / no_show / null → contributes nothing
  }
  return { realized, pipeline }
}

/**
 * Revenue attributable to a single contact. `appointments` may be the
 * client-wide list — rows are filtered to the contact before summing.
 */
export function estimateContactRevenue(
  contact: { id: string },
  appointments: RevenueAppointment[],
  avgTicket: number
): RevenueEstimate {
  const own = appointments.filter(
    a => a.contact_id === undefined || a.contact_id === contact.id
  )
  return sumRevenue(own, avgTicket)
}

/**
 * Client-wide revenue over the trailing 30 days — "what did the AI book this
 * month". Windowed on created_at (when the booking entered the system),
 * falling back to scheduled_at, so a confirmed appointment scheduled for a
 * future date still counts toward pipeline. Appointments without either
 * timestamp are skipped (can't be windowed honestly).
 */
export function estimateClientRevenue30d(
  appointments: RevenueAppointment[],
  avgTicket: number,
  now: Date = new Date()
): RevenueEstimate {
  const windowStart = now.getTime() - REVENUE_WINDOW_DAYS * DAY_MS
  const windowed = appointments.filter(a => {
    const stamp = a.created_at ?? a.scheduled_at
    if (!stamp) return false
    const t = new Date(stamp).getTime()
    return Number.isFinite(t) && t >= windowStart
  })
  return sumRevenue(windowed, avgTicket)
}

/**
 * Cumulative realized revenue since the client's value-story baseline —
 * "total revenue recovered since onboarding". Only completed appointments
 * count (pipeline is a This-Month concept), windowed from `baselineDate`
 * (client_settings.baseline_locked_at, falling back to clients.created_at)
 * with no upper bound and no reset — this number only ever goes up.
 */
export function estimateCumulativeRevenue(
  appointments: RevenueAppointment[],
  avgTicket: number,
  baselineDate: Date
): number {
  const baselineMs = baselineDate.getTime()
  let realized = 0
  for (const a of appointments) {
    if (a.status !== REALIZED_STATUS) continue
    const stamp = a.created_at ?? a.scheduled_at
    if (!stamp) continue
    const t = new Date(stamp).getTime()
    if (Number.isFinite(t) && t >= baselineMs) realized += appointmentValue(a, avgTicket)
  }
  return realized
}

// ── Answer-rate consistency streak ────────────────────────────────────────────
// The third value-story tile: how many consecutive calendar months the AI has
// kept the answer rate at or above the threshold. "Answered" means the call
// connected — voicemail and hang-ups-before-answer don't count.

export const ANSWER_RATE_THRESHOLD = 0.9

const UNANSWERED_OUTCOMES = new Set(['voicemail', 'hung_up'])

export interface AnswerRateStreak {
  /** number of calendar months that have at least one call */
  monthsOfData: number
  /** answer rate of the most recent month with calls (0–1), null if no calls */
  latestRate: number | null
  /** consecutive months at/above threshold, counting back from the present */
  streakMonths: number
}

export function computeAnswerRateStreak(
  calls: Array<{ started_at: string; outcome: string | null }>,
  threshold: number = ANSWER_RATE_THRESHOLD,
  now: Date = new Date()
): AnswerRateStreak {
  const byMonth = new Map<string, { total: number; answered: number }>()
  for (const c of calls) {
    const d = new Date(c.started_at)
    if (Number.isNaN(d.getTime())) continue
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const bucket = byMonth.get(key) ?? { total: 0, answered: 0 }
    bucket.total++
    if (!(c.outcome != null && UNANSWERED_OUTCOMES.has(c.outcome))) bucket.answered++
    byMonth.set(key, bucket)
  }

  const monthsOfData = byMonth.size
  const rateOf = (key: string) => {
    const b = byMonth.get(key)
    return b && b.total > 0 ? b.answered / b.total : null
  }

  // Walk backward month by month from the current one. The current (partial)
  // month doesn't break the streak while it's still in progress — it only
  // counts when it's already at/above threshold.
  const cursor = new Date(now.getFullYear(), now.getMonth(), 1)
  let streak = 0
  let latestRate: number | null = null
  for (let i = 0; i < 120 && streak < byMonth.size; i++) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
    const rate = rateOf(key)
    if (latestRate === null && rate !== null) latestRate = rate
    if (rate !== null && rate >= threshold) {
      streak++
    } else if (i === 0) {
      // current month missing or below threshold → still in progress, skip
    } else {
      break
    }
    cursor.setMonth(cursor.getMonth() - 1)
  }

  return { monthsOfData, latestRate, streakMonths: streak }
}

// ── Reactivation value ────────────────────────────────────────────────────────
// Forward-looking pipeline estimate ONLY — never overlaps the revenue tiles.
//
// A contact only derives as `reactivated` while it has NO counted appointment
// (the won/booked rules win otherwise), so each one is valued at the avg
// ticket: back in play, worth one typical job until it books. The moment it
// books, rule 2 flips it to `booked` — it leaves this card and its real
// dollars start counting in This Month / Since Onboarding instead.
//
// The one path to a reactivated contact WITH real appointment revenue is the
// metadata.lead_status_override escape hatch. Those dollars are already in
// the revenue tiles, so such a contact contributes $0 here — counting its
// appointments (or stacking avgTicket on top) would double-count.

export function computeReactivationValue(
  reactivatedContactIds: string[],
  appointments: RevenueAppointment[],
  avgTicket: number
): number {
  let total = 0
  for (const id of reactivatedContactIds) {
    const rev = estimateContactRevenue({ id }, appointments, avgTicket)
    if (rev.realized + rev.pipeline === 0) total += avgTicket
  }
  return total
}

// ── After-hours capture ───────────────────────────────────────────────────────
// "Calls the AI caught when a human receptionist wouldn't have been there."
// Counts only ANSWERED after-hours calls — a voicemail at 2am is a call that
// still went cold, not a capture win.

export interface AfterHoursStats {
  /** after-hours calls that actually connected */
  answeredAfterHours: number
  /** all calls in the window, for the share calculation */
  totalCalls: number
  /** whole-number % of total volume that was answered after hours */
  pctOfTotal: number
}

export function computeAfterHoursStats(
  calls: Array<{ started_at: string; outcome: string | null; after_hours: boolean | null }>,
  windowDays = 30,
  now: Date = new Date()
): AfterHoursStats {
  const windowStart = now.getTime() - windowDays * DAY_MS
  let answeredAfterHours = 0
  let totalCalls = 0
  for (const c of calls) {
    const t = new Date(c.started_at).getTime()
    if (!Number.isFinite(t) || t < windowStart) continue
    totalCalls++
    const answered = !(c.outcome != null && UNANSWERED_OUTCOMES.has(c.outcome))
    if (answered && c.after_hours === true) answeredAfterHours++
  }
  return {
    answeredAfterHours,
    totalCalls,
    pctOfTotal: totalCalls > 0 ? Math.round((answeredAfterHours / totalCalls) * 100) : 0,
  }
}

/** "$1,234" — shared money formatting so panels agree on presentation. */
export function formatMoney(amount: number): string {
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })
}

/** Prefix per the labeling rule: "Est. $1,234" unless the value is exact. */
export function formatRevenueLabel(amount: number, exact = false): string {
  return exact ? formatMoney(amount) : `Est. ${formatMoney(amount)}`
}
