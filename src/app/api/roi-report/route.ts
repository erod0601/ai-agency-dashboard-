import { NextResponse } from 'next/server'
import { getCurrentUser, getProfile } from '@/lib/queries'
import { resolveActiveClient } from '@/lib/active-client'
import { buildRoiReportData, roiFilename } from '@/lib/roi-report'
import { renderRoiPdf } from '@/lib/roi-pdf'

// GET /api/roi-report — one-page ROI snapshot for the active client.
// Same auth gate as the dashboard pages; numbers come from the same helpers
// as the live Analytics page, so the PDF can never disagree with it.
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getProfile(user.id)
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { clientId } = await resolveActiveClient(profile)
  if (!clientId) return NextResponse.json({ error: 'No client selected' }, { status: 400 })

  const data = await buildRoiReportData(clientId)
  if (!data) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const pdf = await renderRoiPdf(data)
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${roiFilename(data.clientName, data.generatedAt)}"`,
      'Cache-Control': 'no-store',
    },
  })
}
