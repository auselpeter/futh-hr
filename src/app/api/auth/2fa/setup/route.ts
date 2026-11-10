import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { generateTotpSecret, generateQrCodeDataUrl, isTwoFactorEnforced } from '@/lib/twofactor'

// POST /api/auth/2fa/setup
// Body (optional): { userId?: string }
//
// Generates a TOTP secret for the current user (from the session) OR, if there
// is no session, for the user identified by `userId` in the request body
// (used during the pre-auth 2FA-setup-required flow).
//
// Does NOT enable 2FA yet — user must verify a code first via /enable.
// Returns { secret, otpauthUrl, qrDataUrl, enforced }.
export async function POST(req: Request) {
  try {
    let user = await getCurrentUser()

    // Pre-auth flow: no session, but userId provided in body
    if (!user) {
      const body = await req.json().catch(() => ({}))
      const userId = body?.userId
      if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      const dbUser = await db.user.findUnique({ where: { id: String(userId) } })
      if (!dbUser || !dbUser.isActive) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      // Only allow setup if user doesn't already have 2FA enabled
      if (dbUser.twoFactorEnabled) {
        return NextResponse.json(
          { error: '2FA is already enabled for this account' },
          { status: 400 },
        )
      }
      // Only allow setup if it's enforced OR they explicitly want it (no
      // requirement check — anyone can set up 2FA voluntarily, even STAFF).
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

    // If already enabled, refuse to set up again
    if (user.twoFactorEnabled) {
      return NextResponse.json(
        { error: '2FA is already enabled. Disable it first to set up a new secret.' },
        { status: 400 },
      )
    }

    const { secret, otpauthUrl } = generateTotpSecret(user.username)
    const qrDataUrl = await generateQrCodeDataUrl(otpauthUrl)

    // Store the secret on the user record (NOT yet enabled).
    // Set twoFactorEnforcedAt if enforced for this role and not already set.
    const enforced = isTwoFactorEnforced(user.role)
    await db.user.update({
      where: { id: user.id },
      data: {
        twoFactorSecret: secret,
        twoFactorEnforcedAt: enforced ? (user.twoFactorEnforcedAt ?? new Date()) : null,
      },
    })

    return NextResponse.json({
      secret,
      otpauthUrl,
      qrDataUrl,
      enforced,
    })
  } catch (e: any) {
    console.error('2FA setup error:', e)
    return NextResponse.json({ error: 'Failed to begin 2FA setup' }, { status: 500 })
  }
}
