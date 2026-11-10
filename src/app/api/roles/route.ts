import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'

// GET /api/roles — list all roles
export async function GET() {
  try {
    const me = await getCurrentUser()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const roles = await db.role.findMany({
      orderBy: { rank: 'desc' },
      include: {
        rolePermissions: { include: { page: true } },
        _count: { select: { rolePermissions: true } },
      },
    })
    // Count users per primary role — return a flat { [roleCode]: count } object so the
    // frontend can do `userCounts[r.code]` directly.
    const grouped = await db.user.groupBy({ by: ['role'], _count: { _all: true } })
    const userCounts: Record<string, number> = {}
    for (const g of grouped) {
      userCounts[g.role] = g._count._all
    }
    // Also count users who have this role as a SECONDARY role (stored in the
    // comma-separated `secondaryRoles` column on User). For each role, add the
    // number of users whose secondaryRoles list contains that role code (skipping
    // entries that match the user's own primary role to avoid double-counting).
    const allUsers = await db.user.findMany({
      where: { secondaryRoles: { not: null } },
      select: { role: true, secondaryRoles: true },
    })
    for (const u of allUsers) {
      const secondary = (u.secondaryRoles || '')
        .split(',')
        .map((r: string) => r.trim())
        .filter((r: string) => Boolean(r) && r !== u.role)
      for (const r of secondary) {
        userCounts[r] = (userCounts[r] || 0) + 1
      }
    }
    return NextResponse.json({ roles, userCounts })
  } catch (e: any) {
    console.error('Roles list error:', e?.message)
    return NextResponse.json({ error: 'Failed to fetch roles' }, { status: 500 })
  }
}

// POST /api/roles — create a new role (admin only)
export async function POST(req: Request) {
  try {
    const me = await getCurrentUser()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!['SUPER_ADMIN', 'ADMIN'].includes(me.role)) {
      return NextResponse.json({ error: 'Forbidden — admin access required' }, { status: 403 })
    }
    const body = await req.json()
    const { code, name, description, rank, level, isActive } = body || {}
    if (!code || !name) {
      return NextResponse.json({ error: 'Code and name are required' }, { status: 400 })
    }
    const existing = await db.role.findUnique({ where: { code } })
    if (existing) return NextResponse.json({ error: 'Role code already exists' }, { status: 400 })

    const role = await db.role.create({
      data: {
        code,
        name,
        description: description || null,
        rank: rank || 100,
        level: level || 'staff',
        isSystem: false,
        isActive: isActive !== undefined ? !!isActive : true,
      },
    })
    await audit(me, 'create', { entity: 'Role', entityId: role.id, details: `Created role ${code} — ${name}`, ipAddress: getIp(req) })
    return NextResponse.json({ role })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to create role' }, { status: 500 })
  }
}
