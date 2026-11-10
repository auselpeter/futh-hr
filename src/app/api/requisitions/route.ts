import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'
import { requisitionInclude } from '@/lib/prisma-helpers'
import { generateRequisitionRefNumber } from '@/lib/ref-number'
import { buildScopeFilter, applyScope } from '@/lib/scope'

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const tab = searchParams.get('tab') || 'all' // all | pending | mine | closed
    const q = searchParams.get('q') || ''
    const type = searchParams.get('type')
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')

    const where: any = {}
    if (q) {
      where.OR = [
        { refNumber: { contains: q } },
        { subject: { contains: q } },
        { description: { contains: q } },
      ]
    }
    if (type) where.type = type
    if (status) where.status = status
    if (priority) where.priority = priority

    if (tab === 'pending') {
      where.AND = [
        { state: { not: 'closed_permanently' } },
        {
          OR: [
            { assigneeId: user.id },
            {
              targetDesignationId: user.designationId ?? undefined,
              assigneeId: null,
            },
          ],
        },
      ]
    } else if (tab === 'mine') {
      where.createdById = user.id
    } else if (tab === 'closed') {
      where.state = 'closed_permanently'
    }

    // Apply role-based data scope
    const scopeWhere = buildScopeFilter(user, 'requisition')
    const finalWhere = applyScope(where, scopeWhere)

    const requisitions = await db.requisition.findMany({
      where: finalWhere,
      orderBy: { createdAt: 'desc' },
      include: requisitionInclude,
    })

    return NextResponse.json({ requisitions })
  } catch (e: any) {
    console.error('Requisition list error:', e)
    return NextResponse.json({ error: 'Failed to fetch requisitions' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { type, subject, description, comment, amount, priority, targetUserId, targetDesignationId, targetDepartmentId } = body || {}

    if (!type || !subject || !description) {
      return NextResponse.json({ error: 'Type, subject and description are required' }, { status: 400 })
    }
    if (!['service', 'expense', 'other'].includes(type)) {
      return NextResponse.json({ error: 'Invalid requisition type' }, { status: 400 })
    }
    if (!targetUserId && !targetDesignationId) {
      return NextResponse.json({ error: 'You must select a recipient (staff or designation)' }, { status: 400 })
    }
    if (type === 'expense' && (amount === null || amount === undefined || isNaN(Number(amount)))) {
      return NextResponse.json({ error: 'Expense requisitions require an amount' }, { status: 400 })
    }

    const refNumber = await generateRequisitionRefNumber(type)

    // Resolve assignee: if to designation, find first active user with that designation
    let assigneeId: string | null = targetUserId || null
    if (!assigneeId && targetDesignationId) {
      const targetUser = await db.user.findFirst({
        where: { designationId: targetDesignationId, isActive: true },
        orderBy: { createdAt: 'asc' },
      })
      if (targetUser) assigneeId = targetUser.id
    }

    // === Staff routing enforcement ===
    // When a STAFF creates a requisition, it must pass through their Head of Unit (HOU)
    // first, then the HOU forwards to HOD. If there's no HOU, it goes directly to HOD.
    // The HOD then selects who to forward to.
    const userRole = (user as any).activeRole || user.role
    const isStaff = !['SUPER_ADMIN', 'ADMIN', 'CMD', 'CMA', 'AD', 'DFA', 'HOD', 'HOU', 'APPRAISAL_OFFICER', 'REGISTRY_OFFICER'].includes(userRole)
    let routedAssigneeId = assigneeId
    let routedTargetUserId = targetUserId || null
    let routedTargetDesignationId = targetDesignationId || null
    let routedToDepartmentId = targetDepartmentId || null
    let routingNote = ''

    if (isStaff) {
      // Find the staff's unit HOU
      const staffRecord = user.staffId ? await db.staff.findUnique({
        where: { id: user.staffId },
        select: { unitId: true, departmentId: true },
      }) : null

      let houUser: any = null
      let hodUser: any = null

      // Find HOU of the staff's unit
      if (staffRecord?.unitId) {
        const unit = await db.unit.findUnique({
          where: { id: staffRecord.unitId },
          select: { houUserId: true },
        })
        if (unit?.houUserId) {
          houUser = await db.user.findUnique({ where: { id: unit.houUserId }, select: { id: true, fullName: true } })
        }
      }

      // Find HOD of the staff's department
      if (staffRecord?.departmentId) {
        const dept = await db.department.findUnique({
          where: { id: staffRecord.departmentId },
          select: { hodUserId: true },
        })
        if (dept?.hodUserId) {
          hodUser = await db.user.findUnique({ where: { id: dept.hodUserId }, select: { id: true, fullName: true } })
        }
      }

      // Route to HOU first, or HOD if no HOU
      const firstApprover = houUser || hodUser
      if (firstApprover) {
        routedAssigneeId = firstApprover.id
        routedTargetUserId = firstApprover.id
        routedTargetDesignationId = null
        routedToDepartmentId = null
        routingNote = houUser
          ? `Routed to Head of Unit (${houUser.fullName}) for review per institutional policy. The HOU will forward to HOD.`
          : `Routed to Head of Department (${hodUser.fullName}) for review per institutional policy (no HOU assigned to your unit).`
      }
    }

    const finalAssigneeId = routedAssigneeId
    const finalTargetUserId = routedTargetUserId
    const finalTargetDesignationId = routedTargetDesignationId
    const finalToDepartmentId = routedToDepartmentId

    const requisition = await db.$transaction(async (tx) => {
      const r = await tx.requisition.create({
        data: {
          refNumber,
          type,
          subject: String(subject),
          description: String(description),
          comment: comment ? String(comment) : null,
          amount: type === 'expense' ? Number(amount) : null,
          priority: priority || 'Normal',
          status: 'Submitted',
          state: 'open',
          createdById: user.id,
          assigneeId: finalAssigneeId,
          targetUserId: finalTargetUserId,
          targetDesignationId: finalTargetDesignationId || null,
          targetDepartmentId: finalToDepartmentId || null,
          departmentId: user.departmentId || null,
        },
        include: requisitionInclude,
      })

      await tx.requisitionRoute.create({
        data: {
          requisitionId: r.id,
          fromUserId: user.id,
          toUserId: finalTargetUserId || finalAssigneeId || null,
          toDesignationId: finalTargetDesignationId || null,
          toDepartmentId: finalToDepartmentId || null,
          action: 'submit',
          remarks: routingNote || 'Requisition submitted',
        },
      })

      // Notify the assignee
      if (finalAssigneeId && finalAssigneeId !== user.id) {
        await tx.notification.create({
          data: {
            userId: finalAssigneeId,
            title: `New requisition: ${r.refNumber}`,
            body: `${user.fullName} submitted a ${type} requisition: ${r.subject}`,
            type: 'requisition',
            link: `requisition:${r.id}`,
          },
        })
      }
      // Also notify users with the target designation (if not a staff-initiated routed requisition)
      if (!isStaff && targetDesignationId) {
        const users = await tx.user.findMany({
          where: { designationId: targetDesignationId, isActive: true },
          select: { id: true },
        })
        for (const u of users) {
          if (u.id !== user.id) {
            await tx.notification.create({
              data: {
                userId: u.id,
                title: `New requisition: ${r.refNumber}`,
                body: `${user.fullName} submitted a ${type} requisition for your designation: ${r.subject}`,
                type: 'requisition',
                link: `requisition:${r.id}`,
              },
            })
          }
        }
      }

      return r
    })

    await audit(user, 'create', { entity: 'Requisition', entityId: requisition.id, details: `Created ${requisition.refNumber} (${requisition.subject})`, ipAddress: getIp(req) })

    return NextResponse.json({ requisition })
  } catch (e: any) {
    console.error('Create requisition error:', e)
    return NextResponse.json({ error: 'Failed to create requisition' }, { status: 500 })
  }
}
