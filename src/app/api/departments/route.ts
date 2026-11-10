import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const departments = await db.department.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: {
        hodUser: { select: { id: true, fullName: true, username: true } },
        _count: { select: { users: true, staff: true, units: true } },
      },
    })
    return NextResponse.json({ departments })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to fetch departments' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = user.activeRole || user.role
    if (!['SUPER_ADMIN', 'ADMIN', 'CMD', 'CMA', 'AD', 'DFA', 'HOD'].includes(role)) {
      return NextResponse.json({ error: 'Not authorized to create departments' }, { status: 403 })
    }
    const body = await req.json()
    const { code, name, faculty, hodUserId, isActive } = body || {}
    if (!code || !name) return NextResponse.json({ error: 'code and name are required' }, { status: 400 })
    const existing = await db.department.findUnique({ where: { code } })
    if (existing) return NextResponse.json({ error: 'Department code already exists' }, { status: 400 })

    const department = await db.department.create({
      data: {
        code,
        name,
        faculty: faculty || null,
        hodUserId: hodUserId || null,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
      include: { hodUser: { select: { id: true, fullName: true, username: true } } },
    })
    await audit(user, 'create', { entity: 'Department', entityId: department.id, details: `Created department ${code} — ${name}`, ipAddress: getIp(req) })
    return NextResponse.json({ department })
  } catch (e: any) {
    console.error('Department create:', e)
    return NextResponse.json({ error: 'Failed to create department' }, { status: 500 })
  }
}
