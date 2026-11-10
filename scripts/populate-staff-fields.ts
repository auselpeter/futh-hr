/**
 * Populate staff fileNumber, gradeLevel, step, and cadre from NR HR.xlsx.
 * Excel columns:
 *   Col 4/11: IPPIS No.
 *   Col 13: FILE NO. (e.g. "2181")
 *   Col 18: GRADE LEVEL (e.g. "5")
 *   Col 19: STEP (e.g. "1")
 *   Col 20: CADRE (e.g. "SNR DATA P. ASST. I")
 */
import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'
import * as fs from 'fs'

const prisma = new PrismaClient()
const EXCEL_PATH = '/home/z/my-project/upload/NR HR.xlsx'

async function main() {
  console.log('Loading Excel...')
  const buf = fs.readFileSync(EXCEL_PATH)
  const wb = XLSX.read(buf, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

  // Build map: IPPIS → { fileNumber, gradeLevel, step, cadre }
  const ippisToData: Record<string, { fileNumber: string; gradeLevel: string; step: string; cadre: string }> = {}
  for (let i = 1; i < rows.length; i++) {
    const ippis = String(rows[i][4] || rows[i][11] || '').trim()
    const fileNo = String(rows[i][13] || '').trim()
    const gradeLevel = String(rows[i][18] || '').trim()
    const step = String(rows[i][19] || '').trim()
    const cadre = String(rows[i][20] || '').trim()
    if (ippis) {
      ippisToData[ippis] = { fileNumber: fileNo || '', gradeLevel: gradeLevel || '', step: step || '', cadre: cadre || '' }
    }
  }
  console.log(`Found ${Object.keys(ippisToData).length} staff with data in Excel`)

  const allStaff = await prisma.staff.findMany({ select: { id: true, ippisNumber: true } })
  let updated = 0
  let noIppis = 0
  let noExcelData = 0

  for (const s of allStaff) {
    const ippis = s.ippisNumber?.trim()
    if (!ippis) { noIppis++; continue }
    const data = ippisToData[ippis]
    if (!data) { noExcelData++; continue }

    await prisma.staff.update({
      where: { id: s.id },
      data: {
        fileNumber: data.fileNumber || null,
        gradeLevel: data.gradeLevel || null,
        step: data.step || null,
        cadre: data.cadre || null,
      },
    })
    updated++
  }

  console.log(`\n=== Summary ===`)
  console.log(`Updated: ${updated}`)
  console.log(`No IPPIS: ${noIppis}`)
  console.log(`No Excel data: ${noExcelData}`)

  // Final state
  const withFileNo = await prisma.staff.count({ where: { fileNumber: { not: null } } })
  const withGrade = await prisma.staff.count({ where: { gradeLevel: { not: null } } })
  const withCadre = await prisma.staff.count({ where: { cadre: { not: null } } })
  console.log(`\nStaff with fileNumber: ${withFileNo}`)
  console.log(`Staff with gradeLevel: ${withGrade}`)
  console.log(`Staff with cadre: ${withCadre}`)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(async () => { await prisma.$disconnect() })
