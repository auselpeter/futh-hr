import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'
import { requisitionInclude } from '@/lib/prisma-helpers'

// All requisition action routes — forward, approve, reject, return, close_permanently
// Multi-signature workflow:
//   - expense: needs CMD signature + DFA signature for full approval
//   - service: needs CMD signature + DA signature for full approval
//   - HOD signature can be captured during the HOD step (before CMD)
// Each action records a RequisitionRoute row with signerName/signerDesignation/signatureUrl/signedAt
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params

    const requisition = await db.requisition.findUnique({ where: { id } })
    if (!requisition) {
      return NextResponse.json({ error: 'Requisition not found' }, { status: 404 })
    }
    if (requisition.state === 'closed_permanently') {
      return NextResponse.json({ error: 'This requisition is permanently closed' }, { status: 400 })
    }

    const body = await req.json()
    const {
      action,
      remarks,
      targetUserId,
      targetDesignationId,
      targetDepartmentId,
      closureNote,
      signatureUrl,
      signatureRole,        // optional override (CMD | DFA | DA | HOD) for SUPER_ADMIN/ADMIN
    } = body || {}

    const validActions = ['forward', 'approve', 'reject', 'return', 'close_permanently']
    if (!validActions.includes(action)) {
      return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 })
    }

    // Permission check — only current assignee or someone matching the target designation can act
    const isAssignee = requisition.assigneeId === user.id
    const isTargetDesignation =
      !requisition.assigneeId &&
      requisition.targetDesignationId !== null &&
      user.designationId === requisition.targetDesignationId
    const canByPass =
      user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' || user.role === 'CMD'
    if (!isAssignee && !isTargetDesignation && !canByPass) {
      return NextResponse.json(
        { error: 'You are not authorized to act on this requisition at this stage' },
        { status: 403 },
      )
    }

    // Determine the effective signature role for this user.
    // SUPER_ADMIN/ADMIN can pass an explicit `signatureRole` override.
    let effectiveRole = signatureRole
    if (!effectiveRole) {
      if (user.role === 'CMD') effectiveRole = 'CMD'
      else if (user.role === 'DFA') effectiveRole = 'DFA'
      else if (user.role === 'AD') effectiveRole = 'DA' // AD acts as Departmental Administrator
      else if (user.role === 'HOD' || user.role === 'HOU') effectiveRole = 'HOD'
      else effectiveRole = null
    }

    const updated = await db.$transaction(async (tx) => {
      let newAssigneeId: string | null = requisition.assigneeId
      let newTargetUserId: string | null = requisition.targetUserId
      let newTargetDesignationId: string | null = requisition.targetDesignationId
      let newTargetDepartmentId: string | null = requisition.targetDepartmentId
      let newStatus = requisition.status
      let newState = requisition.state
      let closedAt: Date | null = null
      let closedById: string | null = null
      let closureNoteFinal: string | null = requisition.closureNote

      // Signature-field updates for the current user's role
      const sigUpdates: any = {}

      // Helper: capture signature for the given role
      const captureSig = (role: 'CMD' | 'DFA' | 'DA' | 'HOD') => {
        const prefix = role.toLowerCase()
        sigUpdates[`${prefix}Id`] = user.id
        sigUpdates[`${prefix}Name`] = user.fullName
        sigUpdates[`${prefix}SignatureUrl`] = signatureUrl || null
        sigUpdates[`${prefix}Remarks`] = remarks || null
        sigUpdates[`${prefix}SignedAt`] = new Date()
      }

      // Capture signature based on role + action
      if (action === 'approve' || action === 'forward') {
        if (effectiveRole === 'HOD') captureSig('HOD')
        if (effectiveRole === 'CMD') captureSig('CMD')
        if (effectiveRole === 'DFA') captureSig('DFA')
        if (effectiveRole === 'DA') captureSig('DA')
      }

      // Helper to find a user with a given role for routing
      async function findFirstByRole(role: string): Promise<string | null> {
        const u = await tx.user.findFirst({
          where: { role, isActive: true },
          orderBy: { createdAt: 'asc' },
        })
        return u?.id || null
      }

      if (action === 'forward') {
        if (!targetUserId && !targetDesignationId) {
          throw new Error('Forward requires a target user or designation')
        }
        newAssigneeId = await (async () => {
          if (targetUserId) {
            const targetUser = await tx.user.findUnique({ where: { id: targetUserId } })
            if (targetUser?.isActive) return targetUserId
          }
          if (targetDesignationId) {
            const u = await tx.user.findFirst({
              where: { designationId: targetDesignationId, isActive: true },
              orderBy: { createdAt: 'asc' },
            })
            return u?.id || null
          }
          return null
        })()
        newTargetUserId = targetUserId || null
        newTargetDesignationId = targetDesignationId || null
        newTargetDepartmentId = targetDepartmentId || null
        newState = 'forwarded'
        newStatus = 'In Review'
      } else if (action === 'approve') {
        const closePermanently = body.closePermanently === true
        const reqType = requisition.type

        // Multi-signature logic:
        // - expense: needs CMD + DFA signatures
        // - service: needs CMD + DA signatures
        // - other: only CMD signature needed (single-sig)

        let cmdSigned = !!sigUpdates.cmdId || !!requisition.cmdSignedAt
        let dfaSigned = !!sigUpdates.dfaId || !!requisition.dfaSignedAt
        let daSigned = !!sigUpdates.daId || !!requisition.daSignedAt

        const needsDfa = reqType === 'expense'
        const needsDa = reqType === 'service'

        // Determine if fully approved
        const fullyApproved =
          cmdSigned && (!needsDfa || dfaSigned) && (!needsDa || daSigned)

        if (closePermanently || fullyApproved) {
          // Fully approved — close
          newStatus = 'Approved'
          newState = closePermanently ? 'closed_permanently' : 'approved'
          if (closePermanently) {
            closedAt = new Date()
            closedById = user.id
            closureNoteFinal = closureNote || 'Approved and closed'
          }
          // Route back to creator
          if (!closePermanently) {
            const creatorId = requisition.createdById
            newAssigneeId = creatorId
            newTargetUserId = creatorId
            newTargetDesignationId = null
          } else {
            newAssigneeId = null
            newTargetUserId = null
            newTargetDesignationId = null
          }
        } else {
          // Multi-sig in progress — route to the next signer
          // Determine next signer based on type & current state
          let nextRole: string | null = null
          if (needsDfa) {
            if (cmdSigned && !dfaSigned) nextRole = 'DFA'
            else if (dfaSigned && !cmdSigned) nextRole = 'CMD'
          } else if (needsDa) {
            if (cmdSigned && !daSigned) nextRole = 'AD'
            else if (daSigned && !cmdSigned) nextRole = 'CMD'
          }
          if (nextRole) {
            const nextUserId = await findFirstByRole(nextRole)
            newAssigneeId = nextUserId
            newTargetUserId = nextUserId
            newTargetDesignationId = null
            newState = 'forwarded'
            if (needsDfa) newStatus = 'Awaiting DFA Signature'
            else if (needsDa) newStatus = 'Awaiting DA Signature'
            else newStatus = 'Awaiting Signature'
          } else {
            // No next signer (shouldn't normally hit this since fullyApproved is false)
            newStatus = 'Approved'
            newState = 'approved'
            const creatorId = requisition.createdById
            newAssigneeId = creatorId
            newTargetUserId = creatorId
          }
        }
      } else if (action === 'reject') {
        const closePermanently = body.closePermanently === true
        if (closePermanently) {
          newStatus = 'Rejected'
          newState = 'closed_permanently'
          closedAt = new Date()
          closedById = user.id
          closureNoteFinal = closureNote || 'Rejected and closed'
          newAssigneeId = null
          newTargetUserId = null
          newTargetDesignationId = null
        } else {
          const creatorId = requisition.createdById
          newAssigneeId = creatorId
          newTargetUserId = creatorId
          newTargetDesignationId = null
          newState = 'rejected'
          newStatus = 'Rejected'
        }
      } else if (action === 'return') {
        const creatorId = requisition.createdById
        newAssigneeId = creatorId
        newTargetUserId = creatorId
        newTargetDesignationId = null
        newState = 'returned'
        newStatus = 'Returned'
      } else if (action === 'kiv') {
        // Keep in View — CMD defers the decision; requisition stays with CMD
        newState = 'kiv'
        newStatus = 'Keep in View'
        newAssigneeId = user.id
        newTargetUserId = user.id
      } else if (action === 'discuss') {
        // Discuss — CMD invites the initiator to come and explain more
        const creatorId = requisition.createdById
        newAssigneeId = creatorId
        newTargetUserId = creatorId
        newTargetDesignationId = null
        newState = 'discuss'
        newStatus = 'Discuss'
      } else if (action === 'close_permanently') {
        newStatus = 'Closed'
        newState = 'closed_permanently'
        closedAt = new Date()
        closedById = user.id
        closureNoteFinal = closureNote || 'Closed permanently'
        newAssigneeId = null
        newTargetUserId = null
        newTargetDesignationId = null
      }

      const r = await tx.requisition.update({
        where: { id },
        data: {
          assigneeId: newAssigneeId,
          targetUserId: newTargetUserId,
          targetDesignationId: newTargetDesignationId,
          targetDepartmentId: newTargetDepartmentId,
          status: newStatus,
          state: newState,
          closedAt,
          closedById,
          closureNote: closureNoteFinal,
          ...sigUpdates,
        },
        include: requisitionInclude,
      })

      // Create a RequisitionRoute entry capturing per-hop signer info
      const signerName = user.fullName
      const signerDesignation = user.designation?.code || user.role
      await tx.requisitionRoute.create({
        data: {
          requisitionId: id,
          fromUserId: user.id,
          toUserId:
            action === 'forward'
              ? (targetUserId || newAssigneeId)
              : action === 'close_permanently' || (body.closePermanently && (action === 'approve' || action === 'reject'))
                ? null
                : newTargetUserId,
          toDesignationId: action === 'forward' ? (targetDesignationId || null) : null,
          toDepartmentId: action === 'forward' ? (targetDepartmentId || null) : null,
          action,
          remarks: remarks || null,
          acknowledgedAt: new Date(),
          signerName,
          signerDesignation,
          signatureUrl: signatureUrl || null,
          signedAt: signatureUrl ? new Date() : null,
        },
      })

      // Audit log
      try {
        await tx.auditLog.create({
          data: {
            userId: user.id,
            action,
            entity: 'Requisition',
            entityId: id,
            details: `${action} ${r.refNumber}${remarks ? ` — ${remarks}` : ''}`,
          },
        })
      } catch {}

      // Notify recipient of new action
      if (newAssigneeId && newAssigneeId !== user.id) {
        const verbMap: Record<string, string> = {
          forward: 'forwarded',
          approve: 'approved',
          reject: 'rejected',
          return: 'returned',
          close_permanently: 'closed',
          kiv: 'kept in view',
          discuss: 'discussion requested',
        }
        const verb = verbMap[action] || action
        await tx.notification.create({
          data: {
            userId: newAssigneeId,
            title: action === 'discuss'
              ? `Discussion Requested: ${r.refNumber}`
              : `Requisition ${verb}: ${r.refNumber}`,
            body: action === 'discuss'
              ? `${user.fullName} has requested you to come and discuss requisition "${r.subject}". Please visit the office to provide more clarification.${remarks ? ` Note: ${remarks}` : ''}`
              : action === 'kiv'
              ? `${user.fullName} has kept your requisition "${r.subject}" in view (KIV). It will be reviewed later.${remarks ? ` Note: ${remarks}` : ''}`
              : `${user.fullName} ${verb} "${r.subject}"${remarks ? ` — ${remarks}` : ''}`,
            type: 'requisition',
            link: `requisition:${r.id}`,
          },
        })
      }

      return r
    })

    // Audit log (outside tx so it doesn't block)
    await audit(user, action === 'close_permanently' ? 'close' : action, { entity: 'Requisition', entityId: id, details: `${action} ${updated.refNumber}${remarks ? ` — ${remarks}` : ''}`, ipAddress: getIp(req) })

    return NextResponse.json({ requisition: updated })
  } catch (e: any) {
    console.error('Requisition action error:', e)
    return NextResponse.json({ error: e.message || 'Action failed' }, { status: 500 })
  }
}
