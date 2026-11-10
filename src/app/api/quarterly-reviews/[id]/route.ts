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
    const review = await db.quarterlyReview.findUnique({ where: { id }, include: { staff: true } })
    if (!review) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ review })
  } catch (e: any) {
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
    if (body.summary !== undefined) data.summary = body.summary
    if (body.comments !== undefined) data.comments = body.comments
    if (body.status !== undefined) data.status = body.status
    if (body.averageScore !== undefined) {
      data.averageScore = Number(body.averageScore)
      data.grade = computeGrade(data.averageScore)
    }
    const review = await db.quarterlyReview.update({ where: { id }, data })
    await audit(user, 'update', { entity: 'QuarterlyReview', entityId: id, details: `Updated quarterly review ${review.period}`, ipAddress: getIp(req) })
    return NextResponse.json({ review })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}
