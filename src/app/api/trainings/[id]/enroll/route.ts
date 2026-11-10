import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const body = await req.json()
    const { staffId } = body
    if (!staffId) return NextResponse.json({ error: 'staffId is required' }, { status: 400 })

    const training = await db.training.findUnique({ where: { id } })
    if (!training) return NextResponse.json({ error: 'Training not found' }, { status: 404 })

    const existing = await db.trainingEnrollment.findUnique({
      where: { trainingId_staffId: { trainingId: id, staffId } },
    })
    if (existing) return NextResponse.json({ error: 'Staff already enrolled' }, { status: 400 })

    // Check max participants
    if (training.maxParticipants) {
      const count = await db.trainingEnrollment.count({ where: { trainingId: id } })
      if (count >= training.maxParticipants) {
        return NextResponse.json({ error: 'Training is full' }, { status: 400 })
      }
    }

    const enrollment = await db.trainingEnrollment.create({
      data: { trainingId: id, staffId, status: 'Enrolled' },
      include: { staff: true, training: true },
    })

    await audit(user, 'create', { entity: 'TrainingEnrollment', entityId: enrollment.id, details: `Enrolled ${enrollment.staff?.fullName} in ${training.code}`, ipAddress: getIp(req) })
    return NextResponse.json({ enrollment })
  } catch (e: any) {
    console.error('Enroll failed:', e)
    return NextResponse.json({ error: 'Failed to enroll staff' }, { status: 500 })
  }
}
