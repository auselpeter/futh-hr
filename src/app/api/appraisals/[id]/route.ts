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
    const appraisal = await db.appraisal.findUnique({ where: { id }, include: { staff: true } })
    if (!appraisal) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ appraisal })
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
    let needCompute = false
    for (const k of ['performanceScore', 'achievementScore', 'competencyScore']) {
      if (body[k] !== undefined) {
        data[k] = Number(body[k]) || 0
        needCompute = true
      }
    }
    if (needCompute) {
      const existing = await db.appraisal.findUnique({ where: { id } })
      if (existing) {
        const p = data.performanceScore ?? existing.performanceScore
        const a = data.achievementScore ?? existing.achievementScore
        const c = data.competencyScore ?? existing.competencyScore
        data.totalScore = p + a + c
        data.grade = computeGrade(data.totalScore / 3)
      }
    }
    if (body.remarks !== undefined) data.remarks = body.remarks
    if (body.status !== undefined) data.status = body.status
    const appraisal = await db.appraisal.update({ where: { id }, data })
    await audit(user, 'update', { entity: 'Appraisal', entityId: id, details: `Updated appraisal ${appraisal.period}`, ipAddress: getIp(req) })
    return NextResponse.json({ appraisal })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
