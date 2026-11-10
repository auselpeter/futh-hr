import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const department = await db.department.findUnique({
      where: { id },
      include: {
        hodUser: { select: { id: true, fullName: true, username: true } },
        units: { select: { id: true, code: true, name: true } },
        _count: { select: { users: true, staff: true, units: true } },
      },
    })
    if (!department) return NextResponse.json({ error: 'Department not found' }, { status: 404 })
    return NextResponse.json({ department })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to fetch department' }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = user.activeRole || user.role
    if (!['SUPER_ADMIN', 'ADMIN', 'CMD', 'CMA', 'AD', 'DFA', 'HOD'].includes(role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }
    const { id } = await params
    const body = await req.json()
    const existing = await db.department.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Department not found' }, { status: 404 })

    const allowedKeys = ['name', 'faculty', 'hodUserId', 'isActive']
    const data: any = {}
    for (const k of allowedKeys) {
      if (body[k] !== undefined) {
        if (k === 'hodUserId' && body[k] === 'none') data[k] = null
        else if (k === 'isActive') data[k] = Boolean(body[k])
        else data[k] = body[k] === '' ? null : body[k]
      }
    }
    const updated = await db.department.update({ where: { id }, data, include: { hodUser: { select: { id: true, fullName: true, username: true } } } })
    await audit(user, 'update', { entity: 'Department', entityId: id, details: `Updated department ${updated.code}`, ipAddress: getIp(req) })
    return NextResponse.json({ department: updated })
  } catch (e: any) {
    console.error('Department patch:', e)
    return NextResponse.json({ error: 'Failed to update department' }, { status: 500 })
  }
}
