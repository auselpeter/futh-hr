import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'

// GET /api/reports — list generated reports for current user
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { searchParams } = new URL(req.url)
    const templateId = searchParams.get('templateId')

    const where: any = { generatedById: user.id }
    if (templateId) where.templateId = templateId

    const reports = await db.generatedReport.findMany({
      where,
      orderBy: [{ generatedAt: 'desc' }],
      include: {
        template: { select: { id: true, code: true, name: true } },
      },
    })
    return NextResponse.json({ reports })
  } catch (e: any) {
    console.error('Reports list:', e)
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 })
  }
}

// POST /api/reports — quick save a generated report (creates GeneratedReport record with provided data)
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json()
    const { templateId, startDate, endDate, departmentId, data, fileName } = body || {}
    if (!templateId) return NextResponse.json({ error: 'templateId is required' }, { status: 400 })

    const report = await db.generatedReport.create({
      data: {
        templateId,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        departmentId: departmentId || null,
        filters: null,
        fileName: fileName || `report-${Date.now()}`,
        fileUrl: null,
        data: typeof data === 'string' ? data : JSON.stringify(data || []),
        generatedById: user.id,
      },
      include: { template: { select: { id: true, code: true, name: true } } },
    })
    await audit(user, 'create', { entity: 'GeneratedReport', entityId: report.id, details: `Generated report from template ${report.template?.code}`, ipAddress: getIp(req) })
    return NextResponse.json({ report })
  } catch (e: any) {
    console.error('Report save:', e)
    return NextResponse.json({ error: 'Failed to save report' }, { status: 500 })
  }
}
