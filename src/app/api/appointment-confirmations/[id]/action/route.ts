import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'

// POST /api/appointment-confirmations/[id]/action
// Body: { action: 'hod_approve' | 'dfa_approve' | 'cmd_approve' | 'reject' | 'cancel' | 'complete',
//         remarks?, signatureUrl?, rejectReason? }
//
// Workflow mirrors Promotions:
//   Submitted → HOD Approved → DFA Approved → CMD Approved → (Completed)
//   At any pre-CMD stage: Rejected (back to creator)
//
// `complete` is the final close-out action: it sets Staff.confirmationDate to
// the actual confirmation date and (optionally) bumps grade level/step.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const body = await req.json()
    const action = body.action

    const confirmation = await db.appointmentConfirmation.findUnique({ where: { id }, include: { staff: true } })
    if (!confirmation) return NextResponse.json({ error: 'Appointment confirmation not found' }, { status: 404 })

    const role = user.activeRole || user.role
    const isHod = role === 'HOD' || role === 'HOU' || role === 'SUPER_ADMIN' || role === 'ADMIN'
    const isDfa = role === 'DFA' || role === 'SUPER_ADMIN' || role === 'ADMIN'
    const isCmd = role === 'CMD' || role === 'SUPER_ADMIN'
    const isRegistry = role === 'REGISTRY_OFFICER' || role === 'SUPER_ADMIN' || role === 'ADMIN'

    const data: any = {}
    let notifTitle = ''
    let notifBody = ''
    let notifTargets: string[] = []

    if (action === 'hod_approve') {
      if (!isHod) return NextResponse.json({ error: 'Only HOD can approve at this stage' }, { status: 403 })
      if (confirmation.status !== 'Submitted' && confirmation.status !== 'Draft') {
        return NextResponse.json({ error: `Cannot HOD-approve a confirmation in status ${confirmation.status}` }, { status: 400 })
      }
      data.hodId = user.id
      data.hodName = user.fullName
      data.hodRemarks = body.remarks || null
      data.hodSignatureUrl = body.signatureUrl || null
      data.hodSignedAt = new Date()
      data.status = 'HOD Approved'
      notifTitle = 'Appointment confirmation approved by HOD'
      notifBody = `${confirmation.staff?.fullName} — ${confirmation.refNumber} approved by HOD (${user.fullName})`
      const dfaUsers = await db.user.findMany({ where: { role: 'DFA', isActive: true }, select: { id: true } })
      notifTargets = dfaUsers.map((u) => u.id)
    } else if (action === 'dfa_approve') {
      if (!isDfa) return NextResponse.json({ error: 'Only DFA can approve at this stage' }, { status: 403 })
      if (confirmation.status !== 'HOD Approved') {
        return NextResponse.json({ error: `Confirmation must be HOD Approved first (currently ${confirmation.status})` }, { status: 400 })
      }
      data.dfaId = user.id
      data.dfaName = user.fullName
      data.dfaRemarks = body.remarks || null
      data.dfaSignatureUrl = body.signatureUrl || null
      data.dfaSignedAt = new Date()
      data.status = 'DFA Approved'
      notifTitle = 'Appointment confirmation approved by DFA'
      notifBody = `${confirmation.staff?.fullName} — ${confirmation.refNumber} approved by DFA (${user.fullName})`
      const cmdUsers = await db.user.findMany({ where: { role: 'CMD', isActive: true }, select: { id: true } })
      notifTargets = cmdUsers.map((u) => u.id)
    } else if (action === 'cmd_approve') {
      if (!isCmd) return NextResponse.json({ error: 'Only CMD can give final approval' }, { status: 403 })
      if (confirmation.status !== 'DFA Approved') {
        return NextResponse.json({ error: `Confirmation must be DFA Approved first (currently ${confirmation.status})` }, { status: 400 })
      }
      data.cmdId = user.id
      data.cmdName = user.fullName
      data.cmdRemarks = body.remarks || null
      data.cmdSignatureUrl = body.signatureUrl || null
      data.cmdSignedAt = new Date()
      data.status = 'CMD Approved'
      data.state = 'approved'
      notifTitle = 'Appointment confirmation approved by CMD'
      notifBody = `${confirmation.staff?.fullName} — ${confirmation.refNumber} fully approved by CMD (${user.fullName})`
      notifTargets = confirmation.createdById ? [confirmation.createdById] : []
    } else if (action === 'complete') {
      // Registry / Admin / CMD only — closes out the approved record by
      // stamping the actual confirmation date on the staff record.
      if (!isRegistry && !isCmd) {
        return NextResponse.json({ error: 'Only Registry, Admin, or CMD can complete the confirmation' }, { status: 403 })
      }
      if (confirmation.status !== 'CMD Approved') {
        return NextResponse.json({ error: `Confirmation must be CMD Approved first (currently ${confirmation.status})` }, { status: 400 })
      }
      const actualDate = body.actualConfirmationDate ? new Date(body.actualConfirmationDate) : new Date()
      data.actualConfirmationDate = actualDate
      data.status = 'Completed'
      data.state = 'completed'
      notifTitle = 'Appointment confirmation completed'
      notifBody = `${confirmation.staff?.fullName} — ${confirmation.refNumber} completed. Confirmation date: ${actualDate.toISOString().slice(0, 10)}`
      // Update the linked Staff record's confirmationDate + optional grade/step bump
      const staffUpdate: any = { confirmationDate: actualDate }
      if (confirmation.newGradeLevel) staffUpdate.gradeLevel = confirmation.newGradeLevel
      if (confirmation.newStep) staffUpdate.step = confirmation.newStep
      await db.staff.update({ where: { id: confirmation.staffId }, data: staffUpdate })
      notifTargets = confirmation.createdById ? [confirmation.createdById] : []
      // Also notify the staff member themselves (if they have a user account)
      const staffUser = await db.staff.findUnique({
        where: { id: confirmation.staffId },
        select: { userId: true },
      })
      if (staffUser?.userId) notifTargets.push(staffUser.userId)
    } else if (action === 'reject') {
      if (!isHod && !isDfa && !isCmd) {
        return NextResponse.json({ error: 'Not authorized to reject' }, { status: 403 })
      }
      data.rejectedById = user.id
      data.rejectedAt = new Date()
      data.rejectReason = body.rejectReason || body.remarks || null
      data.status = 'Rejected'
      data.state = 'rejected'
      notifTitle = 'Appointment confirmation rejected'
      notifBody = `${confirmation.staff?.fullName} — ${confirmation.refNumber} was rejected by ${user.fullName}${data.rejectReason ? `: ${data.rejectReason}` : ''}`
      notifTargets = confirmation.createdById ? [confirmation.createdById] : []
    } else if (action === 'cancel') {
      if (confirmation.createdById !== user.id && role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
        return NextResponse.json({ error: 'Only the creator can cancel' }, { status: 403 })
      }
      data.status = 'Cancelled'
      data.state = 'cancelled'
      notifTitle = 'Appointment confirmation cancelled'
      notifBody = `${confirmation.staff?.fullName} — ${confirmation.refNumber} was cancelled`
      notifTargets = []
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const updated = await db.appointmentConfirmation.update({
      where: { id },
      data,
      include: { staff: true },
    })

    const auditAction =
      action === 'reject' ? 'reject' :
      action === 'cancel' ? 'cancel' :
      action === 'complete' ? 'complete' :
      'approve'
    await audit(user, auditAction, {
      entity: 'AppointmentConfirmation',
      entityId: id,
      details: `${action} ${updated.refNumber}${body.remarks || body.rejectReason ? ` — ${body.rejectReason || body.remarks}` : ''}`,
      ipAddress: getIp(req),
    })

    try {
      if (notifTargets.length > 0) {
        await db.notification.createMany({
          data: notifTargets.map((uid) => ({
            userId: uid,
            title: notifTitle,
            body: notifBody,
            type: 'approval',
            link: `/?view=appointment-confirmations`,
          })),
        })
      }
    } catch (n) {
      console.error('Notify appointment confirmation failed:', n)
    }

    return NextResponse.json({ confirmation: updated })
  } catch (e: any) {
    console.error('Appointment confirmation action:', e)
    return NextResponse.json({ error: 'Failed to perform action' }, { status: 500 })
  }
}
