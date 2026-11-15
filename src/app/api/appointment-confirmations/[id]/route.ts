import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params

    const confirmation = await db.appointmentConfirmation.findUnique({
      where: { id },
      include: {
        staff: {
          select: {
            id: true, staffId: true, fullName: true, position: true, rank: true,
            gradeLevel: true, step: true, dateHired: true, confirmationDate: true,
            retirementDate: true,
            department: { select: { id: true, code: true, name: true } },
            designation: { select: { id: true, code: true, name: true } },
          },
        },
      },
    })
    if (!confirmation) return NextResponse.json({ error: 'Appointment confirmation not found' }, { status: 404 })
    return NextResponse.json({ confirmation })
  } catch (e: any) {
    console.error('Appointment confirmation GET:', e)
    return NextResponse.json({ error: 'Failed to fetch appointment confirmation' }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const body = await req.json()

    const existing = await db.appointmentConfirmation.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Appointment confirmation not found' }, { status: 404 })

    const role = user.activeRole || user.role
    const isCreator = existing.createdById === user.id
    const isPrivileged = ['SUPER_ADMIN', 'ADMIN', 'CMD', 'DFA', 'AD', 'HOD'].includes(role)
    if (!isCreator && !isPrivileged) {
      return NextResponse.json({ error: 'Not authorized to edit this appointment confirmation' }, { status: 403 })
    }
    if (!['Draft', 'Submitted', 'HOD Approved'].includes(existing.status)) {
      return NextResponse.json({ error: 'Cannot edit a confirmation that is already in the approval workflow' }, { status: 400 })
    }

    const allowedKeys = [
      'dateOfFirstAppointment', 'dateHired', 'expectedConfirmationDate',
      'serviceYearsRequired', 'currentPosition', 'currentRank',
      'currentGradeLevel', 'currentDepartmentId', 'newGradeLevel', 'newStep',
      'confirmationLetterUrl', 'assessmentFormUrl', 'remarks', 'justification',
      'status', 'state',
    ]
    const dateKeys = ['dateOfFirstAppointment', 'dateHired', 'expectedConfirmationDate']
    const intKeys = ['serviceYearsRequired']
    const data: any = {}
    for (const k of allowedKeys) {
      if (body[k] !== undefined) {
        if (dateKeys.includes(k)) {
          data[k] = body[k] ? new Date(body[k]) : null
        } else if (intKeys.includes(k)) {
          data[k] = body[k] === null || body[k] === '' ? null : Number(body[k])
        } else {
          data[k] = body[k] === '' ? null : body[k]
        }
      }
    }

    const updated = await db.appointmentConfirmation.update({
      where: { id },
      data,
      include: { staff: true },
    })
    await audit(user, 'update', {
      entity: 'AppointmentConfirmation',
      entityId: id,
      details: `Updated appointment confirmation ${updated.refNumber}`,
      ipAddress: getIp(req),
    })
    return NextResponse.json({ confirmation: updated })
  } catch (e: any) {
    console.error('Appointment confirmation PATCH:', e)
    return NextResponse.json({ error: 'Failed to update appointment confirmation' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params

    const existing = await db.appointmentConfirmation.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Appointment confirmation not found' }, { status: 404 })

    const role = user.activeRole || user.role
    const isCreator = existing.createdById === user.id
    const isAdmin = role === 'SUPER_ADMIN' || role === 'ADMIN'
    if (!isCreator && !isAdmin) {
      return NextResponse.json({ error: 'Not authorized to delete this appointment confirmation' }, { status: 403 })
    }
    // Only allow deleting Draft/Submitted confirmations — once HOD has approved,
    // the record is part of the audit trail.
    if (!['Draft', 'Submitted', 'Rejected', 'Cancelled'].includes(existing.status)) {
      return NextResponse.json({ error: `Cannot delete a confirmation in status ${existing.status} — cancel it instead` }, { status: 400 })
    }

    await db.appointmentConfirmation.delete({ where: { id } })
    await audit(user, 'delete', {
      entity: 'AppointmentConfirmation',
      entityId: id,
      details: `Deleted appointment confirmation ${existing.refNumber}`,
      ipAddress: getIp(req),
    })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('Appointment confirmation DELETE:', e)
    return NextResponse.json({ error: 'Failed to delete appointment confirmation' }, { status: 500 })
  }
}
