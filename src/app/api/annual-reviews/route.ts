import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'
import { buildScopeFilter, applyScope } from '@/lib/scope'

function computeVerdict(score: number): string {
  if (score >= 90) return 'Outstanding'
  if (score >= 80) return 'Excellent'
  if (score >= 70) return 'Very Good'
  if (score >= 60) return 'Good'
  if (score >= 50) return 'Satisfactory'
  return 'Poor'
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
    const scopeWhere = buildScopeFilter(user, 'annualReview')
    const finalWhere = applyScope(where, scopeWhere)

    const reviews = await db.annualReview.findMany({
      where: finalWhere,
      orderBy: [{ period: 'desc' }, { createdAt: 'desc' }],
      include: {
        staff: { select: { id: true, staffId: true, fullName: true, position: true, department: true } },
      },
    })
    return NextResponse.json({ reviews })
  } catch (e: any) {
    console.error('AnnualReviews list:', e)
    return NextResponse.json({ error: 'Failed to fetch annual reviews' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json()
    const { staffId, period, assessmentScore, monthlyScore, quarterlyScore, appraisalScore, dutyScore, comments, status: initStatus } = body || {}
    if (!staffId || !period) {
      return NextResponse.json({ error: 'staffId and period required' }, { status: 400 })
    }
    const a = Number(assessmentScore) || 0
    const m = Number(monthlyScore) || 0
    const q = Number(quarterlyScore) || 0
    const ap = Number(appraisalScore) || 0
    const du = Number(dutyScore) || 0
    const overall = (a + m + q + ap + du) / 5
    const verdict = computeVerdict(overall)

    const review = await db.annualReview.create({
      data: {
        staffId, period: String(period),
        assessmentScore: a, monthlyScore: m, quarterlyScore: q, appraisalScore: ap, dutyScore: du,
        overallScore: overall, verdict, comments: comments || null,
        status: initStatus || 'Draft',
      },
      include: { staff: { select: { id: true, staffId: true, fullName: true } } },
    })
    await audit(user, 'create', { entity: 'AnnualReview', entityId: review.id, details: `Created annual review ${review.period} for ${review.staff?.fullName || 'staff'}`, ipAddress: getIp(req) })
    return NextResponse.json({ review })
  } catch (e: any) {
    console.error('AnnualReview create:', e)
    return NextResponse.json({ error: 'Failed to create annual review' }, { status: 500 })
  }
}
