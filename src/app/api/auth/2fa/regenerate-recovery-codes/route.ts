import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'
import { getSession } from '@/lib/session'
import { generateRecoveryCodes } from '@/lib/twofactor'

// POST /api/auth/2fa/regenerate-recovery-codes
// Body: { password: string }
// Re-verifies password, generates 8 new recovery codes (bcrypt-hashed), returns them plain.
// Audits as 2fa_enable (re-enables the recovery code slot).
export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const user = await db.user.findUnique({ where: { id: session.userId } })
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!user.twoFactorEnabled) {
      return NextResponse.json({ error: '2FA is not enabled' }, { status: 400 })
    }

    const body = await req.json()
    const { password } = body || {}
    if (!password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 })
    }

    const ok = await verifyPassword(String(password), user.passwordHash)
    if (!ok) {
      return NextResponse.json({ error: 'Incorrect password' }, { status: 403 })
    }

    const { plain, hashed } = await generateRecoveryCodes()

    await db.user.update({
      where: { id: user.id },
      data: {
        twoFactorRecoveryCodes: JSON.stringify(hashed),
        twoFactorLastUsedAt: new Date(),
      },
    })

    await audit(
      { id: user.id, username: user.username, role: user.role } as any,
      '2fa_enable',
      {
        entity: 'User',
        entityId: user.id,
        details: 'Regenerated 8 recovery codes',
        ipAddress: getIp(req),
      },
    )

    return NextResponse.json({
      recoveryCodes: plain,
      message: 'New recovery codes generated. The previous codes are no longer valid.',
    })
  } catch (e: any) {
    console.error('2FA regenerate error:', e)
    return NextResponse.json({ error: 'Failed to regenerate recovery codes' }, { status: 500 })
  }
}
