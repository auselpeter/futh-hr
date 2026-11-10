import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'
import { buildScopeFilter, applyScope } from '@/lib/scope'

function computeGrade(score: number): string {
  if (score >= 90) return 'A+'
  if (score >= 80) return 'A'
  if (score >= 70) return 'B'
  if (score >= 60) return 'C'
  if (score >= 50) return 'D'
  return 'F'
}

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { searchParams } = new URL(req.url)
    const staffId = searchParams.get('staffId')
    const period = searchParams.get('period')
    const status = searchParams.get('status')

    const where: any = {}
    if (staffId) where.staffId = staffId
    if (period) where.period = period
    if (status) where.status = status

    // Apply role-based data scope
    const scopeWhere = buildScopeFilter(user, 'appraisal')
    const finalWhere = applyScope(where, scopeWhere)

    const appraisals = await db.appraisal.findMany({
      where: finalWhere,
      orderBy: [{ period: 'desc' }, { createdAt: 'desc' }],
      include: { staff: { select: { id: true, staffId: true, fullName: true, position: true } } },
    })
    return NextResponse.json({ appraisals })
  } catch (e: any) {
    console.error('Appraisals list:', e)
    return NextResponse.json({ error: 'Failed to fetch appraisals' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json()
    const { staffId, period, performanceScore, achievementScore, competencyScore, remarks, status, appraisedById } = body || {}
    if (!staffId || !period) {
      return NextResponse.json({ error: 'staffId and period required' }, { status: 400 })
    }
    const p = Number(performanceScore) || 0
    const a = Number(achievementScore) || 0
    const c = Number(competencyScore) || 0
    const total = p + a + c
    const grade = computeGrade(total / 3)

    const appraisal = await db.appraisal.create({
      data: {
        staffId, period: String(period),
        performanceScore: p, achievementScore: a, competencyScore: c,
        totalScore: total, grade,
        remarks: remarks || null,
        status: status || 'Draft',
        appraisedById: appraisedById || user.id,
      },
      include: { staff: { select: { id: true, staffId: true, fullName: true } } },
    })
    await audit(user, 'create', { entity: 'Appraisal', entityId: appraisal.id, details: `Created appraisal ${appraisal.period} for ${appraisal.staff?.fullName || 'staff'}`, ipAddress: getIp(req) })
    return NextResponse.json({ appraisal })
  } catch (e: any) {
    console.error('Appraisal create:', e)
    return NextResponse.json({ error: 'Failed to create appraisal' }, { status: 500 })
  }
}
