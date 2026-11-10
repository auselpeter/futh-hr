import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'

// GET /api/roles/[id] — fetch a single role with its permissions
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await getCurrentUser()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const role = await db.role.findUnique({
      where: { id },
      include: { rolePermissions: { include: { page: true } } },
    })
    if (!role) return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    return NextResponse.json({ role })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to fetch role' }, { status: 500 })
  }
}

// PATCH /api/roles/[id] — update role
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await getCurrentUser()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!['SUPER_ADMIN', 'ADMIN'].includes(me.role)) {
      return NextResponse.json({ error: 'Forbidden — admin access required' }, { status: 403 })
    }
    const { id } = await params
    const body = await req.json()
    const { name, description, rank, level, isActive } = body || {}
    const existing = await db.role.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    // Code is immutable for system roles; allow update only for non-system
    if (existing.isSystem && body.code && body.code !== existing.code) {
      return NextResponse.json({ error: 'System role code is immutable' }, { status: 400 })
    }

    const data: any = {}
    if (name !== undefined) data.name = name
    if (description !== undefined) data.description = description || null
    if (rank !== undefined) data.rank = rank
    if (level !== undefined) data.level = level
    if (isActive !== undefined) data.isActive = !!isActive

    const updated = await db.role.update({ where: { id }, data, include: { rolePermissions: { include: { page: true } } } })
    await audit(me, 'update', { entity: 'Role', entityId: id, details: `Updated role ${existing.code}`, ipAddress: getIp(req) })
    return NextResponse.json({ role: updated })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to update role' }, { status: 500 })
  }
}

// DELETE /api/roles/[id] — delete role (only non-system roles)
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await getCurrentUser()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!['SUPER_ADMIN', 'ADMIN'].includes(me.role)) {
      return NextResponse.json({ error: 'Forbidden — admin access required' }, { status: 403 })
    }
    const { id } = await params
    const existing = await db.role.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    if (existing.isSystem) return NextResponse.json({ error: 'System roles cannot be deleted' }, { status: 400 })

    // Check if any users have this role
    const userCount = await db.user.count({ where: { role: existing.code } })
    if (userCount > 0) {
      return NextResponse.json({ error: `Cannot delete: ${userCount} users still have this role` }, { status: 400 })
    }

    await db.role.delete({ where: { id } })
    await audit(me, 'delete', { entity: 'Role', entityId: id, details: `Deleted role ${existing.code}`, ipAddress: getIp(req) })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to delete role' }, { status: 500 })
  }
}
