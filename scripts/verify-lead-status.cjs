/* Local verification for the derived lead-status + revenue layer.
 *
 * Runs the real derivation against a client's live Supabase data and prints the
 * status distribution + estimated revenue, so the DORMANCY_DAYS (30) and
 * LOST_DAYS (14) thresholds can be sanity-checked and tuned.
 *
 * This is a dev utility — it is NOT imported by the app. The logic below mirrors
 * src/lib/lead-status.ts and src/lib/revenue.ts; if you change those, update here.
 *
 * Usage (from the repo root, where node_modules/@supabase is available):
 *
 *   # macOS / Linux
 *   SUPABASE_URL=https://xxxx.supabase.co SUPABASE_KEY=<service_role_key> \
 *     node scripts/verify-lead-status.cjs
 *
 *   # Windows (cmd)
 *   set SUPABASE_URL=https://xxxx.supabase.co
 *   set SUPABASE_KEY=<service_role_key>
 *   node scripts/verify-lead-status.cjs
 *
 * Use the service_role key (Project Settings -> API) so it can read past RLS.
 * It is read from the environment only — never commit a key into this file.
 * Optionally set CLIENT_ID to target a different client (defaults to Acme HVAC).
 */
const { createClient } = require('@supabase/supabase-js')

const CLIENT_ID = process.env.CLIENT_ID || '8e729b01-3228-4d79-9634-dbc556d883b7' // Acme HVAC
const URL = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_KEY

if (!URL || !KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY env vars. See the header of this file.')
  process.exit(2)
}

// ── Mirror of src/lib/revenue.ts ─────────────────────────────────────────────
const DEFAULT_AVG_TICKET = 350
const REVENUE_STATUSES = new Set(['confirmed', 'completed'])

function getAvgTicket(settings) {
  const v = settings && settings.avg_ticket_value
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : DEFAULT_AVG_TICKET
}
function appointmentValue(appt, avgTicket) {
  const raw = appt.estimated_value
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) return raw
  return avgTicket
}
function estimateContactRevenue(_contact, appointments, avgTicket) {
  const safeAvg = Number.isFinite(avgTicket) && avgTicket >= 0 ? avgTicket : DEFAULT_AVG_TICKET
  let realized = 0, pipeline = 0
  for (const appt of appointments || []) {
    const status = appt.status || ''
    if (!REVENUE_STATUSES.has(status)) continue
    const value = appointmentValue(appt, safeAvg)
    if (status === 'completed') realized += value
    else pipeline += value
  }
  return { realized, pipeline }
}
function estimateClientRevenue30d(appointments, avgTicket, now = Date.now()) {
  const cutoff = now - 30 * 24 * 60 * 60 * 1000
  const recent = (appointments || []).filter((a) => {
    const stamp = a.created_at || a.scheduled_at
    if (!stamp) return false
    const t = new Date(stamp).getTime()
    return Number.isFinite(t) && t >= cutoff
  })
  return estimateContactRevenue(null, recent, avgTicket)
}

// ── Mirror of src/lib/lead-status.ts ─────────────────────────────────────────
const LEAD_STATUSES = ['new', 'engaged', 'booked', 'won', 'lost', 'reactivated']
const DORMANCY_DAYS = 30, RECENT_DAYS = 14, LOST_DAYS = 14
const DAY_MS = 24 * 60 * 60 * 1000
const ENGAGED_OUTCOMES = new Set(['booked', 'follow_up_needed'])
const DEAD_END_OUTCOMES = new Set(['voicemail', 'hung_up', 'info_only'])

function deriveLeadStatus(calls, appointments, metadata, opts = {}) {
  const rawOverride = metadata && metadata.lead_status_override
  if (typeof rawOverride === 'string' && LEAD_STATUSES.includes(rawOverride)) return rawOverride

  const now = opts.now || Date.now()
  const appts = appointments || []
  const sortedCalls = [...(calls || [])]
    .filter((c) => c && c.started_at)
    .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime())

  const hasLiveAppointment = appts.some((a) => a.status === 'confirmed' || a.status === 'completed')

  if (appts.some((a) => a.status === 'completed')) return 'won'
  if (appts.some((a) => a.status === 'confirmed')) return 'booked'

  if (sortedCalls.length >= 2) {
    const last = new Date(sortedCalls[sortedCalls.length - 1].started_at).getTime()
    const prev = new Date(sortedCalls[sortedCalls.length - 2].started_at).getTime()
    if (now - last <= RECENT_DAYS * DAY_MS && last - prev > DORMANCY_DAYS * DAY_MS) return 'reactivated'
  }

  const hasEngagedCall = sortedCalls.some((c) => ENGAGED_OUTCOMES.has(c.outcome || ''))
  if (!hasLiveAppointment && (hasEngagedCall || opts.hasTwoWaySms)) return 'engaged'

  if (!hasLiveAppointment && sortedCalls.length > 0) {
    const allDeadEnd = sortedCalls.every((c) => DEAD_END_OUTCOMES.has(c.outcome || ''))
    const newest = new Date(sortedCalls[sortedCalls.length - 1].started_at).getTime()
    if (allDeadEnd && now - newest > LOST_DAYS * DAY_MS) return 'lost'
  }
  return 'new'
}

// ── Runner ───────────────────────────────────────────────────────────────────
const sb = createClient(URL, KEY, { auth: { persistSession: false } })
const fmt = (n) => '$' + Math.round(n).toLocaleString()
function groupBy(rows, key) {
  const m = new Map()
  for (const r of rows) { const k = r[key]; if (!k) continue; if (!m.has(k)) m.set(k, []); m.get(k).push(r) }
  return m
}

async function main() {
  const [settingsRes, contactsRes, callsRes, apptsRes, threadsRes] = await Promise.all([
    sb.from('client_settings').select('avg_ticket_value').eq('client_id', CLIENT_ID).maybeSingle(),
    sb.from('contacts').select('id, phone, full_name, metadata').eq('client_id', CLIENT_ID),
    sb.from('calls').select('contact_id, started_at, outcome').eq('client_id', CLIENT_ID),
    sb.from('appointments').select('contact_id, status, estimated_value, scheduled_at, created_at').eq('client_id', CLIENT_ID),
    sb.from('message_threads').select('contact_phone').eq('client_id', CLIENT_ID),
  ])
  for (const [label, res] of [['client_settings', settingsRes], ['contacts', contactsRes], ['calls', callsRes], ['appointments', apptsRes], ['message_threads', threadsRes]]) {
    if (res.error) console.warn(`  ! ${label}: ${res.error.message}`)
  }

  const avgTicket = getAvgTicket(settingsRes.data)
  const contacts = contactsRes.data || []
  const calls = callsRes.data || []
  const appts = apptsRes.data || []
  const smsPhones = new Set((threadsRes.data || []).map((t) => t.contact_phone).filter(Boolean))
  const callsByContact = groupBy(calls, 'contact_id')
  const apptsByContact = groupBy(appts, 'contact_id')

  console.log(`\n=== Client ${CLIENT_ID} ===`)
  console.log(`avg_ticket_value setting: ${settingsRes.data?.avg_ticket_value ?? 'null'} -> getAvgTicket = ${fmt(avgTicket)}`)
  console.log(`contacts=${contacts.length} calls=${calls.length} appointments=${appts.length} sms_threads=${smsPhones.size}`)

  const dist = Object.fromEntries(LEAD_STATUSES.map((s) => [s, 0]))
  let overrides = 0, smsPromotable = 0, errors = 0
  for (const c of contacts) {
    const cCalls = callsByContact.get(c.id) || []
    const cAppts = apptsByContact.get(c.id) || []
    const hasTwoWaySms = c.phone ? smsPhones.has(c.phone) : false
    try {
      const status = deriveLeadStatus(cCalls, cAppts, c.metadata, { hasTwoWaySms })
      if (!LEAD_STATUSES.includes(status)) { console.warn(`  ! invalid status "${status}" for ${c.id}`); errors++; continue }
      dist[status]++
      if (c.metadata && c.metadata.lead_status_override) overrides++
      if (hasTwoWaySms && deriveLeadStatus(cCalls, cAppts, c.metadata, { hasTwoWaySms: false }) !== status) smsPromotable++
    } catch (e) { console.warn(`  ! deriveLeadStatus threw for ${c.id}: ${e.message}`); errors++ }
  }

  console.log('\n=== Lead status distribution ===')
  const total = contacts.length || 1
  for (const s of LEAD_STATUSES) {
    console.log(`  ${s.padEnd(12)} ${String(dist[s]).padStart(4)}  ${((dist[s] / total) * 100).toFixed(1).padStart(5)}%`)
  }
  console.log(`  ${'(overrides)'.padEnd(12)} ${String(overrides).padStart(4)}   metadata.lead_status_override in effect`)
  console.log(`  ${'(sms-eng)'.padEnd(12)} ${String(smsPromotable).padStart(4)}   'engaged' only because of a two-way SMS thread`)

  const client30 = estimateClientRevenue30d(appts, avgTicket)
  let sumRealized = 0, sumPipeline = 0, bad = 0
  for (const c of contacts) {
    const r = estimateContactRevenue(c, apptsByContact.get(c.id) || [], avgTicket)
    if (![r.realized, r.pipeline].every((n) => Number.isFinite(n) && n >= 0)) bad++
    sumRealized += r.realized; sumPipeline += r.pipeline
  }
  console.log('\n=== Revenue (estimated) ===')
  console.log(`  Per-contact sum:  realized=${fmt(sumRealized)}  pipeline=${fmt(sumPipeline)}`)
  console.log(`  Trailing 30d:     realized=${fmt(client30.realized)}  pipeline=${fmt(client30.pipeline)}`)
  console.log(`  NaN/negative values: ${bad === 0 ? 'none ✓' : bad + ' ✗'}`)
  console.log(`\n${errors === 0 && bad === 0 ? '✅ Derivation ran clean across all contacts' : '❌ ' + (errors + bad) + ' issue(s)'}`)
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
