// ─── Revenue estimation ──────────────────────────────────────────────────────
//
// Single source of truth for the dashboard's revenue math. Nothing outside this
// file should hardcode dollar amounts or the placeholder ticket value.
//
// UI labeling rule (enforced by callers, documented here): every number that
// flows out of these helpers must be prefixed "Est." in the UI, UNLESS it comes
// from a `completed` appointment that carries a real `estimated_value`. Use
// `isRealizedValue()` to check that condition per appointment.

// HVAC placeholder default — used until the owner enters their real average
// job value in Settings. Kept honest, not aspirational.
export const DEFAULT_AVG_TICKET = 350

// Appointment statuses that count toward pipeline (booked but not yet done).
// `booked` and `confirmed` are the same tier in this schema — see BookedPanel,
// which already treats them as equivalent "active" appointments.
const PIPELINE_STATUSES = new Set(['booked', 'confirmed'])
// Statuses that count toward revenue at all. `cancelled` / `no_show` never do.
const REVENUE_STATUSES = new Set(['booked', 'confirmed', 'completed'])

// Minimal shapes so these helpers stay decoupled from the full DB row types.
export interface RevenueSettings {
  avg_ticket_value?: number | null
}

export interface RevenueAppointment {
  status?: string | null
  estimated_value?: number | null
  // Date the appointment is booked for — used by the trailing-30d aggregate.
  scheduled_at?: string | null
  created_at?: string | null
}

export interface RevenueBreakdown {
  // Dollars from `completed` appointments (money that has been earned).
  realized: number
  // Dollars from `booked` / `confirmed` appointments (money booked but not yet earned).
  pipeline: number
}

// Always fall back to the placeholder so the dashboard shows an honest estimate
// before the owner provides their real number.
export function getAvgTicket(settings: RevenueSettings | null | undefined): number {
  const v = settings?.avg_ticket_value
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : DEFAULT_AVG_TICKET
}

// Value for a single appointment: its own `estimated_value` when set to a sane
// number, otherwise the client's average ticket. Guards against NaN/negatives.
function appointmentValue(appt: RevenueAppointment, avgTicket: number): number {
  const raw = appt.estimated_value
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) return raw
  return avgTicket
}

// True when an appointment's displayed number is a real (non-estimated) figure:
// a `completed` appointment carrying its own `estimated_value`. Callers use this
// to decide whether to drop the "Est." prefix.
export function isRealizedValue(appt: RevenueAppointment): boolean {
  const raw = appt.estimated_value
  return appt.status === 'completed' && typeof raw === 'number' && Number.isFinite(raw) && raw >= 0
}

// Split a contact's appointment revenue into realized (completed) vs pipeline
// (confirmed). `contact` is accepted for a stable call signature / future use
// even though the math only needs the appointments.
export function estimateContactRevenue(
  contact: unknown,
  appointments: RevenueAppointment[] | null | undefined,
  avgTicket: number,
): RevenueBreakdown {
  const safeAvg = Number.isFinite(avgTicket) && avgTicket >= 0 ? avgTicket : DEFAULT_AVG_TICKET
  let realized = 0
  let pipeline = 0

  for (const appt of appointments ?? []) {
    const status = appt.status ?? ''
    if (!REVENUE_STATUSES.has(status)) continue
    const value = appointmentValue(appt, safeAvg)
    if (status === 'completed') realized += value
    else if (PIPELINE_STATUSES.has(status)) pipeline += value
  }

  return { realized, pipeline }
}

// Same realized/pipeline split, aggregated across every appointment booked in
// the trailing 30 days. Keyed off `created_at` (when the appointment entered the
// system), falling back to `scheduled_at`. No upper bound, so a confirmed
// appointment scheduled for a future date still contributes to pipeline.
export function estimateClientRevenue30d(
  appointments: RevenueAppointment[] | null | undefined,
  avgTicket: number,
  now: number = Date.now(),
): RevenueBreakdown {
  const cutoff = now - 30 * 24 * 60 * 60 * 1000
  const recent = (appointments ?? []).filter((appt) => {
    const stamp = appt.created_at ?? appt.scheduled_at
    if (!stamp) return false
    const t = new Date(stamp).getTime()
    return Number.isFinite(t) && t >= cutoff
  })
  return estimateContactRevenue(null, recent, avgTicket)
}
