import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'

// PV Workflow:
//   1. DFA/DDFA forwards approved requisition to Desk Officer
//   2. Desk Officer raises PV → forwards to Audit Officer (forward_to_audit)
//   3. Audit Officer reviews → clears for payment (audit_clear / forward_to_dfa)
//      OR queries → sends back to initiator (audit_query → initiator_respond → re-review)
//   4. DFA/DDFA receives cleared PV → forwards to CPO (forward_to_cpo)
//   5. CPO makes payment → marks as paid + cheque number (mark_paid)
//   6. PV + requisition archived for future reference (archive)
//
// Actions: forward_to_audit | audit_clear | audit_query | initiator_respond |
//          forward_to_dfa | forward_to_cpo | mark_paid | reject | cancel | archive
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const body = await req.json()
    const action = body.action

    const pv = await db.paymentVoucher.findUnique({ where: { id } })
    if (!pv) return NextResponse.json({ error: 'Payment voucher not found' }, { status: 404 })

    const role = user.activeRole || user.role
    const designationCode = (user as any).designation?.code || ''
    const isSuperAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(role)
    const isDfa = role === 'DFA' || isSuperAdmin
    // DFA can act as Desk Officer / Audit Officer / CPO when those specialized roles aren't staffed
    // (in small hospitals the DFA often wears multiple finance hats).
    const isDeskOfficer = role === 'DESK_OFFICER' || designationCode === 'DESK_OFFICER' || isSuperAdmin || isDfa
    const isAuditOfficer = role === 'AUDIT_OFFICER' || designationCode === 'AUDIT_OFFICER' || isSuperAdmin || isDfa
    const isCpo = role === 'CPO' || designationCode === 'CPO' || isSuperAdmin || isDfa
    const isOwner = pv.createdById === user.id

    const data: any = {}
    let notifTitle = ''
    let notifBody = ''
    let notifTargets: string[] = []

    if (action === 'forward_to_audit') {
      // Desk Officer raises PV and forwards to Audit
      if (!isDeskOfficer) return NextResponse.json({ error: 'Only Desk Officer can forward PV to audit' }, { status: 403 })
      if (!['Draft', 'Raised'].includes(pv.status)) return NextResponse.json({ error: `Cannot forward a PV in status ${pv.status}` }, { status: 400 })
      data.deskOfficerId = user.id
      data.deskOfficerName = user.fullName
      data.deskOfficerRemarks = body.remarks || null
      data.raisedAt = new Date()
      data.status = 'Pending Audit'
      data.state = 'forwarded_to_audit'
      notifTitle = 'PV forwarded to Audit'
      notifBody = `PV ${pv.refNumber} forwarded to Audit by ${user.fullName} (Desk Officer). Please review.`
      const targets = await db.user.findMany({ where: { role: 'AUDIT_OFFICER', isActive: true }, select: { id: true } })
      notifTargets = targets.map((u) => u.id)
    } else if (action === 'audit_clear') {
      // Audit Officer clears PV for payment → forwards to DFA/DDFA
      if (!isAuditOfficer) return NextResponse.json({ error: 'Only Audit Officer can clear PV for payment' }, { status: 403 })
      if (!['Pending Audit', 'Query Raised'].includes(pv.status)) return NextResponse.json({ error: `Cannot clear in status ${pv.status}` }, { status: 400 })
      data.auditOfficerId = user.id
      data.auditOfficerName = user.fullName
      data.auditComments = body.remarks || 'Cleared for payment'
      data.auditReviewedAt = new Date()
      data.auditApprovedAt = new Date()
      data.auditSignatureUrl = body.signatureUrl || null
      data.status = 'Audit Approved'
      data.state = 'audit_approved'
      notifTitle = 'PV cleared for payment by Audit'
      notifBody = `PV ${pv.refNumber} has been cleared for payment by ${user.fullName} (Audit). Forwarding to DFA/DDFA.`
      const targets = await db.user.findMany({ where: { role: { in: ['DFA'] }, isActive: true }, select: { id: true } })
      notifTargets = targets.map((u) => u.id)
    } else if (action === 'audit_query') {
      // Audit Officer raises a query → sends back to initiator
      if (!isAuditOfficer) return NextResponse.json({ error: 'Only Audit Officer can raise queries' }, { status: 403 })
      if (!['Pending Audit', 'Audit Approved'].includes(pv.status)) return NextResponse.json({ error: `Cannot raise query in status ${pv.status}` }, { status: 400 })
      data.auditOfficerId = user.id
      data.auditOfficerName = user.fullName
      data.queryText = body.remarks || null
      data.queryRaisedAt = new Date()
      data.queryRaisedById = user.id
      data.status = 'Query Raised'
      data.state = 'audit_queried'
      notifTitle = 'Audit query raised on PV'
      notifBody = `PV ${pv.refNumber}: Query raised by ${user.fullName} (Audit). ${body.remarks || ''}`
      notifTargets = pv.createdById ? [pv.createdById] : []
    } else if (action === 'initiator_respond') {
      // Initiator responds to audit query
      if (!isOwner && !isDeskOfficer && !isSuperAdmin) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
      if (pv.status !== 'Query Raised') return NextResponse.json({ error: `Cannot respond in status ${pv.status}` }, { status: 400 })
      data.initiatorResponse = body.responseText || body.remarks || null
      data.initiatorRespondedAt = new Date()
      data.initiatorRespondedById = user.id
      data.status = 'Pending Audit'
      data.state = 'forwarded_to_audit'
      notifTitle = 'Initiator responded to audit query'
      notifBody = `PV ${pv.refNumber}: Response submitted by ${user.fullName}. Please re-review.`
      const targets = await db.user.findMany({ where: { role: 'AUDIT_OFFICER', isActive: true }, select: { id: true } })
      notifTargets = targets.map((u) => u.id)
    } else if (action === 'forward_to_cpo') {
      // DFA/DDFA forwards cleared PV to CPO (Central Pay Officer) for payment
      if (!isDfa) return NextResponse.json({ error: 'Only DFA/DDFA can forward PV to CPO' }, { status: 403 })
      if (!['Audit Approved'].includes(pv.status)) return NextResponse.json({ error: `Cannot forward to CPO in status ${pv.status}. PV must be Audit Approved first.` }, { status: 400 })
      data.dfaApprovedPV = true
      data.dfaApprovedAt = new Date()
      data.dfaRemarks = body.remarks || null
      data.status = 'Payment Authorized'
      data.state = 'payment_authorized'
      notifTitle = 'PV forwarded to CPO for payment'
      notifBody = `PV ${pv.refNumber} forwarded to CPO by ${user.fullName} (DFA). Please process payment.`
      const targets = await db.user.findMany({ where: { role: 'CPO', isActive: true }, select: { id: true } })
      if (targets.length === 0) {
        // If no CPO users, notify DFA users
        const dfaTargets = await db.user.findMany({ where: { role: 'DFA', isActive: true }, select: { id: true } })
        notifTargets = dfaTargets.map((u) => u.id)
      } else {
        notifTargets = targets.map((u) => u.id)
      }
    } else if (action === 'mark_paid') {
      // CPO makes payment → marks PV as paid + enters cheque number
      if (!isCpo && !isDfa) return NextResponse.json({ error: 'Only CPO or DFA can mark PV as paid' }, { status: 403 })
      if (!['Payment Authorized', 'Payment Due'].includes(pv.status)) return NextResponse.json({ error: `Cannot mark paid in status ${pv.status}` }, { status: 400 })
      data.payingOfficerId = user.id
      data.payingOfficerName = user.fullName
      data.payingOfficerSignatureUrl = body.signatureUrl || null
      data.paidAt = new Date()
      data.paidBy = user.id
      data.chequeNumber = body.chequeNumber || null
      data.status = 'Paid'
      data.state = 'paid'
      notifTitle = 'PV payment completed'
      notifBody = `PV ${pv.refNumber} marked as paid by ${user.fullName} (CPO). Cheque: ${body.chequeNumber || 'N/A'}`
      notifTargets = pv.createdById ? [pv.createdById] : []
      // Also notify DFA
      const dfaUsers = await db.user.findMany({ where: { role: 'DFA', isActive: true }, select: { id: true } })
      notifTargets.push(...dfaUsers.map((u) => u.id))
    } else if (action === 'archive') {
      // Archive PV + requisition for future reference
      if (!isDfa && !isCpo && !isSuperAdmin) return NextResponse.json({ error: 'Only DFA or CPO can archive PVs' }, { status: 403 })
      if (pv.status !== 'Paid') return NextResponse.json({ error: 'Can only archive paid PVs' }, { status: 400 })
      data.status = 'Archived'
      data.state = 'archived'
      notifTitle = 'PV archived'
      notifBody = `PV ${pv.refNumber} archived by ${user.fullName} for future reference.`
      notifTargets = pv.createdById ? [pv.createdById] : []
    } else if (action === 'reject') {
      if (!isDeskOfficer && !isAuditOfficer && !isDfa) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
      data.status = 'Rejected'
      data.state = 'rejected'
      notifTitle = 'PV rejected'
      notifBody = `PV ${pv.refNumber} rejected by ${user.fullName}${body.rejectReason ? `: ${body.rejectReason}` : ''}`
      notifTargets = pv.createdById ? [pv.createdById] : []
    } else if (action === 'cancel') {
      if (!isOwner && !isSuperAdmin) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
      data.status = 'Cancelled'
      data.state = 'cancelled'
      notifTitle = 'PV cancelled'
      notifBody = `PV ${pv.refNumber} cancelled`
      notifTargets = []
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const updated = await db.paymentVoucher.update({ where: { id }, data })
    const auditAction =
      action === 'reject' ? 'reject' :
      action === 'cancel' ? 'cancel' :
      action === 'mark_paid' ? 'complete' :
      action === 'archive' ? 'close' :
      action === 'forward_to_audit' ? 'forward' :
      action === 'forward_to_cpo' ? 'forward' :
      'approve'
    await audit(user, auditAction, { entity: 'PaymentVoucher', entityId: id, details: `${action} ${updated.refNumber}`, ipAddress: getIp(req) })

    try {
      if (notifTargets.length > 0) {
        await db.notification.createMany({
          data: notifTargets.map((uid) => ({
            userId: uid, title: notifTitle, body: notifBody, type: 'approval',
            link: `/?view=payment-vouchers`,
          })),
        })
      }
    } catch (n) {
      console.error('PV notify failed:', n)
    }

    // Create a PVComment for the audit trail
    try {
      await db.pVComment.create({
        data: {
          pvId: id,
          type: action === 'audit_query' ? 'query' : action === 'initiator_respond' ? 'response' : 'note',
          body: body.remarks || body.responseText || body.chequeNumber || action,
          userId: user.id,
        },
      })
    } catch (e) {
      // Non-critical
    }

    return NextResponse.json({ paymentVoucher: updated })
  } catch (e: any) {
    console.error('PV action:', e)
    return NextResponse.json({ error: 'Failed to perform action' }, { status: 500 })
  }
}
