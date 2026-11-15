/**
 * Seed: default shift definitions + flag clinical vs non-clinical departments.
 *
 * Creates the following global shifts (no departmentId, apply hospital-wide):
 *   - EARLY   : 06:00 – 14:00 (clinical early shift)
 *   - LATE    : 14:00 – 22:00 (clinical late shift)
 *   - NIGHT   : 22:00 – 06:00 (clinical night shift, crosses midnight)
 *   - CALL    : 00:00 – 23:59 (call-duty, 24h on-call)
 *   - STANDARD: 08:00 – 16:00 (non-clinical standard, default for admin/support depts)
 *
 * Then marks the known clinical departments at FUTH Lafia as isClinical=true
 * so attendance reports can group clinical vs non-clinical staff.
 *
 * Run with: bun run scripts/seed-default-shifts.ts
 */
import { db } from '../src/lib/db'

const DEFAULT_SHIFTS = [
  { code: 'EARLY', name: 'Early Shift', description: 'Clinical early shift (06:00 – 14:00)', startTime: '06:00', endTime: '14:00', graceMinutes: 15, crossesMidnight: false, type: 'early', isCallDuty: false },
  { code: 'LATE', name: 'Late Shift', description: 'Clinical late shift (14:00 – 22:00)', startTime: '14:00', endTime: '22:00', graceMinutes: 15, crossesMidnight: false, type: 'late', isCallDuty: false },
  { code: 'NIGHT', name: 'Night Shift', description: 'Clinical night shift (22:00 – 06:00, crosses midnight)', startTime: '22:00', endTime: '06:00', graceMinutes: 15, crossesMidnight: true, type: 'night', isCallDuty: false },
  { code: 'CALL', name: 'Call Duty', description: 'On-call duty (24 hours)', startTime: '00:00', endTime: '23:59', graceMinutes: 0, crossesMidnight: false, type: 'call-duty', isCallDuty: true },
  { code: 'STANDARD', name: 'Standard Shift', description: 'Non-clinical standard working hours (08:00 – 16:00)', startTime: '08:00', endTime: '16:00', graceMinutes: 15, crossesMidnight: false, type: 'standard', isCallDuty: false },
]

// Known clinical department codes at FUTH Lafia.
// These are the departments that deliver direct patient care and therefore
// need shift-based attendance (early / late / night / call-duty).
// Departments not listed here are flagged as non-clinical (admin / support)
// and default to the 08:00–16:00 STANDARD shift.
const CLINICAL_DEPT_CODES = [
  'SURG', 'MED', 'OBG', 'PAED', 'ORTH', 'EENT', 'PSYCH', 'ANAES', 'A&E',
  'ICU', 'RAD', 'LAB', 'PHARM', 'DENT', 'NHIS', 'NURS',
]

async function main() {
  console.log('Seeding default shifts + clinical department flags...')

  // 1. Upsert default shifts (global, no department binding)
  for (const s of DEFAULT_SHIFTS) {
    const existing = await db.shift.findFirst({ where: { code: s.code, departmentId: null } })
    if (existing) {
      console.log(`  ✓ ${s.code} already exists (id=${existing.id})`)
      continue
    }
    const created = await db.shift.create({ data: { ...s, departmentId: null, isActive: true } })
    console.log(`  ✓ created ${s.code} — ${s.name} (${s.startTime}-${s.endTime})`)
  }

  // 2. Flag clinical departments
  const depts = await db.department.findMany()
  let flaggedCount = 0
  for (const d of depts) {
    const isClinical = CLINICAL_DEPT_CODES.includes(d.code.toUpperCase())
    if (d.isClinical !== isClinical) {
      await db.department.update({ where: { id: d.id }, data: { isClinical } })
      flaggedCount++
      console.log(`  ✓ ${d.code} — ${d.name}: ${isClinical ? 'CLINICAL' : 'non-clinical'}`)
    }
  }
  if (flaggedCount === 0) {
    console.log('  (all departments already had the correct isClinical flag)')
  }

  console.log('\nDone. Default shifts + clinical flags applied.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
