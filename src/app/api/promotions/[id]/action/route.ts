import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'

// POST /api/promotions/[id]/action
// Body: { action: 'hod_approve' | 'dfa_approve' | 'cmd_approve' | 'reject' | 'cancel',
//         remarks?, signatureUrl?, rejectReason? }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const body = await req.json()
    const action = body.action

    const promotion = await db.promotion.findUnique({ where: { id }, include: { staff: true } })
    if (!promotion) return NextResponse.json({ error: 'Promotion not found' }, { status: 404 })

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
      if (promotion.status !== 'Submitted' && promotion.status !== 'Draft') {
        return NextResponse.json({ error: `Cannot HOD-approve a promotion in status ${promotion.status}` }, { status: 400 })
      }
      data.hodId = user.id
      data.hodName = user.fullName
      data.hodRemarks = body.remarks || null
      data.hodSignatureUrl = body.signatureUrl || null
      data.hodSignedAt = new Date()
      data.status = 'HOD Approved'
      notifTitle = 'Promotion approved by HOD'
      notifBody = `${promotion.staff?.fullName} — ${promotion.refNumber} approved by HOD (${user.fullName})`
      // Notify DFA users (next approver)
      const dfaUsers = await db.user.findMany({ where: { role: 'DFA', isActive: true }, select: { id: true } })
      notifTargets = dfaUsers.map((u) => u.id)
    } else if (action === 'dfa_approve') {
      if (!isDfa) return NextResponse.json({ error: 'Only DFA can approve at this stage' }, { status: 403 })
      if (promotion.status !== 'HOD Approved') {
        return NextResponse.json({ error: `Promotion must be HOD Approved first (currently ${promotion.status})` }, { status: 400 })
      }
      data.dfaId = user.id
      data.dfaName = user.fullName
      data.dfaRemarks = body.remarks || null
      data.dfaSignatureUrl = body.signatureUrl || null
      data.dfaSignedAt = new Date()
      data.status = 'DFA Approved'
      notifTitle = 'Promotion approved by DFA'
      notifBody = `${promotion.staff?.fullName} — ${promotion.refNumber} approved by DFA (${user.fullName})`
      const cmdUsers = await db.user.findMany({ where: { role: 'CMD', isActive: true }, select: { id: true } })
      notifTargets = cmdUsers.map((u) => u.id)
    } else if (action === 'cmd_approve') {
      if (!isCmd) return NextResponse.json({ error: 'Only CMD can give final approval' }, { status: 403 })
      if (promotion.status !== 'DFA Approved') {
        return NextResponse.json({ error: `Promotion must be DFA Approved first (currently ${promotion.status})` }, { status: 400 })
      }
      data.cmdId = user.id
      data.cmdName = user.fullName
      data.cmdRemarks = body.remarks || null
      data.cmdSignatureUrl = body.signatureUrl || null
      data.cmdSignedAt = new Date()
      data.status = 'CMD Approved'
      data.state = 'approved'
      notifTitle = 'Promotion approved by CMD'
      notifBody = `${promotion.staff?.fullName} — ${promotion.refNumber} fully approved by CMD (${user.fullName})`
      // Notify creator + (optionally) HOD
      notifTargets = promotion.createdById ? [promotion.createdById] : []
    } else if (action === 'reject') {
      if (!isHod && !isDfa && !isCmd) {
        return NextResponse.json({ error: 'Not authorized to reject' }, { status: 403 })
      }
      data.rejectedById = user.id
      data.rejectedAt = new Date()
      data.rejectReason = body.rejectReason || body.remarks || null
      data.status = 'Rejected'
      data.state = 'rejected'
      notifTitle = 'Promotion rejected'
      notifBody = `${promotion.staff?.fullName} — ${promotion.refNumber} was rejected by ${user.fullName}${data.rejectReason ? `: ${data.rejectReason}` : ''}`
      notifTargets = promotion.createdById ? [promotion.createdById] : []
    } else if (action === 'cancel') {
      if (promotion.createdById !== user.id && role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
        return NextResponse.json({ error: 'Only the creator can cancel' }, { status: 403 })
      }
      data.status = 'Cancelled'
      data.state = 'cancelled'
      notifTitle = 'Promotion cancelled'
      notifBody = `${promotion.staff?.fullName} — ${promotion.refNumber} was cancelled`
      notifTargets = []
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const updated = await db.promotion.update({
      where: { id },
      data,
      include: { staff: true },
    })

    // Audit action
    const auditAction =
      action === 'reject' ? 'reject' :
      action === 'cancel' ? 'cancel' :
      'approve'
    await audit(user, auditAction, { entity: 'Promotion', entityId: id, details: `${action} ${updated.refNumber}${body.remarks || body.rejectReason ? ` — ${body.rejectReason || body.remarks}` : ''}`, ipAddress: getIp(req) })

    // Send notifications (best-effort)
    try {
      if (notifTargets.length > 0) {
        await db.notification.createMany({
          data: notifTargets.map((uid) => ({
            userId: uid,
            title: notifTitle,
            body: notifBody,
            type: 'approval',
            link: `/?view=promotions`,
          })),
        })
      }
    } catch (n) {
      console.error('Notify promotion failed:', n)
    }

    return NextResponse.json({ promotion: updated })
  } catch (e: any) {
    console.error('Promotion action:', e)
    return NextResponse.json({ error: 'Failed to perform action' }, { status: 500 })
  }
}
