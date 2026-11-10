// Inspect the current state of the DB:
// - List existing departments and how many staff each has
// - List existing units
// - Sample 10 bulk-imported staff to see what department/unit they currently have

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('=== Existing Departments ===')
  const depts = await prisma.department.findMany({
    orderBy: { code: 'asc' },
    include: { _count: { select: { staff: true, units: true, users: true } } },
  })
  for (const d of depts) {
    console.log(`  ${d.code} | ${d.name} | staff=${d._count.staff} | units=${d._count.units} | users=${d._count.users}`)
  }
  console.log(`Total: ${depts.length} departments\n`)

  console.log('=== Existing Units ===')
  const units = await prisma.unit.findMany({
    orderBy: { code: 'asc' },
    include: { department: { select: { code: true, name: true } }, _count: { select: { staff: true } } },
  })
  for (const u of units.slice(0, 30)) {
    console.log(`  ${u.code} | ${u.name} | dept=${u.department?.code} | staff=${u._count.staff}`)
  }
  console.log(`... and ${Math.max(0, units.length - 30)} more. Total: ${units.length} units\n`)

  console.log('=== Sample of 10 bulk-imported staff (with current dept/unit) ===')
  const staff = await prisma.staff.findMany({
    take: 10,
    include: { department: true, unit: true },
  })
  for (const s of staff) {
    console.log(`  ${s.fullName} | staffId=${s.staffId} | ippis=${s.ippisNumber} | dept=${s.department?.code ?? '-'} (${s.department?.name ?? '-'}) | unit=${s.unit?.code ?? '-'} (${s.unit?.name ?? '-'})`)
  }

  console.log('\n=== Department distribution of all staff ===')
  const allStaff = await prisma.staff.findMany({ select: { departmentId: true } })
  const counts: Record<string, number> = {}
  for (const s of allStaff) {
    const k = s.departmentId || '(unassigned)'
    counts[k] = (counts[k] || 0) + 1
  }
  // Resolve department names
  const allDepts = await prisma.department.findMany()
  const byId = Object.fromEntries(allDepts.map(d => [d.id, d]))
  for (const [id, n] of Object.entries(counts).sort((a,b) => b[1]-a[1])) {
    const d = byId[id]
    console.log(`  ${d ? `${d.code} (${d.name})` : id} : ${n}`)
  }
  console.log(`Total staff: ${allStaff.length}`)
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); process.exit(1) })
