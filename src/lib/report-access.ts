// Resolve a user's report access level.
//
// Priority order (highest wins):
//   executive   → CMD, CMA, SUPER_ADMIN, ADMIN  → can see ALL templates
//   director    → DFA, AD                        → director + management + level_management + all
//   management  → HOD                             → management + level_management + all
//   level_management → HOU, APPRAISAL_OFFICER, REGISTRY_OFFICER  → level_management + all
//   all         → STAFF, DESK_OFFICER, AUDIT_OFFICER            → only "all" templates
//
// If the user holds the PLANNING_OFFICER designation, they're treated as
// `management` level (they manage the Posting & Transfer workflow).

import type { SafeUser } from './auth'

export type ReportAccessLevel =
  | 'executive'
  | 'director'
  | 'management'
  | 'level_management'
  | 'all'

// All template access levels in order from most-restrictive to least-restrictive
export const ACCESS_LEVELS: ReportAccessLevel[] = [
  'all',
  'level_management',
  'management',
  'director',
  'executive',
]

export const ACCESS_LEVEL_LABELS: Record<ReportAccessLevel, string> = {
  all: 'All Staff',
  level_management: 'Level Management',
  management: 'Management',
  director: 'Director',
  executive: 'Executive',
}

// Map a user's role + designation to a single access level
export function resolveAccessLevel(user: SafeUser | null | undefined): ReportAccessLevel {
  if (!user) return 'all'
  const role = user.activeRole || user.role
  const desgCode = user.designation?.code

  // Planning Officer designation → management level
  if (desgCode === 'PLANNING_OFFICER') return 'management'

  if (['SUPER_ADMIN', 'ADMIN', 'CMD', 'CMA'].includes(role)) return 'executive'
  if (['DFA', 'AD'].includes(role)) return 'director'
  if (role === 'HOD') return 'management'
  if (['HOU', 'APPRAISAL_OFFICER', 'REGISTRY_OFFICER'].includes(role)) return 'level_management'
  return 'all'
}

// Return the list of access levels a user is allowed to view.
// e.g. a `director` user can see templates with accessLevel ∈ [director, management, level_management, all]
export function allowedAccessLevels(user: SafeUser | null | undefined): ReportAccessLevel[] {
  const lvl = resolveAccessLevel(user)
  switch (lvl) {
    case 'executive':
      return ['executive', 'director', 'management', 'level_management', 'all']
    case 'director':
      return ['director', 'management', 'level_management', 'all']
    case 'management':
      return ['management', 'level_management', 'all']
    case 'level_management':
      return ['level_management', 'all']
    case 'all':
    default:
      return ['all']
  }
}
