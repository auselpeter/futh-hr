/**
 * Seed:
 *   - SECRETARY role + designation + demo user
 *   - CMD_SECRETARY role + designation + demo user
 *   - RBAC for documents page (view+create+edit+delete) granted to:
 *       SUPER_ADMIN, ADMIN, REGISTRY_OFFICER, SECRETARY, CMD_SECRETARY, AD
 *   - RBAC for documents page (view+create only) granted to STAFF
 *       (STAFF upload is restricted to personal_image/personal_signature via API)
 *   - RBAC for documents page (view only) granted to other roles (CMD, CMA, DFA, HOD, HOU, APPRAISAL_OFFICER)
 *
 * Run with: bun run scripts/seed-secretary-roles.ts
 */
import { db } from '../src/lib/db'
import bcrypt from 'bcryptjs'

async function main() {
  console.log('Seeding SECRETARY + CMD_SECRETARY roles + Documents page RBAC...')

  // 1. Create the documents page if missing
  const documentsPage = await db.page.upsert({
    where: { key: 'documents' },
    update: { name: 'Documents', icon: 'FileText', category: 'Registry', sortOrder: 90, isActive: true,
      description: 'Institutional document repository — Registry uploads hardcopies, committee files; staff upload own image/signature' },
    create: { key: 'documents', name: 'Documents', icon: 'FileText', category: 'Registry', sortOrder: 90, isActive: true,
      description: 'Institutional document repository — Registry uploads hardcopies, committee files; staff upload own image/signature' },
  })
  console.log('✓ page: documents')

  // 2. Roles + designations + demo users for SECRETARY and CMD_SECRETARY
  const roleDefs = [
    {
      code: 'SECRETARY',
      name: 'Secretary',
      description: 'Secretary — institutional document management, committee files',
      rank: 500,
      level: 'officer',
      username: 'secretary',
      fullName: 'Mrs. Hauwa Idris',
      email: 'secretary@futhlafia.gov.ng',
      altEmail: 'secretary_officer@futhlafia.gov.ng',
      deptCode: 'REG',
    },
    {
      code: 'CMD_SECRETARY',
      name: 'CMD Secretary',
      description: "CMD's Secretary — executive document management for the CMD's office",
      rank: 510,
      level: 'officer',
      username: 'cmd_secretary',
      fullName: 'Mr. Suleiman Abba',
      email: 'cmd.secretary@futhlafia.gov.ng',
      altEmail: 'cmd_secretary_officer@futhlafia.gov.ng',
      deptCode: 'ADMIN',
    },
  ] as const

  const passwordHash = await bcrypt.hash('admin123', 10)

  for (const def of roleDefs) {
    // Role
    await db.role.upsert({
      where: { code: def.code },
      update: { name: def.name, description: def.description, rank: def.rank, level: def.level, isSystem: true, isActive: true },
      create: { code: def.code, name: def.name, description: def.description, rank: def.rank, level: def.level, isSystem: true, isActive: true },
    })
    // Designation
    const dsg = await db.designation.upsert({
      where: { code: def.code },
      update: { name: def.name, description: def.description, rank: def.rank, level: def.level },
      create: { code: def.code, name: def.name, description: def.description, rank: def.rank, level: def.level },
    })
    // Department
    const dept = await db.department.findUnique({ where: { code: def.deptCode } })
    if (!dept) {
      console.log(`⚠ department ${def.deptCode} not found — skipping user creation for ${def.username}`)
      continue
    }

    // Pick a unique email (avoid collision with existing users)
    let emailToUse = def.email
    const existingWithEmail = await db.user.findUnique({ where: { email: emailToUse } })
    if (existingWithEmail && existingWithEmail.username !== def.username) {
      emailToUse = def.altEmail
      const altConflict = await db.user.findUnique({ where: { email: emailToUse } })
      if (altConflict && altConflict.username !== def.username) {
        emailToUse = `${def.username}_${Date.now()}@futhlafia.gov.ng`
      }
    }

    const existing = await db.user.findUnique({ where: { username: def.username } })
    if (existing) {
      await db.user.update({
        where: { username: def.username },
        data: {
          email: emailToUse,
          fullName: def.fullName,
          role: def.code,
          designationId: dsg.id,
          departmentId: dept.id,
          passwordHash,
          isActive: true,
        },
      })
      console.log(`✓ user updated: ${def.username} (${def.code}) — email=${emailToUse}`)
    } else {
      await db.user.create({
        data: {
          username: def.username,
          email: emailToUse,
          fullName: def.fullName,
          role: def.code,
          designationId: dsg.id,
          departmentId: dept.id,
          passwordHash,
          isActive: true,
        },
      })
      console.log(`✓ user created: ${def.username} (${def.code}) — email=${emailToUse}`)
    }
    console.log(`✓ role + designation: ${def.code}`)
  }

  // 3. RBAC for documents page
  // Full CRUD: SUPER_ADMIN, ADMIN, REGISTRY_OFFICER, SECRETARY, CMD_SECRETARY, AD
  // View + Create (limited): STAFF — API enforces that STAFF can only upload personal_image / personal_signature for themselves
  // View only: CMD, CMA, DFA, HOD, HOU, APPRAISAL_OFFICER
  const fullCRUD = ['SUPER_ADMIN', 'ADMIN', 'REGISTRY_OFFICER', 'SECRETARY', 'CMD_SECRETARY', 'AD']
  const viewCreate = ['STAFF', 'PLANNING_OFFICER']
  const viewOnly = ['CMD', 'CMA', 'DFA', 'HOD', 'HOU', 'APPRAISAL_OFFICER']

  for (const code of [...fullCRUD, ...viewCreate, ...viewOnly]) {
    await db.role.upsert({
      where: { code },
      update: { isActive: true },
      create: { code, name: code.replace('_', ' '), isActive: true, isSystem: true },
    })
    const roleRec = await db.role.findUnique({ where: { code } })
    if (!roleRec) continue
    const canCreate = fullCRUD.includes(code) || viewCreate.includes(code)
    const canEdit = fullCRUD.includes(code)
    const canDelete = fullCRUD.includes(code)
    await db.rolePagePermission.upsert({
      where: { roleId_pageId: { roleId: roleRec.id, pageId: documentsPage.id } },
      update: { canView: true, canCreate, canEdit, canDelete },
      create: { roleId: roleRec.id, pageId: documentsPage.id, canView: true, canCreate, canEdit, canDelete },
    })
    const level = fullCRUD.includes(code) ? 'full' : viewCreate.includes(code) ? 'view+create' : 'view'
    console.log(`✓ RBAC: ${code} → documents [${level}]`)
  }

  console.log('Done.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await db.$disconnect() })
