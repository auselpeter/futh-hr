import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'

// Actions: planning_review | hod_approve | dfa_approve | cmd_approve | reject | cancel
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const body = await req.json()
    const action = body.action

    const posting = await db.postingTransfer.findUnique({ where: { id }, include: { staff: true } })
    if (!posting) return NextResponse.json({ error: 'Posting not found' }, { status: 404 })

    const role = user.activeRole || user.role
    const isPlanning = ['SUPER_ADMIN', 'ADMIN', 'CMA', 'AD', 'HOD'].includes(role)
    const isHod = ['HOD', 'HOU', 'SUPER_ADMIN', 'ADMIN'].includes(role)
    const isDfa = ['DFA', 'SUPER_ADMIN', 'ADMIN'].includes(role)
    const isCmd = role === 'CMD' || role === 'SUPER_ADMIN'

    const data: any = {}
    let notifTitle = ''
    let notifBody = ''
    let notifTargets: string[] = []

    if (action === 'planning_review') {
      if (!isPlanning) return NextResponse.json({ error: 'Only planning officer can review' }, { status: 403 })
      if (posting.status !== 'Submitted') return NextResponse.json({ error: `Cannot review in status ${posting.status}` }, { status: 400 })
      data.planningReviewedById = user.id
      data.planningReviewedAt = new Date()
      data.planningRemarks = body.remarks || null
      data.status = 'Planning Reviewed'
      notifTitle = 'Posting reviewed by planning'
      notifBody = `Posting ${posting.refNumber} reviewed by planning (${user.fullName})`
      const targets = await db.user.findMany({ where: { role: { in: ['HOD', 'SUPER_ADMIN', 'ADMIN'] }, isActive: true }, select: { id: true } })
      notifTargets = targets.map((u) => u.id)
    } else if (action === 'hod_approve') {
      if (!isHod) return NextResponse.json({ error: 'Only HOD can approve at this stage' }, { status: 403 })
      if (posting.status !== 'Planning Reviewed') return NextResponse.json({ error: `Must be Planning Reviewed first` }, { status: 400 })
      data.hodId = user.id
      data.hodName = user.fullName
      data.hodRemarks = body.remarks || null
      data.hodSignatureUrl = body.signatureUrl || null
      data.hodSignedAt = new Date()
      data.status = 'HOD Approved'
      notifTitle = 'Posting approved by HOD'
      notifBody = `Posting ${posting.refNumber} approved by HOD (${user.fullName})`
      const targets = await db.user.findMany({ where: { role: { in: ['DFA', 'SUPER_ADMIN', 'ADMIN'] }, isActive: true }, select: { id: true } })
      notifTargets = targets.map((u) => u.id)
    } else if (action === 'dfa_approve') {
      if (!isDfa) return NextResponse.json({ error: 'Only DFA can approve at this stage' }, { status: 403 })
      if (posting.status !== 'HOD Approved') return NextResponse.json({ error: `Must be HOD Approved first` }, { status: 400 })
      data.dfaId = user.id
      data.dfaName = user.fullName
      data.dfaRemarks = body.remarks || null
      data.dfaSignatureUrl = body.signatureUrl || null
      data.dfaSignedAt = new Date()
      data.status = 'DFA Approved'
      notifTitle = 'Posting approved by DFA'
      notifBody = `Posting ${posting.refNumber} approved by DFA (${user.fullName})`
      const targets = await db.user.findMany({ where: { role: { in: ['CMD', 'SUPER_ADMIN'] }, isActive: true }, select: { id: true } })
      notifTargets = targets.map((u) => u.id)
    } else if (action === 'cmd_approve') {
      if (!isCmd) return NextResponse.json({ error: 'Only CMD can give final approval' }, { status: 403 })
      if (posting.status !== 'DFA Approved') return NextResponse.json({ error: `Must be DFA Approved first` }, { status: 400 })
      data.cmdId = user.id
      data.cmdName = user.fullName
      data.cmdRemarks = body.remarks || null
      data.cmdSignatureUrl = body.signatureUrl || null
      data.cmdSignedAt = new Date()
      data.status = 'CMD Approved'
      data.state = 'approved'
      notifTitle = 'Posting approved by CMD'
      notifBody = `Posting ${posting.refNumber} fully approved by CMD (${user.fullName})`
      notifTargets = posting.createdById ? [posting.createdById] : []
    } else if (action === 'reject') {
      if (!isPlanning && !isHod && !isDfa && !isCmd) return NextResponse.json({ error: 'Not authorized to reject' }, { status: 403 })
      data.rejectedById = user.id
      data.rejectedAt = new Date()
      data.rejectReason = body.rejectReason || body.remarks || null
      data.status = 'Rejected'
      data.state = 'rejected'
      notifTitle = 'Posting rejected'
      notifBody = `Posting ${posting.refNumber} rejected by ${user.fullName}`
      notifTargets = posting.createdById ? [posting.createdById] : []
    } else if (action === 'cancel') {
      if (posting.createdById !== user.id && role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
        return NextResponse.json({ error: 'Only the creator can cancel' }, { status: 403 })
      }
      data.status = 'Cancelled'
      data.state = 'cancelled'
      notifTitle = 'Posting cancelled'
      notifBody = `Posting ${posting.refNumber} cancelled`
      notifTargets = []
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const updated = await db.postingTransfer.update({ where: { id }, data, include: { staff: true } })
    const auditAction = action === 'reject' ? 'reject' : action === 'cancel' ? 'cancel' : 'approve'
    await audit(user, auditAction, { entity: 'PostingTransfer', entityId: id, details: `${action} ${updated.refNumber}`, ipAddress: getIp(req) })

    try {
      if (notifTargets.length > 0) {
        await db.notification.createMany({
          data: notifTargets.map((uid) => ({ userId: uid, title: notifTitle, body: notifBody, type: 'approval', link: `/?view=posting-transfer` })),
        })
      }
    } catch (n) {
      console.error('PT notify failed:', n)
    }
    return NextResponse.json({ posting: updated })
  } catch (e: any) {
    console.error('PT action:', e)
    return NextResponse.json({ error: 'Failed to perform action' }, { status: 500 })
  }
}
