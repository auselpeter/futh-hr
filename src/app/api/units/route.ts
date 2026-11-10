import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { searchParams } = new URL(req.url)
    const departmentId = searchParams.get('departmentId')
    const where: any = { isActive: true }
    if (departmentId) where.departmentId = departmentId
    const units = await db.unit.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        department: { select: { id: true, code: true, name: true } },
        houUser: { select: { id: true, fullName: true, username: true } },
        _count: { select: { staff: true } },
      },
    })
    return NextResponse.json({ units })
  } catch (e: any) {
    console.error('Units list:', e)
    return NextResponse.json({ error: 'Failed to fetch units' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = user.activeRole || user.role
    if (!['SUPER_ADMIN', 'ADMIN', 'CMD', 'CMA', 'AD', 'DFA', 'HOD', 'HOU'].includes(role)) {
      return NextResponse.json({ error: 'Not authorized to create units' }, { status: 403 })
    }
    const body = await req.json()
    const { code, name, description, departmentId, houUserId, isActive } = body || {}
    if (!code || !name || !departmentId) {
      return NextResponse.json({ error: 'code, name and departmentId are required' }, { status: 400 })
    }
    const existing = await db.unit.findUnique({ where: { code } })
    if (existing) return NextResponse.json({ error: 'Unit code already exists' }, { status: 400 })

    const unit = await db.unit.create({
      data: {
        code,
        name,
        description: description || null,
        departmentId,
        houUserId: houUserId || null,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
      include: { department: true, houUser: { select: { id: true, fullName: true } } },
    })
    await audit(user, 'create', { entity: 'Unit', entityId: unit.id, details: `Created unit ${code} — ${name}`, ipAddress: getIp(req) })
    return NextResponse.json({ unit })
  } catch (e: any) {
    console.error('Unit create:', e)
    return NextResponse.json({ error: 'Failed to create unit' }, { status: 500 })
  }
}
