/**
 * Seed PLANNING_OFFICER:
 *   - role (with full staff permissions: view + create + edit + delete)
 *   - designation
 *   - demo user `planning` (password `admin123`)
 *
 * Run with: bun run scripts/seed-planning-officer.ts
 */
import { db } from '../src/lib/db'
import bcrypt from 'bcryptjs'

async function main() {
  console.log('Seeding PLANNING_OFFICER role + designation + demo user + RBAC...')

  // 1. Role: PLANNING_OFFICER
  await db.role.upsert({
    where: { code: 'PLANNING_OFFICER' },
    update: { name: 'Planning Officer', description: 'Planning Officer — staff records management', isSystem: true, isActive: true, rank: 850, level: 'directorate' },
    create: { code: 'PLANNING_OFFICER', name: 'Planning Officer', description: 'Planning Officer — staff records management', isSystem: true, isActive: true, rank: 850, level: 'directorate' },
  })
  console.log('✓ role: PLANNING_OFFICER')

  // 2. Designation
  const dsg = await db.designation.upsert({
    where: { code: 'PLANNING_OFFICER' },
    update: { name: 'Planning Officer', description: 'Planning Officer — manages staff records, appraisals, duties, planning', rank: 850, level: 'directorate' },
    create: { code: 'PLANNING_OFFICER', name: 'Planning Officer', description: 'Planning Officer — manages staff records, appraisals, duties, planning', rank: 850, level: 'directorate' },
  })
  console.log('✓ designation: PLANNING_OFFICER')

  // 3. Demo user — put them in HR department (since they handle staff)
  const hrDept = await db.department.findUnique({ where: { code: 'HR' } })
  if (!hrDept) throw new Error('HR department not seeded')
  const passwordHash = await bcrypt.hash('admin123', 10)
  const targetEmail = 'planning@futhlafia.gov.ng'

  // Find a usable email: the target email may already be used by a different test user.
  // Pick a unique email in that case.
  const emailOwner = await db.user.findUnique({ where: { email: targetEmail } })
  const planningUser = await db.user.findUnique({ where: { username: 'planning' } })
  const finalEmail =
    !emailOwner || emailOwner.username === 'planning'
      ? targetEmail
      : `planning_officer@futhlafia.gov.ng`

  if (planningUser) {
    await db.user.update({
      where: { username: 'planning' },
      data: {
        email: finalEmail,
        fullName: 'Mr. Adamu Tanko',
        role: 'PLANNING_OFFICER',
        designationId: dsg.id,
        departmentId: hrDept.id,
        passwordHash,
        isActive: true,
      },
    })
    console.log(`✓ user updated: planning (PLANNING_OFFICER) — email=${finalEmail}`)
  } else {
    // Confirm the final email isn't already taken
    const conflict = await db.user.findUnique({ where: { email: finalEmail } })
    const safeEmail = conflict ? `planning_${Date.now()}@futhlafia.gov.ng` : finalEmail
    await db.user.create({
      data: {
        username: 'planning',
        email: safeEmail,
        fullName: 'Mr. Adamu Tanko',
        role: 'PLANNING_OFFICER',
        designationId: dsg.id,
        departmentId: hrDept.id,
        passwordHash,
        isActive: true,
      },
    })
    console.log(`✓ user created: planning (PLANNING_OFFICER) — email=${safeEmail}`)
  }

  // 4. RBAC: grant PLANNING_OFFICER broad permissions — at minimum full staff CRUD
  const roleRec = await db.role.findUnique({ where: { code: 'PLANNING_OFFICER' } })
  if (!roleRec) throw new Error('PLANNING_OFFICER role not found after upsert')

  // === Staff: full CRUD (view + create + edit + delete) ===
  const staffPage = await db.page.findUnique({ where: { key: 'staff' } })
  if (staffPage) {
    await db.rolePagePermission.upsert({
      where: { roleId_pageId: { roleId: roleRec.id, pageId: staffPage.id } },
      update: { canView: true, canCreate: true, canEdit: true, canDelete: true },
      create: { roleId: roleRec.id, pageId: staffPage.id, canView: true, canCreate: true, canEdit: true, canDelete: true },
    })
    console.log('✓ RBAC: PLANNING_OFFICER → staff [view, create, edit, delete]')
  }

  // === Designations: full CRUD (Planning Officer manages designations) ===
  const dsgPage = await db.page.findUnique({ where: { key: 'designations' } })
  if (dsgPage) {
    await db.rolePagePermission.upsert({
      where: { roleId_pageId: { roleId: roleRec.id, pageId: dsgPage.id } },
      update: { canView: true, canCreate: true, canEdit: true, canDelete: false },
      create: { roleId: roleRec.id, pageId: dsgPage.id, canView: true, canCreate: true, canEdit: true, canDelete: false },
    })
    console.log('✓ RBAC: PLANNING_OFFICER → designations [view, create, edit]')
  }

  // === Departments: view only ===
  const deptPage = await db.page.findUnique({ where: { key: 'departments' } })
  if (deptPage) {
    await db.rolePagePermission.upsert({
      where: { roleId_pageId: { roleId: roleRec.id, pageId: deptPage.id } },
      update: { canView: true, canCreate: false, canEdit: false, canDelete: false },
      create: { roleId: roleRec.id, pageId: deptPage.id, canView: true, canCreate: false, canEdit: false, canDelete: false },
    })
    console.log('✓ RBAC: PLANNING_OFFICER → departments [view]')
  }

  // === Units: view only ===
  const unitPage = await db.page.findUnique({ where: { key: 'units' } })
  if (unitPage) {
    await db.rolePagePermission.upsert({
      where: { roleId_pageId: { roleId: roleRec.id, pageId: unitPage.id } },
      update: { canView: true, canCreate: false, canEdit: false, canDelete: false },
      create: { roleId: roleRec.id, pageId: unitPage.id, canView: true, canCreate: false, canEdit: false, canDelete: false },
    })
    console.log('✓ RBAC: PLANNING_OFFICER → units [view]')
  }

  // === Duties (Appraisals tab): full CRUD — Planning Officer can assign duties ===
  const apprPage = await db.page.findUnique({ where: { key: 'appraisals' } })
  if (apprPage) {
    await db.rolePagePermission.upsert({
      where: { roleId_pageId: { roleId: roleRec.id, pageId: apprPage.id } },
      update: { canView: true, canCreate: true, canEdit: true, canDelete: false },
      create: { roleId: roleRec.id, pageId: apprPage.id, canView: true, canCreate: true, canEdit: true, canDelete: false },
    })
    console.log('✓ RBAC: PLANNING_OFFICER → appraisals [view, create, edit]')
  }

  // === Dashboard: view only ===
  const dashPage = await db.page.findUnique({ where: { key: 'dashboard' } })
  if (dashPage) {
    await db.rolePagePermission.upsert({
      where: { roleId_pageId: { roleId: roleRec.id, pageId: dashPage.id } },
      update: { canView: true, canCreate: false, canEdit: false, canDelete: false },
      create: { roleId: roleRec.id, pageId: dashPage.id, canView: true, canCreate: false, canEdit: false, canDelete: false },
    })
    console.log('✓ RBAC: PLANNING_OFFICER → dashboard [view]')
  }

  // === Mail: full CRUD ===
  const mailPage = await db.page.findUnique({ where: { key: 'mail' } })
  if (mailPage) {
    await db.rolePagePermission.upsert({
      where: { roleId_pageId: { roleId: roleRec.id, pageId: mailPage.id } },
      update: { canView: true, canCreate: true, canEdit: true, canDelete: true },
      create: { roleId: roleRec.id, pageId: mailPage.id, canView: true, canCreate: true, canEdit: true, canDelete: true },
    })
    console.log('✓ RBAC: PLANNING_OFFICER → mail [view, create, edit, delete]')
  }

  // === Settings: view ===
  const setPage = await db.page.findUnique({ where: { key: 'settings' } })
  if (setPage) {
    await db.rolePagePermission.upsert({
      where: { roleId_pageId: { roleId: roleRec.id, pageId: setPage.id } },
      update: { canView: true, canCreate: false, canEdit: false, canDelete: false },
      create: { roleId: roleRec.id, pageId: setPage.id, canView: true, canCreate: false, canEdit: false, canDelete: false },
    })
    console.log('✓ RBAC: PLANNING_OFFICER → settings [view]')
  }

  // === Reports: view + create (Planning Officer generates HR reports) ===
  const repPage = await db.page.findUnique({ where: { key: 'reports' } })
  if (repPage) {
    await db.rolePagePermission.upsert({
      where: { roleId_pageId: { roleId: roleRec.id, pageId: repPage.id } },
      update: { canView: true, canCreate: true, canEdit: false, canDelete: false },
      create: { roleId: roleRec.id, pageId: repPage.id, canView: true, canCreate: true, canEdit: false, canDelete: false },
    })
    console.log('✓ RBAC: PLANNING_OFFICER → reports [view, create]')
  }

  // === Leaves: view + create + edit (Planning Officer manages leave requests) ===
  const leavePage = await db.page.findUnique({ where: { key: 'leaves' } })
  if (leavePage) {
    await db.rolePagePermission.upsert({
      where: { roleId_pageId: { roleId: roleRec.id, pageId: leavePage.id } },
      update: { canView: true, canCreate: true, canEdit: true, canDelete: false },
      create: { roleId: roleRec.id, pageId: leavePage.id, canView: true, canCreate: true, canEdit: true, canDelete: false },
    })
    console.log('✓ RBAC: PLANNING_OFFICER → leaves [view, create, edit]')
  }

  console.log('Done.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await db.$disconnect() })
