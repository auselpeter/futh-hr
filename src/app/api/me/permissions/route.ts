import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

// GET /api/me/permissions — returns the list of page keys the current user can view
export async function GET() {
  try {
    const me = await getCurrentUser()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Use the active role (override or primary)
    const activeRole = (me as any).activeRole || me.role

    // SUPER_ADMIN sees everything
    if (activeRole === 'SUPER_ADMIN') {
      const allPages = await db.page.findMany({ where: { isActive: true } })
      return NextResponse.json({
        pages: allPages.map((p) => p.key),
        permissions: allPages.map((p) => ({ key: p.key, canView: true, canCreate: true, canEdit: true, canDelete: true })),
      })
    }

    // Find the user's Role record (by code = activeRole)
    const role = await db.role.findUnique({ where: { code: activeRole } })
    if (!role) {
      // Fallback: no role found, only allow dashboard
      return NextResponse.json({ pages: ['dashboard'], permissions: [{ key: 'dashboard', canView: true, canCreate: false, canEdit: false, canDelete: false }] })
    }

    // Fetch all permissions for this role where canView = true
    const perms = await db.rolePagePermission.findMany({
      where: { roleId: role.id, canView: true, page: { isActive: true } },
      include: { page: true },
    })
    return NextResponse.json({
      pages: perms.map((p) => p.page.key),
      permissions: perms.map((p) => ({
        key: p.page.key,
        canView: p.canView,
        canCreate: p.canCreate,
        canEdit: p.canEdit,
        canDelete: p.canDelete,
      })),
    })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to fetch permissions' }, { status: 500 })
  }
}
