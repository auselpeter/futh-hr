/**
 * Import staff records from the NR HR.xlsx Excel sheet into the FUTH HR database.
 *
 * For each row in the Excel, the script:
 *   1. Creates a Staff record with all available fields (personal, govt, contact, address,
 *      employment, NOK, bank, academic, dependant).
 *   2. Auto-creates a linked User account (username from full name, password = IPPIS number).
 *   3. Generates a Document record (file) with file number from the Excel's FILE NO. column.
 *
 * Idempotent: skips staff whose staffId (IPPIS-based) already exists.
 *
 * Run with: bun run scripts/import-staff-excel.ts
 */
import * as XLSX from 'xlsx'
import { db } from '../src/lib/db'
import bcrypt from 'bcryptjs'
import path from 'path'
import fs from 'fs'

// === Column mapping (0-indexed) ===
const COL = {
  SNO: 0, TITLE: 1, FULL_NAME: 2, DEPARTMENT: 3, IPPIS: 4, PHONE: 5, UNIT: 6,
  DESIGNATION: 7, DOB: 8, MARITAL: 9, GENDER: 10, IPPIS2: 11, ID_NO: 12,
  FILE_NO: 13, NIN: 14, BVN: 15, TIN: 16, WARD: 17, GRADE: 18, STEP: 19,
  CADRE: 20, PHONE2: 21, NATIONALITY: 22, STATE: 23, LGA: 24, BIRTH_PLACE: 25,
  RELIGION: 26, EMAIL: 27, PERM_ADDRESS: 28, RES_STATE: 29, RES_LGA: 30,
  SALARY: 31, BANK: 32, ACCOUNT: 33, PENSION_ADMIN: 34, PENSION_PIN: 35,
  NOK_NAME: 36, NOK_PHONE: 37, NOK_RELATION: 38, NOK_ADDRESS: 39,
  PREV_AGENCY: 40, PRES_AGENCY: 41, FIRST_APPT: 42, CONFIRMATION: 43,
  LAST_PROMO: 44, BLOOD: 45, GENOTYPE: 46, INSTITUTE: 47, COURSE: 48,
  QUALIFICATION: 49, QUAL2: 50, CLASS: 51, YEAR: 52, REFERENCES: 53,
}

function clean(v: any): string | null {
  if (v === null || v === undefined) return null
  let s = String(v).trim()
  if (s === '' || s === '*' || s === 'N/A' || s === 'NA' || s === 'NULL' || s === 'NIL' || s === 'NILL' || s === 'Not YET' || s === 'NOTYET') return null
  return s
}

function cleanDate(v: any): Date | null {
  const s = clean(v)
  if (!s) return null
  // Try various date formats
  // Excel serial number
  if (typeof v === 'number' && v > 30000) {
    const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000)
    return d
  }
  // DD/MM/YYYY or D/M/YYYY
  const m1 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (m1) return new Date(`${m1[3]}-${m1[2].padStart(2, '0')}-${m1[1].padStart(2, '0')}`)
  // YYYY/MM/DD
  const m2 = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/)
  if (m2) return new Date(`${m2[1]}-${m2[2].padStart(2, '0')}-${m2[3].padStart(2, '0')}`)
  // Try Date.parse
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d
  return null
}

// Parse a full name like "MUHAMMED, Mr. ALIYU KABIRU" → { surname, firstName, otherNames }
function parseFullName(raw: string): { surname: string; firstName: string; otherNames: string; fullName: string } {
  const s = raw.replace(/\s+/g, ' ').trim()
  // Pattern: "SURNAME, Title. FIRSTNAME OTHERNAMES"
  const parts = s.split(',')
  if (parts.length >= 2) {
    const surname = parts[0].trim()
    let rest = parts.slice(1).join(',').trim()
    // Remove title prefix (Mr., Mrs., Ms., Dr., Miss, Alhaji, etc.)
    rest = rest.replace(/^(Mr\.?|Mrs\.?|Ms\.?|Dr\.?|Miss|Alhaji|Alhaja|Hajiya|Hajia|Mallam|Mallama|Barr\.?|Hon\.?|Prof\.?|Capt\.?|Lt\.?)\.?\s+/i, '')
    const nameParts = rest.split(/\s+/).filter(Boolean)
    const firstName = nameParts[0] || ''
    const otherNames = nameParts.slice(1).join(' ')
    const fullName = otherNames ? `${firstName} ${otherNames} ${surname}` : `${firstName} ${surname}`
    return { surname: surname.replace(/^SURNAME,?$/i, ''), firstName, otherNames, fullName }
  }
  // No comma — try to split by spaces
  const nameParts = s.split(/\s+/).filter(Boolean)
  if (nameParts.length >= 2) {
    const surname = nameParts[0]
    const firstName = nameParts[1]
    const otherNames = nameParts.slice(2).join(' ')
    const fullName = otherNames ? `${firstName} ${otherNames} ${surname}` : `${firstName} ${surname}`
    return { surname, firstName, otherNames, fullName }
  }
  return { surname: s, firstName: s, otherNames: '', fullName: s }
}

// Map department name from Excel to existing Department code
function mapDeptCode(deptName: string | null): string {
  if (!deptName) return 'ADMIN'
  const d = deptName.toUpperCase().trim()
  // Try to match against existing department codes/names
  if (d.includes('ICT') || d.includes('INFORMATION') && d.includes('TECH')) return 'ICT'
  if (d.includes('PHARMAC')) return 'PHARM'
  if (d.includes('NURS')) return 'NURS'
  if (d.includes('ADMIN')) return 'ADMIN'
  if (d.includes('FINANCE') || d.includes('ACCOUNT')) return 'FIN'
  if (d.includes('HUMAN') || d.includes('HR')) return 'HR'
  if (d.includes('REGISTR')) return 'REG'
  if (d.includes('STORE')) return 'ADMIN'
  if (d.includes('MEDICAL') && !d.includes('RECORD')) return 'MED'
  if (d.includes('LAB')) return 'LAB'
  if (d.includes('RADIO')) return 'RAD'
  if (d.includes('SURG')) return 'SURG'
  if (d.includes('PAED')) return 'PAED'
  if (d.includes('DENTAL')) return 'ADMIN'
  if (d.includes('STORE')) return 'ADMIN'
  if (d.includes('SERVI')) return 'ADMIN'
  if (d.includes('WORKS') || d.includes('MAINT')) return 'MAINT'
  if (d.includes('COMMUN')) return 'MED'
  if (d.includes('RESEARCH') || d.includes('DEVELOP')) return 'MED'
  if (d.includes('BEHAV')) return 'MED'
  if (d.includes('HEALTH') && d.includes('INFORMATION')) return 'REG'
  if (d.includes('ENVIRON')) return 'MED'
  if (d.includes('TRANSPORT')) return 'MAINT'
  if (d.includes('PROCURE')) return 'ADMIN'
  if (d.includes('PUBLIC') || d.includes('RELATION')) return 'ADMIN'
  if (d.includes('STC') || d.includes('EDU')) return 'ADMIN'
  if (d.includes('SECURITY')) return 'ADMIN'
  if (d.includes('ORTHO')) return 'SURG'
  if (d.includes('OPHTHAL')) return 'MED'
  if (d.includes('NUTRITION')) return 'MED'
  if (d.includes('PHYSIO')) return 'MED'
  if (d.includes('LAUND')) return 'ADMIN'
  if (d.includes('AUDIT')) return 'FIN'
  if (d.includes('MEDICAL LIB')) return 'ADMIN'
  if (d.includes('ACCOUNTING')) return 'FIN'
  return 'ADMIN'
}

async function main() {
  console.log('Reading Excel file...')
  const filePath = path.join(process.cwd(), 'upload', 'NR HR.xlsx')
  const wb = XLSX.readFile(filePath, { cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

  console.log(`Total rows (including header): ${rows.length}`)
  // Skip header row
  const dataRows = rows.slice(1).filter(r => r[COL.FULL_NAME] && r[COL.IPPIS])
  console.log(`Data rows with name + IPPIS: ${dataRows.length}`)

  // Pre-fetch departments, designations for lookups
  const departments = await db.department.findMany()
  const deptByCode: Record<string, any> = {}
  for (const d of departments) deptByCode[d.code] = d

  const designations = await db.designation.findMany()
  const dsgByCode: Record<string, any> = {}
  for (const d of designations) dsgByCode[d.code] = d

  // Find the 'STF' designation (default for staff)
  const stfDsg = dsgByCode['STF']

  let created = 0
  let skipped = 0
  let errors = 0

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i]
    try {
      const rawName = clean(row[COL.FULL_NAME]) || `Staff ${i + 1}`
      const ippis = clean(row[COL.IPPIS]) || ''
      const staffIdVal = ippis || `FUTH/IMP/${String(i + 1).padStart(4, '0')}`
      const fileNo = clean(row[COL.FILE_NO]) || ''
      const email = clean(row[COL.EMAIL])
      const phone = clean(row[COL.PHONE]) || clean(row[COL.PHONE2])
      const deptName = clean(row[COL.DEPARTMENT])
      const deptCode = mapDeptCode(deptName)
      const dept = deptByCode[deptCode]

      // Check if staff with this staffId already exists
      const existing = await db.staff.findUnique({ where: { staffId: staffIdVal } })
      if (existing) {
        skipped++
        continue
      }

      const { surname, firstName, otherNames, fullName } = parseFullName(rawName)

      // Determine gender
      const gender = clean(row[COL.GENDER]) || null
      const maritalStatus = clean(row[COL.MARITAL]) || null
      const dob = cleanDate(row[COL.DOB])
      const dateHired = cleanDate(row[COL.FIRST_APPT])
      const confirmationDate = cleanDate(row[COL.CONFIRMATION])

      // Determine status
      const rawStatus = (clean(row[COL.CADRE]) || '').toLowerCase()
      let status = 'active'
      // Could check retirement, disengaged, etc.

      // Create the staff record
      const staff = await db.staff.create({
        data: {
          staffId: staffIdVal,
          ippisNumber: ippis || null,
          surname,
          firstName,
          otherNames: otherNames || null,
          fullName,
          gender: gender as any,
          dateOfBirth: dob,
          maritalStatus: maritalStatus as any,
          nationality: clean(row[COL.NATIONALITY]) || 'Nigerian',
          religion: clean(row[COL.RELIGION]) || null,
          stateOfOrigin: clean(row[COL.STATE]) || null,
          lga: clean(row[COL.LGA]) || null,
          ninNumber: clean(row[COL.NIN]) || null,
          tinNumber: clean(row[COL.TIN]) || null,
          pensionNumber: clean(row[COL.PENSION_PIN]) || null,
          email: email || null,
          phone: phone || null,
          permanentAddress: clean(row[COL.PERM_ADDRESS]) || null,
          residentialAddress: clean(row[COL.PERM_ADDRESS]) || null, // Use perm as residential if residential not available
          cityOfResidence: clean(row[COL.RES_LGA]) || null,
          stateOfResidence: clean(row[COL.RES_STATE]) || null,
          position: clean(row[COL.DESIGNATION]) || clean(row[COL.CADRE]) || null,
          rank: clean(row[COL.GRADE]) || null,
          employmentType: 'permanent',
          dateHired: dateHired,
          confirmationDate: confirmationDate || null,
          status: status as any,
          departmentId: dept?.id || null,
          designationId: stfDsg?.id || null,
        },
      })

      // === Create Next of Kin ===
      const nokName = clean(row[COL.NOK_NAME])
      if (nokName) {
        await db.nextOfKin.create({
          data: {
            staffId: staff.id,
            fullName: nokName,
            phone: clean(row[COL.NOK_PHONE]) || null,
            relationship: clean(row[COL.NOK_RELATION]) || null,
            address: clean(row[COL.NOK_ADDRESS]) || null,
            isPrimary: true,
          },
        })
      }

      // === Create Bank Detail ===
      const bankName = clean(row[COL.BANK])
      const accountNumber = clean(row[COL.ACCOUNT])
      if (bankName && accountNumber) {
        await db.bankDetail.create({
          data: {
            staffId: staff.id,
            bankName,
            accountName: fullName,
            accountNumber,
            isPrimary: true,
          },
        })
      }

      // === Create Academic Background ===
      const institute = clean(row[COL.INSTITUTE])
      const qualification = clean(row[COL.QUALIFICATION]) || clean(row[COL.QUAL2])
      const course = clean(row[COL.COURSE])
      if (institute || qualification) {
        const yearVal = clean(row[COL.YEAR])
        await db.academicBackground.create({
          data: {
            staffId: staff.id,
            institution: institute || '—',
            qualification: qualification || null,
            field: course || null,
            grade: clean(row[COL.CLASS]) || null,
            certificateNumber: null,
          },
        })
      }

      // === Create linked User account ===
      const username = fullName.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
      const userPassword = ippis || 'admin123'
      const userEmail = email || `${username}@futhlafia.gov.ng`

      // Check if user already exists
      const existingUser = await db.user.findFirst({
        where: { OR: [{ username }, { email: userEmail }] },
      })
      if (!existingUser) {
        const newUser = await db.user.create({
          data: {
            username: username.substring(0, 50),
            email: userEmail,
            fullName,
            passwordHash: bcrypt.hashSync(userPassword, 10),
            role: 'STAFF',
            phone: phone || null,
            designationId: stfDsg?.id || null,
            departmentId: dept?.id || null,
            staffId: staff.id,
            isActive: true,
          },
        })
        // Link the staff to the user
        await db.staff.update({ where: { id: staff.id }, data: { userId: newUser.id } })
      }

      // === Generate Document (file) record if FILE NO. exists ===
      if (fileNo) {
        // Generate a document ref number
        const docYear = new Date().getFullYear()
        const docRef = `FUTH/DOC/HDC/${docYear}/${String(i + 1).padStart(4, '0')}`
        try {
          await db.document.create({
            data: {
              fileNumber: docRef,
              title: `Staff File — ${fullName} (${staffIdVal})`,
              description: `Personal staff file imported from NR HR Excel. File No: ${fileNo}`,
              category: 'staff_hardcopy',
              fileUrl: '/uploads/document/imported-placeholder.pdf',
              fileName: `imported-${fileNo}.pdf`,
              staffId: staff.id,
              uploadedById: (await db.user.findFirst({ where: { username: 'registry' } }))?.id || (await db.user.findFirst({ where: { username: 'admin' } }))?.id || '',
              isPublic: false,
              tags: `imported,excel,${deptCode}`,
            },
          })
        } catch (docErr: any) {
          // Non-critical — continue
          console.log(`  ⚠ Document creation failed for ${fullName}: ${docErr.message}`)
        }
      }

      created++
      if ((created + skipped + errors) % 50 === 0) {
        console.log(`Progress: ${created + skipped + errors}/${dataRows.length} (created=${created}, skipped=${skipped}, errors=${errors})`)
      }
    } catch (e: any) {
      errors++
      if (errors <= 10) {
        console.error(`Error on row ${i + 2}: ${e.message?.slice(0, 200)}`)
      }
    }
  }

  console.log()
  console.log('=== Import Summary ===')
  console.log(`Total rows processed: ${dataRows.length}`)
  console.log(`Staff created: ${created}`)
  console.log(`Skipped (already exists): ${skipped}`)
  console.log(`Errors: ${errors}`)
  console.log('Done.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await db.$disconnect() })
