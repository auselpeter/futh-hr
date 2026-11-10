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
    const scopeWhere = buildScopeFilter(user, 'assessment')
    const finalWhere = applyScope(where, scopeWhere)

    const assessments = await db.assessment.findMany({
      where: finalWhere,
      orderBy: [{ period: 'desc' }, { createdAt: 'desc' }],
      include: { staff: { select: { id: true, staffId: true, fullName: true, position: true } } },
    })
    return NextResponse.json({ assessments })
  } catch (e: any) {
    console.error('Assessment list:', e)
    return NextResponse.json({ error: 'Failed to fetch assessments' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json()
    const { staffId, period, knowledgeScore, skillsScore, attitudeScore, communicationScore, remarks, status, assessedById } = body || {}
    if (!staffId || !period) {
      return NextResponse.json({ error: 'staffId and period required' }, { status: 400 })
    }
    const k = Number(knowledgeScore) || 0
    const s = Number(skillsScore) || 0
    const a = Number(attitudeScore) || 0
    const c = Number(communicationScore) || 0
    const total = k + s + a + c
    const grade = computeGrade(total / 4)

    const assessment = await db.assessment.create({
      data: {
        staffId, period: String(period),
        knowledgeScore: k, skillsScore: s, attitudeScore: a, communicationScore: c,
        totalScore: total, grade,
        remarks: remarks || null,
        status: status || 'Draft',
        assessedById: assessedById || user.id,
      },
      include: { staff: { select: { id: true, staffId: true, fullName: true } } },
    })
    await audit(user, 'create', { entity: 'Assessment', entityId: assessment.id, details: `Created assessment ${assessment.period} for ${assessment.staff?.fullName || 'staff'}`, ipAddress: getIp(req) })
    return NextResponse.json({ assessment })
  } catch (e: any) {
    console.error('Assessment create:', e)
    return NextResponse.json({ error: 'Failed to create assessment' }, { status: 500 })
  }
}
