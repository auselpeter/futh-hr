import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'

function computeVerdict(score: number): string {
  if (score >= 90) return 'Outstanding'
  if (score >= 80) return 'Excellent'
  if (score >= 70) return 'Very Good'
  if (score >= 60) return 'Good'
  if (score >= 50) return 'Satisfactory'
  return 'Poor'
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const review = await db.annualReview.findUnique({
      where: { id },
      include: { staff: { include: { department: true } } },
    })
    if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 })
    return NextResponse.json({ review })
  } catch (e: any) {
    console.error('AnnualReview GET:', e)
    return NextResponse.json({ error: 'Failed to fetch review' }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const body = await req.json()

    const data: any = {}
    const numeric = ['assessmentScore', 'monthlyScore', 'quarterlyScore', 'appraisalScore', 'dutyScore']
    for (const k of numeric) {
      if (body[k] !== undefined) data[k] = Number(body[k]) || 0
    }
    if (body.comments !== undefined) data.comments = body.comments
    if (body.status !== undefined) data.status = body.status
    if (body.annualReviewDuties !== undefined) data.annualReviewDuties = body.annualReviewDuties

    if (numeric.some((k) => body[k] !== undefined)) {
      const existing = await db.annualReview.findUnique({ where: { id } })
      if (existing) {
        const a = data.assessmentScore ?? existing.assessmentScore
        const m = data.monthlyScore ?? existing.monthlyScore
        const q = data.quarterlyScore ?? existing.quarterlyScore
        const ap = data.appraisalScore ?? existing.appraisalScore
        const du = data.dutyScore ?? existing.dutyScore
        data.overallScore = (a + m + q + ap + du) / 5
        data.verdict = computeVerdict(data.overallScore)
      }
    }

    const review = await db.annualReview.update({
      where: { id },
      data,
      include: { staff: { select: { id: true, staffId: true, fullName: true } } },
    })
    await audit(user, 'update', { entity: 'AnnualReview', entityId: id, details: `Updated annual review ${review.period}`, ipAddress: getIp(req) })
    return NextResponse.json({ review })
  } catch (e: any) {
    console.error('AnnualReview PATCH:', e)
    return NextResponse.json({ error: 'Failed to update review' }, { status: 500 })
  }
}
