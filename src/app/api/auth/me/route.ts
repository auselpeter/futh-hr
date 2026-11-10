import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { isTwoFactorEnforced } from '@/lib/twofactor'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ user: null }, { status: 200 })
    }
    // Compute 2FA-related fields
    let remainingRecoveryCodes = 0
    if (user.twoFactorRecoveryCodes) {
      try {
        remainingRecoveryCodes = JSON.parse(user.twoFactorRecoveryCodes).length
      } catch {
        remainingRecoveryCodes = 0
      }
    }
    return NextResponse.json({
      user: {
        ...user,
        twoFactorEnabled: user.twoFactorEnabled,
        twoFactorEnforced: isTwoFactorEnforced(user.role),
        twoFactorRecoveryCodesRemaining: remainingRecoveryCodes,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ user: null }, { status: 200 })
  }
}
