import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { Profile, Client, ClientSettings, DailyCallMetric, RecentCall, CallOutcome, ServiceCount, MessageThread, Appointment, Lead, LeadCall } from '@/types/database'

// React.cache deduplicates calls with identical args within a single server render pass,
// so layout.tsx and page.tsx can call the same helpers without double-querying Supabase.

// ── Auth & profile ─────────────────────────────────────────────────────────

export const getCurrentUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})

export const getProfile = cache(async (userId: string): Promise<Profile | null> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, client_id, created_at')
    .eq('id', userId)
    .single()
  if (error) console.error('[getProfile]', error.message)
  return data as Profile | null
})

// ── Clients & settings ─────────────────────────────────────────────────────

export const getAllClients = cache(async (): Promise<Client[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('clients')
    .select('id, name, business_type, created_at')
    .order('name')
  if (error) console.error('[getAllClients]', error.message)
  return (data as Client[] | null) ?? []
})

export const getClient = cache(async (clientId: string): Promise<Client | null> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('clients')
    .select('id, name, business_type, created_at')
    .eq('id', clientId)
    .single()
  if (error) console.error('[getClient]', error.message)
  return data as Client | null
})

export const getClientSettings = cache(async (clientId: string): Promise<ClientSettings | null> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('client_settings')
    .select('client_id, primary_color, logo_url, display_name')
    .eq('client_id', clientId)
    .single()
  if (error) console.error('[getClientSettings]', error.message)
  return data as ClientSettings | null
})

export const getClientFull = cache(async (clientId: string): Promise<Client | null> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('clients')
    .select('id, name, business_type, timezone, created_at')
    .eq('id', clientId)
    .single()
  if (error) console.error('[getClientFull]', error.message)
  return data as Client | null
})

export const getClientSettingsFull = cache(async (clientId: string): Promise<ClientSettings | null> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('client_settings')
    .select('client_id, primary_color, logo_url, display_name, avg_ticket_value, crm_provider, crm_config')
    .eq('client_id', clientId)
    .single()
  if (error) console.error('[getClientSettingsFull]', error.message)
  return data as ClientSettings | null
})

// ── Dashboard metrics ──────────────────────────────────────────────────────

// Fetch 61 days so the page can compute current-30d vs prior-30d deltas from one call.
// View column is "day" (date_trunc('day', started_at) as day), NOT "date".
export const getDailyCallMetrics = cache(async (clientId: string): Promise<DailyCallMetric[]> => {
  const supabase = await createClient()
  const since = new Date()
  since.setDate(since.getDate() - 61)
  const { data, error } = await supabase
    .from('daily_call_metrics')
    .select('day, total_calls, after_hours_calls, booked_calls, voicemails, hangups, follow_ups, avg_duration_seconds, total_duration_seconds')
    .eq('client_id', clientId)
    .gte('day', since.toISOString().split('T')[0])
    .order('day', { ascending: true })
  if (error) console.error('[getDailyCallMetrics] client_id=%s error=%s', clientId, error.message)
  else console.log('[getDailyCallMetrics] client_id=%s rows=%d', clientId, data?.length ?? 0)
  return (data as DailyCallMetric[] | null) ?? []
})

// booking_conversion_30d columns: client_id, total_calls_30d, booked_30d, conversion_rate_pct
export const getBookingConversion30d = cache(async (clientId: string) => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('booking_conversion_30d')
    .select('conversion_rate_pct, total_calls_30d, booked_30d')
    .eq('client_id', clientId)
    .maybeSingle()
  if (error) console.error('[getBookingConversion30d] client_id=%s error=%s', clientId, error.message)
  else console.log('[getBookingConversion30d] client_id=%s data=%s', clientId, JSON.stringify(data))
  return data as { conversion_rate_pct: number; total_calls_30d: number; booked_30d: number } | null
})

// estimated_revenue_30d columns: client_id, bookings_30d, avg_ticket_value, estimated_revenue_30d
export const getEstimatedRevenue30d = cache(async (clientId: string) => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('estimated_revenue_30d')
    .select('bookings_30d, avg_ticket_value, estimated_revenue_30d')
    .eq('client_id', clientId)
    .maybeSingle()
  if (error) console.error('[getEstimatedRevenue30d] client_id=%s error=%s', clientId, error.message)
  else console.log('[getEstimatedRevenue30d] client_id=%s data=%s', clientId, JSON.stringify(data))
  return data as { bookings_30d: number; avg_ticket_value: number; estimated_revenue_30d: number } | null
})

// recent_calls view columns: id, client_id, started_at, duration_seconds, outcome, intent,
//   sentiment, after_hours, summary, recording_url, appointment_id, contact_name, contact_phone
export const getRecentCalls = cache(async (clientId: string, limit = 10): Promise<RecentCall[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('recent_calls')
    .select('id, client_id, started_at, duration_seconds, outcome, intent, sentiment, after_hours, contact_name, contact_phone, summary, recording_url, appointment_id')
    .eq('client_id', clientId)
    .order('started_at', { ascending: false })
    .limit(limit)
  if (error) console.error('[getRecentCalls] client_id=%s error=%s', clientId, error.message)
  else console.log('[getRecentCalls] client_id=%s rows=%d', clientId, data?.length ?? 0)
  return (data as RecentCall[] | null) ?? []
})

// Aggregates outcomes from the calls table. The timestamp column is started_at.
export const getCallOutcomes30d = cache(async (clientId: string): Promise<CallOutcome[]> => {
  const supabase = await createClient()
  const since = new Date()
  since.setDate(since.getDate() - 30)
  const { data, error } = await supabase
    .from('calls')
    .select('outcome')
    .eq('client_id', clientId)
    .gte('started_at', since.toISOString())
  if (error) console.error('[getCallOutcomes30d] client_id=%s error=%s', clientId, error.message)
  if (error || !data) return []
  const counts: Record<string, number> = {}
  for (const row of data) {
    const o = (row.outcome as string | null) ?? 'unknown'
    counts[o] = (counts[o] ?? 0) + 1
  }
  return Object.entries(counts)
    .map(([outcome, count]) => ({ outcome, count }))
    .sort((a, b) => b.count - a.count)
})

export const getAppointments30d = cache(async (clientId: string): Promise<number> => {
  const supabase = await createClient()
  const since = new Date()
  since.setDate(since.getDate() - 30)
  const { count, error } = await supabase
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clientId)
    .gte('created_at', since.toISOString())
  if (error) console.error('[getAppointments30d] client_id=%s error=%s', clientId, error.message)
  return count ?? 0
})

// Tries med_spa services_30d view first, falls back to generic weekly_intents.
export const getTopServicesOrIntents = cache(async (clientId: string): Promise<ServiceCount[]> => {
  const supabase = await createClient()

  const { data: svcData, error: svcErr } = await supabase
    .from('services_30d')
    .select('service_type, bookings, estimated_value')
    .eq('client_id', clientId)
    .order('bookings', { ascending: false })
    .limit(5)
  if (svcErr) console.error('[getTopServicesOrIntents:services_30d] client_id=%s error=%s', clientId, svcErr.message)
  if (!svcErr && svcData?.length) {
    return svcData.map(d => ({ name: (d.service_type as string) ?? '', count: (d.bookings as number) ?? 0 }))
  }

  const { data: intData, error: intErr } = await supabase
    .from('weekly_intents')
    .select('intent, occurrences')
    .eq('client_id', clientId)
    .order('occurrences', { ascending: false })
    .limit(5)
  if (intErr) console.error('[getTopServicesOrIntents:weekly_intents] client_id=%s error=%s', clientId, intErr.message)
  if (!intErr && intData) {
    return intData.map(d => ({ name: (d.intent as string) ?? '', count: (d.occurrences as number) ?? 0 }))
  }

  return []
})

// ── Appointments page ─────────────────────────────────────────────────────────

export const getAppointmentsForPage = cache(async (clientId: string): Promise<Appointment[]> => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('appointments')
    .select(`
      id, client_id, contact_id, call_id, conversation_id,
      scheduled_at, duration_minutes, service_type, status,
      google_calendar_event_id, estimated_value, notes, metadata,
      created_at, updated_at,
      contacts(full_name, phone)
    `)
    .eq('client_id', clientId)
    .order('scheduled_at', { ascending: false })

  function deriveBookedVia(row: any): string {
    if (row.call_id)          return 'call'
    if (row.conversation_id)  return 'sms'
    return 'unknown'
  }

  if (!error && data) {
    return data.map((row: any) => ({
      id: row.id,
      client_id: row.client_id,
      contact_id: row.contact_id ?? null,
      call_id: row.call_id ?? null,
      conversation_id: row.conversation_id ?? null,
      scheduled_at: row.scheduled_at,
      duration_minutes: row.duration_minutes ?? null,
      service_type: row.service_type,
      status: row.status,
      google_calendar_event_id: row.google_calendar_event_id ?? null,
      estimated_value: row.estimated_value ?? null,
      notes: row.notes,
      metadata: row.metadata ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at ?? null,
      contact_name: row.contacts?.full_name ?? null,
      contact_phone: row.contacts?.phone ?? null,
      bookedVia: deriveBookedVia(row),
    })) as Appointment[]
  }

  // Fall back without join if FK name differs
  console.error('[getAppointmentsForPage:join] falling back —', error?.message)
  const { data: fallback, error: fbErr } = await supabase
    .from('appointments')
    .select('id, client_id, contact_id, call_id, conversation_id, scheduled_at, duration_minutes, service_type, status, google_calendar_event_id, estimated_value, notes, metadata, created_at, updated_at')
    .eq('client_id', clientId)
    .order('scheduled_at', { ascending: false })
  if (fbErr) console.error('[getAppointmentsForPage:fallback]', fbErr.message)
  if (!fallback) return []
  return fallback.map((row: any) => ({
    ...row,
    contact_name: null,
    contact_phone: null,
    bookedVia: deriveBookedVia(row),
  })) as Appointment[]
})

// ── Calls page ────────────────────────────────────────────────────────────────

// Tries the calls table with a contacts join first; falls back to recent_calls view.
export const getCallsForPage = cache(async (clientId: string): Promise<RecentCall[]> => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('calls')
    .select(`
      id, client_id, started_at, duration_seconds, outcome, intent,
      sentiment, after_hours, summary, recording_url, appointment_id,
      contacts(full_name, phone)
    `)
    .eq('client_id', clientId)
    .order('started_at', { ascending: false })

  if (!error && data) {
    return data.map((row: any) => ({
      id: row.id,
      client_id: row.client_id,
      started_at: row.started_at,
      duration_seconds: row.duration_seconds,
      outcome: row.outcome,
      intent: row.intent,
      sentiment: row.sentiment,
      after_hours: row.after_hours,
      summary: row.summary,
      recording_url: row.recording_url,
      appointment_id: row.appointment_id ?? null,
      contact_name: row.contacts?.full_name ?? null,
      contact_phone: row.contacts?.phone ?? null,
    })) as RecentCall[]
  }

  // Fall back to view if join fails (e.g. FK name differs)
  console.error('[getCallsForPage:join] falling back to recent_calls view —', error?.message)
  const { data: fallback, error: fbErr } = await supabase
    .from('recent_calls')
    .select('id, client_id, started_at, duration_seconds, outcome, intent, sentiment, after_hours, summary, recording_url, contact_name, contact_phone, appointment_id')
    .eq('client_id', clientId)
    .order('started_at', { ascending: false })
  if (fbErr) console.error('[getCallsForPage:view fallback]', fbErr.message)
  return (fallback as RecentCall[] | null) ?? []
})

// ── Leads page ────────────────────────────────────────────────────────────────

// A lead is a contact with at least one call but no appointment yet.
// contacts_enriched view columns: contacts.* + call_count + appointment_count.
export const getLeadsForPage = cache(async (clientId: string, limit = 200): Promise<Lead[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('contacts_enriched')
    .select('id, client_id, phone, email, full_name, source, first_seen_at, last_seen_at, metadata, call_count, appointment_count')
    .eq('client_id', clientId)
    .gt('call_count', 0)
    .eq('appointment_count', 0)
    .order('last_seen_at', { ascending: false, nullsFirst: false })
    .limit(limit)
  if (error) console.error('[getLeadsForPage] client_id=%s error=%s', clientId, error.message)
  else console.log('[getLeadsForPage] client_id=%s rows=%d', clientId, data?.length ?? 0)
  return (data as Lead[] | null) ?? []
})

// All calls for a set of contacts, newest first — powers the lead activity feed
// and per-lead AI summary (latest call's summary field).
export const getCallsForContacts = cache(async (clientId: string, contactIds: string[]): Promise<LeadCall[]> => {
  if (contactIds.length === 0) return []
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('calls')
    .select('id, contact_id, started_at, duration_seconds, outcome, intent, sentiment, after_hours, summary, recording_url')
    .eq('client_id', clientId)
    .in('contact_id', contactIds)
    .order('started_at', { ascending: false })
  if (error) console.error('[getCallsForContacts] client_id=%s error=%s', clientId, error.message)
  return (data as LeadCall[] | null) ?? []
})

// ── Revenue + funnel layer ────────────────────────────────────────────────────
// Raw inputs for the code-derived revenue estimates (src/lib/revenue) and lead
// statuses (src/lib/lead-status). No stored rollups — everything derives at
// read time. Explicit limits match PostgREST's 1000-row cap; at real scale the
// funnel becomes a SQL rollup, but demo data sits comfortably under it.

export interface FunnelInputs {
  contacts: Array<{ id: string; metadata: Record<string, unknown> | null }>
  calls: Array<{ contact_id: string | null; started_at: string; outcome: string | null }>
  appointments: Array<{
    contact_id: string | null
    status: string | null
    estimated_value: number | null
    scheduled_at: string | null
    created_at: string | null
  }>
  /** contact_ids with at least one inbound AND one outbound SMS */
  twoWaySmsContactIds: Set<string>
}

export const getFunnelInputs = cache(async (clientId: string): Promise<FunnelInputs> => {
  const supabase = await createClient()
  const [contactsRes, callsRes, apptsRes, messagesRes] = await Promise.all([
    supabase.from('contacts').select('id, metadata').eq('client_id', clientId).limit(1000),
    supabase.from('calls').select('contact_id, started_at, outcome').eq('client_id', clientId).limit(1000),
    supabase
      .from('appointments')
      .select('contact_id, status, estimated_value, scheduled_at, created_at')
      .eq('client_id', clientId)
      .limit(1000),
    supabase.from('messages').select('contact_id, direction').eq('client_id', clientId).limit(1000),
  ])
  for (const [name, res] of [
    ['contacts', contactsRes], ['calls', callsRes], ['appointments', apptsRes], ['messages', messagesRes],
  ] as const) {
    if (res.error) console.error('[getFunnelInputs:%s] client_id=%s error=%s', name, clientId, res.error.message)
  }

  const inbound = new Set<string>()
  const outbound = new Set<string>()
  for (const m of messagesRes.data ?? []) {
    if (!m.contact_id) continue
    if (m.direction === 'inbound') inbound.add(m.contact_id)
    else if (m.direction === 'outbound') outbound.add(m.contact_id)
  }
  const twoWaySmsContactIds = new Set([...inbound].filter(id => outbound.has(id)))

  return {
    contacts: (contactsRes.data ?? []) as FunnelInputs['contacts'],
    calls: (callsRes.data ?? []) as FunnelInputs['calls'],
    appointments: (apptsRes.data ?? []) as FunnelInputs['appointments'],
    twoWaySmsContactIds,
  }
})

// ── Messages ──────────────────────────────────────────────────────────────────

export const getMessageThreads = cache(async (clientId: string): Promise<MessageThread[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('message_threads')
    .select('conversation_id, client_id, contact_name, contact_phone, last_message_body, last_message_at')
    .eq('client_id', clientId)
    .order('last_message_at', { ascending: false })
  if (error) console.error('[getMessageThreads] client_id=%s error=%s', clientId, error.message)
  return (data as MessageThread[] | null) ?? []
})
