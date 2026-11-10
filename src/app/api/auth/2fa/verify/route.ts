import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { setSessionCookie } from '@/lib/session'
import { audit, getIp } from '@/lib/audit'
import { verifyTotpCode, verifyRecoveryCode } from '@/lib/twofactor'

// POST /api/auth/2fa/verify
// Body: { code: string, userId: string }
// Second step in the login flow — verifies a 6-digit TOTP code OR a 10-char
// recovery code against the user's stored secret / recovery hashes.
// On success, sets the session cookie and proceeds with login.
// Returns { success, remainingRecoveryCodes? }
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { code, userId } = body || {}
    if (!code || !userId) {
      return NextResponse.json({ error: 'code and userId are required' }, { status: 400 })
    }

    const user = await db.user.findUnique({
      where: { id: String(userId) },
      include: { designation: true, department: true, staff: true },
    })
    if (!user || !user.isActive) {
      return NextResponse.json({ error: 'Account not found or deactivated' }, { status: 401 })
    }
    if (!user.twoFactorEnabled) {
      return NextResponse.json({ error: '2FA is not enabled for this account' }, { status: 400 })
    }

    const trimmed = String(code).trim()

    // Try TOTP first (6-digit numeric)
    const isNumeric = /^\d{6}$/.test(trimmed)
    let totpValid = false
    let recoveryValid = false
    let remainingRecoveryHashes: string[] | null = null

    if (isNumeric && user.twoFactorSecret) {
      totpValid = verifyTotpCode(user.twoFactorSecret, trimmed)
    }

    // Try recovery code (any 10-char alphanumeric, case-insensitive)
    if (!totpValid) {
      const result = await verifyRecoveryCode(user.twoFactorRecoveryCodes, trimmed)
      recoveryValid = result.valid
      if (recoveryValid) {
        remainingRecoveryHashes = result.remainingHashes
      }
    }

    if (!totpValid && !recoveryValid) {
      return NextResponse.json({ error: 'Invalid 2FA code or recovery code' }, { status: 401 })
    }

    // Update user: last login, last 2FA used, and (if recovery used) updated recovery hashes
    const updateData: any = {
      lastLoginAt: new Date(),
      twoFactorLastUsedAt: new Date(),
    }
    if (recoveryValid && remainingRecoveryHashes !== null) {
      updateData.twoFactorRecoveryCodes = JSON.stringify(remainingRecoveryHashes)
    }
    await db.user.update({ where: { id: user.id }, data: updateData })

    // Set the session cookie
    await setSessionCookie({
      userId: user.id,
      username: user.username,
      role: user.role,
    })

    // Audit successful 2FA verify
    await audit(
      { id: user.id, username: user.username, role: user.role } as any,
      '2fa_verify',
      {
        entity: 'User',
        entityId: user.id,
        details: recoveryValid
          ? `Verified with recovery code (TOTP bypassed)`
          : `Verified with TOTP code`,
        ipAddress: getIp(req),
      },
    )

    let remainingRecoveryCodes: number | undefined = undefined
    if (recoveryValid && remainingRecoveryHashes) {
      remainingRecoveryCodes = remainingRecoveryHashes.length
    } else if (user.twoFactorRecoveryCodes) {
      try {
        remainingRecoveryCodes = JSON.parse(user.twoFactorRecoveryCodes).length
      } catch {}
    }

    const { passwordHash, ...safeUser } = user
    return NextResponse.json({
      success: true,
      user: {
        ...safeUser,
        lastLoginAt: new Date(),
      },
      message: 'Login successful',
      usedRecoveryCode: recoveryValid,
      remainingRecoveryCodes,
    })
  } catch (e: any) {
    console.error('2FA verify error:', e)
    return NextResponse.json({ error: 'Failed to verify 2FA code' }, { status: 500 })
  }
}
