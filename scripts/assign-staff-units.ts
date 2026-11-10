/**
 * Assign units to staff from the NR HR.xlsx Excel file.
 *
 * The Excel has:
 *   Col 3: DEPARTMENT (e.g. "ICT", "PHARMACY", "ADMINISTRATIVE")
 *   Col 6: UNIT (e.g. "INSURERAN", "ANNEX EXTENSSION FUTH", "GENERAL DUTIES")
 *
 * The DB has 33 departments + 188 units (from the FUTH DEPT & UNITS.xlsx).
 *
 * Strategy:
 *   1. Load all staff records (with their current departmentId).
 *   2. For each staff, look up the Excel row by IPPIS number (Col 4/11).
 *   3. Get the unit name from Col 6.
 *   4. Fuzzy-match the unit name to the 188 units in the DB, scoped by the
 *      staff's current department. If no match within the department, try
 *      matching across ALL units.
 *   5. If matched, set staff.unitId. If not matched, leave unitId null
 *      (staff will still have their department).
 *
 * Fuzzy matching: normalize both strings (lowercase, remove spaces/punctuation/
 * common misspellings) and check if one contains the other. Score by
 * Levenshtein-like similarity.
 */
import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'
import * as fs from 'fs'

const prisma = new PrismaClient()
const EXCEL_PATH = '/home/z/my-project/upload/NR HR.xlsx'

// Normalize a string for fuzzy matching
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\bunit\b/g, '')
    .replace(/\bward\b/g, '')
    .replace(/\bthe\b/g, '')
    .replace(/\band\b/g, '')
    .replace(/\bof\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Check if two normalized strings are similar enough
function isMatch(excelUnit: string, dbUnit: string): boolean {
  const a = normalize(excelUnit)
  const b = normalize(dbUnit)
  if (!a || !b) return false
  if (a === b) return true
  if (a.includes(b) || b.includes(a)) return true
  // Check first 4 chars match (handles abbreviations like "A&E" → "accident emergency")
  if (a.length >= 4 && b.length >= 4 && a.slice(0, 4) === b.slice(0, 4)) return true
  return false
}

// Score a match (higher = better)
function scoreMatch(excelUnit: string, dbUnit: string): number {
  const a = normalize(excelUnit)
  const b = normalize(dbUnit)
  if (!a || !b) return 0
  if (a === b) return 100
  if (a.includes(b)) return 80 + b.length
  if (b.includes(a)) return 70 + a.length
  if (a.length >= 4 && b.length >= 4 && a.slice(0, 4) === b.slice(0, 4)) return 50
  // Fuzzy: check if 60% of chars match (handles misspellings like EXPANDITURE vs EXPENDITURE)
  if (a.length >= 5 && b.length >= 5) {
    let matches = 0
    const longer = a.length > b.length ? a : b
    const shorter = a.length > b.length ? b : a
    for (const c of shorter) { if (longer.includes(c)) matches++ }
    if (matches / shorter.length >= 0.7) return 40
  }
  // Check if any word in the Excel unit matches any word in the DB unit
  const aWords = a.split(' ').filter(w => w.length >= 3)
  const bWords = b.split(' ').filter(w => w.length >= 3)
  for (const aw of aWords) {
    for (const bw of bWords) {
      if (aw === bw) return 35
      if (aw.length >= 4 && bw.length >= 4 && (aw.includes(bw) || bw.includes(aw))) return 30
    }
  }
  return 0
}

async function main() {
  console.log('Loading Excel...')
  const buf = fs.readFileSync(EXCEL_PATH)
  const wb = XLSX.read(buf, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

  // Build a map: IPPIS → unit name (from Excel)
  const ippisToUnit: Record<string, string> = {}
  const ippisToDept: Record<string, string> = {}
  for (let i = 1; i < rows.length; i++) {
    const ippis = String(rows[i][4] || rows[i][11] || '').trim()
    const dept = String(rows[i][3] || '').trim()
    const unit = String(rows[i][6] || '').trim()
    if (ippis && unit) {
      ippisToUnit[ippis] = unit
      ippisToDept[ippis] = dept
    }
  }
  console.log(`Found ${Object.keys(ippisToUnit).length} staff with units in the Excel`)

  // Load all DB units, grouped by department
  const dbUnits = await prisma.unit.findMany({
    include: { department: { select: { code: true, name: true } } },
  })
  console.log(`DB units: ${dbUnits.length}`)

  // Build a lookup: departmentId → units[]
  const unitsByDept: Record<string, typeof dbUnits> = {}
  for (const u of dbUnits) {
    if (!unitsByDept[u.departmentId]) unitsByDept[u.departmentId] = []
    unitsByDept[u.departmentId].push(u)
  }

  // Load all staff
  const allStaff = await prisma.staff.findMany({
    select: { id: true, staffId: true, ippisNumber: true, departmentId: true, unitId: true, fullName: true },
  })
  console.log(`Staff to process: ${allStaff.length}`)

  let assigned = 0
  let noMatch = 0
  let alreadyAssigned = 0
  let noIppis = 0
  let noExcelUnit = 0
  const noMatchSamples: string[] = []

  for (const s of allStaff) {
    // Skip if already has a unit
    if (s.unitId) {
      alreadyAssigned++
      continue
    }

    // Get the IPPIS number
    const ippis = s.ippisNumber?.trim()
    if (!ippis) {
      noIppis++
      continue
    }

    // Get the unit name from Excel
    const excelUnit = ippisToUnit[ippis]
    if (!excelUnit) {
      noExcelUnit++
      continue
    }

    // Get the staff's department's units
    const deptUnits = s.departmentId ? (unitsByDept[s.departmentId] || []) : []

    // Try to match within the department first
    let bestMatch: { unit: typeof dbUnits[0]; score: number } | null = null
    for (const u of deptUnits) {
      const score = scoreMatch(excelUnit, u.name)
      if (score > 0 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { unit: u, score }
      }
    }

    // If no match within department, try across ALL units
    if (!bestMatch) {
      for (const u of dbUnits) {
        const score = scoreMatch(excelUnit, u.name)
        if (score > 0 && (!bestMatch || score > bestMatch.score)) {
          bestMatch = { unit: u, score }
        }
      }
    }

    if (bestMatch) {
      await prisma.staff.update({
        where: { id: s.id },
        data: { unitId: bestMatch.unit.id },
      })
      assigned++
    } else {
      noMatch++
      if (noMatchSamples.length < 20) {
        noMatchSamples.push(`${s.fullName} (IPPIS: ${ippis}) → Excel unit: "${excelUnit}" (dept: ${ippisToDept[ippis] || '—'})`)
      }
    }
  }

  console.log(`\n=== Summary ===`)
  console.log(`Assigned: ${assigned}`)
  console.log(`Already had unit: ${alreadyAssigned}`)
  console.log(`No IPPIS number: ${noIppis}`)
  console.log(`No unit in Excel: ${noExcelUnit}`)
  console.log(`No match found: ${noMatch}`)
  if (noMatchSamples.length > 0) {
    console.log(`\n=== Unmatched samples (first 20) ===`)
    for (const s of noMatchSamples) console.log(`  ${s}`)
  }

  // Final state
  const withUnits = await prisma.staff.count({ where: { unitId: { not: null } } })
  const withoutUnits = await prisma.staff.count({ where: { unitId: null } })
  console.log(`\n=== Final state ===`)
  console.log(`Staff with units: ${withUnits}`)
  console.log(`Staff without units: ${withoutUnits}`)
  console.log(`Total staff: ${withUnits + withoutUnits}`)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(async () => { await prisma.$disconnect() })
