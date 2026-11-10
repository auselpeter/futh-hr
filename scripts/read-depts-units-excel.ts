// One-off script: read the FUTH DEPT & UNITS.xlsx file and print its structure
// so we can plan the upsert.
import * as XLSX from 'xlsx'
import * as fs from 'fs'

const PATH = '/home/z/my-project/upload/FUTH DEPT & UNITS.xlsx'

const buf = fs.readFileSync(PATH)
const wb = XLSX.read(buf, { type: 'buffer' })
console.log('Sheet names:', wb.SheetNames)
const ws = wb.Sheets[wb.SheetNames[0]]
const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
console.log(`Total rows: ${rows.length}`)
console.log('First 5 rows:')
for (const r of rows.slice(0, 5)) console.log('  ', JSON.stringify(r))
console.log('...')
console.log('Last 5 rows:')
for (const r of rows.slice(-5)) console.log('  ', JSON.stringify(r))

// Walk the rows and reconstruct the department → unit tree.
// Columns: 0=SN, 1=DEPARTMENT, 2=Unit
// - Rows where SN is a number mark a new department; subsequent rows with SN blank belong to that department.
// - Some rows (e.g. "21" appears twice for Physiotherapy + Procurement — handle as 2 separate depts)
type Dept = { sn: string; name: string; units: string[] }
const depts: Dept[] = []
let current: Dept | null = null
for (let i = 2; i < rows.length; i++) { // skip first 2 header rows
  const [sn, dep, unit] = rows[i].map((x: any) => String(x ?? '').trim())
  if (sn) {
    // New department
    if (current) depts.push(current)
    current = { sn, name: dep, units: [] }
    if (unit) current.units.push(unit)
  } else if (current) {
    if (unit) current.units.push(unit)
  }
}
if (current) depts.push(current)

console.log(`\nParsed ${depts.length} departments:`)
for (const d of depts) {
  console.log(`  ${d.sn}. ${d.name} (${d.units.length} units)`)
  for (const u of d.units) console.log(`      - ${u}`)
}
