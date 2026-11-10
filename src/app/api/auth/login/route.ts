import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/auth'
import { setSessionCookie } from '@/lib/session'
import { audit, getIp } from '@/lib/audit'
import { isTwoFactorEnforced } from '@/lib/twofactor'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    const { username, password } = body
    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 })
    }
    // === Username / IPPIS lookup ===
    // The institutional policy is: username = IPPIS Number. But the user may type
    // their IPPIS, their custom username, or even their staffId — look up the
    // User by username first, then by linked Staff.ippisNumber, then by
    // linked Staff.staffId (FUTH/001 etc.).
    const trimmed = String(username).trim().toLowerCase()
    let user = await db.user.findUnique({
      where: { username: trimmed },
      include: { designation: true, department: true, staff: true },
    })
    if (!user) {
      // Try matching by IPPIS Number on the linked Staff record
      user = await db.user.findFirst({
        where: { staff: { ippisNumber: String(username).trim() } },
        include: { designation: true, department: true, staff: true },
      })
    }
    if (!user) {
      // Try matching by Staff.staffId (FUTH internal staff number, e.g. "FUTH/001")
      user = await db.user.findFirst({
        where: { staff: { staffId: String(username).trim() } },
        include: { designation: true, department: true, staff: true },
      })
    }
    if (!user) {
      // Best-effort audit of failed login (no user context)
      try {
        await db.auditLog.create({
          data: {
            userId: 'unknown',
            action: 'login_failed',
            entity: 'User',
            details: `Unknown username / IPPIS: ${username}`,
            ipAddress: getIp(req),
          },
        })
      } catch {}
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }
    if (!user.isActive) {
      return NextResponse.json({ error: 'Account deactivated. Contact the administrator.' }, { status: 403 })
    }
    const ok = await verifyPassword(String(password), user.passwordHash)
    if (!ok) {
      // Audit failed login
      try {
        await db.auditLog.create({
          data: {
            userId: user.id,
            action: 'login_failed',
            entity: 'User',
            details: `Failed password attempt for ${user.username}`,
            ipAddress: getIp(req),
          },
        })
      } catch {}
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // === 2FA check ===
    // If the user has 2FA enabled, do NOT set the session cookie yet — return a challenge.
    if (user.twoFactorEnabled) {
      return NextResponse.json({
        twoFactorRequired: true,
        userId: user.id,
        twoFactorEnforced: isTwoFactorEnforced(user.role),
      })
    }

    // === 2FA ENFORCEMENT (TEMPORARILY DISABLED) ===
    // Two-Factor Authentication is enforced for executive roles, but since the bulk
    // import created 2,800+ accounts without 2FA, we temporarily disable the
    // enforcement block so admins can log in and manage the system.
    // To re-enable: uncomment the block below.
    //
    // if (isTwoFactorEnforced(user.role) && !user.twoFactorEnabled) {
    //   return NextResponse.json({
    //     twoFactorSetupRequired: true,
    //     userId: user.id,
    //     role: user.role,
    //   })
    // }

    // Update last login
    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })

    await setSessionCookie({
      userId: user.id,
      username: user.username,
      role: user.role,
    })

    // Audit successful login
    await audit(
      { id: user.id, username: user.username, role: user.role } as any,
      'login',
      { entity: 'User', entityId: user.id, details: `Login as ${user.username}`, ipAddress: getIp(req) },
    )

    const { passwordHash, ...safeUser } = user
    return NextResponse.json({
      user: {
        ...safeUser,
        lastLoginAt: new Date(),
      },
      message: 'Login successful',
    })
  } catch (e: any) {
    console.error('Login error:', e)
    return NextResponse.json({ error: 'Login failed. Please try again.' }, { status: 500 })
  }
}
