import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'
import { getSession } from '@/lib/session'

// POST /api/auth/2fa/disable
// Body: { password: string }
// Verifies the user's password, then disables 2FA (clears secret + recovery codes).
export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const user = await db.user.findUnique({ where: { id: session.userId } })
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { password } = body || {}
    if (!password) {
      return NextResponse.json({ error: 'Password is required to disable 2FA' }, { status: 400 })
    }

    const ok = await verifyPassword(String(password), user.passwordHash)
    if (!ok) {
      return NextResponse.json({ error: 'Incorrect password' }, { status: 403 })
    }

    await db.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorRecoveryCodes: null,
        twoFactorLastUsedAt: null,
      },
    })

    await audit(
      { id: user.id, username: user.username, role: user.role } as any,
      '2fa_disable',
      { entity: 'User', entityId: user.id, details: `Disabled 2FA for ${user.username}`, ipAddress: getIp(req) },
    )

    return NextResponse.json({ success: true, message: '2FA disabled' })
  } catch (e: any) {
    console.error('2FA disable error:', e)
    return NextResponse.json({ error: 'Failed to disable 2FA' }, { status: 500 })
  }
}
