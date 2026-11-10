import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'

/**
 * Leave workflow:
 *
 *   Staff submits leave
 *     → auto-route to Head of Unit (HOU)
 *     → HOU approves → route to Head of Department (HOD)
 *     → HOD approves → route to Registry
 *     → Registry decides who to forward to (DFA, CMD, AD, etc.)
 *     → Forwarded approver acts → returns to Registry
 *     → Registry completes (closes) the leave
 *
 * Actions:
 *   - hou_approve: HOU approves, routes to HOD
 *   - hod_approve: HOD approves, routes to Registry
 *   - registry_receive: Registry acknowledges receipt (auto when routed to Registry)
 *   - forward: Registry forwards to a specific user (DFA, CMD, AD, etc.)
 *   - return_to_registry: Forwarded approver is done, returns to Registry
 *   - complete: Registry completes the leave (final closure)
 *   - reject: Any approver can reject at their stage
 *   - cancel: Creator cancels
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const body = await req.json()
    const action = body.action
    const role = user.activeRole || user.role

    const leave = await db.leave.findUnique({
      where: { id },
      include: { staff: { include: { department: true, unit: true } }, leaveType: true },
    })
    if (!leave) return NextResponse.json({ error: 'Leave not found' }, { status: 404 })

    const data: any = {}
    let notifTitle = ''
    let notifBody = ''
    let notifTargets: string[] = []

    // ─────────────────────────────────────
    // HOU APPROVE — Head of Unit approves, routes to HOD
    // ─────────────────────────────────────
    if (action === 'hou_approve') {
      if (role !== 'HOU' && role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
        return NextResponse.json({ error: 'Only Head of Unit can approve at this stage' }, { status: 403 })
      }
      if (leave.currentStage !== 'HOU Review') {
        return NextResponse.json({ error: `Leave is not at HOU Review stage (currently: ${leave.currentStage})` }, { status: 400 })
      }

      // Find the HOD of the staff's department
      const dept = leave.staff?.department
      let hodUser: any = null
      if (dept?.hodUserId) {
        hodUser = await db.user.findUnique({ where: { id: dept.hodUserId } })
      }
      if (!hodUser) {
        // Fallback: find any user with HOD role in the same department
        hodUser = await db.user.findFirst({
          where: { role: 'HOD', departmentId: dept?.id, isActive: true },
        })
      }
      if (!hodUser) {
        // Fallback: any active HOD
        hodUser = await db.user.findFirst({ where: { role: 'HOD', isActive: true } })
      }

      data.houId = user.id
      data.houName = user.fullName
      data.houRemarks = body.remarks || null
      data.houSignedAt = new Date()
      data.currentStage = 'HOD Review'
      data.currentHolderId = hodUser?.id || null
      data.status = 'HOU Approved'

      // Create routing record
      await db.leaveRoute.create({
        data: {
          leaveId: id,
          fromUserId: user.id,
          toUserId: hodUser?.id || null,
          stage: 'HOU Review',
          action: 'hou_approve',
          remarks: body.remarks || null,
          signerName: user.fullName,
          signerDesignation: 'Head of Unit',
          signedAt: new Date(),
        },
      })

      notifTitle = 'Leave application forwarded to HOD'
      notifBody = `${leave.staff?.fullName} — ${leave.refNumber} approved by HOU (${user.fullName}) and forwarded to you for HOD review.`
      if (hodUser) notifTargets.push(hodUser.id)
    }

    // ─────────────────────────────────────
    // HOD APPROVE — Head of Department approves, routes to Registry
    // ─────────────────────────────────────
    else if (action === 'hod_approve') {
      if (role !== 'HOD' && role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
        return NextResponse.json({ error: 'Only Head of Department can approve at this stage' }, { status: 403 })
      }
      if (leave.currentStage !== 'HOD Review') {
        return NextResponse.json({ error: `Leave is not at HOD Review stage (currently: ${leave.currentStage})` }, { status: 400 })
      }

      // Find a Registry user
      const registryUser = await db.user.findFirst({
        where: { role: 'REGISTRY_OFFICER', isActive: true },
      })

      data.hodId = user.id
      data.hodName = user.fullName
      data.hodRemarks = body.remarks || null
      data.hodSignedAt = new Date()
      data.currentStage = 'Registry'
      data.currentHolderId = registryUser?.id || null
      data.status = 'HOD Approved'

      if (registryUser) {
        data.registryId = registryUser.id
        data.registryName = registryUser.fullName
        data.registryReceivedAt = new Date()
      }

      // Create routing record
      await db.leaveRoute.create({
        data: {
          leaveId: id,
          fromUserId: user.id,
          toUserId: registryUser?.id || null,
          stage: 'HOD Review',
          action: 'hod_approve',
          remarks: body.remarks || null,
          signerName: user.fullName,
          signerDesignation: 'Head of Department',
          signedAt: new Date(),
        },
      })

      notifTitle = 'Leave application received by Registry'
      notifBody = `${leave.staff?.fullName} — ${leave.refNumber} approved by HOD (${user.fullName}) and sent to Registry. Please review and decide who to forward to.`
      if (registryUser) notifTargets.push(registryUser.id)
    }

    // ─────────────────────────────────────
    // FORWARD — Registry forwards to a specific user (DFA, CMD, AD, etc.)
    // ─────────────────────────────────────
    else if (action === 'forward') {
      if (role !== 'REGISTRY_OFFICER' && role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
        return NextResponse.json({ error: 'Only Registry can forward leave applications' }, { status: 403 })
      }
      if (leave.currentStage !== 'Registry') {
        return NextResponse.json({ error: `Leave is not at Registry stage (currently: ${leave.currentStage})` }, { status: 400 })
      }

      const targetUserId = body.targetUserId
      if (!targetUserId) {
        return NextResponse.json({ error: 'targetUserId is required — specify who to forward to' }, { status: 400 })
      }

      const targetUser = await db.user.findUnique({ where: { id: targetUserId } })
      if (!targetUser) {
        return NextResponse.json({ error: 'Target user not found' }, { status: 400 })
      }

      data.currentStage = 'Forwarded'
      data.currentHolderId = targetUserId
      data.status = `Forwarded to ${targetUser.role.replace('_', ' ')}`
      data.registryRemarks = body.remarks || `Forwarded to ${targetUser.fullName} (${targetUser.role})`

      // Create routing record
      await db.leaveRoute.create({
        data: {
          leaveId: id,
          fromUserId: user.id,
          toUserId: targetUserId,
          stage: 'Registry',
          action: 'forward',
          remarks: body.remarks || `Forwarded to ${targetUser.fullName} (${targetUser.role})`,
          signerName: user.fullName,
          signerDesignation: 'Registry Officer',
          signedAt: new Date(),
        },
      })

      notifTitle = 'Leave application forwarded to you'
      notifBody = `${leave.staff?.fullName} — ${leave.refNumber} forwarded by Registry (${user.fullName}) for your review/action. When done, please return to Registry.`
      notifTargets.push(targetUserId)
    }

    // ─────────────────────────────────────
    // RETURN TO REGISTRY — Forwarded approver is done, returns to Registry
    // ─────────────────────────────────────
    else if (action === 'return_to_registry') {
      if (leave.currentStage !== 'Forwarded') {
        return NextResponse.json({ error: `Leave is not at Forwarded stage (currently: ${leave.currentStage})` }, { status: 400 })
      }

      // Find a Registry user
      const registryUser = await db.user.findFirst({
        where: { role: 'REGISTRY_OFFICER', isActive: true },
      })

      data.currentStage = 'Registry'
      data.currentHolderId = registryUser?.id || null
      data.status = 'Registry Received'

      // Record the approver's action (DFA, CMD, AD, etc.)
      const approverRole = role.replace('_', ' ')
      if (role === 'DFA' || role === 'SUPER_ADMIN') {
        data.dfaId = user.id
        data.dfaName = user.fullName
        data.dfaRemarks = body.remarks || null
        data.dfaSignedAt = new Date()
      }
      if (role === 'CMD') {
        data.cmdId = user.id
        data.cmdName = user.fullName
        data.cmdRemarks = body.remarks || null
        data.cmdSignedAt = new Date()
      }

      // Create routing record
      await db.leaveRoute.create({
        data: {
          leaveId: id,
          fromUserId: user.id,
          toUserId: registryUser?.id || null,
          stage: 'Forwarded',
          action: 'return_to_registry',
          remarks: body.remarks || `Returned to Registry by ${user.fullName} (${approverRole})`,
          signerName: user.fullName,
          signerDesignation: approverRole,
          signedAt: new Date(),
        },
      })

      notifTitle = 'Leave application returned to Registry'
      notifBody = `${leave.staff?.fullName} — ${leave.refNumber} reviewed by ${user.fullName} (${approverRole}) and returned to you. Please complete the process.`
      if (registryUser) notifTargets.push(registryUser.id)
    }

    // ─────────────────────────────────────
    // COMPLETE — Registry completes (closes) the leave
    // ─────────────────────────────────────
    else if (action === 'complete') {
      if (role !== 'REGISTRY_OFFICER' && role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
        return NextResponse.json({ error: 'Only Registry can complete the leave process' }, { status: 403 })
      }
      if (leave.currentStage !== 'Registry') {
        return NextResponse.json({ error: `Leave must be at Registry stage to complete (currently: ${leave.currentStage})` }, { status: 400 })
      }

      data.currentStage = 'Completed'
      data.currentHolderId = null
      data.status = 'Completed'
      data.state = 'completed'
      if (body.daysApproved) data.daysApproved = Number(body.daysApproved)

      // Create routing record
      await db.leaveRoute.create({
        data: {
          leaveId: id,
          fromUserId: user.id,
          toUserId: null,
          stage: 'Registry',
          action: 'complete',
          remarks: body.remarks || 'Leave process completed by Registry',
          signerName: user.fullName,
          signerDesignation: 'Registry Officer',
          signedAt: new Date(),
        },
      })

      notifTitle = 'Leave application completed'
      notifBody = `${leave.staff?.fullName} — ${leave.refNumber} has been completed by Registry.`
      if (leave.createdBy) notifTargets.push(leave.createdBy)
    }

    // ─────────────────────────────────────
    // REJECT — Any approver can reject at their stage
    // ─────────────────────────────────────
    else if (action === 'reject') {
      // Find a Registry user to return to (or notify the creator)
      const registryUser = await db.user.findFirst({
        where: { role: 'REGISTRY_OFFICER', isActive: true },
      })

      data.rejectedById = user.id
      data.rejectedAt = new Date()
      data.rejectReason = body.rejectReason || body.remarks || null
      data.currentStage = 'Rejected'
      data.currentHolderId = null
      data.status = 'Rejected'
      data.state = 'rejected'

      // Create routing record
      await db.leaveRoute.create({
        data: {
          leaveId: id,
          fromUserId: user.id,
          toUserId: null,
          stage: leave.currentStage,
          action: 'reject',
          remarks: body.rejectReason || body.remarks || null,
          signerName: user.fullName,
          signerDesignation: (user.activeRole || user.role).replace('_', ' '),
          signedAt: new Date(),
        },
      })

      notifTitle = 'Leave application rejected'
      notifBody = `${leave.staff?.fullName} — ${leave.refNumber} was rejected by ${user.fullName} (${(user.activeRole || user.role).replace('_', ' ')}). Reason: ${body.rejectReason || body.remarks || '—'}`
      if (leave.createdBy) notifTargets.push(leave.createdBy)
      if (registryUser) notifTargets.push(registryUser.id)
    }

    // ─────────────────────────────────────
    // CANCEL — Creator cancels
    // ─────────────────────────────────────
    else if (action === 'cancel') {
      if (leave.createdBy !== user.id && role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
        return NextResponse.json({ error: 'Only the creator can cancel' }, { status: 403 })
      }
      data.currentStage = 'Cancelled'
      data.currentHolderId = null
      data.status = 'Cancelled'
      data.state = 'cancelled'

      await db.leaveRoute.create({
        data: {
          leaveId: id,
          fromUserId: user.id,
          toUserId: null,
          stage: leave.currentStage,
          action: 'cancel',
          remarks: body.remarks || 'Cancelled by creator',
        },
      })

      notifTitle = 'Leave application cancelled'
      notifBody = `${leave.staff?.fullName} — ${leave.refNumber} was cancelled`
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // Update the leave
    const updated = await db.leave.update({
      where: { id },
      data,
      include: {
        staff: { select: { id: true, staffId: true, fullName: true, position: true, department: true, unit: true } },
        leaveType: true,
        currentHolder: { select: { id: true, fullName: true, role: true, username: true } },
        routes: {
          orderBy: { createdAt: 'asc' },
          include: {
            fromUser: { select: { id: true, fullName: true, role: true } },
            toUser: { select: { id: true, fullName: true, role: true } },
          },
        },
      },
    })

    // Audit
    await audit(user, action === 'reject' ? 'reject' : action === 'cancel' ? 'cancel' : 'approve', {
      entity: 'Leave', entityId: id,
      details: `${action} ${updated.refNumber}${body.remarks || body.rejectReason ? ` — ${body.rejectReason || body.remarks}` : ''}`,
      ipAddress: getIp(req),
    })

    // Send notifications
    try {
      if (notifTargets.length > 0) {
        const uniqueTargets = [...new Set(notifTargets)]
        await db.notification.createMany({
          data: uniqueTargets.map((uid) => ({
            userId: uid, title: notifTitle, body: notifBody, type: 'approval', link: `/?view=leaves`,
          })),
        })
      }
    } catch (n) {
      console.error('Leave notify failed:', n)
    }

    return NextResponse.json({ leave: updated })
  } catch (e: any) {
    console.error('Leave action:', e)
    return NextResponse.json({ error: 'Failed to perform action' }, { status: 500 })
  }
}
