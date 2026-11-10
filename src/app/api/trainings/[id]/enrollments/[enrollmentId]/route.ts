import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'

// PATCH /api/trainings/[id]/enrollments/[enrollmentId]
// Body: { status?, score?, grade?, certificateUrl?, feedbackNotes?, attendanceRate? }
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; enrollmentId: string }> },
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id, enrollmentId } = await params
    const body = await req.json()

    const existing = await db.trainingEnrollment.findUnique({
      where: { id: enrollmentId },
      include: { training: true, staff: true },
    })
    if (!existing) return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 })
    if (existing.trainingId !== id) {
      return NextResponse.json({ error: 'Enrollment does not belong to this training' }, { status: 400 })
    }

    const role = user.activeRole || user.role
    if (!['SUPER_ADMIN', 'ADMIN', 'CMD', 'DFA', 'AD', 'HOD', 'HOU', 'APPRAISAL_OFFICER'].includes(role)) {
      return NextResponse.json({ error: 'Not authorized to update enrollment' }, { status: 403 })
    }

    const data: any = {}
    if (body.status !== undefined) {
      data.status = body.status
      if (body.status === 'Attended') data.attendedAt = new Date()
      if (body.status === 'Completed') data.completedAt = new Date()
      if (body.status === 'Cancelled' && !data.leftAt) data.leftAt = new Date()
    }
    if (body.score !== undefined) data.score = body.score === null || body.score === '' ? null : Number(body.score)
    if (body.grade !== undefined) data.grade = body.grade || null
    if (body.certificateUrl !== undefined) data.certificateUrl = body.certificateUrl || null
    if (body.feedbackNotes !== undefined) data.feedbackNotes = body.feedbackNotes || null
    if (body.attendanceRate !== undefined) data.attendanceRate = body.attendanceRate === null || body.attendanceRate === '' ? null : Number(body.attendanceRate)

    const updated = await db.trainingEnrollment.update({
      where: { id: enrollmentId },
      data,
      include: {
        staff: { select: { id: true, fullName: true, staffId: true } },
        training: { select: { id: true, code: true, title: true } },
      },
    })
    await audit(user, 'update', { entity: 'TrainingEnrollment', entityId: enrollmentId, details: `Updated enrollment for ${updated.staff?.fullName} in ${updated.training?.code} (status=${body.status || 'unchanged'})`, ipAddress: getIp(req) })
    return NextResponse.json({ enrollment: updated })
  } catch (e: any) {
    console.error('Enrollment patch:', e)
    return NextResponse.json({ error: 'Failed to update enrollment' }, { status: 500 })
  }
}
