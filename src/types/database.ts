export type UserRole = 'agency' | 'client_owner' | 'client_staff'

export interface Profile {
  id: string
  full_name: string | null
  role: UserRole
  client_id: string | null
  created_at: string
}

export interface Client {
  id: string
  name: string
  business_type: string | null
  timezone: string | null
  created_at: string
}

export interface ClientSettings {
  client_id: string
  primary_color: string | null
  logo_url: string | null
  display_name: string | null
  avg_ticket_value: number | null
  // Frozen value-story baseline, set once at onboarding. Null → fall back to
  // clients.created_at.
  baseline_locked_at: string | null
  crm_provider: string | null
  crm_config: Record<string, unknown> | null
}

// ── Dashboard metrics ────────────────────────────────────────────────────────

// Matches daily_call_metrics view: day, total_calls, after_hours_calls, booked_calls, ...
export interface DailyCallMetric {
  day: string              // ISO date string: YYYY-MM-DD  (view column is "day", not "date")
  total_calls: number
  after_hours_calls: number
  booked_calls: number | null
  voicemails: number | null
  hangups: number | null
  follow_ups: number | null
  avg_duration_seconds: number | null
  total_duration_seconds: number | null
}

// Matches recent_calls view
export interface RecentCall {
  id: string
  client_id: string
  started_at: string       // view column is "started_at", not "called_at"
  duration_seconds: number | null
  outcome: string | null
  intent: string | null
  sentiment: string | null
  after_hours: boolean | null
  contact_name: string | null   // view column is "contact_name", not "caller_name"
  contact_phone: string | null  // view column is "contact_phone", not "caller_phone"
  summary: string | null
  recording_url: string | null
  appointment_id: string | null
}

export interface CallOutcome {
  outcome: string
  count: number
}

export interface ServiceCount {
  name: string
  count: number
}

// ── Appointments ─────────────────────────────────────────────────────────────

export interface Appointment {
  id: string
  client_id: string
  contact_id: string | null
  call_id: string | null
  conversation_id: string | null
  scheduled_at: string
  duration_minutes: number | null
  service_type: string | null
  status: string | null               // confirmed | cancelled | completed | no_show
  google_calendar_event_id: string | null
  estimated_value: number | null
  notes: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string | null
  // Joined from contacts table
  contact_name: string | null
  contact_phone: string | null
  // Derived: call_id → "call", conversation_id → "sms", else "unknown"
  bookedVia: string
}

// ── Leads ────────────────────────────────────────────────────────────────────

// Matches contacts_enriched view (contacts columns + call_count/appointment_count).
// A "lead" is a contact with call_count > 0 and appointment_count = 0.
export interface Lead {
  id: string
  client_id: string
  phone: string | null
  email: string | null
  full_name: string | null
  source: string | null
  first_seen_at: string | null
  last_seen_at: string | null
  metadata: Record<string, unknown> | null
  call_count: number
  appointment_count: number
}

// Subset of calls columns used in the lead activity feed
export interface LeadCall {
  id: string
  contact_id: string | null
  started_at: string
  duration_seconds: number | null
  outcome: string | null
  intent: string | null
  sentiment: string | null
  after_hours: boolean | null
  summary: string | null
  recording_url: string | null
}

// ── Messages ─────────────────────────────────────────────────────────────────

// Matches message_threads view
export interface MessageThread {
  conversation_id: string
  client_id: string
  contact_name: string | null
  contact_phone: string | null
  last_message_body: string | null
  last_message_at: string
}

// Matches messages table
export interface Message {
  id: string
  conversation_id: string
  body: string
  direction: 'inbound' | 'outbound'
  created_at: string
}
