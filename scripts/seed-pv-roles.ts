/**
 * Seed Payment Voucher specialized roles: DESK_OFFICER, AUDIT_OFFICER, CPO
 * These roles are referenced by the PV workflow action route but were missing
 * from the original seed (which only had DFA in the finance chain).
 *
 * Run with: bun run scripts/seed-pv-roles.ts
 */
import { db } from '../src/lib/db'
import bcrypt from 'bcryptjs'

async function main() {
  console.log('Seeding PV-specialized designations + demo users...')

  // 1. Designations — Desk Officer, Audit Officer, Central Pay Officer
  const designations = [
    { code: 'DESK_OFFICER', name: 'Desk Officer', description: 'Finance Desk Officer — raises PVs and forwards to Audit', rank: 350, level: 'officer' },
    { code: 'AUDIT_OFFICER', name: 'Audit Officer', description: 'Internal Audit — reviews and clears PVs for payment', rank: 360, level: 'officer' },
    { code: 'CPO', name: 'Central Pay Officer', description: 'Central Pay Officer — disburses payment and records cheque numbers', rank: 340, level: 'officer' },
  ]
  for (const d of designations) {
    const existing = await db.designation.findUnique({ where: { code: d.code } })
    if (existing) {
      await db.designation.update({ where: { code: d.code }, data: { name: d.name, description: d.description, rank: d.rank, level: d.level } })
      console.log(`✓ designation updated: ${d.code} — ${d.name}`)
    } else {
      await db.designation.create({ data: d })
      console.log(`✓ designation created: ${d.code} — ${d.name}`)
    }
  }

  // 2. Demo users
  const finDept = await db.department.findUnique({ where: { code: 'FIN' } })
  if (!finDept) throw new Error('FIN department not seeded')

  const passwordHash = await bcrypt.hash('admin123', 10)
  const users = [
    { username: 'desk',  fullName: 'Mr. Ibrahim Sani',  email: 'desk@futhlafia.gov.ng',   role: 'DESK_OFFICER',  designationCode: 'DESK_OFFICER' },
    { username: 'audit', fullName: 'Mrs. Ngozi Eze',   email: 'audit@futhlafia.gov.ng',  role: 'AUDIT_OFFICER', designationCode: 'AUDIT_OFFICER' },
    { username: 'cpo',   fullName: 'Mr. Yusuf Bello',   email: 'cpo@futhlafia.gov.ng',    role: 'CPO',            designationCode: 'CPO' },
  ]
  for (const u of users) {
    const dsg = await db.designation.findUnique({ where: { code: u.designationCode } })
    if (!dsg) continue
    const existing = await db.user.findUnique({ where: { username: u.username } })
    if (existing) {
      await db.user.update({
        where: { username: u.username },
        data: {
          email: u.email,
          fullName: u.fullName,
          role: u.role as any,
          designationId: dsg.id,
          departmentId: finDept.id,
          passwordHash,
        },
      })
      console.log(`✓ user updated: ${u.username} (${u.role})`)
    } else {
      await db.user.create({
        data: {
          username: u.username,
          email: u.email,
          fullName: u.fullName,
          role: u.role as any,
          designationId: dsg.id,
          departmentId: finDept.id,
          passwordHash,
          isActive: true,
        },
      })
      console.log(`✓ user created: ${u.username} (${u.role})`)
    }
  }

  // 3. RBAC — give the 3 new roles view + create + edit on payment-vouchers
  const pvPage = await db.page.findUnique({ where: { key: 'payment-vouchers' } })
  if (pvPage) {
    for (const r of ['DESK_OFFICER', 'AUDIT_OFFICER', 'CPO'] as const) {
      await db.role.upsert({
        where: { code: r },
        update: { name: r.replace('_', ' '), description: `${r} role`, isSystem: true, isActive: true },
        create: { code: r, name: r.replace('_', ' '), description: `${r} role`, isSystem: true, isActive: true },
      })
      const roleRec = await db.role.findUnique({ where: { code: r } })
      if (!roleRec || !pvPage) continue
      await db.rolePagePermission.upsert({
        where: { roleId_pageId: { roleId: roleRec.id, pageId: pvPage.id } },
        update: { canView: true, canCreate: true, canEdit: true, canDelete: false },
        create: { roleId: roleRec.id, pageId: pvPage.id, canView: true, canCreate: true, canEdit: true, canDelete: false },
      })
      console.log(`✓ RBAC: ${r} → payment-vouchers [view, create, edit]`)
    }
  } else {
    console.log('⚠ payment-vouchers page not found — skipping RBAC')
  }

  console.log('Done.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await db.$disconnect() })
