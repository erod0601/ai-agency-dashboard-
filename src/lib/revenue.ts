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
