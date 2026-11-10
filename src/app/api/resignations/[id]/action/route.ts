import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'

// POST /api/resignations/[id]/action
// Body: { action: 'hod_acknowledge' | 'dfa_approve' | 'cmd_accept' | 'reject' | 'withdraw',
//         remarks?, signatureUrl?, rejectReason?,
//         exitInterviewConducted?, exitInterviewNotes?, handoverCompleted?, assetsReturned? }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const body = await req.json()
    const action = body.action

    const resignation = await db.resignation.findUnique({ where: { id }, include: { staff: true } })
    if (!resignation) return NextResponse.json({ error: 'Resignation not found' }, { status: 404 })

    const role = user.activeRole || user.role
    const isHod = role === 'HOD' || role === 'HOU' || role === 'SUPER_ADMIN' || role === 'ADMIN'
    const isDfa = role === 'DFA' || role === 'SUPER_ADMIN' || role === 'ADMIN'
    const isCmd = role === 'CMD' || role === 'SUPER_ADMIN'

    const data: any = {}
    let notifTitle = ''
    let notifBody = ''
    let notifTargets: string[] = []

    if (action === 'hod_acknowledge') {
      if (!isHod) return NextResponse.json({ error: 'Only HOD can acknowledge' }, { status: 403 })
      if (resignation.status !== 'Submitted' && resignation.status !== 'Draft') {
        return NextResponse.json({ error: `Cannot HOD-acknowledge a resignation in status ${resignation.status}` }, { status: 400 })
      }
      data.hodId = user.id
      data.hodName = user.fullName
      data.hodRemarks = body.remarks || null
      data.hodSignatureUrl = body.signatureUrl || null
      data.hodSignedAt = new Date()
      data.status = 'HOD Acknowledged'
      notifTitle = 'Resignation acknowledged by HOD'
      notifBody = `${resignation.staff?.fullName} — ${resignation.refNumber} acknowledged by HOD (${user.fullName})`
      const dfaUsers = await db.user.findMany({ where: { role: 'DFA', isActive: true }, select: { id: true } })
      notifTargets = dfaUsers.map((u) => u.id)
    } else if (action === 'dfa_approve') {
      if (!isDfa) return NextResponse.json({ error: 'Only DFA can approve at this stage' }, { status: 403 })
      if (resignation.status !== 'HOD Acknowledged') {
        return NextResponse.json({ error: `Resignation must be HOD Acknowledged first (currently ${resignation.status})` }, { status: 400 })
      }
      data.dfaId = user.id
      data.dfaName = user.fullName
      data.dfaRemarks = body.remarks || null
      data.dfaSignatureUrl = body.signatureUrl || null
      data.dfaSignedAt = new Date()
      data.status = 'DFA Approved'
      notifTitle = 'Resignation approved by DFA'
      notifBody = `${resignation.staff?.fullName} — ${resignation.refNumber} approved by DFA (${user.fullName})`
      const cmdUsers = await db.user.findMany({ where: { role: 'CMD', isActive: true }, select: { id: true } })
      notifTargets = cmdUsers.map((u) => u.id)
    } else if (action === 'cmd_accept') {
      if (!isCmd) return NextResponse.json({ error: 'Only CMD can accept' }, { status: 403 })
      if (resignation.status !== 'DFA Approved') {
        return NextResponse.json({ error: `Resignation must be DFA Approved first (currently ${resignation.status})` }, { status: 400 })
      }
      data.cmdId = user.id
      data.cmdName = user.fullName
      data.cmdRemarks = body.remarks || null
      data.cmdSignatureUrl = body.signatureUrl || null
      data.cmdSignedAt = new Date()
      data.status = 'Accepted'
      data.state = 'approved'
      notifTitle = 'Resignation accepted by CMD'
      notifBody = `${resignation.staff?.fullName} — ${resignation.refNumber} accepted by CMD (${user.fullName})`
      notifTargets = resignation.createdById ? [resignation.createdById] : []
    } else if (action === 'reject') {
      if (!isHod && !isDfa && !isCmd) {
        return NextResponse.json({ error: 'Not authorized to reject' }, { status: 403 })
      }
      data.rejectedById = user.id
      data.rejectedAt = new Date()
      data.rejectReason = body.rejectReason || body.remarks || null
      data.status = 'Rejected'
      data.state = 'rejected'
      notifTitle = 'Resignation rejected'
      notifBody = `${resignation.staff?.fullName} — ${resignation.refNumber} was rejected by ${user.fullName}${data.rejectReason ? `: ${data.rejectReason}` : ''}`
      notifTargets = resignation.createdById ? [resignation.createdById] : []
    } else if (action === 'withdraw') {
      // The staff who created it (or an admin) can withdraw
      const isOwner = resignation.createdById === user.id || resignation.staff?.userId === user.id
      if (!isOwner && role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
        return NextResponse.json({ error: 'Only the staff who submitted the resignation can withdraw it' }, { status: 403 })
      }
      if (!['Submitted', 'HOD Acknowledged'].includes(resignation.status)) {
        return NextResponse.json({ error: `Cannot withdraw a resignation in status ${resignation.status}` }, { status: 400 })
      }
      data.isWithdrawn = true
      data.withdrawnAt = new Date()
      data.withdrawnById = user.id
      data.status = 'Withdrawn'
      data.state = 'cancelled'
      notifTitle = 'Resignation withdrawn'
      notifBody = `${resignation.staff?.fullName} — ${resignation.refNumber} was withdrawn`
      // Notify HODs (in case they were tracking)
      const hodUsers = await db.user.findMany({ where: { role: 'HOD', isActive: true }, select: { id: true } })
      notifTargets = hodUsers.map((u) => u.id)
    } else if (action === 'update_exit') {
      if (!isHod && !isDfa && !isCmd && role !== 'AD' && role !== 'APPRAISAL_OFFICER') {
        return NextResponse.json({ error: 'Not authorized to update exit details' }, { status: 403 })
      }
      if (body.exitInterviewConducted !== undefined) data.exitInterviewConducted = Boolean(body.exitInterviewConducted)
      if (body.exitInterviewNotes !== undefined) data.exitInterviewNotes = body.exitInterviewNotes || null
      if (body.handoverCompleted !== undefined) data.handoverCompleted = Boolean(body.handoverCompleted)
      if (body.assetsReturned !== undefined) data.assetsReturned = Boolean(body.assetsReturned)
      notifTitle = 'Resignation exit details updated'
      notifBody = `${resignation.staff?.fullName} — ${resignation.refNumber} exit details updated by ${user.fullName}`
      notifTargets = resignation.createdById ? [resignation.createdById] : []
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const updated = await db.resignation.update({
      where: { id },
      data,
      include: { staff: true },
    })

    // Audit action
    const auditAction =
      action === 'reject' ? 'reject' :
      action === 'withdraw' ? 'withdraw' :
      action === 'update_exit' ? 'update' :
      action === 'cmd_accept' ? 'approve' :
      action === 'hod_acknowledge' ? 'acknowledge' :
      'approve'
    await audit(user, auditAction, { entity: 'Resignation', entityId: id, details: `${action} ${updated.refNumber}${body.remarks || body.rejectReason ? ` — ${body.rejectReason || body.remarks}` : ''}`, ipAddress: getIp(req) })

    try {
      if (notifTargets.length > 0) {
        await db.notification.createMany({
          data: notifTargets.map((uid) => ({
            userId: uid,
            title: notifTitle,
            body: notifBody,
            type: 'approval',
            link: `/?view=resignations`,
          })),
        })
      }
    } catch (n) {
      console.error('Notify resignation failed:', n)
    }

    return NextResponse.json({ resignation: updated })
  } catch (e: any) {
    console.error('Resignation action:', e)
    return NextResponse.json({ error: 'Failed to perform action' }, { status: 500 })
  }
}
