import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'

// Actions: hod_review | dfa_approve | cmd_approve | reject | cancel | update_exit
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const body = await req.json()
    const action = body.action

    const retirement = await db.retirement.findUnique({ where: { id }, include: { staff: true } })
    if (!retirement) return NextResponse.json({ error: 'Retirement not found' }, { status: 404 })

    const role = user.activeRole || user.role
    const isHod = ['HOD', 'HOU', 'SUPER_ADMIN', 'ADMIN'].includes(role)
    const isDfa = ['DFA', 'SUPER_ADMIN', 'ADMIN'].includes(role)
    const isCmd = role === 'CMD' || role === 'SUPER_ADMIN'

    const data: any = {}
    let notifTitle = ''
    let notifBody = ''
    let notifTargets: string[] = []

    if (action === 'hod_approve' || action === 'hod_review') {
      if (!isHod) return NextResponse.json({ error: 'Only HOD can approve at this stage' }, { status: 403 })
      if (retirement.status !== 'Submitted' && retirement.status !== 'Draft') return NextResponse.json({ error: `Cannot HOD-approve in status ${retirement.status}` }, { status: 400 })
      data.hodId = user.id
      data.hodName = user.fullName
      data.hodRemarks = body.remarks || null
      data.hodSignatureUrl = body.signatureUrl || null
      data.hodSignedAt = new Date()
      data.status = 'HOD Approved'
      notifTitle = 'Retirement approved by HOD'
      notifBody = `${retirement.staff?.fullName} — ${retirement.refNumber} approved by HOD (${user.fullName})`
      const targets = await db.user.findMany({ where: { role: 'DFA', isActive: true }, select: { id: true } })
      notifTargets = targets.map((u) => u.id)
    } else if (action === 'dfa_approve') {
      if (!isDfa) return NextResponse.json({ error: 'Only DFA can approve at this stage' }, { status: 403 })
      if (retirement.status !== 'HOD Approved') return NextResponse.json({ error: `Must be HOD Approved first` }, { status: 400 })
      data.dfaId = user.id
      data.dfaName = user.fullName
      data.dfaRemarks = body.remarks || null
      data.dfaSignatureUrl = body.signatureUrl || null
      data.dfaSignedAt = new Date()
      data.status = 'DFA Approved'
      notifTitle = 'Retirement approved by DFA'
      notifBody = `${retirement.staff?.fullName} — ${retirement.refNumber} approved by DFA (${user.fullName})`
      const targets = await db.user.findMany({ where: { role: 'CMD', isActive: true }, select: { id: true } })
      notifTargets = targets.map((u) => u.id)
    } else if (action === 'cmd_approve') {
      if (!isCmd) return NextResponse.json({ error: 'Only CMD can give final approval' }, { status: 403 })
      if (retirement.status !== 'DFA Approved') return NextResponse.json({ error: `Must be DFA Approved first` }, { status: 400 })
      data.cmdId = user.id
      data.cmdName = user.fullName
      data.cmdRemarks = body.remarks || null
      data.cmdSignatureUrl = body.signatureUrl || null
      data.cmdSignedAt = new Date()
      data.status = 'CMD Approved'
      data.state = 'approved'
      notifTitle = 'Retirement approved by CMD'
      notifBody = `${retirement.staff?.fullName} — ${retirement.refNumber} fully approved by CMD (${user.fullName})`
      notifTargets = retirement.createdById ? [retirement.createdById] : []
    } else if (action === 'reject') {
      if (!isHod && !isDfa && !isCmd) return NextResponse.json({ error: 'Not authorized to reject' }, { status: 403 })
      data.rejectedById = user.id
      data.rejectedAt = new Date()
      data.rejectReason = body.rejectReason || body.remarks || null
      data.status = 'Rejected'
      data.state = 'rejected'
      notifTitle = 'Retirement rejected'
      notifBody = `${retirement.staff?.fullName} — ${retirement.refNumber} rejected by ${user.fullName}`
      notifTargets = retirement.createdById ? [retirement.createdById] : []
    } else if (action === 'cancel') {
      if (retirement.createdById !== user.id && role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
        return NextResponse.json({ error: 'Only the creator can cancel' }, { status: 403 })
      }
      data.status = 'Cancelled'
      data.state = 'cancelled'
      notifTitle = 'Retirement cancelled'
      notifBody = `${retirement.staff?.fullName} — ${retirement.refNumber} cancelled`
      notifTargets = []
    } else if (action === 'update_exit') {
      if (!isHod && !isDfa && !isCmd && role !== 'AD' && role !== 'APPRAISAL_OFFICER') return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
      if (body.exitInterviewConducted !== undefined) data.exitInterviewConducted = Boolean(body.exitInterviewConducted)
      if (body.exitInterviewNotes !== undefined) data.exitInterviewNotes = body.exitInterviewNotes || null
      if (body.handoverCompleted !== undefined) data.handoverCompleted = Boolean(body.handoverCompleted)
      if (body.assetsReturned !== undefined) data.assetsReturned = Boolean(body.assetsReturned)
      notifTitle = 'Retirement exit details updated'
      notifBody = `${retirement.staff?.fullName} — ${retirement.refNumber} exit details updated by ${user.fullName}`
      notifTargets = retirement.createdById ? [retirement.createdById] : []
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const updated = await db.retirement.update({ where: { id }, data, include: { staff: true } })
    const auditAction = action === 'reject' ? 'reject' : action === 'cancel' ? 'cancel' : action === 'update_exit' ? 'update' : 'approve'
    await audit(user, auditAction, { entity: 'Retirement', entityId: id, details: `${action} ${updated.refNumber}`, ipAddress: getIp(req) })

    try {
      if (notifTargets.length > 0) {
        await db.notification.createMany({
          data: notifTargets.map((uid) => ({ userId: uid, title: notifTitle, body: notifBody, type: 'approval', link: `/?view=retirements` })),
        })
      }
    } catch (n) {
      console.error('Retirement notify failed:', n)
    }
    return NextResponse.json({ retirement: updated })
  } catch (e: any) {
    console.error('Retirement action:', e)
    return NextResponse.json({ error: 'Failed to perform action' }, { status: 500 })
  }
}
