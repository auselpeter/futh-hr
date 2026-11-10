import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'
import * as fs from 'fs'

const prisma = new PrismaClient()
const XLSX_PATH = '/home/z/my-project/upload/FUTH DEPT & UNITS.xlsx'

// Old → New department code mapping
const OLD_TO_NEW_DEPT_MAP: Record<string, string> = {
  ADMIN: 'ADMIN', FIN: 'FINACC', HR: 'ADMIN', ICT: 'ICT', LAB: 'LAB',
  MAINT: 'WORKS', MED: 'MED', NURS: 'NURS', OBG: 'OBGYN', PAED: 'PAED',
  PHARM: 'PHARM', RAD: 'RADIO', REG: 'ADMIN', SURG: 'ORTHO',
}

function makeCode(name: string): string {
  const clean = name.trim().toUpperCase().replace(/[^A-Z0-9 &/]/g, '')
  const SPECIAL: Record<string, string> = {
    'FINANCE AND ACCOUNT': 'FINACC', 'ADMINISTRATIVE': 'ADMIN', 'MENTAL & BEHAVIOURAL': 'MENT',
    'COMMUNITY MED': 'COMMMED', 'HEALTH INFORMATION MANAGEMENT': 'HIM',
    'MEDICAL': 'MED', 'NURSING': 'NURS', 'NUTRITION & DIETETICS': 'NUTDIET',
    'OPHTHALMOLOGY': 'OPTHA', 'ORTHOPEADIC': 'ORTHO', 'PAEDIATRIC': 'PAED',
    'PHYSIOTHERAPY': 'PHYSIO', 'PUBLIC RELATION': 'PR', 'RESEARCH & DEVELOPMENT': 'RND',
    'OBSTHETIC AND GYNAECOLOGY': 'OBGYN', 'EPIDEMIOLOGY': 'EPI', 'SECURITY': 'SEC',
  }
  if (SPECIAL[clean]) return SPECIAL[clean]
  const words = clean.split(/\s+/).filter(w => w && !['AND', '&', 'OF', 'THE'].includes(w))
  if (words.length === 1) return words[0].slice(0, 5)
  return words.map(w => w[0]).join('').slice(0, 5) || 'DEPT'
}

function makeUnitCode(name: string, deptCode: string): string {
  const clean = name.trim().toUpperCase().replace(/[^A-Z0-9 &/]/g, '')
  if (!clean) return `${deptCode}_UNIT`
  if (!clean.includes(' ') && !clean.includes('&')) return `${deptCode}_${clean.slice(0, 4)}`
  const words = clean.split(/\s+/).filter(w => w && !['AND', '&'].includes(w))
  return `${deptCode}_${(words.map(w => w[0]).join('').slice(0, 4) || 'UNIT')}`
}

function parseExcel(): { sn: string; name: string; units: string[] }[] {
  const buf = fs.readFileSync(XLSX_PATH)
  const wb = XLSX.read(buf, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
  const depts: { sn: string; name: string; units: string[] }[] = []
  let current: { sn: string; name: string; units: string[] } | null = null
  for (let i = 2; i < rows.length; i++) {
    const [sn, dep, unit] = rows[i].map((x: any) => String(x ?? '').trim())
    if (sn) {
      if (current) depts.push(current)
      current = { sn, name: dep, units: [] }
      if (unit) current.units.push(unit)
    } else if (current) {
      if (unit) current.units.push(unit)
    }
  }
  if (current) depts.push(current)
  return depts
}

async function main() {
  console.log('Updating departments and units from Excel...')
  const depts = parseExcel()
  console.log(`Parsed ${depts.length} departments and ${depts.reduce((n, d) => n + d.units.length, 0)} units`)

  const existingDepts = await prisma.department.findMany()
  const existingDeptsByCode: Record<string, any> = {}
  for (const d of existingDepts) existingDeptsByCode[d.code.toUpperCase()] = d
  console.log(`Existing departments: ${existingDepts.length}`)

  const existingUnits = await prisma.unit.findMany()
  const existingUnitsByKey: Record<string, any> = {}
  for (const u of existingUnits) existingUnitsByKey[`${u.departmentId}|${u.code.toUpperCase()}`] = u

  const planDepts: { code: string; name: string; units: { code: string; name: string }[] }[] = []
  const codeUniqueness: Record<string, number> = {}
  for (const d of depts) {
    let code = makeCode(d.name)
    if (codeUniqueness[code]) { codeUniqueness[code]++; code = `${code}${codeUniqueness[code]}` } else { codeUniqueness[code] = 1 }
    const units: { code: string; name: string }[] = []
    const unitCodeSeen: Record<string, number> = {}
    for (const u of d.units) {
      let uc = makeUnitCode(u, code)
      if (unitCodeSeen[uc]) { unitCodeSeen[uc]++; uc = `${uc}${unitCodeSeen[uc]}` } else { unitCodeSeen[uc] = 1 }
      units.push({ code: uc, name: u })
    }
    planDepts.push({ code, name: d.name, units })
  }

  let depCreated = 0, depUpdated = 0, unitCreated = 0, unitUpdated = 0
  const newDeptIdByCode: Record<string, string> = {}

  for (const d of planDepts) {
    const existing = existingDeptsByCode[d.code]
    if (existing) {
      if (existing.name !== d.name) {
        await prisma.department.update({ where: { id: existing.id }, data: { name: d.name } })
        depUpdated++
      }
      newDeptIdByCode[d.code] = existing.id
    } else {
      const created = await prisma.department.create({ data: { code: d.code, name: d.name, isActive: true } })
      newDeptIdByCode[d.code] = created.id
      depCreated++
    }
    for (const u of d.units) {
      const deptId = newDeptIdByCode[d.code]
      const key = `${deptId}|${u.code.toUpperCase()}`
      const existingUnit = existingUnitsByKey[key]
      if (existingUnit) {
        if (existingUnit.name !== u.name) { await prisma.unit.update({ where: { id: existingUnit.id }, data: { name: u.name } }); unitUpdated++ }
      } else {
        await prisma.unit.create({ data: { code: u.code, name: u.name, departmentId: deptId, isActive: true } })
        unitCreated++
      }
    }
  }

  console.log(`Departments: ${depCreated} created, ${depUpdated} updated`)
  console.log(`Units: ${unitCreated} created, ${unitUpdated} updated`)

  // Re-allocate staff
  console.log('\n=== Re-allocating staff ===')
  const freshDepts = await prisma.department.findMany()
  const freshDeptsByCode: Record<string, any> = {}
  for (const d of freshDepts) freshDeptsByCode[d.code.toUpperCase()] = d

  const allStaff = await prisma.staff.findMany({ select: { id: true, fullName: true, staffId: true, departmentId: true, unitId: true } })
  let reassigned = 0, unchanged = 0

  for (const s of allStaff) {
    let oldCode: string | null = null
    if (s.departmentId) {
      const oldDep = existingDepts.find(d => d.id === s.departmentId)
      if (oldDep) oldCode = oldDep.code.toUpperCase()
    }
    if (!oldCode) { unchanged++; continue }
    const newCode = OLD_TO_NEW_DEPT_MAP[oldCode]
    if (!newCode) { unchanged++; continue }
    const newDep = freshDeptsByCode[newCode]
    if (!newDep) { unchanged++; continue }
    if (s.departmentId === newDep.id) { unchanged++; continue }
    await prisma.staff.update({ where: { id: s.id }, data: { departmentId: newDep.id, unitId: null } })
    const linkedUser = await prisma.user.findFirst({ where: { staffId: s.id } })
    if (linkedUser) await prisma.user.update({ where: { id: linkedUser.id }, data: { departmentId: newDep.id } }).catch(() => {})
    reassigned++
  }

  console.log(`Reassigned: ${reassigned}, Unchanged: ${unchanged}`)

  // Final state
  console.log('\n=== Final state ===')
  const finalDepts = await prisma.department.findMany({ orderBy: { code: 'asc' }, include: { _count: { select: { staff: true, units: true } } } })
  console.log(`Total departments: ${finalDepts.length}`)
  for (const d of finalDepts) console.log(`  ${d.code} | ${d.name} | staff=${d._count.staff} | units=${d._count.units}`)
  const finalUnits = await prisma.unit.count()
  console.log(`Total units: ${finalUnits}`)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(async () => { await prisma.$disconnect() })
