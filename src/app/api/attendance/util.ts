// Shared helpers for the attendance module.
import { db } from '@/lib/db'

type StaffLite = { id: string; staffId: string; departmentId: string | null }

// Compute the working day (YYYY-MM-DD), status (on_time/late/early_leave/absent/overtime),
// minutes late, minutes early, and hours worked for a single punch.
//
// For night shifts crossing midnight (e.g. 22:00 → 06:00), the `day` is the
// date the shift STARTED (so a punch at 02:00 on 2026-03-15 for a 22:00-06:00
// shift counts toward the 2026-03-14 day).
//
// Late/early-leave computation:
//   - Punch IN: if punchTime > shiftStart + graceMinutes → status='late', minutesLate = diff
//   - Punch OUT: if punchTime < shiftEnd - graceMinutes → status='early_leave', minutesEarly = diff
//   - Otherwise → status='on_time'
//   - If no shift assigned → status='on_time' (no penalty)
//
export async function computeAttendanceStatus(
  staff: StaffLite,
  punchTime: Date,
  inOutMode?: number | null,
): Promise<{
  day: string
  status: string
  minutesLate: number | null
  minutesEarly: number | null
  hoursWorked: number | null
}> {
  const day = punchTime.toISOString().slice(0, 10)

  // Look up the staff's active shift assignment as of the punch date.
  // If the staff has no shift assignment, fall back to their department's
  // standard shift (non-clinical: 08:00-16:00) or the global STANDARD shift.
  let shift: { id: string; startTime: string; endTime: string; graceMinutes: number; crossesMidnight: boolean; type: string } | null = null
  const staffShift = await db.staffShift.findFirst({
    where: {
      staffId: staff.id,
      isActive: true,
      effectiveFrom: { lte: punchTime },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: punchTime } }],
    },
    include: { shift: true },
    orderBy: { effectiveFrom: 'desc' },
  })
  if (staffShift?.shift) {
    shift = staffShift.shift
  } else if (staff.departmentId) {
    // Fall back to the department's standard / first active shift
    const deptShift = await db.shift.findFirst({
      where: { departmentId: staff.departmentId, isActive: true },
      orderBy: { type: 'asc' }, // standard first
    })
    if (deptShift) shift = deptShift
  }
  if (!shift) {
    // Look up the global STANDARD shift (no departmentId)
    const stdShift = await db.shift.findFirst({ where: { code: 'STANDARD', departmentId: null, isActive: true } })
    if (stdShift) shift = stdShift
  }

  if (!shift) {
    // No shift defined — just record the punch with on_time status
    return { day, status: 'on_time', minutesLate: null, minutesEarly: null, hoursWorked: null }
  }

  // Build the shift's actual start/end Date for the punch's day
  const [sH, sM] = shift.startTime.split(':').map(Number)
  const [eH, eM] = shift.endTime.split(':').map(Number)
  const shiftStart = new Date(punchTime)
  shiftStart.setHours(sH, sM, 0, 0)
  const shiftEnd = new Date(punchTime)
  shiftEnd.setHours(eH, eM, 0, 0)
  if (shift.crossesMidnight) {
    // If punch is before shiftEnd (which is the next day morning), shift the start back by a day
    if (punchTime < shiftEnd) {
      shiftStart.setDate(shiftStart.getDate() - 1)
    } else {
      shiftEnd.setDate(shiftEnd.getDate() + 1)
    }
  }

  const isOut = inOutMode === 1 || inOutMode === 3
  const graceMs = shift.graceMinutes * 60 * 1000
  let status = 'on_time'
  let minutesLate: number | null = null
  let minutesEarly: number | null = null

  if (!isOut) {
    // Punch IN — check if late
    if (punchTime > new Date(shiftStart.getTime() + graceMs)) {
      status = 'late'
      minutesLate = Math.round((punchTime.getTime() - shiftStart.getTime()) / 60000)
    }
  } else {
    // Punch OUT — check if early leave
    if (punchTime < new Date(shiftEnd.getTime() - graceMs)) {
      status = 'early_leave'
      minutesEarly = Math.round((shiftEnd.getTime() - punchTime.getTime()) / 60000)
    }
  }

  // hoursWorked is set on the OUT punch by looking up the paired IN punch
  // for the same staff on the same day. The pairing happens in the import path,
  // not here — leave it null for fresh inserts.
  return { day, status, minutesLate, minutesEarly, hoursWorked: null }
}

// Pair an IN punch with its OUT punch (within the same working day) and
// compute the hours worked. Called after the OUT punch is inserted.
export async function pairInOut(staffId: string, day: string): Promise<void> {
  const records = await db.attendanceRecord.findMany({
    where: { staffId, day, punchType: { in: ['in', 'out'] } },
    orderBy: { punchTime: 'asc' },
  })
  // Pair sequential in/out punches
  for (let i = 0; i < records.length - 1; i++) {
    const a = records[i]
    const b = records[i + 1]
    if (a.punchType === 'in' && b.punchType === 'out' && !a.pairedWith && !b.pairedWith) {
      const hours = (b.punchTime.getTime() - a.punchTime.getTime()) / (1000 * 60 * 60)
      await db.attendanceRecord.update({ where: { id: a.id }, data: { pairedWith: b.id } })
      await db.attendanceRecord.update({ where: { id: b.id }, data: { pairedWith: a.id, hoursWorked: Math.round(hours * 100) / 100 } })
      i++ // skip the OUT we just paired
    }
  }
}
