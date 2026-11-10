import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'

// POST /api/terminations/[id]/action
// Body: { action: 'hod_approve' | 'dfa_approve' | 'cmd_approve' | 'reject' | 'cancel',
//         remarks?, signatureUrl?, rejectReason?,
//         exitInterviewConducted?, exitInterviewNotes?, handoverCompleted?, assetsReturned? }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const body = await req.json()
    const action = body.action

    const termination = await db.termination.findUnique({ where: { id }, include: { staff: true } })
    if (!termination) return NextResponse.json({ error: 'Termination not found' }, { status: 404 })

    const role = user.activeRole || user.role
    const isHod = role === 'HOD' || role === 'HOU' || role === 'SUPER_ADMIN' || role === 'ADMIN'
    const isDfa = role === 'DFA' || role === 'SUPER_ADMIN' || role === 'ADMIN'
    const isCmd = role === 'CMD' || role === 'SUPER_ADMIN'

    const data: any = {}
    let notifTitle = ''
    let notifBody = ''
    let notifTargets: string[] = []

    if (action === 'hod_approve') {
      if (!isHod) return NextResponse.json({ error: 'Only HOD can approve at this stage' }, { status: 403 })
      if (termination.status !== 'Submitted' && termination.status !== 'Draft') {
        return NextResponse.json({ error: `Cannot HOD-approve a termination in status ${termination.status}` }, { status: 400 })
      }
      data.hodId = user.id
      data.hodName = user.fullName
      data.hodRemarks = body.remarks || null
      data.hodSignatureUrl = body.signatureUrl || null
      data.hodSignedAt = new Date()
      data.status = 'HOD Approved'
      notifTitle = 'Termination approved by HOD'
      notifBody = `${termination.staff?.fullName} — ${termination.refNumber} approved by HOD (${user.fullName})`
      const dfaUsers = await db.user.findMany({ where: { role: 'DFA', isActive: true }, select: { id: true } })
      notifTargets = dfaUsers.map((u) => u.id)
    } else if (action === 'dfa_approve') {
      if (!isDfa) return NextResponse.json({ error: 'Only DFA can approve at this stage' }, { status: 403 })
      if (termination.status !== 'HOD Approved') {
        return NextResponse.json({ error: `Termination must be HOD Approved first (currently ${termination.status})` }, { status: 400 })
      }
      data.dfaId = user.id
      data.dfaName = user.fullName
      data.dfaRemarks = body.remarks || null
      data.dfaSignatureUrl = body.signatureUrl || null
      data.dfaSignedAt = new Date()
      data.status = 'DFA Approved'
      notifTitle = 'Termination approved by DFA'
      notifBody = `${termination.staff?.fullName} — ${termination.refNumber} approved by DFA (${user.fullName})`
      const cmdUsers = await db.user.findMany({ where: { role: 'CMD', isActive: true }, select: { id: true } })
      notifTargets = cmdUsers.map((u) => u.id)
    } else if (action === 'cmd_approve') {
      if (!isCmd) return NextResponse.json({ error: 'Only CMD can give final approval' }, { status: 403 })
      if (termination.status !== 'DFA Approved') {
        return NextResponse.json({ error: `Termination must be DFA Approved first (currently ${termination.status})` }, { status: 400 })
      }
      data.cmdId = user.id
      data.cmdName = user.fullName
      data.cmdRemarks = body.remarks || null
      data.cmdSignatureUrl = body.signatureUrl || null
      data.cmdSignedAt = new Date()
      data.status = 'CMD Approved'
      data.state = 'approved'
      notifTitle = 'Termination approved by CMD'
      notifBody = `${termination.staff?.fullName} — ${termination.refNumber} fully approved by CMD (${user.fullName})`
      notifTargets = termination.createdById ? [termination.createdById] : []
    } else if (action === 'reject') {
      if (!isHod && !isDfa && !isCmd) {
        return NextResponse.json({ error: 'Not authorized to reject' }, { status: 403 })
      }
      data.rejectedById = user.id
      data.rejectedAt = new Date()
      data.rejectReason = body.rejectReason || body.remarks || null
      data.status = 'Rejected'
      data.state = 'rejected'
      notifTitle = 'Termination rejected'
      notifBody = `${termination.staff?.fullName} — ${termination.refNumber} was rejected by ${user.fullName}${data.rejectReason ? `: ${data.rejectReason}` : ''}`
      notifTargets = termination.createdById ? [termination.createdById] : []
    } else if (action === 'cancel') {
      if (termination.createdById !== user.id && role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
        return NextResponse.json({ error: 'Only the creator can cancel' }, { status: 403 })
      }
      data.status = 'Cancelled'
      data.state = 'cancelled'
      notifTitle = 'Termination cancelled'
      notifBody = `${termination.staff?.fullName} — ${termination.refNumber} was cancelled`
      notifTargets = []
    } else if (action === 'update_exit') {
      // Update exit interview / handover / assets without changing the approval status
      if (!isHod && !isDfa && !isCmd && role !== 'AD' && role !== 'APPRAISAL_OFFICER') {
        return NextResponse.json({ error: 'Not authorized to update exit details' }, { status: 403 })
      }
      if (body.exitInterviewConducted !== undefined) data.exitInterviewConducted = Boolean(body.exitInterviewConducted)
      if (body.exitInterviewNotes !== undefined) data.exitInterviewNotes = body.exitInterviewNotes || null
      if (body.handoverCompleted !== undefined) data.handoverCompleted = Boolean(body.handoverCompleted)
      if (body.assetsReturned !== undefined) data.assetsReturned = Boolean(body.assetsReturned)
      notifTitle = 'Termination exit details updated'
      notifBody = `${termination.staff?.fullName} — ${termination.refNumber} exit details updated by ${user.fullName}`
      notifTargets = termination.createdById ? [termination.createdById] : []
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const updated = await db.termination.update({
      where: { id },
      data,
      include: { staff: true },
    })

    // Audit action
    const auditAction =
      action === 'reject' ? 'reject' :
      action === 'cancel' ? 'cancel' :
      action === 'update_exit' ? 'update' :
      'approve'
    await audit(user, auditAction, { entity: 'Termination', entityId: id, details: `${action} ${updated.refNumber}${body.remarks || body.rejectReason ? ` — ${body.rejectReason || body.remarks}` : ''}`, ipAddress: getIp(req) })

    try {
      if (notifTargets.length > 0) {
        await db.notification.createMany({
          data: notifTargets.map((uid) => ({
            userId: uid,
            title: notifTitle,
            body: notifBody,
            type: 'approval',
            link: `/?view=terminations`,
          })),
        })
      }
    } catch (n) {
      console.error('Notify termination failed:', n)
    }

    return NextResponse.json({ termination: updated })
  } catch (e: any) {
    console.error('Termination action:', e)
    return NextResponse.json({ error: 'Failed to perform action' }, { status: 500 })
  }
}
