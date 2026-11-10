import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'

function computeGrade(score: number): string {
  if (score >= 90) return 'A+'
  if (score >= 80) return 'A'
  if (score >= 70) return 'B'
  if (score >= 60) return 'C'
  if (score >= 50) return 'D'
  return 'F'
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const appraisal = await db.monthlyAppraisal.findUnique({
      where: { id },
      include: { staff: { include: { department: true } } },
    })
    if (!appraisal) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ appraisal })
  } catch (e: any) {
    console.error('MonthlyAppraisal GET:', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const body = await req.json()

    const data: any = {}
    if (body.score !== undefined) {
      data.score = Number(body.score) || 0
      data.grade = computeGrade(data.score)
    }
    for (const k of ['achievements', 'challenges', 'recommendations', 'comments', 'hodRemarks', 'houRemarks', 'status']) {
      if (body[k] !== undefined) data[k] = body[k]
    }
    if (body.hodSign) {
      data.hodName = body.hodName || user.fullName
      data.hodSignedAt = new Date()
      data.status = body.status || 'Signed'
    }
    if (body.houSign) {
      data.houName = body.houName || user.fullName
      data.houSignedAt = new Date()
      data.status = body.status || 'Acknowledged'
    }

    const appraisal = await db.monthlyAppraisal.update({ where: { id }, data })
    await audit(user, 'update', { entity: 'MonthlyAppraisal', entityId: id, details: `Updated monthly appraisal ${appraisal.period}`, ipAddress: getIp(req) })
    return NextResponse.json({ appraisal })
  } catch (e: any) {
    console.error('MonthlyAppraisal PATCH:', e)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}
