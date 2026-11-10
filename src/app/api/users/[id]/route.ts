import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'
import bcrypt from 'bcryptjs'

const userInclude = {
  designation: true,
  department: true,
  staff: true,
}

// GET /api/users/[id] — fetch a single user (admin only)
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await getCurrentUser()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!['SUPER_ADMIN', 'ADMIN'].includes(me.role)) {
      return NextResponse.json({ error: 'Forbidden — admin access required' }, { status: 403 })
    }
    const { id } = await params
    const user = await db.user.findUnique({ where: { id }, include: userInclude })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    const { passwordHash, ...safe } = user
    return NextResponse.json({ user: safe })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 })
  }
}

// PATCH /api/users/[id] — update user (admin only)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await getCurrentUser()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!['SUPER_ADMIN', 'ADMIN'].includes(me.role)) {
      return NextResponse.json({ error: 'Forbidden — admin access required' }, { status: 403 })
    }
    const { id } = await params
    const body = await req.json()
    const { username, email, fullName, password, role, phone, designationId, departmentId, staffId, isActive } = body || {}

    const existing = await db.user.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Check uniqueness if username/email is changing
    if (username || email) {
      const conflict = await db.user.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            { OR: [{ username: username || '' }, { email: email || '' }] },
          ],
        },
      })
      if (conflict) return NextResponse.json({ error: 'Username or email already exists' }, { status: 400 })
    }

    const data: any = {}
    if (username !== undefined) data.username = username
    if (email !== undefined) data.email = email
    if (fullName !== undefined) data.fullName = fullName
    if (role !== undefined) data.role = role
    if (phone !== undefined) data.phone = phone || null
    if (designationId !== undefined) data.designationId = designationId || null
    if (departmentId !== undefined) data.departmentId = departmentId || null
    if (staffId !== undefined) data.staffId = staffId || null
    if (isActive !== undefined) data.isActive = !!isActive
    if (password) data.passwordHash = bcrypt.hashSync(password, 10)

    const updated = await db.user.update({ where: { id }, data, include: userInclude })
    const { passwordHash, ...safe } = updated
    await audit(me, 'update', { entity: 'User', entityId: id, details: `Updated user ${existing.username}${password ? ' (incl. password reset)' : ''}`, ipAddress: getIp(req) })
    return NextResponse.json({ user: safe })
  } catch (e: any) {
    console.error('User update error:', e)
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}

// DELETE /api/users/[id] — soft delete (set isActive=false) — admin only
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await getCurrentUser()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!['SUPER_ADMIN', 'ADMIN'].includes(me.role)) {
      return NextResponse.json({ error: 'Forbidden — admin access required' }, { status: 403 })
    }
    const { id } = await params
    if (id === me.id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
    }
    const existing = await db.user.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Soft-delete by deactivating
    await db.user.update({ where: { id }, data: { isActive: false } })
    await audit(me, 'delete', { entity: 'User', entityId: id, details: `Deactivated user ${existing.username}`, ipAddress: getIp(req) })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
  }
}
