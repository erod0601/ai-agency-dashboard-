// ── ROI one-pager renderer ────────────────────────────────────────────────────
// pdf-lib (per the project's PDF tooling guidance: pure JS, no native deps,
// runs in a route handler). Letter portrait, single page, curated rollups
// only — never raw logs or contact details.
//
// Layout decision: pdf-lib ships the standard 14 fonts only; embedding
// Poppins/Inter would mean bundling TTFs + fontkit. Helvetica is the closest
// standard face, so the brand comes through via the palette instead
// (Teal #14B8A6, Deep Navy #0D182A).

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { formatMoney, ANSWER_RATE_THRESHOLD } from './revenue'
import { formatSpeedToLead } from './speed-to-lead'
import type { RoiReportData } from './roi-report'

const TEAL = rgb(20 / 255, 184 / 255, 166 / 255)
const NAVY = rgb(13 / 255, 24 / 255, 42 / 255)
const GRAY = rgb(0.42, 0.47, 0.55)
const LIGHT = rgb(0.955, 0.965, 0.975)
const WHITE = rgb(1, 1, 1)

const PAGE_W = 612
const PAGE_H = 792
const MARGIN = 48

interface Ctx {
  page: PDFPage
  font: PDFFont
  bold: PDFFont
}

function text(
  ctx: Ctx,
  str: string,
  x: number,
  yTop: number,
  size: number,
  opts: { bold?: boolean; color?: ReturnType<typeof rgb>; align?: 'left' | 'right' | 'center'; maxWidth?: number } = {}
) {
  const font = opts.bold ? ctx.bold : ctx.font
  let drawX = x
  const width = font.widthOfTextAtSize(str, size)
  if (opts.align === 'right') drawX = x - width
  if (opts.align === 'center') drawX = x - width / 2
  ctx.page.drawText(str, {
    x: drawX,
    y: PAGE_H - yTop - size,
    size,
    font,
    color: opts.color ?? NAVY,
    maxWidth: opts.maxWidth,
    lineHeight: size * 1.45,
  })
}

export async function renderRoiPdf(data: RoiReportData): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle(`7scale ROI Snapshot — ${data.clientName} — ${data.periodLabel}`)
  doc.setProducer('7scale dashboard')
  const page = doc.addPage([PAGE_W, PAGE_H])
  const ctx: Ctx = {
    page,
    font: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  }

  // ── 1. Header band ───────────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: PAGE_H - 108, width: PAGE_W, height: 108, color: NAVY })
  page.drawRectangle({ x: 0, y: PAGE_H - 112, width: PAGE_W, height: 4, color: TEAL })
  text(ctx, '7scale', MARGIN, 24, 15, { bold: true, color: TEAL })
  text(ctx, `ROI Snapshot — ${data.periodLabel}`, MARGIN, 46, 23, { bold: true, color: WHITE })
  text(ctx, data.clientName, MARGIN, 78, 12, { color: rgb(0.72, 0.78, 0.86) })
  text(
    ctx,
    `Generated ${data.generatedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
    PAGE_W - MARGIN, 80, 9,
    { color: rgb(0.55, 0.62, 0.72), align: 'right' }
  )

  // ── 2. Headline: This Month ──────────────────────────────────────────────
  let y = 146
  text(ctx, 'EST. REVENUE RECOVERED — LAST 30 DAYS', MARGIN, y, 9, { bold: true, color: GRAY })
  y += 18
  const total = data.revenue30d.realized + data.revenue30d.pipeline
  text(ctx, `Est. ${formatMoney(total)}`, MARGIN, y, 34, { bold: true })
  text(ctx, `${formatMoney(data.revenue30d.realized)} realized`, PAGE_W - MARGIN - 130, y + 6, 11, { bold: true, color: rgb(0.02, 0.55, 0.35), align: 'right' })
  text(ctx, `${formatMoney(data.revenue30d.pipeline)} pipeline`, PAGE_W - MARGIN, y + 6, 11, { bold: true, color: TEAL, align: 'right' })
  text(ctx, 'completed jobs', PAGE_W - MARGIN - 130, y + 21, 8, { color: GRAY, align: 'right' })
  text(ctx, 'booked, not yet done', PAGE_W - MARGIN, y + 21, 8, { color: GRAY, align: 'right' })

  // ── 3. Since Onboarding ──────────────────────────────────────────────────
  y += 62
  const baselineLabel = data.baselineDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  text(ctx, `SINCE ONBOARDING (${baselineLabel.toUpperCase()})`, MARGIN, y, 9, { bold: true, color: GRAY })
  y += 17
  text(ctx, `Est. ${formatMoney(data.cumulative)}`, MARGIN, y, 24, { bold: true })
  text(ctx, 'total revenue recovered — cumulative, this number only goes up', MARGIN + ctx.bold.widthOfTextAtSize(`Est. ${formatMoney(data.cumulative)}`, 24) + 14, y + 11, 9, { color: GRAY })

  // ── 4. Three supporting stats ────────────────────────────────────────────
  y += 52
  const boxW = (PAGE_W - MARGIN * 2 - 2 * 14) / 3
  const boxH = 86
  const boxes: Array<{ label: string; value: string; sub: string }> = [
    {
      label: 'AFTER-HOURS ANSWERED',
      value: data.afterHours.answeredAfterHours > 0
        ? `${data.afterHours.answeredAfterHours} (${data.afterHours.pctOfTotal}%)`
        : '—',
      sub: data.afterHours.answeredAfterHours > 0
        ? 'of all calls, last 30 days'
        : 'none in the last 30 days',
    },
    {
      label: 'AVG. SPEED TO LEAD',
      value: data.speedToLead ? formatSpeedToLead(data.speedToLead.avgSeconds) : '—',
      sub: data.speedToLead
        ? `missed call to AI follow-up (${data.speedToLead.sampleSize})`
        : 'no missed-call recoveries yet',
    },
    {
      label: 'DORMANT LEADS REACTIVATED',
      value: data.reactivatedCount > 0
        ? `${data.reactivatedCount} = Est. ${formatMoney(data.reactivationValue)}`
        : '—',
      sub: data.reactivatedCount > 0
        ? 'back in play after 30+ days quiet'
        : 'none re-engaged yet',
    },
  ]
  boxes.forEach((box, i) => {
    const bx = MARGIN + i * (boxW + 14)
    page.drawRectangle({
      x: bx, y: PAGE_H - y - boxH, width: boxW, height: boxH,
      color: LIGHT, borderColor: rgb(0.88, 0.9, 0.92), borderWidth: 1,
    })
    text(ctx, box.label, bx + 12, y + 13, 7.5, { bold: true, color: GRAY })
    text(ctx, box.value, bx + 12, y + 30, 17, { bold: true })
    text(ctx, box.sub, bx + 12, y + 58, 8, { color: GRAY })
  })

  // ── 5. Consistency streak line ───────────────────────────────────────────
  y += boxH + 26
  const thresholdPct = Math.round(ANSWER_RATE_THRESHOLD * 100)
  const ratePct = data.streak.latestRate !== null ? `${Math.round(data.streak.latestRate * 100)}%` : '—'
  const streakLine = data.streak.latestRate === null
    ? `No calls in recent months — the answer-rate streak resumes with the next call`
    : data.streak.monthsOfData < 2
      ? `Answer rate: ${ratePct} — building the streak (month 1 of service)`
      : data.streak.streakMonths > 0
        ? `Answer rate: ${ratePct} — ${data.streak.streakMonths} consecutive month${data.streak.streakMonths === 1 ? '' : 's'} at or above ${thresholdPct}%`
        : `Answer rate: ${ratePct} — working back toward ${thresholdPct}%`
  page.drawRectangle({ x: MARGIN, y: PAGE_H - y - 6, width: 3, height: 14, color: TEAL })
  text(ctx, streakLine, MARGIN + 12, y, 11, { bold: true })

  // ── 6. Mini funnel ───────────────────────────────────────────────────────
  y += 36
  text(ctx, 'CONVERSION FUNNEL — ALL CONTACTS', MARGIN, y, 9, { bold: true, color: GRAY })
  y += 20
  const maxCount = data.funnel[0]?.count ?? 0
  const barMaxW = PAGE_W - MARGIN * 2 - 150
  const shades = [rgb(0.35, 0.42, 0.52), rgb(0.24, 0.55, 0.6), rgb(0.16, 0.65, 0.62), TEAL]
  data.funnel.forEach((stage, i) => {
    const rowY = y + i * 26
    text(ctx, stage.label, MARGIN, rowY, 9.5, { color: GRAY })
    const w = maxCount > 0 ? Math.max((stage.count / maxCount) * barMaxW, 3) : 3
    page.drawRectangle({ x: MARGIN + 70, y: PAGE_H - rowY - 15, width: w, height: 13, color: shades[i] ?? TEAL })
    const prev = i > 0 ? data.funnel[i - 1].count : null
    const pct = prev && prev > 0 ? ` (${Math.round((stage.count / prev) * 100)}% of previous)` : ''
    text(ctx, `${stage.count.toLocaleString()}${pct}`, MARGIN + 70 + w + 8, rowY + 1, 9, { bold: true })
  })
  y += data.funnel.length * 26

  // ── 7. Footer ────────────────────────────────────────────────────────────
  // NB: raw drawText/drawRectangle coords are bottom-origin (unlike the
  // top-origin text() helper above) — footY is distance from the page bottom.
  const footY = 48
  page.drawRectangle({ x: MARGIN, y: footY + 34, width: PAGE_W - MARGIN * 2, height: 1.5, color: TEAL })
  page.drawText('7scale', { x: MARGIN, y: footY + 16, size: 11, font: ctx.bold, color: NAVY })
  page.drawText('AI reception, measured.', { x: MARGIN + 46, y: footY + 16, size: 9, font: ctx.font, color: GRAY })
  const provenance =
    `Estimates use ${data.usingDefaultTicket ? 'an industry-average' : "this client's"} job value of ` +
    `${formatMoney(data.avgTicket)} where an appointment has no recorded value. Onboarding and streak ` +
    `figures measure from ${baselineLabel}${data.baselineLocked ? ' (locked baseline)' : " (client start date)"}.`
  page.drawText(provenance, {
    x: MARGIN, y: footY, size: 7.5, font: ctx.font, color: GRAY,
    maxWidth: PAGE_W - MARGIN * 2, lineHeight: 11,
  })

  return doc.save()
}
