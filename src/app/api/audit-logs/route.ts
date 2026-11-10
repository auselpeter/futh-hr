import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, isAdmin } from '@/lib/auth'

// GET /api/audit-logs — paginated, filterable audit log list
// Query params:
//   page (default 1)
//   limit (default 50, max 200)
//   userId (filter by user)
//   entity (filter by entity type)
//   action (filter by action)
//   q (search details/user)
//   from (ISO date)
//   to (ISO date)
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Activity Log is admin-only (CMD + SUPER_ADMIN + ADMIN).
    // Auditors / AD / DFA also can view.
    const allowedRoles = ['SUPER_ADMIN', 'ADMIN', 'CMD', 'CMA', 'AD', 'DFA']
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json({ error: 'You do not have access to the audit log' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))
    const userId = searchParams.get('userId')
    const entity = searchParams.get('entity')
    const action = searchParams.get('action')
    const q = searchParams.get('q') || ''
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const where: any = {}
    if (userId) where.userId = userId
    if (entity) where.entity = entity
    if (action) where.action = { contains: action }
    if (from || to) {
      where.createdAt = {}
      if (from) where.createdAt.gte = new Date(from)
      if (to) where.createdAt.lte = new Date(to)
    }
    if (q) {
      where.OR = [
        { details: { contains: q } },
        { action: { contains: q } },
        { entity: { contains: q } },
        { user: { fullName: { contains: q } } },
        { user: { username: { contains: q } } },
      ]
    }

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              username: true,
              role: true,
              avatarUrl: true,
            },
          },
        },
      }),
      db.auditLog.count({ where }),
    ])

    return NextResponse.json({
      logs,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    })
  } catch (e: any) {
    console.error('Audit logs list error:', e)
    return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 })
  }
}

// DELETE /api/audit-logs — clears logs older than 90 days. SUPER_ADMIN only.
export async function DELETE() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Only Super Admin can clear audit logs' }, { status: 403 })
    }
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 90)
    const result = await db.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } })
    return NextResponse.json({ deleted: result.count, cutoff })
  } catch (e: any) {
    console.error('Clear audit logs error:', e)
    return NextResponse.json({ error: 'Failed to clear audit logs' }, { status: 500 })
  }
}
