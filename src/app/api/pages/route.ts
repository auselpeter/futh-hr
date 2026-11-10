import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'

// GET /api/pages — list all pages
export async function GET() {
  try {
    const me = await getCurrentUser()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const pages = await db.page.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { rolePermissions: { include: { role: true } } },
    })
    return NextResponse.json({ pages })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to fetch pages' }, { status: 500 })
  }
}

// POST /api/pages — create a new page (admin only)
export async function POST(req: Request) {
  try {
    const me = await getCurrentUser()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!['SUPER_ADMIN', 'ADMIN'].includes(me.role)) {
      return NextResponse.json({ error: 'Forbidden — admin access required' }, { status: 403 })
    }
    const body = await req.json()
    const { key, name, description, icon, category, sortOrder, isActive } = body || {}
    if (!key || !name) {
      return NextResponse.json({ error: 'Key and name are required' }, { status: 400 })
    }
    const existing = await db.page.findUnique({ where: { key } })
    if (existing) return NextResponse.json({ error: 'Page key already exists' }, { status: 400 })

    const page = await db.page.create({
      data: {
        key,
        name,
        description: description || null,
        icon: icon || null,
        category: category || 'Main',
        sortOrder: sortOrder || 100,
        isActive: isActive !== undefined ? !!isActive : true,
      },
    })
    await audit(me, 'create', { entity: 'Page', entityId: page.id, details: `Created page ${key} — ${name}`, ipAddress: getIp(req) })
    return NextResponse.json({ page })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to create page' }, { status: 500 })
  }
}
