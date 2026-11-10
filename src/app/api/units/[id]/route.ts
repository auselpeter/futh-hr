import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const unit = await db.unit.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, code: true, name: true } },
        houUser: { select: { id: true, fullName: true, username: true } },
        _count: { select: { staff: true } },
      },
    })
    if (!unit) return NextResponse.json({ error: 'Unit not found' }, { status: 404 })
    return NextResponse.json({ unit })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to fetch unit' }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = user.activeRole || user.role
    if (!['SUPER_ADMIN', 'ADMIN', 'CMD', 'CMA', 'AD', 'DFA', 'HOD', 'HOU'].includes(role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }
    const { id } = await params
    const body = await req.json()
    const existing = await db.unit.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Unit not found' }, { status: 404 })

    const allowedKeys = ['name', 'description', 'departmentId', 'houUserId', 'isActive']
    const data: any = {}
    for (const k of allowedKeys) {
      if (body[k] !== undefined) {
        if (k === 'houUserId' && body[k] === 'none') data[k] = null
        else if (k === 'isActive') data[k] = Boolean(body[k])
        else data[k] = body[k] === '' ? null : body[k]
      }
    }
    const updated = await db.unit.update({ where: { id }, data, include: { department: true, houUser: { select: { id: true, fullName: true } } } })
    await audit(user, 'update', { entity: 'Unit', entityId: id, details: `Updated unit ${updated.code}`, ipAddress: getIp(req) })
    return NextResponse.json({ unit: updated })
  } catch (e: any) {
    console.error('Unit patch:', e)
    return NextResponse.json({ error: 'Failed to update unit' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = user.activeRole || user.role
    if (!['SUPER_ADMIN', 'ADMIN'].includes(role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }
    const { id } = await params
    const existing = await db.unit.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Unit not found' }, { status: 404 })

    await db.unit.delete({ where: { id } })
    await audit(user, 'delete', { entity: 'Unit', entityId: id, details: `Deleted unit ${existing.code}`, ipAddress: getIp(req) })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('Unit delete:', e)
    return NextResponse.json({ error: 'Failed to delete unit' }, { status: 500 })
  }
}
