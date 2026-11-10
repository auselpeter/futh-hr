// Seed script for Pages, Roles, and default Role-Page Permissions
// Run with: bun run /home/z/my-project/scripts/seed-rbac.ts

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

// Pages — matches ViewKey in Sidebar.tsx (all 26 pages)
const PAGES = [
  { key: 'dashboard',          name: 'Dashboard',           icon: 'LayoutDashboard', category: 'Main',      sortOrder: 10,  description: 'Main dashboard with stats and charts' },
  { key: 'cmd-dashboard',      name: 'CMD Dashboard',       icon: 'ShieldCheck',     category: 'Executive', sortOrder: 20,  description: 'Executive CMD-only dashboard with approval queue' },
  { key: 'cmd-mail',           name: 'CMD Mail',            icon: 'Inbox',           category: 'Executive', sortOrder: 30,  description: 'CMD internal mail inbox' },
  { key: 'requisitions',       name: 'Requisitions',       icon: 'FolderKanban',    category: 'Main',      sortOrder: 40,  description: 'Requisitions (service/expense/other) with routing workflow' },
  { key: 'projects',           name: 'Projects',           icon: 'FolderKanban',    category: 'Main',      sortOrder: 45,  description: 'Institutional projects with members and milestones' },
  { key: 'reports',            name: 'Reports',            icon: 'FileBarChart',    category: 'Main',      sortOrder: 48,  description: 'Report templates & generated reports' },
  { key: 'files',              name: 'Registry Files',      icon: 'FileText',        category: 'Main',      sortOrder: 50,  description: 'Registry files including committee files with full routing history' },
  { key: 'committees',         name: 'Committees',          icon: 'Users2',          category: 'Admin',     sortOrder: 55,  description: 'Manage institutional committees (Tenders, Disciplinary, etc.)' },
  { key: 'staff',              name: 'Staff Directory',     icon: 'Users',           category: 'HR',        sortOrder: 60,  description: 'Staff directory with full bio + NOK/Bank/Academic' },
  { key: 'duties',             name: 'Duties',             icon: 'ListChecks',      category: 'HR',        sortOrder: 65,  description: 'Duty assignments and tracking' },
  { key: 'appraisals',         name: 'Appraisals & Reviews',icon: 'ClipboardList',   category: 'HR',        sortOrder: 70,  description: 'Annual/Monthly/Quarterly reviews + Assessments + Appraisals + Duties' },
  { key: 'department-ratings', name: 'Department Ratings', icon: 'Award',           category: 'HR',        sortOrder: 75,  description: 'Department/unit performance leaderboard' },
  { key: 'leaves',             name: 'Leave Management',   icon: 'Plane',           category: 'HR',        sortOrder: 80,  description: 'Leave applications with HOD/DFA/CMD approval workflow' },
  { key: 'promotions',         name: 'Promotions',          icon: 'TrendingUp',      category: 'HR',        sortOrder: 85,  description: 'Staff promotions with HOD → DFA → CMD approval workflow' },
  { key: 'terminations',       name: 'Terminations',        icon: 'UserMinus',       category: 'HR',        sortOrder: 86,  description: 'Staff terminations/dismissals/retirement' },
  { key: 'resignations',       name: 'Resignations',         icon: 'DoorOpen',        category: 'HR',        sortOrder: 87,  description: 'Staff resignation applications' },
  { key: 'retirements',        name: 'Retirements',         icon: 'HandCoins',       category: 'HR',        sortOrder: 88,  description: 'Staff retirement applications & benefit processing' },
  { key: 'payment-vouchers',   name: 'Payment Vouchers',   icon: 'Receipt',         category: 'Finance',    sortOrder: 89,  description: 'Payment vouchers — DFA → Desk Officer → Audit workflow' },
  { key: 'posting-transfer',   name: 'Posting & Transfer', icon: 'ArrowLeftRight',  category: 'HR',        sortOrder: 90,  description: 'Posting/transfer workflow — Planning → HOD → DFA → CMD' },
  { key: 'trainings',          name: 'Training',           icon: 'GraduationCap',    category: 'HR',        sortOrder: 91,  description: 'Training programs with enrollments & certificates' },
  { key: 'departments',       name: 'Departments',         icon: 'Building2',        category: 'Admin',     sortOrder: 92,  description: 'Department management' },
  { key: 'units',              name: 'Units',              icon: 'Network',          category: 'Admin',     sortOrder: 93,  description: 'Unit management (sub-departmental)' },
  { key: 'designations',      name: 'Designations',        icon: 'BriefcaseBusiness',category: 'Admin',     sortOrder: 95,  description: 'Job designations (CMD/CMA/AD/HOD/HOU/DFA/AO/REG/STF)' },
  { key: 'user-mgmt',          name: 'User Management',    icon: 'UserCog',          category: 'Admin',     sortOrder: 110, description: 'Manage users, roles, pages, and permissions' },
  { key: 'mail',               name: 'Mail',               icon: 'Mail',             category: 'Main',      sortOrder: 120, description: 'Internal mail' },
  { key: 'settings',           name: 'Settings',           icon: 'Settings',         category: 'Admin',     sortOrder: 130, description: 'System settings' },
]

// Roles — mirrors the role string on User
const ROLES = [
  { code: 'SUPER_ADMIN',      name: 'Super Administrator',   rank: 2000, level: 'executive',  isSystem: true, description: 'Full system access including User Management' },
  { code: 'ADMIN',            name: 'Administrator',         rank: 1500, level: 'executive',  isSystem: true, description: 'System administrator — all modules except user mgmt' },
  { code: 'CMD',              name: 'Chief Medical Director',rank: 1000, level: 'executive',  isSystem: true, description: 'Hospital chief executive — top-level approver' },
  { code: 'CMA',              name: 'Chief Medical Administrator', rank: 900, level: 'executive', isSystem: true, description: 'Chief administrative officer' },
  { code: 'AD',               name: 'Administrator (AD)',   rank: 800,  level: 'directorate', isSystem: true, description: 'Directorate-level administrator' },
  { code: 'DFA',              name: 'Director of Finance & Administration', rank: 750, level: 'directorate', isSystem: true, description: 'Director of Finance & Administration' },
  { code: 'HOD',              name: 'Head of Department',    rank: 700,  level: 'management', isSystem: true, description: 'Head of Department — scoped to own department' },
  { code: 'HOU',              name: 'Head of Unit',          rank: 600,  level: 'management', isSystem: true, description: 'Head of Unit — unit-level manager' },
  { code: 'APPRAISAL_OFFICER',name: 'Appraisal Officer',    rank: 400,  level: 'officer',    isSystem: true, description: 'Appraisal Officer — performance reviews' },
  { code: 'REGISTRY_OFFICER', name: 'Registry Officer',     rank: 300,  level: 'officer',    isSystem: true, description: 'Registry Officer — file creation & routing' },
  { code: 'STAFF',            name: 'Staff',                rank: 100,  level: 'staff',      isSystem: true, description: 'Regular staff member' },
]

// Default permission matrix: which role gets what on which page
// canView, canCreate, canEdit, canDelete
type Perm = [boolean, boolean, boolean, boolean]

// Pages each role should see and what they can do
const ROLE_PAGE_MATRIX: Record<string, Record<string, Perm>> = {
  SUPER_ADMIN: {
    'dashboard': [true, true, true, true],
    'cmd-dashboard': [true, true, true, true],
    'cmd-mail': [true, true, true, true],
    'requisitions': [true, true, true, true],
    'projects': [true, true, true, true],
    'reports': [true, true, true, true],
    'files': [true, true, true, true],
    'committees': [true, true, true, true],
    'staff': [true, true, true, true],
    'duties': [true, true, true, true],
    'appraisals': [true, true, true, true],
    'department-ratings': [true, true, true, true],
    'leaves': [true, true, true, true],
    'promotions': [true, true, true, true],
    'terminations': [true, true, true, true],
    'resignations': [true, true, true, true],
    'retirements': [true, true, true, true],
    'payment-vouchers': [true, true, true, true],
    'posting-transfer': [true, true, true, true],
    'trainings': [true, true, true, true],
    'departments': [true, true, true, true],
    'units': [true, true, true, true],
    'designations': [true, true, true, true],
    'mail': [true, true, true, true],
    'user-mgmt': [true, true, true, true],
    'settings': [true, true, true, true],
  },
  ADMIN: {
    'dashboard': [true, true, true, true],
    'requisitions': [true, true, true, true],
    'projects': [true, true, true, true],
    'reports': [true, true, true, true],
    'files': [true, true, true, true],
    'committees': [true, true, true, true],
    'staff': [true, true, true, true],
    'duties': [true, true, true, true],
    'appraisals': [true, true, true, true],
    'department-ratings': [true, true, true, true],
    'leaves': [true, true, true, true],
    'promotions': [true, true, true, true],
    'terminations': [true, true, true, true],
    'resignations': [true, true, true, true],
    'retirements': [true, true, true, true],
    'payment-vouchers': [true, true, true, true],
    'posting-transfer': [true, true, true, true],
    'trainings': [true, true, true, true],
    'departments': [true, true, true, true],
    'units': [true, true, true, true],
    'designations': [true, true, true, true],
    'mail': [true, true, true, true],
    'settings': [true, true, true, true],
  },
  CMD: {
    'dashboard': [true, false, false, false],
    'cmd-dashboard': [true, false, false, false],
    'cmd-mail': [true, true, true, true],
    'requisitions': [true, true, true, true],
    'projects': [true, true, true, false],
    'reports': [true, true, false, false],
    'files': [true, true, true, true],
    'committees': [true, true, true, false],
    'staff': [true, false, false, false],
    'duties': [true, true, true, false],
    'appraisals': [true, true, true, false],
    'department-ratings': [true, false, false, false],
    'leaves': [true, true, true, false],
    'promotions': [true, true, true, false],
    'terminations': [true, true, true, false],
    'resignations': [true, true, true, false],
    'retirements': [true, true, true, false],
    'payment-vouchers': [true, true, true, false],
    'posting-transfer': [true, true, true, false],
    'trainings': [true, true, true, false],
    'departments': [true, false, false, false],
    'units': [true, false, false, false],
    'designations': [true, false, false, false],
    'mail': [true, true, true, true],
  },
  CMA: {
    'dashboard': [true, false, false, false],
    'cmd-mail': [true, true, true, true],
    'requisitions': [true, true, true, false],
    'projects': [true, true, true, false],
    'reports': [true, true, false, false],
    'files': [true, true, true, false],
    'committees': [true, true, true, false],
    'staff': [true, false, false, false],
    'duties': [true, true, true, false],
    'appraisals': [true, true, true, false],
    'department-ratings': [true, false, false, false],
    'leaves': [true, true, true, false],
    'promotions': [true, true, true, false],
    'terminations': [true, true, true, false],
    'resignations': [true, true, true, false],
    'retirements': [true, true, true, false],
    'payment-vouchers': [true, true, true, false],
    'posting-transfer': [true, true, true, false],
    'trainings': [true, true, true, false],
    'designations': [true, false, false, false],
    'mail': [true, true, true, true],
  },
  AD: {
    'dashboard': [true, false, false, false],
    'requisitions': [true, true, true, false],
    'projects': [true, true, true, false],
    'reports': [true, true, false, false],
    'files': [true, true, true, false],
    'committees': [true, true, true, false],
    'staff': [true, true, true, false],
    'duties': [true, true, true, false],
    'appraisals': [true, true, true, false],
    'department-ratings': [true, false, false, false],
    'leaves': [true, true, true, false],
    'promotions': [true, true, true, false],
    'terminations': [true, true, true, false],
    'resignations': [true, true, true, false],
    'retirements': [true, true, true, false],
    'payment-vouchers': [true, true, true, false],
    'posting-transfer': [true, true, true, false],
    'trainings': [true, true, true, false],
    'departments': [true, false, false, false],
    'units': [true, true, true, false],
    'designations': [true, false, false, false],
    'mail': [true, true, true, true],
  },
  DFA: {
    'dashboard': [true, false, false, false],
    'requisitions': [true, true, true, false],
    'projects': [true, true, true, false],
    'reports': [true, true, false, false],
    'files': [true, true, true, false],
    'committees': [true, true, true, false],
    'staff': [true, false, false, false],
    'duties': [true, true, true, false],
    'appraisals': [true, true, true, false],
    'department-ratings': [true, false, false, false],
    'leaves': [true, true, true, false],
    'promotions': [true, true, true, false],
    'terminations': [true, true, true, false],
    'resignations': [true, true, true, false],
    'retirements': [true, true, true, false],
    'payment-vouchers': [true, true, true, true],
    'posting-transfer': [true, true, true, false],
    'trainings': [true, true, true, false],
    'designations': [true, false, false, false],
    'mail': [true, true, true, true],
  },
  HOD: {
    'dashboard': [true, false, false, false],
    'requisitions': [true, true, true, false],
    'projects': [true, true, true, false],
    'reports': [true, false, false, false],
    'files': [true, true, true, false],
    'staff': [true, false, false, false],
    'duties': [true, true, true, false],
    'appraisals': [true, true, true, false],
    'department-ratings': [true, false, false, false],
    'leaves': [true, true, true, false],
    'promotions': [true, true, true, false],
    'terminations': [true, true, true, false],
    'resignations': [true, true, true, false],
    'retirements': [true, true, true, false],
    'payment-vouchers': [true, true, true, false],
    'posting-transfer': [true, true, true, false],
    'trainings': [true, true, true, false],
    'mail': [true, true, true, true],
  },
  HOU: {
    'dashboard': [true, false, false, false],
    'requisitions': [true, true, true, false],
    'projects': [true, true, true, false],
    'reports': [true, false, false, false],
    'files': [true, true, true, false],
    'staff': [true, false, false, false],
    'duties': [true, true, true, false],
    'appraisals': [true, true, true, false],
    'department-ratings': [true, false, false, false],
    'leaves': [true, true, true, false],
    'trainings': [true, true, true, false],
    'units': [true, false, false, false],
    'mail': [true, true, true, true],
  },
  APPRAISAL_OFFICER: {
    'dashboard': [true, false, false, false],
    'staff': [true, false, false, false],
    'duties': [true, true, true, false],
    'appraisals': [true, true, true, false],
    'department-ratings': [true, false, false, false],
    'leaves': [true, false, false, false],
    'promotions': [true, false, false, false],
    'trainings': [true, true, true, false],
    'mail': [true, true, true, true],
  },
  REGISTRY_OFFICER: {
    'dashboard': [true, false, false, false],
    'requisitions': [true, true, true, false],
    'files': [true, true, true, true],
    'staff': [true, false, false, false],
    'mail': [true, true, true, true],
  },
  STAFF: {
    'dashboard': [true, false, false, false],
    'requisitions': [true, true, false, false],
    'leaves': [true, true, false, false],
    'resignations': [true, true, false, false],
    'trainings': [true, false, false, false],
    'mail': [true, true, true, true],
  },
}

async function main() {
  console.log('Seeding Pages, Roles, and Role-Page Permissions...')

  // 1. Pages
  for (const p of PAGES) {
    await db.page.upsert({
      where: { key: p.key },
      update: { name: p.name, description: p.description, icon: p.icon, category: p.category, sortOrder: p.sortOrder, isActive: true },
      create: p,
    })
  }
  console.log(`✓ ${PAGES.length} pages seeded`)

  // 2. Roles
  for (const r of ROLES) {
    await db.role.upsert({
      where: { code: r.code },
      update: { name: r.name, description: r.description, rank: r.rank, level: r.level, isSystem: r.isSystem, isActive: true },
      create: r,
    })
  }
  console.log(`✓ ${ROLES.length} roles seeded`)

  // 3. Role-Page Permissions
  const allPages = await db.page.findMany()
  const allRoles = await db.role.findMany()
  const pageByKey = Object.fromEntries(allPages.map((p) => [p.key, p]))
  const roleByCode = Object.fromEntries(allRoles.map((r) => [r.code, r]))

  let permCount = 0
  for (const [roleCode, pageMap] of Object.entries(ROLE_PAGE_MATRIX)) {
    const role = roleByCode[roleCode]
    if (!role) continue
    for (const [pageKey, perm] of Object.entries(pageMap)) {
      const page = pageByKey[pageKey]
      if (!page) continue
      const [canView, canCreate, canEdit, canDelete] = perm
      const existing = await db.rolePagePermission.findUnique({
        where: { roleId_pageId: { roleId: role.id, pageId: page.id } },
      })
      if (existing) {
        await db.rolePagePermission.update({
          where: { id: existing.id },
          data: { canView, canCreate, canEdit, canDelete },
        })
      } else {
        await db.rolePagePermission.create({
          data: { roleId: role.id, pageId: page.id, canView, canCreate, canEdit, canDelete },
        })
      }
      permCount++
    }
  }
  console.log(`✓ ${permCount} role-page permissions seeded`)

  console.log('RBAC seeding complete!')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await db.$disconnect() })
