// Two-Factor Authentication (TOTP) helper using otpauth + qrcode libraries.
// Generates secrets, builds otpauth:// URLs, and verifies TOTP codes.

import * as otpauth from 'otpauth'
import * as QRCode from 'qrcode'
import bcrypt from 'bcryptjs'

const ISSUER = 'FUTH LAFIA HR'

// Generate a new TOTP secret + return secret + otpauth URL
export function generateTotpSecret(username: string): { secret: string; otpauthUrl: string } {
  const secret = new otpauth.Secret({ size: 20 })
  const totp = new otpauth.TOTP({
    issuer: ISSUER,
    label: username,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret,
  })
  return {
    secret: secret.base32,
    otpauthUrl: totp.toString(),
  }
}

// Generate a QR code (as a data URL) for the otpauth:// URL
export async function generateQrCodeDataUrl(otpauthUrl: string): Promise<string> {
  return await QRCode.toDataURL(otpauthUrl, { width: 240, margin: 2 })
}

// Verify a 6-digit TOTP code against a stored secret
export function verifyTotpCode(secretBase32: string, code: string): boolean {
  if (!secretBase32 || !code) return false
  const totp = new otpauth.TOTP({
    issuer: ISSUER,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: otpauth.Secret.fromBase32(secretBase32),
  })
  // window: 1 means we accept the previous, current, or next 30-second window
  return totp.validate({ token: code, window: 1 }) !== null
}

// Generate 8 single-use recovery codes (returned as plain strings + their bcrypt hashes)
export async function generateRecoveryCodes(): Promise<{ plain: string[]; hashed: string[] }> {
  const plain: string[] = []
  const hashed: string[] = []
  for (let i = 0; i < 8; i++) {
    // 10-character alphanumeric code, easy to read/write
    const code = Math.random().toString(36).slice(2, 12).toUpperCase()
    plain.push(code)
    hashed.push(await bcrypt.hash(code, 10))
  }
  return { plain, hashed }
}

// Verify a recovery code against the user's stored hashes; consume it (remove from list) if matched
export async function verifyRecoveryCode(
  storedHashesJson: string | null | undefined,
  candidate: string,
): Promise<{ valid: boolean; remainingHashes: string[] }> {
  if (!storedHashesJson) return { valid: false, remainingHashes: [] }
  let hashes: string[] = []
  try {
    hashes = JSON.parse(storedHashesJson)
  } catch {
    return { valid: false, remainingHashes: [] }
  }
  for (let i = 0; i < hashes.length; i++) {
    const match = await bcrypt.compare(candidate.toUpperCase(), hashes[i])
    if (match) {
      const remaining = hashes.slice(0, i).concat(hashes.slice(i + 1))
      return { valid: true, remainingHashes: remaining }
    }
  }
  return { valid: false, remainingHashes: hashes }
}

// Roles for which 2FA is enforced (must enable within 7 days of first login)
// Two-Factor Authentication is REQUIRED (not optional) for all senior roles:
//   - Executive level: SUPER_ADMIN, ADMIN, CMD, CMA
//   - Directorate level: AD, DFA, PLANNING_OFFICER
//   - Sensitive officer roles with system-wide document/staff access:
//     SECRETARY, CMD_SECRETARY, AUDIT_OFFICER, DESK_OFFICER, CPO (payment workflow)
//
// These users cannot log in without first setting up 2FA. The login flow
// (src/app/api/auth/login/route.ts) returns `twoFactorSetupRequired` when
// an enforced user without 2FA tries to log in, and `twoFactorRequired`
// (challenge) when an enforced user WITH 2FA enabled tries to log in.
export const TWO_FACTOR_ENFORCED_ROLES = [
  // Executive
  'SUPER_ADMIN', 'ADMIN', 'CMD', 'CMA',
  // Directorate
  'AD', 'DFA', 'PLANNING_OFFICER',
  // Sensitive officers (institutional document + payment workflow)
  'SECRETARY', 'CMD_SECRETARY', 'AUDIT_OFFICER', 'DESK_OFFICER', 'CPO',
]

export function isTwoFactorEnforced(role: string): boolean {
  return TWO_FACTOR_ENFORCED_ROLES.includes(role)
}
