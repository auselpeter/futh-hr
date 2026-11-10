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
    const assessment = await db.assessment.findUnique({ where: { id }, include: { staff: true } })
    if (!assessment) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ assessment })
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
    for (const k of ['knowledgeScore', 'skillsScore', 'attitudeScore', 'communicationScore']) {
      if (body[k] !== undefined) {
        data[k] = Number(body[k]) || 0
        needCompute = true
      }
    }
    if (needCompute) {
      const existing = await db.assessment.findUnique({ where: { id } })
      if (existing) {
        const k = data.knowledgeScore ?? existing.knowledgeScore
        const s = data.skillsScore ?? existing.skillsScore
        const a = data.attitudeScore ?? existing.attitudeScore
        const c = data.communicationScore ?? existing.communicationScore
        data.totalScore = k + s + a + c
        data.grade = computeGrade(data.totalScore / 4)
      }
    }
    if (body.remarks !== undefined) data.remarks = body.remarks
    if (body.status !== undefined) data.status = body.status
    const assessment = await db.assessment.update({ where: { id }, data })
    await audit(user, 'update', { entity: 'Assessment', entityId: id, details: `Updated assessment ${assessment.period}`, ipAddress: getIp(req) })
    return NextResponse.json({ assessment })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}
