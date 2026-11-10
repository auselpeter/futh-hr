import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { clearSessionCookie } from '@/lib/session'
import { audit, getIp } from '@/lib/audit'

export async function POST(req: Request) {
  try {
    // Audit logout before clearing cookie
    const user = await getCurrentUser()
    if (user) {
      await audit(user, 'logout', { entity: 'User', entityId: user.id, details: `Logout: ${user.username}`, ipAddress: getIp(req) })
    }
    await clearSessionCookie()
    return NextResponse.json({ message: 'Logged out' })
  } catch (e: any) {
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 })
  }
}
