import bcrypt from 'bcryptjs'
import { db } from './db'
import { getSession } from './session'

export type SafeUser = {
  id: string
  email: string
  username: string
  fullName: string
  phone: string | null
  avatarUrl: string | null
  role: string             // primary role (from DB)
  activeRole: string       // the role used for permissions (activeRoleOverride || role)
  secondaryRoles: string[] // additional roles this user can switch to
  staffId: string | null
  designationId: string | null
  departmentId: string | null
  isActive: boolean
  lastLoginAt: Date | null
  // === Two-Factor Authentication ===
  twoFactorEnabled: boolean
  twoFactorSecret: string | null
  twoFactorRecoveryCodes: string | null // JSON array of bcrypt hashes
  twoFactorEnforcedAt: Date | null
  twoFactorLastUsedAt: Date | null
  designation?: { id: string; code: string; name: string; rank: number; level: string } | null
  department?: { id: string; code: string; name: string; faculty: string | null } | null
  staff?: { id: string; staffId: string; fullName: string; position: string | null; rank: string | null } | null
}

function toSafeUser(u: any): SafeUser {
  const { passwordHash, secondaryRoles, activeRoleOverride, ...rest } = u
  const rolesList: string[] = secondaryRoles
    ? String(secondaryRoles).split(',').map((s: string) => s.trim()).filter(Boolean)
    : []
  return {
    ...(rest as any),
    role: u.role,
    activeRole: activeRoleOverride || u.role,
    secondaryRoles: rolesList,
  } as SafeUser
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash)
  } catch {
    return false
  }
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10)
}

export async function getCurrentUser(): Promise<SafeUser | null> {
  const session = await getSession()
  if (!session) return null
  const user = await db.user.findUnique({
    where: { id: session.userId },
    include: {
      designation: true,
      department: true,
      staff: true,
    },
  })
  if (!user || !user.isActive) return null
  return toSafeUser(user)
}

export async function requireUser(): Promise<SafeUser> {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('UNAUTHORIZED')
  }
  return user
}

// Role rank — higher = more senior
export const ROLE_RANK: Record<string, number> = {
  SUPER_ADMIN: 9999,
  ADMIN: 1000,
  PLANNING_OFFICER: 950,
  CMD: 1000,
  CMA: 900,
  AD: 800,
  DFA: 750,
  HOD: 700,
  HOU: 600,
  SECRETARY: 510,
  CMD_SECRETARY: 500,
  APPRAISAL_OFFICER: 400,
  REGISTRY_OFFICER: 300,
  DESK_OFFICER: 350,
  AUDIT_OFFICER: 360,
  CPO: 340,
  STAFF: 100,
}

export function roleRank(role: string): number {
  return ROLE_RANK[role] ?? 0
}

export function isExecutive(role: string): boolean {
  return ['SUPER_ADMIN', 'ADMIN', 'CMD', 'CMA', 'AD', 'DFA'].includes(role)
}

export function isAdmin(role: string): boolean {
  return ['SUPER_ADMIN', 'ADMIN', 'PLANNING_OFFICER'].includes(role)
}

export function isCmd(role: string): boolean {
  return role === 'CMD'
}

export function isRegistry(role: string): boolean {
  return ['SUPER_ADMIN', 'ADMIN', 'REGISTRY_OFFICER'].includes(role)
}
