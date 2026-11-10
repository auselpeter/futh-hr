// Role-based data scoping helper
// Returns a Prisma `where` clause for each entity type based on the current user's role.

import type { SafeUser } from './auth'

export type EntityType =
  | 'requisition'
  | 'file'
  | 'staff'
  | 'leave'
  | 'annualReview'
  | 'monthlyAppraisal'
  | 'quarterlyReview'
  | 'assessment'
  | 'appraisal'
  | 'duty'
  | 'mail'
  | 'promotion'
  | 'termination'
  | 'resignation'
  | 'retirement'
  | 'paymentVoucher'
  | 'postingTransfer'
  | 'training'
  | 'project'
  | 'unit'
  | 'report'

/**
 * Returns the set of fields that exist on a given entity type for self-scope.
 * Different entities have different field names (assigneeId for requisition,
 * currentHolderId for file, userId for staff, toId/fromId for mail, etc).
 */
function selfScopeFields(user: SafeUser, entity: EntityType): any[] {
  const meId = user.id
  const deptId = user.departmentId
  switch (entity) {
    case 'requisition':
      return [
        { createdById: meId },
        { assigneeId: meId },
        { targetUserId: meId },
      ]
    case 'file':
      return [
        { createdById: meId },
        { currentHolderId: meId },
        { targetUserId: meId },
      ]
    case 'staff':
      return [
        { userId: meId },
      ]
    case 'leave':
      // Leaves use createdBy for the applicant
      return [
        { createdBy: meId },
        { staff: { userId: meId } },
      ]
    case 'mail':
      return [
        { fromId: meId },
        { toId: meId },
      ]
    case 'annualReview':
    case 'monthlyAppraisal':
    case 'quarterlyReview':
    case 'assessment':
    case 'appraisal':
    case 'duty':
      return [
        // Appraisal entities are keyed by staffId — scope by the linked user
        { staff: { userId: meId } },
      ]
    case 'promotion':
    case 'termination':
    case 'resignation':
    case 'retirement':
    case 'postingTransfer':
      return [
        { createdById: meId },
        { staff: { userId: meId } },
      ]
    case 'paymentVoucher':
      return [
        { createdById: meId },
        { deskOfficerId: meId },
        { auditOfficerId: meId },
        { payingOfficerId: meId },
      ]
    case 'training':
      return [
        { departmentId: deptId || undefined },
        { enrollments: { some: { staff: { userId: meId } } } },
      ]
    case 'project':
      return [
        { createdById: meId },
        { members: { some: { staff: { userId: meId } } } },
      ]
    case 'unit':
    case 'report':
      return []
  }
}

/**
 * Returns a Prisma `where` clause for the given entity type that scopes
 * records to what the given user is allowed to see.
 */
export function buildScopeFilter(user: SafeUser | null, entity: EntityType): any {
  if (!user) return { id: '__never__' }

  const role = user.activeRole || user.role
  const deptId = user.departmentId

  // All-seeing roles: no filter
  if (['SUPER_ADMIN', 'ADMIN', 'PLANNING_OFFICER', 'CMD', 'CMA', 'DFA', 'AD', 'DESK_OFFICER', 'AUDIT_OFFICER', 'CPO'].includes(role)) {
    return {}
  }

  // HR-lifecycle entities (promotion / termination / resignation / retirement / postingTransfer) — these have
  // a `staff` relation but no top-level `departmentId`, so the filters below
  // scope by `staff.departmentId` for HOD / HOU / AD / DFA.
  if (entity === 'promotion' || entity === 'termination' || entity === 'resignation' || entity === 'retirement' || entity === 'postingTransfer') {
    // DFA sees all HR-lifecycle records (they approve them financially)
    if (role === 'DFA') return {}
    // AD sees all HR-lifecycle records (administrative oversight)
    if (role === 'AD') return {}
    // APPRAISAL_OFFICER — read-only view of all promotions (per RBAC matrix)
    if (role === 'APPRAISAL_OFFICER') return {}
    // HOD / HOU — see only their department's records + their own created records
    if (role === 'HOD' || role === 'HOU') {
      return {
        OR: [
          { staff: { departmentId: deptId || undefined } },
          ...selfScopeFields(user, entity),
        ],
      }
    }
    // STAFF (and any other role) — only their own records
    return { OR: selfScopeFields(user, entity) }
  }

  // Payment vouchers — DFA, AD, AUDIT_OFFICER, DESK_OFFICER, CPO see all PVs
  if (entity === 'paymentVoucher') {
    if (['DFA', 'AD', 'SUPER_ADMIN', 'ADMIN', 'CMD', 'AUDIT_OFFICER', 'DESK_OFFICER', 'CPO'].includes(role)) {
      return {}
    }
    if (role === 'HOD' || role === 'HOU') {
      return {
        OR: [
          { requisition: { departmentId: deptId || undefined } },
          ...selfScopeFields(user, entity),
        ],
      }
    }
    return { OR: selfScopeFields(user, entity) }
  }

  // Trainings, projects — department-scoped
  if (entity === 'training' || entity === 'project' || entity === 'unit' || entity === 'report') {
    if (role === 'DFA' || role === 'AD' || role === 'APPRAISAL_OFFICER' || role === 'REGISTRY_OFFICER') {
      return { OR: [{ departmentId: { not: null } }, ...selfScopeFields(user, entity)] }
    }
    if (role === 'HOD' || role === 'HOU') {
      return {
        OR: [
          { departmentId: deptId || undefined },
          ...selfScopeFields(user, entity),
        ],
      }
    }
    return { OR: selfScopeFields(user, entity) }
  }

  // DFA — sees all dept-tagged records + their own
  if (role === 'DFA') {
    const ors: any[] = [
      { departmentId: { not: null } },
      ...selfScopeFields(user, entity),
    ]
    // For requisitions, DFA also sees all expense requisitions
    if (entity === 'requisition') ors.push({ type: 'expense' })
    return { OR: ors }
  }

  // AD — administrative director — sees ADMIN/HR/REG/FIN depts + own
  if (role === 'AD') {
    return {
      OR: [
        { departmentId: { not: null } },
        ...selfScopeFields(user, entity),
      ],
    }
  }

  // HOD / HOU — see only their department's records + their own
  if (role === 'HOD' || role === 'HOU') {
    return {
      OR: [
        { departmentId: deptId || undefined },
        ...selfScopeFields(user, entity),
      ],
    }
  }

  // APPRAISAL_OFFICER — sees all appraisal/review/duty records (they manage these),
  // sees all staff (read-only), sees only own requisitions/files/mail.
  if (role === 'APPRAISAL_OFFICER') {
    if (['assessment', 'appraisal', 'duty', 'annualReview', 'monthlyAppraisal', 'quarterlyReview'].includes(entity)) {
      return {}
    }
    if (entity === 'staff') return {}
    // requisition / file / mail: own only
    return { OR: selfScopeFields(user, entity) }
  }

  // REGISTRY_OFFICER — sees all files, all staff (they manage the registry),
  // all documents, all committees. Only own requisitions/mail.
  if (role === 'REGISTRY_OFFICER') {
    if (entity === 'file') return {}
    if (entity === 'staff') return {}
    if (entity === 'mail') return {}
    return { OR: selfScopeFields(user, entity) }
  }

  // Default: STAFF — see only their own records
  return { OR: selfScopeFields(user, entity) }
}

/**
 * Combine a base `where` (with potential `OR` for search) and a scope filter.
 * Uses Prisma's AND to combine them. If scope is `{}` returns base.
 */
export function applyScope(baseWhere: any, scopeWhere: any): any {
  if (!scopeWhere || Object.keys(scopeWhere).length === 0) return baseWhere
  const andArray: any[] = []
  if (baseWhere && Object.keys(baseWhere).length > 0) andArray.push(baseWhere)
  andArray.push(scopeWhere)
  return { AND: andArray }
}
