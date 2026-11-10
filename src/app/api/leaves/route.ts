import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'
import { buildScopeFilter, applyScope } from '@/lib/scope'

function daysBetween(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime()
  return Math.max(1, Math.floor(ms / (1000 * 60 * 60 * 24)) + 1)
}

async function generateLeaveRef(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `LV-${year}-`
  const leaves = await db.leave.findMany({
    where: { refNumber: { startsWith: prefix } },
    select: { refNumber: true },
  })
  let max = 0
  for (const l of leaves) {
    const seqStr = l.refNumber.replace(prefix, '')
    const seq = parseInt(seqStr, 10)
    if (!isNaN(seq) && seq > max) max = seq
  }
  return `${prefix}${String(max + 1).padStart(6, '0')}`
}

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { searchParams } = new URL(req.url)
    const tab = searchParams.get('tab') || 'all'
    const status = searchParams.get('status')
    const q = searchParams.get('q') || ''
    const limit = Math.min(parseInt(searchParams.get('limit') || '200'), 500)

    const where: any = {}
    if (status) where.status = status
    if (tab === 'mine') where.createdBy = user.id
    if (tab === 'pending_my_approval') {
      // Show leaves currently held by this user
      where.currentHolderId = user.id
      where.state = { notIn: ['approved', 'rejected', 'cancelled', 'completed'] }
    }
    if (tab === 'approved') where.state = 'completed'
    if (tab === 'rejected') where.state = 'rejected'
    if (q) {
      where.OR = [
        { refNumber: { contains: q } },
        { staff: { fullName: { contains: q } } },
        { leaveType: { name: { contains: q } } },
      ]
    }

    // Apply role-based data scope
    const scopeWhere = buildScopeFilter(user, 'leave')
    const finalWhere = applyScope(where, scopeWhere)

    const leaves = await db.leave.findMany({
      where: finalWhere,
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
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
          take: 20,
        },
      },
    })
    return NextResponse.json({ leaves })
  } catch (e: any) {
    console.error('Leaves list:', e)
    return NextResponse.json({ error: 'Failed to fetch leaves' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json()
    const { staffId, leaveTypeId, startDate, endDate, reason, address, phone, certificateUrl } = body || {}
    if (!staffId || !leaveTypeId || !startDate || !endDate || !reason) {
      return NextResponse.json({ error: 'staffId, leaveTypeId, startDate, endDate, reason are required' }, { status: 400 })
    }
    const refNumber = await generateLeaveRef()
    const start = new Date(startDate)
    const end = new Date(endDate)
    if (end < start) {
      return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 })
    }
    const days = daysBetween(start, end)

    // === Auto-route to Head of Unit (HOU) ===
    // Find the staff's unit/department, then find the HOU for that unit
    const staff = await db.staff.findUnique({
      where: { id: staffId },
      include: { department: true, unit: true },
    })

    let houUser: any = null
    // Try unit's HOU first
    if (staff?.unit?.houUserId) {
      houUser = await db.user.findUnique({ where: { id: staff.unit.houUserId } })
    }
    // Fallback: any active HOU
    if (!houUser) {
      houUser = await db.user.findFirst({ where: { role: 'HOU', isActive: true } })
    }
    // Fallback: HOD (if no HOU, go straight to HOD)
    let hodUser: any = null
    if (staff?.department?.hodUserId) {
      hodUser = await db.user.findUnique({ where: { id: staff.department.hodUserId } })
    }
    if (!hodUser) {
      hodUser = await db.user.findFirst({ where: { role: 'HOD', isActive: true } })
    }

    // Determine the first routing target
    const firstHolder = houUser || hodUser
    const firstStage = houUser ? 'HOU Review' : 'HOD Review'

    const leave = await db.$transaction(async (tx) => {
      const created = await tx.leave.create({
        data: {
          refNumber,
          staffId, leaveTypeId,
          startDate: start, endDate: end, daysRequested: days,
          reason, address: address || null, phone: phone || null,
          certificateUrl: certificateUrl || null,
          status: 'Pending', state: 'open',
          currentStage: firstStage,
          currentHolderId: firstHolder?.id || null,
          createdBy: user.id,
        },
        include: { staff: true, leaveType: true },
      })

      // Create initial routing record
      await tx.leaveRoute.create({
        data: {
          leaveId: created.id,
          fromUserId: user.id,
          toUserId: firstHolder?.id || null,
          stage: 'Submitted',
          action: 'submit',
          remarks: `Leave application submitted by ${user.fullName}, auto-routed to ${firstStage}`,
        },
      })

      return created
    })

    // Notify the first holder (HOU or HOD)
    try {
      if (firstHolder) {
        await db.notification.create({
          data: {
            userId: firstHolder.id,
            title: 'New leave application for your review',
            body: `${leave.staff?.fullName || 'Staff'} applied for ${leave.leaveType?.name} (${refNumber}). Please review and approve.`,
            type: 'approval',
            link: `/?view=leaves`,
          },
        })
      }
    } catch (n) {
      console.error('Leave notify failed:', n)
    }

    await audit(user, 'create', { entity: 'Leave', entityId: leave.id, details: `Created leave ${leave.refNumber} for ${leave.staff?.fullName || 'staff'}, routed to ${firstStage}`, ipAddress: getIp(req) })

    return NextResponse.json({ leave })
  } catch (e: any) {
    console.error('Leave create:', e)
    return NextResponse.json({ error: 'Failed to create leave' }, { status: 500 })
  }
}
