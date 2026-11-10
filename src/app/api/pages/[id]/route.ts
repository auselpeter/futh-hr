import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'

// GET /api/pages/[id]
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await getCurrentUser()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const page = await db.page.findUnique({
      where: { id },
      include: { rolePermissions: { include: { role: true } } },
    })
    if (!page) return NextResponse.json({ error: 'Page not found' }, { status: 404 })
    return NextResponse.json({ page })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to fetch page' }, { status: 500 })
  }
}

// PATCH /api/pages/[id]
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await getCurrentUser()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!['SUPER_ADMIN', 'ADMIN'].includes(me.role)) {
      return NextResponse.json({ error: 'Forbidden — admin access required' }, { status: 403 })
    }
    const { id } = await params
    const body = await req.json()
    const { name, description, icon, category, sortOrder, isActive } = body || {}
    const existing = await db.page.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Page not found' }, { status: 404 })

    const data: any = {}
    if (name !== undefined) data.name = name
    if (description !== undefined) data.description = description || null
    if (icon !== undefined) data.icon = icon || null
    if (category !== undefined) data.category = category
    if (sortOrder !== undefined) data.sortOrder = sortOrder
    if (isActive !== undefined) data.isActive = !!isActive

    const updated = await db.page.update({ where: { id }, data })
    await audit(me, 'update', { entity: 'Page', entityId: id, details: `Updated page ${existing.key}`, ipAddress: getIp(req) })
    return NextResponse.json({ page: updated })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to update page' }, { status: 500 })
  }
}

// DELETE /api/pages/[id]
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await getCurrentUser()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!['SUPER_ADMIN', 'ADMIN'].includes(me.role)) {
      return NextResponse.json({ error: 'Forbidden — admin access required' }, { status: 403 })
    }
    const { id } = await params
    const existing = await db.page.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Page not found' }, { status: 404 })

    await db.page.delete({ where: { id } })
    await audit(me, 'delete', { entity: 'Page', entityId: id, details: `Deleted page ${existing.key}`, ipAddress: getIp(req) })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to delete page' }, { status: 500 })
  }
}
