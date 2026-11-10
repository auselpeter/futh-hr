import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'

// GET /api/role-permissions — full matrix of all permissions (with role + page names)
export async function GET(req: Request) {
  try {
    const me = await getCurrentUser()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { searchParams } = new URL(req.url)
    const roleId = searchParams.get('roleId')
    const pageId = searchParams.get('pageId')

    const where: any = {}
    if (roleId) where.roleId = roleId
    if (pageId) where.pageId = pageId

    const perms = await db.rolePagePermission.findMany({
      where,
      include: { role: true, page: true },
      orderBy: [{ role: { rank: 'desc' } }, { page: { sortOrder: 'asc' } }],
    })
    return NextResponse.json({ permissions: perms })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to fetch permissions' }, { status: 500 })
  }
}

// POST /api/role-permissions — create or update a single permission entry
export async function POST(req: Request) {
  try {
    const me = await getCurrentUser()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!['SUPER_ADMIN', 'ADMIN'].includes(me.role)) {
      return NextResponse.json({ error: 'Forbidden — admin access required' }, { status: 403 })
    }
    const body = await req.json()
    const { roleId, pageId, canView, canCreate, canEdit, canDelete } = body || {}
    if (!roleId || !pageId) {
      return NextResponse.json({ error: 'roleId and pageId are required' }, { status: 400 })
    }

    const existing = await db.rolePagePermission.findUnique({
      where: { roleId_pageId: { roleId, pageId } },
    })
    let perm
    if (existing) {
      perm = await db.rolePagePermission.update({
        where: { id: existing.id },
        data: {
          canView: canView ?? existing.canView,
          canCreate: canCreate ?? existing.canCreate,
          canEdit: canEdit ?? existing.canEdit,
          canDelete: canDelete ?? existing.canDelete,
          createdById: me.id,
        },
        include: { role: true, page: true },
      })
    } else {
      perm = await db.rolePagePermission.create({
        data: {
          roleId,
          pageId,
          canView: canView ?? true,
          canCreate: canCreate ?? false,
          canEdit: canEdit ?? false,
          canDelete: canDelete ?? false,
          createdById: me.id,
        },
        include: { role: true, page: true },
      })
    }
    await audit(me, 'permission_change', { entity: 'RolePagePermission', entityId: perm.id, details: `Set permission for role ${perm.role?.code} on page ${perm.page?.key} (view=${canView} create=${canCreate} edit=${canEdit} delete=${canDelete})`, ipAddress: getIp(req) })
    return NextResponse.json({ permission: perm })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to update permission' }, { status: 500 })
  }
}

// PATCH /api/role-permissions — bulk update (batch)
// Body: { updates: [{ roleId, pageId, canView, canCreate, canEdit, canDelete }] }
export async function PATCH(req: Request) {
  try {
    const me = await getCurrentUser()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!['SUPER_ADMIN', 'ADMIN'].includes(me.role)) {
      return NextResponse.json({ error: 'Forbidden — admin access required' }, { status: 403 })
    }
    const body = await req.json()
    const { updates } = body || {}
    if (!Array.isArray(updates)) {
      return NextResponse.json({ error: 'updates array required' }, { status: 400 })
    }

    await db.$transaction(
      updates.map((u: any) => {
        return db.rolePagePermission.upsert({
          where: { roleId_pageId: { roleId: u.roleId, pageId: u.pageId } },
          update: {
            canView: u.canView ?? false,
            canCreate: u.canCreate ?? false,
            canEdit: u.canEdit ?? false,
            canDelete: u.canDelete ?? false,
            createdById: me.id,
          },
          create: {
            roleId: u.roleId,
            pageId: u.pageId,
            canView: u.canView ?? false,
            canCreate: u.canCreate ?? false,
            canEdit: u.canEdit ?? false,
            canDelete: u.canDelete ?? false,
            createdById: me.id,
          },
        })
      })
    )
    await audit(me, 'permission_change', { entity: 'RolePagePermission', entityId: 'bulk', details: `Bulk updated ${updates.length} permission entries`, ipAddress: getIp(req) })
    return NextResponse.json({ success: true, count: updates.length })
  } catch (e: any) {
    console.error('Permission bulk update error:', e)
    return NextResponse.json({ error: 'Failed to bulk update permissions' }, { status: 500 })
  }
}

// DELETE /api/role-permissions — delete a single permission entry
export async function DELETE(req: Request) {
  try {
    const me = await getCurrentUser()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!['SUPER_ADMIN', 'ADMIN'].includes(me.role)) {
      return NextResponse.json({ error: 'Forbidden — admin access required' }, { status: 403 })
    }
    const body = await req.json()
    const { roleId, pageId } = body || {}
    if (!roleId || !pageId) {
      return NextResponse.json({ error: 'roleId and pageId required' }, { status: 400 })
    }
    await db.rolePagePermission.delete({
      where: { roleId_pageId: { roleId, pageId } },
    })
    await audit(me, 'permission_change', { entity: 'RolePagePermission', entityId: `${roleId}:${pageId}`, details: `Removed permission for role/page (${roleId}/${pageId})`, ipAddress: getIp(req) })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to delete permission' }, { status: 500 })
  }
}
