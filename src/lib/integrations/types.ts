// ── Integration layer types ──────────────────────────────────────────────────
// Boundary between dashboard UI and live providers (Twilio SMS, Retell AI voice,
// n8n workflows). All functions in this folder are STUBS until credentials are
// provisioned and the TCPA/Texas compliance review is complete.

export interface SendSmsInput {
  clientId: string
  toPhone: string
  body: string
  contactId?: string
}

export interface StartCallInput {
  clientId: string
  toPhone: string
  contactId?: string
  /** Optional context passed to the voice agent (e.g. "follow up on lip filler inquiry") */
  context?: string
}

export type IntegrationResult =
  | { ok: true; providerId: string }
  | { ok: false; reason: 'not_configured' | 'provider_error'; message: string }

export interface CallSummaryResult {
  ok: boolean
  summary: string | null
}

/** Shape of integration config stored in client_settings.crm_config (jsonb). */
export interface IntegrationConfig {
  twilio?: { accountSid?: string; messagingServiceSid?: string; fromNumber?: string }
  retell?: { apiKeyRef?: string; agentId?: string }
  n8n?: { webhookBaseUrl?: string }
}
