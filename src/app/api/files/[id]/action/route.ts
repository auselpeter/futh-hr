import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, isRegistry } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'
import { fileInclude } from '@/lib/prisma-helpers'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params

    const file = await db.registryFile.findUnique({ where: { id } })
    if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 })

    const body = await req.json()
    const {
      action,
      remarks,
      targetUserId,
      targetDesignationId,
      targetDepartmentId,
      signatureUrl,
    } = body || {}

    const validActions = ['forward', 'acknowledge', 'return', 'complete', 'reject', 'archive']
    if (!validActions.includes(action)) {
      return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 })
    }

    // Permission check
    const isHolder = file.currentHolderId === user.id
    const isTargetDesignation =
      !file.currentHolderId &&
      file.targetDesignationId !== null &&
      user.designationId === file.targetDesignationId
    const canByPass = ['SUPER_ADMIN', 'ADMIN', 'CMD'].includes(user.role)
    const isRegistryUser = isRegistry(user.role)

    if (action === 'archive') {
      if (!isRegistryUser && !canByPass) {
        return NextResponse.json({ error: 'Only Registry Officers can archive files' }, { status: 403 })
      }
    } else if (!isHolder && !isTargetDesignation && !canByPass) {
      return NextResponse.json(
        { error: 'You are not authorized to act on this file at this stage' },
        { status: 403 },
      )
    }

    const updated = await db.$transaction(async (tx) => {
      let newHolderId: string | null = file.currentHolderId
      let newTargetUserId: string | null = file.targetUserId
      let newTargetDesignationId: string | null = file.targetDesignationId
      let newTargetDepartmentId: string | null = file.targetDepartmentId
      let newStatus = file.status
      let newState = file.state
      let closedAt: Date | null = file.closedAt
      let closedById: string | null = file.closedById

      async function resolveHolderForTarget(): Promise<string | null> {
        if (targetUserId) {
          const u = await tx.user.findUnique({ where: { id: targetUserId } })
          if (u?.isActive) return targetUserId
        }
        if (targetDesignationId) {
          const u = await tx.user.findFirst({
            where: { designationId: targetDesignationId, isActive: true },
            orderBy: { createdAt: 'asc' },
          })
          return u?.id || null
        }
        return null
      }

      if (action === 'forward') {
        if (!targetUserId && !targetDesignationId) {
          throw new Error('Forward requires a target user or designation')
        }
        newHolderId = await resolveHolderForTarget()
        newTargetUserId = targetUserId || null
        newTargetDesignationId = targetDesignationId || null
        newTargetDepartmentId = targetDepartmentId || null
        newStatus = 'In Transit'
        newState = 'in_transit'
      } else if (action === 'acknowledge') {
        // Mark as received — holder acknowledges receipt, file moves to "received" state
        newStatus = 'Received'
        newState = 'received'
        // Holder remains the same
      } else if (action === 'return') {
        newHolderId = file.createdById
        newTargetUserId = file.createdById
        newTargetDesignationId = null
        newStatus = 'Returned'
        newState = 'returned'
      } else if (action === 'complete') {
        newStatus = 'Completed'
        newState = 'completed'
        closedAt = new Date()
        closedById = user.id
        newHolderId = null
        newTargetUserId = null
        newTargetDesignationId = null
      } else if (action === 'reject') {
        newStatus = 'Rejected'
        newState = 'returned'
        newHolderId = file.createdById
        newTargetUserId = file.createdById
        newTargetDesignationId = null
      } else if (action === 'archive') {
        newStatus = 'Archived'
        newState = 'archived'
        closedAt = new Date()
        closedById = user.id
        newHolderId = null
        newTargetUserId = null
        newTargetDesignationId = null
      }

      // Build closure-signature field updates for complete/archive actions
      // based on the acting user's role.
      const closureSigUpdates: any = {}
      if ((action === 'complete' || action === 'archive') && signatureUrl) {
        if (user.role === 'CMD' || user.role === 'SUPER_ADMIN') {
          closureSigUpdates.cmdSignatureUrl = signatureUrl
          closureSigUpdates.cmdSignedAt = new Date()
        } else if (user.role === 'DFA') {
          closureSigUpdates.dfaSignatureUrl = signatureUrl
          closureSigUpdates.dfaSignedAt = new Date()
        } else if (user.role === 'HOD' || user.role === 'HOU') {
          closureSigUpdates.hodSignatureUrl = signatureUrl
          closureSigUpdates.hodSignedAt = new Date()
        } else if (user.role === 'REGISTRY_OFFICER' || user.role === 'ADMIN') {
          closureSigUpdates.registrySignatureUrl = signatureUrl
          closureSigUpdates.registrySignedAt = new Date()
        }
      }

      const updated = await tx.registryFile.update({
        where: { id },
        data: {
          currentHolderId: newHolderId,
          targetUserId: newTargetUserId,
          targetDesignationId: newTargetDesignationId,
          targetDepartmentId: newTargetDepartmentId,
          status: newStatus,
          state: newState,
          closedAt,
          closedById,
          // Closure signatures — captured on complete/archive based on user role
          ...(action === 'complete' || action === 'archive' ? closureSigUpdates : {}),
        },
        include: fileInclude,
      })

      await tx.fileRoute.create({
        data: {
          fileId: id,
          fromUserId: user.id,
          toUserId: action === 'forward' ? (targetUserId || newHolderId) : action === 'return' || action === 'reject' ? file.createdById : null,
          toDesignationId: action === 'forward' ? (targetDesignationId || null) : null,
          toDepartmentId: action === 'forward' ? (targetDepartmentId || null) : null,
          action,
          remarks: remarks || null,
          acknowledgedAt: action === 'acknowledge' ? new Date() : null,
          signerName: user.fullName,
          signerDesignation: user.designation?.code || user.role,
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
            entity: 'RegistryFile',
            entityId: id,
            details: `${action} ${updated.fileNumber}${remarks ? ` — ${remarks}` : ''}`,
          },
        })
      } catch {}

      // Notify new holder
      if (newHolderId && newHolderId !== user.id) {
        const verbMap: Record<string, string> = {
          forward: 'forwarded',
          acknowledge: 'acknowledged',
          return: 'returned',
          complete: 'completed',
          reject: 'rejected',
          archive: 'archived',
        }
        const verb = verbMap[action] || action
        await tx.notification.create({
          data: {
            userId: newHolderId,
            title: `File ${verb}: ${updated.fileNumber}`,
            body: `${user.fullName} ${verb} "${updated.subject}"${remarks ? ` — ${remarks}` : ''}`,
            type: 'file',
            link: `file:${updated.id}`,
          },
        })
      }

      return updated
    })

    await audit(user, action, { entity: 'RegistryFile', entityId: id, details: `${action} ${updated.fileNumber}${remarks ? ` — ${remarks}` : ''}`, ipAddress: getIp(req) })

    return NextResponse.json({ file: updated })
  } catch (e: any) {
    console.error('File action error:', e)
    return NextResponse.json({ error: e.message || 'Action failed' }, { status: 500 })
  }
}
