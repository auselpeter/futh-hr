import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'

function computeGrade(achieved: number): string {
  if (achieved >= 90) return 'A+'
  if (achieved >= 80) return 'A'
  if (achieved >= 70) return 'B'
  if (achieved >= 60) return 'C'
  if (achieved >= 50) return 'D'
  return 'F'
}

function computeRating(achieved: number): string {
  if (achieved >= 90) return 'Outstanding'
  if (achieved >= 80) return 'Excellent'
  if (achieved >= 70) return 'Very Good'
  if (achieved >= 60) return 'Good'
  if (achieved >= 50) return 'Satisfactory'
  return 'Poor'
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const duty = await db.duty.findUnique({ where: { id }, include: { staff: true } })
    if (!duty) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ duty })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params

    // Permission check:
    // - Managers (HOD, HOU, APPRAISAL_OFFICER, ADMIN, SUPER_ADMIN) can update all fields
    // - STAFF can only update evidence-related fields (evidenceUrl, evidenceFileName, evidenceNotes,
    //   evidenceUploadedAt, completedAt, status → Completed) to notify management of task completion
    const role = (user as any).activeRole || user.role
    const designationCode = (user as any).designation?.code || ''
    const isManager =
      ['SUPER_ADMIN', 'ADMIN', 'HOD', 'HOU', 'APPRAISAL_OFFICER'].includes(role) ||
      designationCode === 'PLANNING_OFFICER'

    const body = await req.json()
    const data: any = {}

    if (isManager) {
      // Managers can update all fields
      if (body.title !== undefined) data.title = body.title
      if (body.description !== undefined) data.description = body.description
      if (body.weight !== undefined) data.weight = Number(body.weight) || 1
      if (body.targetScore !== undefined) data.targetScore = Number(body.targetScore) || 100
      if (body.period !== undefined) data.period = body.period
      if (body.type !== undefined) data.type = body.type
      if (body.order !== undefined) data.order = Number(body.order) || 1
      if (body.startDate !== undefined) data.startDate = body.startDate ? new Date(body.startDate) : null
      if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null
      if (body.status !== undefined) data.status = body.status
      if (body.achievedScore !== undefined) {
        if (body.achievedScore === null || body.achievedScore === '') {
          data.achievedScore = null
          data.grade = null
          data.rating = null
        } else {
          data.achievedScore = Number(body.achievedScore)
          data.grade = computeGrade(data.achievedScore)
          data.rating = computeRating(data.achievedScore)
        }
      }
      if (body.scoreNotes !== undefined) data.scoreNotes = body.scoreNotes
      if (body.reviewedById !== undefined) data.reviewedById = body.reviewedById
      if (body.reviewedByName !== undefined) data.reviewedByName = body.reviewedByName
      if (body.reviewedAt !== undefined) data.reviewedAt = body.reviewedAt ? new Date(body.reviewedAt) : null
      if (body.reviewRemarks !== undefined) data.reviewRemarks = body.reviewRemarks
    }

    // Both managers and staff can upload evidence + mark as completed
    if (body.evidenceUrl !== undefined) {
      data.evidenceUrl = body.evidenceUrl
      data.evidenceFileName = body.evidenceFileName || null
      data.evidenceNotes = body.evidenceNotes || null
      data.evidenceUploadedAt = new Date()
      // When evidence is uploaded, mark duty as Completed
      if (body.evidenceUrl) {
        data.completedAt = new Date()
        if (!data.status) data.status = 'Completed'
      }
    }
    // Staff can also set evidence notes independently
    if (!isManager && body.evidenceNotes !== undefined) {
      data.evidenceNotes = body.evidenceNotes
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 })
    }

    const duty = await db.duty.update({ where: { id }, data })
    await audit(user, 'update', { entity: 'Duty', entityId: id, details: `Updated duty ${duty.title}`, ipAddress: getIp(req) })
    return NextResponse.json({ duty })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params

    // Only managers can delete duties
    const role = (user as any).activeRole || user.role
    const designationCode = (user as any).designation?.code || ''
    const isManager =
      ['SUPER_ADMIN', 'ADMIN', 'HOD', 'HOU', 'APPRAISAL_OFFICER'].includes(role) ||
      designationCode === 'PLANNING_OFFICER'
    if (!isManager) {
      return NextResponse.json({ error: 'Only HOD, HOU, Appraisal Officer, or Admin can delete duties' }, { status: 403 })
    }
    const existing = await db.duty.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await db.duty.delete({ where: { id } })
    await audit(user, 'delete', { entity: 'Duty', entityId: id, details: `Deleted duty ${existing.title}`, ipAddress: getIp(req) })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
