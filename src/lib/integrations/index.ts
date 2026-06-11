// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION BOUNDARY — STUBS ONLY
//
// Real implementations will call Twilio (SMS) and Retell AI (voice) via n8n
// write nodes using credentials stored in client_settings.crm_config.
// Do NOT wire live sends until:
//   1. Twilio/Retell credentials are provisioned per client
//   2. n8n write workflows exist
//   3. TCPA / Texas compliance review is complete
//
// To go live: replace the bodies below, keep the signatures.
// ─────────────────────────────────────────────────────────────────────────────

import type { SendSmsInput, StartCallInput, IntegrationResult, CallSummaryResult } from './types'

const NOT_CONFIGURED = 'Messaging integration is not configured yet. Coming soon.'

export async function sendSms(_input: SendSmsInput): Promise<IntegrationResult> {
  return { ok: false, reason: 'not_configured', message: NOT_CONFIGURED }
}

export async function startCall(_input: StartCallInput): Promise<IntegrationResult> {
  return { ok: false, reason: 'not_configured', message: 'Outbound calling is not configured yet. Coming soon.' }
}

/** Live version will fetch/refresh a summary from the provider; demo data already has summaries on calls. */
export async function getCallSummary(_callId: string): Promise<CallSummaryResult> {
  return { ok: false, summary: null }
}

export type { SendSmsInput, StartCallInput, IntegrationResult, CallSummaryResult, IntegrationConfig } from './types'
