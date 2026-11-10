import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, roleRank } from '@/lib/auth'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [
      totalStaff,
      totalDepartments,
      totalDesignations,
      totalUsers,
      pendingReqsForMe,
      pendingFilesForMe,
      unreadMail,
      pendingReqsAll,
      pendingFilesAll,
      urgentReqsForMe,
    ] = await Promise.all([
      db.staff.count(),
      db.department.count({ where: { isActive: true } }),
      db.designation.count({ where: { isActive: true } }),
      db.user.count({ where: { isActive: true } }),
      // Pending requisitions where I'm the assignee OR my designation is the target
      db.requisition.count({
        where: {
          AND: [
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
          ],
        },
      }),
      db.registryFile.count({
        where: {
          AND: [
            { state: { notIn: ['archived', 'completed'] } },
            {
              OR: [
                { currentHolderId: user.id },
                {
                  targetDesignationId: user.designationId ?? undefined,
                  currentHolderId: null,
                },
              ],
            },
          ],
        },
      }),
      db.mailMessage.count({ where: { toId: user.id, isRead: false, isArchived: false } }),
      db.requisition.count({ where: { state: { not: 'closed_permanently' } } }),
      db.registryFile.count({ where: { state: { notIn: ['archived'] } } }),
      db.requisition.count({
        where: {
          AND: [
            { state: { not: 'closed_permanently' } },
            { priority: { in: ['Urgent', 'Critical'] } },
            {
              OR: [
                { assigneeId: user.id },
                {
                  targetDesignationId: user.designationId ?? undefined,
                  assigneeId: null,
                },
              ],
            },
          ],
        },
      }),
    ])

    // Staff distribution by department
    const staffByDeptRaw = await db.staff.groupBy({
      by: ['departmentId'],
      _count: { _all: true },
    })
    const departments = await db.department.findMany()
    const staffByDepartment = staffByDeptRaw
      .map((row) => {
        const dept = departments.find((d) => d.id === row.departmentId)
        return {
          name: dept?.name ?? 'Unassigned',
          code: dept?.code ?? '—',
          count: row._count._all,
        }
      })
      .sort((a, b) => b.count - a.count)

    // Requisitions by type
    const reqsByTypeRaw = await db.requisition.groupBy({
      by: ['type'],
      _count: { _all: true },
    })
    const reqsByType = reqsByTypeRaw.map((r) => ({
      name: r.type.charAt(0).toUpperCase() + r.type.slice(1),
      value: r._count._all,
    }))

    // Monthly requisition trend (last 6 months)
    const now = new Date()
    const months: { label: string; count: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
      const count = await db.requisition.count({
        where: { createdAt: { gte: start, lt: end } },
      })
      months.push({
        label: start.toLocaleDateString('en-US', { month: 'short' }),
        count,
      })
    }

    // Recent requisitions
    const recentReqs = await db.requisition.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { include: { designation: true, department: true } },
        assignee: { include: { designation: true } },
        targetDesignation: true,
      },
    })

    // Recent files
    const recentFiles = await db.registryFile.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { include: { designation: true, department: true } },
        currentHolder: { include: { designation: true } },
        targetDesignation: true,
      },
    })

    // CMD-specific data: requisitions routed to CMD awaiting action
    let cmdQueue: any[] = []
    let cmdMailPreview: any[] = []
    if (user.role === 'CMD') {
      cmdQueue = await db.requisition.findMany({
        where: {
          AND: [
            { state: { not: 'closed_permanently' } },
            {
              OR: [
                { assigneeId: user.id },
                { targetDesignationId: user.designationId ?? undefined, assigneeId: null },
              ],
            },
          ],
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
        include: {
          createdBy: { include: { designation: true, department: true } },
          targetDesignation: true,
          routes: { orderBy: { createdAt: 'desc' }, take: 1, include: { fromUser: true } },
        },
        take: 20,
      })

      cmdMailPreview = await db.mailMessage.findMany({
        where: { toId: user.id, isArchived: false },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { from: { include: { designation: true } } },
      })
    }

    return NextResponse.json({
      stats: {
        totalStaff,
        totalDepartments,
        totalDesignations,
        totalUsers,
        pendingReqsForMe,
        pendingFilesForMe,
        unreadMail,
        pendingReqsAll,
        pendingFilesAll,
        urgentReqsForMe,
      },
      charts: {
        staffByDepartment,
        reqsByType,
        monthlyTrend: months,
      },
      recent: {
        requisitions: recentReqs,
        files: recentFiles,
      },
      cmd: {
        queue: cmdQueue,
        mailPreview: cmdMailPreview,
      },
      user: { id: user.id, role: user.role, roleRank: roleRank(user.role) },
    })
  } catch (e: any) {
    console.error('Dashboard error:', e)
    return NextResponse.json({ error: 'Failed to load dashboard' }, { status: 500 })
  }
}
