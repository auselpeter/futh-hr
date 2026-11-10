import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, verifyPassword, hashPassword } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'

export async function POST(req: Request) {
  try {
    const me = await getCurrentUser()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json()
    const { currentPassword, newPassword, confirmNewPassword } = body || {}
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return NextResponse.json({ error: 'All three fields are required' }, { status: 400 })
    }
    if (String(newPassword) !== String(confirmNewPassword)) {
      return NextResponse.json({ error: 'New password and confirmation do not match' }, { status: 400 })
    }
    if (String(newPassword).length < 6) {
      return NextResponse.json({ error: 'New password must be at least 6 characters long' }, { status: 400 })
    }
    if (String(newPassword) === String(currentPassword)) {
      return NextResponse.json({ error: 'New password must be different from your current password' }, { status: 400 })
    }
    const user = await db.user.findUnique({ where: { id: me.id } })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    const ok = await verifyPassword(String(currentPassword), user.passwordHash)
    if (!ok) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
    const newHash = await hashPassword(String(newPassword))
    await db.user.update({ where: { id: user.id }, data: { passwordHash: newHash } })
    await audit(me, 'update', { entity: 'User', entityId: user.id, details: 'User changed their own password (self-service from Profile)', ipAddress: getIp(req) })
    return NextResponse.json({ success: true, message: 'Password changed successfully' })
  } catch (e: any) {
    console.error('Change password error:', e)
    return NextResponse.json({ error: 'Failed to change password' }, { status: 500 })
  }
}
