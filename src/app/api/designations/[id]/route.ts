import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, isAdmin } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!isAdmin(user.role)) {
      return NextResponse.json({ error: 'Only administrators can edit designations' }, { status: 403 })
    }
    const { id } = await params
    const body = await req.json()
    const { name, description, rank, level, isActive } = body || {}

    const data: any = {}
    if (name !== undefined) data.name = String(name)
    if (description !== undefined) data.description = description ? String(description) : null
    if (rank !== undefined) data.rank = Number(rank)
    if (level !== undefined) data.level = String(level)
    if (isActive !== undefined) data.isActive = Boolean(isActive)

    const designation = await db.designation.update({
      where: { id },
      data,
      include: { _count: { select: { users: true, staff: true } } },
    })
    await audit(user, 'update', { entity: 'Designation', entityId: id, details: `Updated designation ${designation.code} — ${designation.name}`, ipAddress: getIp(req) })
    return NextResponse.json({ designation })
  } catch (e: any) {
    console.error('Update designation error:', e)
    return NextResponse.json({ error: 'Failed to update designation' }, { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!isAdmin(user.role)) {
      return NextResponse.json({ error: 'Only administrators can delete designations' }, { status: 403 })
    }
    const { id } = await params
    // Soft delete — just deactivate
    const existing = await db.designation.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Designation not found' }, { status: 404 })
    await db.designation.update({ where: { id }, data: { isActive: false } })
    await audit(user, 'delete', { entity: 'Designation', entityId: id, details: `Deactivated designation ${existing.code} — ${existing.name}`, ipAddress: getIp(req) })
    return NextResponse.json({ message: 'Designation deactivated' })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to delete designation' }, { status: 500 })
  }
}
