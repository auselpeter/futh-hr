// Audit logging helper — call `audit()` from any API mutation to record an audit entry.
// Entries show up in the User Management → Activity Log tab.

import { db } from './db'
import type { SafeUser } from './auth'

export type AuditAction =
  | 'create' | 'update' | 'delete'
  | 'sign' | 'approve' | 'reject' | 'forward' | 'return' | 'close' | 'acknowledge'
  | 'withdraw' | 'archive' | 'complete' | 'cancel'
  | 'login' | 'logout' | 'login_failed'
  | 'role_switch' | '2fa_enable' | '2fa_disable' | '2fa_verify'
  | 'permission_change' | 'reset_password' | 'upload'

export async function audit(
  user: SafeUser | null | undefined,
  action: AuditAction | string,
  options: {
    entity?: string
    entityId?: string
    details?: string
    ipAddress?: string
  } = {},
): Promise<void> {
  if (!user?.id) return // don't audit actions without a user context
  try {
    await db.auditLog.create({
      data: {
        userId: user.id,
        action: String(action),
        entity: options.entity || null,
        entityId: options.entityId || null,
        details: options.details || null,
        ipAddress: options.ipAddress || null,
      },
    })
  } catch (e) {
    // Don't fail the main operation just because audit logging failed
    console.error('Audit log failed:', e)
  }
}

// Convenience helper for handlers that want to extract an IP address from a Request
export function getIp(req?: Request): string | undefined {
  if (!req) return undefined
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  const realIp = req.headers.get('x-real-ip')
  if (realIp) return realIp
  return undefined
}
