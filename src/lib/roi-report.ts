// ── ROI report data ───────────────────────────────────────────────────────────
// Aggregates the exact numbers already powering the live Analytics page —
// every figure flows through the same helpers, so the PDF and the dashboard
// can never disagree. No new calculation logic lives here.

import {
  getClientFull,
  getClientSettingsFull,
  getFunnelInputs,
  getSpeedToLeadInputs,
} from './queries'
import {
  getAvgTicket,
  estimateClientRevenue30d,
  estimateCumulativeRevenue,
  computeAnswerRateStreak,
  computeAfterHoursStats,
  computeReactivationValue,
  type RevenueEstimate,
  type AnswerRateStreak,
  type AfterHoursStats,
} from './revenue'
import { computeStatusDistribution } from './lead-status'
import { computeAvgSpeedToLead, type SpeedToLeadResult } from './speed-to-lead'

export interface RoiFunnelStage {
  label: string
  count: number
}

export interface RoiReportData {
  clientName: string
  periodLabel: string // "July 2026"
  generatedAt: Date
  revenue30d: RevenueEstimate
  cumulative: number
  baselineDate: Date
  baselineLocked: boolean
  afterHours: AfterHoursStats
  speedToLead: SpeedToLeadResult | null
  reactivatedCount: number
  reactivationValue: number
  streak: AnswerRateStreak
  funnel: RoiFunnelStage[]
  avgTicket: number
  usingDefaultTicket: boolean
}

export async function buildRoiReportData(clientId: string): Promise<RoiReportData | null> {
  const [client, settings, funnelInputs, speedToLeadInputs] = await Promise.all([
    getClientFull(clientId),
    getClientSettingsFull(clientId),
    getFunnelInputs(clientId),
    getSpeedToLeadInputs(clientId),
  ])
  if (!client) return null

  const avgTicket = getAvgTicket(settings)
  const usingDefaultTicket = settings?.avg_ticket_value == null
  const baselineLocked = settings?.baseline_locked_at != null
  const baselineDate = new Date(settings?.baseline_locked_at ?? client.created_at)
  const { distribution, reactivatedIds } = computeStatusDistribution(funnelInputs)

  // Cumulative funnel stages, same containment as the ConversionFunnel UI:
  // won ⊂ booked ⊂ engaged ⊂ contacted.
  const won = distribution.won
  const booked = won + distribution.booked
  const engaged = booked + distribution.engaged + distribution.reactivated
  const contacted = engaged + distribution.new + distribution.lost

  const now = new Date()
  return {
    clientName: client.name,
    periodLabel: now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    generatedAt: now,
    revenue30d: estimateClientRevenue30d(funnelInputs.appointments, avgTicket),
    cumulative: estimateCumulativeRevenue(funnelInputs.appointments, avgTicket, baselineDate),
    baselineDate,
    baselineLocked,
    afterHours: computeAfterHoursStats(funnelInputs.calls),
    speedToLead: computeAvgSpeedToLead(speedToLeadInputs),
    reactivatedCount: distribution.reactivated,
    reactivationValue: computeReactivationValue(reactivatedIds, funnelInputs.appointments, avgTicket),
    streak: computeAnswerRateStreak(funnelInputs.calls),
    funnel: [
      { label: 'Contacted', count: contacted },
      { label: 'Engaged', count: engaged },
      { label: 'Booked', count: booked },
      { label: 'Won', count: won },
    ],
    avgTicket,
    usingDefaultTicket,
  }
}

/** `7scale-roi-acme-hvac-demo-2026-07.pdf` */
export function roiFilename(clientName: string, now: Date = new Date()): string {
  const slug = clientName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  return `7scale-roi-${slug}-${ym}.pdf`
}
