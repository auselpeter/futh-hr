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

function quarterMonths(q: number): number[] {
  if (q === 1) return [1, 2, 3]
  if (q === 2) return [4, 5, 6]
  if (q === 3) return [7, 8, 9]
  return [10, 11, 12]
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
    const scopeWhere = buildScopeFilter(user, 'quarterlyReview')
    const finalWhere = applyScope(where, scopeWhere)

    const reviews = await db.quarterlyReview.findMany({
      where: finalWhere,
      orderBy: [{ year: 'desc' }, { quarter: 'desc' }],
      include: { staff: { select: { id: true, staffId: true, fullName: true } } },
    })
    return NextResponse.json({ reviews })
  } catch (e: any) {
    console.error('QuarterlyReviews list:', e)
    return NextResponse.json({ error: 'Failed to fetch quarterly reviews' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json()
    const { staffId, quarter, year, summary, comments, status } = body || {}
    if (!staffId || !quarter || !year) {
      return NextResponse.json({ error: 'staffId, quarter and year required' }, { status: 400 })
    }
    const period = `${year}-Q${quarter}`
    const months = quarterMonths(Number(quarter))
    const monthly = await db.monthlyAppraisal.findMany({
      where: { staffId, year: Number(year), month: { in: months } },
    })
    const avg = monthly.length ? monthly.reduce((s, m) => s + (m.score || 0), 0) / monthly.length : 0
    const grade = computeGrade(avg)

    const existing = await db.quarterlyReview.findUnique({
      where: { staffId_year_quarter: { staffId, year: Number(year), quarter: Number(quarter) } },
    })
    if (existing) {
      return NextResponse.json({ error: 'Quarterly review already exists' }, { status: 409 })
    }

    const review = await db.quarterlyReview.create({
      data: {
        staffId, period, quarter: Number(quarter), year: Number(year),
        averageScore: Number(avg.toFixed(2)), grade,
        summary: summary || null,
        comments: comments || null,
        status: status || 'Draft',
      },
      include: { staff: { select: { id: true, staffId: true, fullName: true } } },
    })
    await audit(user, 'create', { entity: 'QuarterlyReview', entityId: review.id, details: `Created quarterly review ${period} for ${review.staff?.fullName || 'staff'}`, ipAddress: getIp(req) })
    return NextResponse.json({ review })
  } catch (e: any) {
    console.error('QuarterlyReview create:', e)
    return NextResponse.json({ error: 'Failed to create quarterly review' }, { status: 500 })
  }
}
