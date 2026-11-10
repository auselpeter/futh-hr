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
    const scopeWhere = buildScopeFilter(user, 'monthlyAppraisal')
    const finalWhere = applyScope(where, scopeWhere)

    const appraisals = await db.monthlyAppraisal.findMany({
      where: finalWhere,
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      include: {
        staff: { select: { id: true, staffId: true, fullName: true, position: true } },
      },
    })
    return NextResponse.json({ appraisals })
  } catch (e: any) {
    console.error('MonthlyAppraisals list:', e)
    return NextResponse.json({ error: 'Failed to fetch monthly appraisals' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json()
    const { staffId, month, year, score, achievements, challenges, recommendations, comments, status } = body || {}
    if (!staffId || !month || !year) {
      return NextResponse.json({ error: 'staffId, month and year required' }, { status: 400 })
    }
    const numericScore = Number(score) || 0
    const grade = computeGrade(numericScore)
    const period = `${year}-${String(month).padStart(2, '0')}`

    const existing = await db.monthlyAppraisal.findUnique({
      where: { staffId_year_month: { staffId, year: Number(year), month: Number(month) } },
    })
    if (existing) {
      return NextResponse.json({ error: 'Monthly appraisal already exists for this staff/month' }, { status: 409 })
    }

    const appraisal = await db.monthlyAppraisal.create({
      data: {
        staffId, period, month: Number(month), year: Number(year),
        score: numericScore, grade,
        achievements: achievements || null,
        challenges: challenges || null,
        recommendations: recommendations || null,
        comments: comments || null,
        status: status || 'Draft',
      },
      include: { staff: { select: { id: true, staffId: true, fullName: true } } },
    })
    await audit(user, 'create', { entity: 'MonthlyAppraisal', entityId: appraisal.id, details: `Created monthly appraisal ${period} for ${appraisal.staff?.fullName || 'staff'}`, ipAddress: getIp(req) })
    return NextResponse.json({ appraisal })
  } catch (e: any) {
    console.error('MonthlyAppraisal create:', e)
    return NextResponse.json({ error: 'Failed to create monthly appraisal' }, { status: 500 })
  }
}
