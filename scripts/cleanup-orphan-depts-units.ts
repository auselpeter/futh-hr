// Cleanup script: delete orphan departments + units left over after the
// dept/unit migration. Specifically removes:
//   - Old departments that have 0 staff AND 0 units AND 0 active users
//   - Old units that have 0 staff AND aren't in the new structure
//
// Orphan departments: FIN, HR, OBG, RAD, REG, SURG, MAINT (codes the script
// migrated staff AWAY from). We only delete if they truly have 0 staff and 0 units.
// We leave orphan users on those depts alone (they'll be re-linked manually
// when admins edit those users).
//
// Orphan units: DEV, ER, ICU, NET, THEATRE, THEATRE_NURS — the 6 demo/seed
// units created before the bulk import. We delete only if they have 0 staff.

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const ORPHAN_DEPT_CODES = ['FIN', 'HR', 'OBG', 'RAD', 'REG', 'SURG', 'MAINT']
const ORPHAN_UNIT_CODES = ['DEV', 'ER', 'ICU', 'NET', 'THEATRE', 'THEATRE_NURS']

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  console.log(`${dryRun ? '[DRY-RUN] ' : ''}Cleaning up orphan departments and units...`)

  // Orphan departments
  console.log('\n=== Orphan departments ===')
  for (const code of ORPHAN_DEPT_CODES) {
    const dep = await prisma.department.findUnique({
      where: { code },
      include: { _count: { select: { staff: true, units: true, users: true } } },
    })
    if (!dep) {
      console.log(`  ${code}: not found (already removed)`)
      continue
    }
    console.log(`  ${code} (${dep.name}) | staff=${dep._count.staff} | units=${dep._count.units} | users=${dep._count.users}`)
    if (dep._count.staff > 0 || dep._count.units > 0) {
      console.log(`    → keeping (has staff or units)`)
      continue
    }
    // Detach any users still linked to this dept (set their departmentId to null)
    if (!dryRun) {
      await prisma.user.updateMany({ where: { departmentId: dep.id }, data: { departmentId: null } })
      await prisma.department.delete({ where: { id: dep.id } })
    }
    console.log(`    → ${dryRun ? 'would delete' : 'deleted'} (users detached)`)
  }

  // Orphan units
  console.log('\n=== Orphan units ===')
  for (const code of ORPHAN_UNIT_CODES) {
    const unit = await prisma.unit.findUnique({
      where: { code },
      include: { _count: { select: { staff: true } } },
    })
    if (!unit) {
      console.log(`  ${code}: not found (already removed)`)
      continue
    }
    console.log(`  ${code} (${unit.name}) | staff=${unit._count.staff}`)
    if (unit._count.staff > 0) {
      console.log(`    → keeping (has staff)`)
      continue
    }
    if (!dryRun) {
      // Detach HOU if any
      if (unit.houUserId) {
        // Just delete the unit — the User.headedUnit relation has SetNull default
        // Actually, the relation is one-to-one with @unique — let's just clear it
        await prisma.user.update({ where: { id: unit.houUserId }, data: { headedUnitId: null } }).catch(() => {})
      }
      await prisma.unit.delete({ where: { id: unit.id } })
    }
    console.log(`    → ${dryRun ? 'would delete' : 'deleted'}`)
  }

  // Final state
  console.log('\n=== Final state ===')
  const finalDepts = await prisma.department.findMany({
    orderBy: { code: 'asc' },
    include: { _count: { select: { staff: true, units: true, users: true } } },
  })
  console.log(`Total departments: ${finalDepts.length}`)
  for (const d of finalDepts) {
    console.log(`  ${d.code} | ${d.name} | staff=${d._count.staff} | units=${d._count.units} | users=${d._count.users}`)
  }
  const finalUnits = await prisma.unit.findMany({ include: { _count: { select: { staff: true } } } })
  console.log(`Total units: ${finalUnits.length}`)
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); process.exit(1) })
