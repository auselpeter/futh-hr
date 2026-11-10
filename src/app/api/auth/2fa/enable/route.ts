import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'
import { verifyTotpCode, generateRecoveryCodes } from '@/lib/twofactor'

// POST /api/auth/2fa/enable
// Body: { code: string, userId?: string }
//
// Verifies the 6-digit code against the stored secret. If valid, enables 2FA
// and generates 8 recovery codes (bcrypt-hashed, stored on the user record).
// Returns the recovery codes in PLAIN text — they are only shown once.
//
// Supports both authenticated (session-based) and pre-auth (userId in body)
// flows. The pre-auth flow is used when the login endpoint returns
// `twoFactorSetupRequired: true, userId` and the user is completing setup
// before being issued a session cookie.
export async function POST(req: Request) {
  try {
    // Parse body ONCE — req.json() can only be called once
    const body = await req.json().catch(() => ({}))
    const { code, userId: bodyUserId } = body || {}

    let user = await getCurrentUser()

    if (!user) {
      const userId = bodyUserId
      if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      const dbUser = await db.user.findUnique({ where: { id: String(userId) } })
      if (!dbUser || !dbUser.isActive) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      user = {
        id: dbUser.id,
        email: dbUser.email,
        username: dbUser.username,
        fullName: dbUser.fullName,
        phone: dbUser.phone,
        avatarUrl: dbUser.avatarUrl,
        role: dbUser.role,
        activeRole: dbUser.role,
        secondaryRoles: [],
        staffId: dbUser.staffId,
        designationId: dbUser.designationId,
        departmentId: dbUser.departmentId,
        isActive: dbUser.isActive,
        lastLoginAt: dbUser.lastLoginAt,
        twoFactorEnabled: dbUser.twoFactorEnabled,
        twoFactorSecret: dbUser.twoFactorSecret,
        twoFactorRecoveryCodes: dbUser.twoFactorRecoveryCodes,
        twoFactorEnforcedAt: dbUser.twoFactorEnforcedAt,
        twoFactorLastUsedAt: dbUser.twoFactorLastUsedAt,
      } as any
    }

    if (user.twoFactorEnabled) {
      return NextResponse.json({ error: '2FA is already enabled' }, { status: 400 })
    }

    if (!code || !String(code).trim()) {
      return NextResponse.json({ error: 'A 6-digit code is required' }, { status: 400 })
    }

    const storedSecret = user.twoFactorSecret
    if (!storedSecret) {
      return NextResponse.json(
        { error: 'No TOTP secret found. Please call /api/auth/2fa/setup first.' },
        { status: 400 },
      )
    }

    const ok = verifyTotpCode(storedSecret, String(code).trim())
    if (!ok) {
      return NextResponse.json({ error: 'Invalid verification code. Please try again.' }, { status: 400 })
    }

    // Generate 8 recovery codes
    const { plain, hashed } = await generateRecoveryCodes()

    await db.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: true,
        twoFactorRecoveryCodes: JSON.stringify(hashed),
        twoFactorLastUsedAt: new Date(),
      },
    })

    await audit(user, '2fa_enable', {
      entity: 'User',
      entityId: user.id,
      details: 'Enabled 2FA (TOTP) and generated 8 recovery codes',
      ipAddress: getIp(req),
    })

    return NextResponse.json({
      recoveryCodes: plain,
      message: '2FA enabled. Save your recovery codes — they will not be shown again.',
    })
  } catch (e: any) {
    console.error('2FA enable error:', e)
    return NextResponse.json({ error: 'Failed to enable 2FA' }, { status: 500 })
  }
}
