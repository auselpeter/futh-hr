import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'
import { computeAttendanceStatus, pairInOut } from '../util'

// POST /api/attendance/import
// Body: { csv: string, deviceId?: string }
//
// CSV format (ZKTeco "Attend" software export):
//   UserID,DateTime,InOutMode,VerifyMode,WorkCode
//   12345,2026-03-14 08:23:00,0,1,0
//   12345,2026-03-14 16:01:00,1,1,0
//
// Also accepts the alternative header format that ZKTeco software sometimes
// produces:
//   User ID,Date,Time,IN/OUT,Verify Mode,Work Code
//   12345,2026-03-14,08:23:00,IN,Fingerprint,0
//
// Existing records are skipped (dedup by staff + punchTime + deviceId).
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = user.activeRole || user.role
    if (!['SUPER_ADMIN', 'ADMIN', 'REGISTRY_OFFICER', 'PLANNING_OFFICER'].includes(role)) {
      return NextResponse.json({ error: 'Only admins / registry / planning can import attendance' }, { status: 403 })
    }

    const body = await req.json()
    const csv: string = body.csv || ''
    const deviceId: string = body.deviceId || 'csv_import'
    if (!csv.trim()) {
      return NextResponse.json({ error: 'CSV content is required' }, { status: 400 })
    }

    const lines = csv.trim().split(/\r?\n/)
    if (lines.length < 2) {
      return NextResponse.json({ error: 'CSV must contain a header row + at least one data row' }, { status: 400 })
    }

    // Parse the header to figure out column order. We support both the
    // ZKTeco native format (UserID,DateTime,InOutMode,VerifyMode,WorkCode)
    // and the human-readable format (User ID,Date,Time,IN/OUT,Verify Mode,Work Code).
    const header = lines[0].split(',').map((s) => s.trim().toLowerCase())
    const idxUserId = header.findIndex((h) => h === 'userid' || h === 'user id' || h === 'user_id' || h === 'ippis' || h === 'staffid')
    const idxDateTime = header.findIndex((h) => h === 'datetime' || h === 'date time')
    const idxDate = header.findIndex((h) => h === 'date')
    const idxTime = header.findIndex((h) => h === 'time')
    const idxInOut = header.findIndex((h) => h === 'in/out' || h === 'inoutmode' || h === 'in/out mode' || h === 'in_out')
    const idxVerify = header.findIndex((h) => h === 'verifymode' || h === 'verify mode' || h === 'verify_mode')
    const idxWorkCode = header.findIndex((h) => h === 'workcode' || h === 'work code' || h === 'work_code')

    if (idxUserId < 0 || (idxDateTime < 0 && (idxDate < 0 || idxTime < 0))) {
      return NextResponse.json({
        error: `CSV header must include a UserID column and either a DateTime column OR separate Date + Time columns. Got: ${header.join(', ')}`,
      }, { status: 400 })
    }

    let inserted = 0
    let skipped = 0
    let unmatched = 0
    const unmatchedSamples: string[] = []
    const dayGroups: { staffId: string; day: string }[] = []

    // Cache staff lookups to avoid hammering the DB for every row
    const staffCache = new Map<string, { id: string; staffId: string; departmentId: string | null } | null>()

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      const cols = line.split(',').map((s) => s.trim())
      const userIdRaw = cols[idxUserId] || ''
      if (!userIdRaw) { skipped++; continue }

      // Build the DateTime
      let dtStr: string
      if (idxDateTime >= 0) {
        dtStr = cols[idxDateTime]
      } else {
        dtStr = `${cols[idxDate]} ${cols[idxTime]}`
      }
      // Normalize: replace / with -, parse "YYYY-MM-DD HH:MM:SS" (seconds optional)
      const m = dtStr.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/)
      if (!m) { skipped++; continue }
      const [, yyyy, mm, dd, hh, mi, ss] = m
      const punchTime = new Date(`${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}T${hh.padStart(2, '0')}:${mi}:${ss || '00'}`)
      if (isNaN(punchTime.getTime())) { skipped++; continue }

      // In/Out mode
      let inOutMode = 0 // default IN
      if (idxInOut >= 0) {
        const v = (cols[idxInOut] || '').toLowerCase()
        if (v === '0' || v === 'in' || v === 'i' || v === 'check-in') inOutMode = 0
        else if (v === '1' || v === 'out' || v === 'o' || v === 'check-out') inOutMode = 1
        else if (v === '2' || v === 'break-in' || v === 'break_in') inOutMode = 2
        else if (v === '3' || v === 'break-out' || v === 'break_out') inOutMode = 3
      }

      // Verify mode (optional)
      let verifyMode: number | null = null
      if (idxVerify >= 0) {
        const v = (cols[idxVerify] || '').toLowerCase()
        if (v === '0' || v === 'password') verifyMode = 0
        else if (v === '1' || v === 'fingerprint' || v === 'fp') verifyMode = 1
        else if (v === '2' || v === 'card' || v === 'rfid') verifyMode = 2
        else if (v === '4' || v === 'face' || v === 'faceid') verifyMode = 4
        else if (v) verifyMode = Number(v) || null
      }

      // Work code (optional)
      let workCode: number | null = null
      if (idxWorkCode >= 0 && cols[idxWorkCode]) {
        workCode = Number(cols[idxWorkCode]) || null
      }

      // Match staff by IPPIS or staffId
      let staff = staffCache.get(userIdRaw)
      if (staff === undefined) {
        const found = await db.staff.findFirst({
          where: { OR: [{ ippisNumber: userIdRaw }, { staffId: userIdRaw }] },
          select: { id: true, staffId: true, departmentId: true },
        })
        staff = found || null
        staffCache.set(userIdRaw, staff)
      }
      if (!staff) {
        unmatched++
        if (unmatchedSamples.length < 5) unmatchedSamples.push(`Row ${i + 1}: UserID=${userIdRaw} @ ${dtStr}`)
        continue
      }

      // Dedup
      const exists = await db.attendanceRecord.findFirst({
        where: { staffId: staff.id, punchTime, deviceId },
        select: { id: true },
      })
      if (exists) { skipped++; continue }

      const { day, status, minutesLate, minutesEarly, hoursWorked } = await computeAttendanceStatus(staff, punchTime, inOutMode)
      await db.attendanceRecord.create({
        data: {
          staffId: staff.id,
          punchTime,
          punchType: inOutMode === 1 ? 'out' : (inOutMode === 3 ? 'break_out' : (inOutMode === 2 ? 'break_in' : 'in')),
          verifyMode,
          inOutMode,
          workCode,
          deviceId,
          status,
          minutesLate,
          minutesEarly,
          hoursWorked,
          source: 'csv_import',
          day,
        },
      })
      inserted++
      dayGroups.push({ staffId: staff.id, day })
    }

    // Pair IN/OUT punches for each (staffId, day) group so hoursWorked is set
    const pairKeys = new Set(dayGroups.map((g) => `${g.staffId}|${g.day}`))
    for (const key of pairKeys) {
      const [staffId, day] = key.split('|')
      await pairInOut(staffId, day)
    }

    await audit(user, 'import', {
      entity: 'AttendanceRecord',
      entityId: deviceId,
      details: `CSV import (${deviceId}) — inserted ${inserted}, skipped ${skipped}, unmatched ${unmatched}`,
      ipAddress: getIp(req),
    })

    return NextResponse.json({
      success: true,
      deviceId,
      inserted,
      skipped,
      unmatched,
      unmatchedSamples,
      message: `Import complete — ${inserted} record(s) inserted, ${skipped} skipped (duplicate or invalid), ${unmatched} unmatched (no staff record found for the UserID).${unmatched > 0 ? ' See unmatchedSamples for details.' : ''}`,
    })
  } catch (e: any) {
    console.error('Attendance CSV import:', e)
    return NextResponse.json({ error: 'Failed to import attendance CSV: ' + (e?.message || 'unknown error') }, { status: 500 })
  }
}
