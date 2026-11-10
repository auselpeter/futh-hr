import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'

// POST /api/me/switch-role
// Body: { role: 'HOD' } — switches the current user's active role to the
// provided role (must be in the user's secondaryRoles or be their primary role).
// Pass { role: null } to clear the override and revert to primary role.
export async function POST(req: Request) {
  try {
    const me = await getCurrentUser()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { role } = body || {}

    // Clear override → revert to primary
    if (!role || role === me.role) {
      await db.user.update({
        where: { id: me.id },
        data: { activeRoleOverride: null },
      })
      await audit(me, 'role_switch', { entity: 'User', entityId: me.id, details: `Reverted to primary role: ${me.role}`, ipAddress: getIp(req) })
      return NextResponse.json({ success: true, activeRole: me.role })
    }

    // Validate that the requested role is in the user's secondaryRoles
    const secondaryRoles: string[] = (me as any).secondaryRoles || []
    if (!secondaryRoles.includes(role)) {
      return NextResponse.json(
        { error: `Role '${role}' is not assigned to your account. You can only switch to: ${[me.role, ...secondaryRoles].join(', ')}` },
        { status: 403 }
      )
    }

    // Verify the role exists in the Role table
    const roleRec = await db.role.findUnique({ where: { code: role } })
    if (!roleRec || !roleRec.isActive) {
      return NextResponse.json({ error: 'Role not found or inactive' }, { status: 400 })
    }

    await db.user.update({
      where: { id: me.id },
      data: { activeRoleOverride: role },
    })

    await audit(me, 'role_switch', { entity: 'User', entityId: me.id, details: `Switched active role to ${role} (primary: ${me.role})`, ipAddress: getIp(req) })

    return NextResponse.json({ success: true, activeRole: role })
  } catch (e: any) {
    console.error('Switch role error:', e)
    return NextResponse.json({ error: 'Failed to switch role' }, { status: 500 })
  }
}
