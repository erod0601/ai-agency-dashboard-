// Verification harness for the revenue + lead-status layer.
// Runs the REAL helpers from src/lib against feature signatures extracted
// from the live Glow Med Spa demo data (985 contacts), plus edge-case fixtures.
import {
  deriveLeadStatus,
  type StatusCall,
  type StatusAppointment,
  type LeadStatus,
} from '../src/lib/lead-status'
import {
  getAvgTicket,
  estimateContactRevenue,
  estimateClientRevenue30d,
  formatRevenueLabel,
  type RevenueAppointment,
} from '../src/lib/revenue'

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date('2026-07-02T03:11:45Z') // matches DB now() at extraction time

// ── Signature groups from SQL (group-by over all 985 contacts) ───────────────
// ageDays: representative age of latest call for its bucket (all were gt30 → 60d)
interface Sig {
  hasCompleted: boolean; hasActiveAppt: boolean; hasCalls: boolean; multiCall: boolean
  latestOutcome: string | null; ageDays: number | null
  anyEngaged: boolean; allDeadEnd: boolean; gap30: boolean; sms2: boolean
  override: string; n: number
}
const SIGS: Sig[] = [
  { hasCompleted: true,  hasActiveAppt: false, hasCalls: true, multiCall: false, latestOutcome: 'booked',           ageDays: 60, anyEngaged: true,  allDeadEnd: false, gap30: false, sms2: false, override: '', n: 198 },
  { hasCompleted: false, hasActiveAppt: true,  hasCalls: true, multiCall: false, latestOutcome: 'booked',           ageDays: 60, anyEngaged: true,  allDeadEnd: false, gap30: false, sms2: false, override: '', n: 174 },
  { hasCompleted: false, hasActiveAppt: false, hasCalls: true, multiCall: false, latestOutcome: 'hung_up',          ageDays: 60, anyEngaged: false, allDeadEnd: true,  gap30: false, sms2: false, override: '', n: 131 },
  { hasCompleted: false, hasActiveAppt: false, hasCalls: true, multiCall: false, latestOutcome: 'voicemail',        ageDays: 60, anyEngaged: false, allDeadEnd: true,  gap30: false, sms2: false, override: '', n: 128 },
  { hasCompleted: false, hasActiveAppt: false, hasCalls: true, multiCall: false, latestOutcome: 'booked',           ageDays: 60, anyEngaged: true,  allDeadEnd: false, gap30: false, sms2: false, override: '', n: 121 },
  { hasCompleted: false, hasActiveAppt: false, hasCalls: true, multiCall: false, latestOutcome: 'follow_up_needed', ageDays: 60, anyEngaged: true,  allDeadEnd: false, gap30: false, sms2: false, override: '', n: 118 },
  { hasCompleted: false, hasActiveAppt: false, hasCalls: true, multiCall: false, latestOutcome: 'info_only',        ageDays: 60, anyEngaged: false, allDeadEnd: true,  gap30: false, sms2: false, override: '', n: 110 },
  { hasCompleted: false, hasActiveAppt: false, hasCalls: true, multiCall: false, latestOutcome: 'voicemail',        ageDays: 60, anyEngaged: false, allDeadEnd: true,  gap30: false, sms2: true,  override: '', n: 3 },
  { hasCompleted: false, hasActiveAppt: true,  hasCalls: true, multiCall: false, latestOutcome: 'booked',           ageDays: 60, anyEngaged: true,  allDeadEnd: false, gap30: false, sms2: true,  override: '', n: 1 },
  { hasCompleted: true,  hasActiveAppt: false, hasCalls: true, multiCall: false, latestOutcome: 'booked',           ageDays: 60, anyEngaged: true,  allDeadEnd: false, gap30: false, sms2: true,  override: '', n: 1 },
]

function iso(daysAgo: number): string {
  return new Date(NOW.getTime() - daysAgo * DAY).toISOString()
}

// Reconstruct a representative contact for a signature. Every signature in the
// live data is single-call, so reconstruction is exact: one call carrying the
// latest outcome at the bucket's representative age.
function synthesize(s: Sig): { calls: StatusCall[]; appts: StatusAppointment[]; meta: Record<string, unknown> } {
  const calls: StatusCall[] = []
  if (s.hasCalls && s.latestOutcome && s.ageDays != null) {
    calls.push({ started_at: iso(s.ageDays), outcome: s.latestOutcome })
    if (s.gap30) calls.unshift({ started_at: iso(s.ageDays + 45), outcome: 'voicemail' })
  }
  const appts: StatusAppointment[] = []
  if (s.hasCompleted) appts.push({ status: 'completed' })
  if (s.hasActiveAppt) appts.push({ status: 'confirmed' })
  const meta: Record<string, unknown> = s.override ? { lead_status_override: s.override } : {}
  return { calls, appts, meta }
}

// ── 1. Status distribution over all 985 contacts ─────────────────────────────
const dist: Record<LeadStatus, number> = { new: 0, engaged: 0, booked: 0, won: 0, lost: 0, reactivated: 0 }
let total = 0
for (const s of SIGS) {
  const { calls, appts, meta } = synthesize(s)
  const status = deriveLeadStatus(calls, appts, meta, { hasTwoWaySms: s.sms2, now: NOW })
  dist[status] += s.n
  total += s.n
}
console.log('── Status distribution (Glow Med Spa, 985 contacts) ──')
console.log(JSON.stringify(dist), 'total =', total)
if (total !== 985) throw new Error('contact count mismatch')

// ── 2. Revenue helpers vs SQL ground truth ────────────────────────────────────
// Aggregates from SQL: every appointment carries estimated_value (no nulls).
// Linearity of summation → one synthetic appointment per status holding the
// status's total value gives the exact same helper output.
const APPT_AGGREGATES: Array<{ status: string; sum: number; n: number }> = [
  { status: 'completed', sum: 125747, n: 199 },
  { status: 'confirmed', sum: 70078,  n: 117 },
  { status: 'booked',    sum: 32172,  n: 58 },
  { status: 'cancelled', sum: 27157,  n: 50 },
  { status: 'no_show',   sum: 41927,  n: 71 },
]
const avgTicket = getAvgTicket({ avg_ticket_value: 450 })
console.log('\n── Revenue checks ──')
console.log('avgTicket(450 set) =', avgTicket, '| avgTicket(null) =', getAvgTicket({ avg_ticket_value: null }))

const allAppts: RevenueAppointment[] = APPT_AGGREGATES.map(a => ({
  status: a.status, estimated_value: a.sum, scheduled_at: iso(60), contact_id: 'x',
}))
const fullHistory = estimateContactRevenue({ id: 'x' }, allAppts, avgTicket)
console.log('full-history:', JSON.stringify(fullHistory),
  '| expect realized=125747 pipeline=102250')
if (fullHistory.realized !== 125747 || fullHistory.pipeline !== 102250) throw new Error('revenue mismatch')

// All real appointments are >30d old → the 30d window must return zeros.
const window30 = estimateClientRevenue30d(allAppts, avgTicket, NOW)
console.log('30d window (all appts 60d old):', JSON.stringify(window30), '| expect 0/0')
if (window30.realized !== 0 || window30.pipeline !== 0) throw new Error('30d window should be empty')

// Upcoming confirmed bookings count as pipeline even when scheduled in the future.
const future = estimateClientRevenue30d(
  [{ status: 'confirmed', estimated_value: 500, scheduled_at: iso(-10) }], avgTicket, NOW)
if (future.pipeline !== 500) throw new Error('future confirmed should be pipeline')
console.log('future confirmed appt → pipeline:', JSON.stringify(future))

// Guards: null value falls back to avgTicket; negatives/NaN can never leak.
const guards = estimateContactRevenue({ id: 'x' }, [
  { status: 'completed', estimated_value: null, contact_id: 'x' },
  { status: 'confirmed', estimated_value: -50,  contact_id: 'x' },
  { status: 'completed', estimated_value: NaN,  contact_id: 'x' },
  { status: 'cancelled', estimated_value: 9999, contact_id: 'x' },
  { status: 'no_show',   estimated_value: 9999, contact_id: 'x' },
], avgTicket)
console.log('guards (null/-50/NaN/cancelled/no_show @ 450):', JSON.stringify(guards),
  '| expect realized=900 pipeline=450')
if (!Number.isFinite(guards.realized) || !Number.isFinite(guards.pipeline)) throw new Error('NaN leaked')
if (guards.realized < 0 || guards.pipeline < 0) throw new Error('negative leaked')
if (guards.realized !== 900 || guards.pipeline !== 450) throw new Error('guard math wrong')
console.log('labels:', formatRevenueLabel(1234), '|', formatRevenueLabel(1234, true))

// ── 3. Edge-case fixtures for rules the live data never exercises ────────────
console.log('\n── Edge-case fixtures ──')
const cases: Array<[string, LeadStatus, LeadStatus]> = []
const t = (name: string, got: LeadStatus, want: LeadStatus) => cases.push([name, got, want])

t('override wins over completed appt',
  deriveLeadStatus([], [{ status: 'completed' }], { lead_status_override: 'lost' }, { now: NOW }), 'lost')
t('invalid override ignored',
  deriveLeadStatus([], [{ status: 'completed' }], { lead_status_override: 'bogus' }, { now: NOW }), 'won')
t('appointment status booked → booked',
  deriveLeadStatus([], [{ status: 'booked' }], null, { now: NOW }), 'booked')
t('cancelled appt does not block engaged',
  deriveLeadStatus([{ started_at: iso(5), outcome: 'follow_up_needed' }], [{ status: 'cancelled' }], null, { now: NOW }), 'engaged')
t('reactivated: 45d gap then recent engaged call',
  deriveLeadStatus([
    { started_at: iso(50), outcome: 'voicemail' },
    { started_at: iso(3),  outcome: 'follow_up_needed' },
  ], [], null, { now: NOW }), 'reactivated')
t('no reactivation when gap call is stale (40d old)',
  deriveLeadStatus([
    { started_at: iso(90), outcome: 'voicemail' },
    { started_at: iso(40), outcome: 'booked' },
  ], [], null, { now: NOW }), 'engaged')
t('two-way SMS alone → engaged',
  deriveLeadStatus([], [], null, { hasTwoWaySms: true, now: NOW }), 'engaged')
t('recent dead-end call (5d) → new, not lost',
  deriveLeadStatus([{ started_at: iso(5), outcome: 'voicemail' }], [], null, { now: NOW }), 'new')
t('dead-end call at 20d → lost',
  deriveLeadStatus([{ started_at: iso(20), outcome: 'hung_up' }], [], null, { now: NOW }), 'lost')
t('no activity at all → new',
  deriveLeadStatus([], [], null, { now: NOW }), 'new')

let failed = 0
for (const [name, got, want] of cases) {
  const ok = got === want
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (got ${got}, want ${want})`)
}
if (failed) throw new Error(`${failed} fixture(s) failed`)
console.log('\nALL CHECKS PASSED')
