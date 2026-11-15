import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'
import { computeAttendanceStatus } from '../util'

// POST /api/attendance/sync
// Body: { host?: string, port?: number, forceFull?: boolean }
//
// Attempts a live TCP pull from the ZKTeco attendance device (default
// 192.168.1.200:4370). The ZKTeco push protocol is binary and proprietary;
// implementing the full handshake (session key negotiation via the
// CMD_CONNECT / CMD_AUTH vendor commands) is a non-trivial undertaking.
//
// To keep this route robust WITHOUT requiring a third-party zklib dependency
// that may break with newer firmware, we take a hybrid approach:
//   1. Probe the device with a TCP connect — if the device is unreachable,
//      return a clear error message + a hint to use /api/attendance/import instead.
//   2. If the device accepts the connection, we attempt the standard ZKTeco
//      "refresh data" handshake. If that fails (firmware mismatch), we still
//      return success but with `pulled: 0` and an explanation.
//
// In production, this route can be replaced by a long-running worker that
// uses the `zkteco-attendance` or `node-zklib` package — the schema + import
// paths are identical, so no data migration is required.
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = user.activeRole || user.role
    if (!['SUPER_ADMIN', 'ADMIN', 'REGISTRY_OFFICER', 'PLANNING_OFFICER'].includes(role)) {
      return NextResponse.json({ error: 'Only admins / registry / planning can sync attendance' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const host = body.host || process.env.ZKTECO_HOST || '192.168.1.200'
    const port = Number(body.port || process.env.ZKTECO_PORT || 4370)

    // 1) TCP reachability probe — 5s timeout so the UI doesn't hang.
    const reachable = await probeTcp(host, port, 5000)
    if (!reachable) {
      return NextResponse.json({
        success: false,
        device: { host, port },
        message: `Could not reach ZKTeco device at ${host}:${port}. Verify the device is powered on, on the same network, and that port ${port} (TCP) is open. You can also use /api/attendance/import to upload a CSV export from ZKeco'sAttend software.`,
      }, { status: 502 })
    }

    // 2) Attempt the ZKTeco handshake. We import the optional `zkteco` helper
    //    lazily so the route doesn't crash if the package is missing.
    let pulled = 0
    let inserted = 0
    let skipped = 0
    let lastError: string | null = null
    let lastPunchTime: string | null = null

    try {
      const { pullAttendanceLogs } = await import('./zklib')
      const logs = await pullAttendanceLogs(host, port)
      pulled = logs.length

      // Insert each log, dedup by (staff lookup + punchTime + deviceId)
      for (const log of logs) {
        const match = await matchStaff(log.userId)
        if (!match) { skipped++; continue }
        const exists = await db.attendanceRecord.findFirst({
          where: { staffId: match.id, punchTime: log.punchTime, deviceId: log.deviceId },
          select: { id: true },
        })
        if (exists) { skipped++; continue }

        const { day, status, minutesLate, minutesEarly, hoursWorked } = await computeAttendanceStatus(match, log.punchTime, log.inOutMode)

        const rec = await db.attendanceRecord.create({
          data: {
            staffId: match.id,
            punchTime: log.punchTime,
            punchType: log.inOutMode === 1 ? 'out' : 'in',
            verifyMode: log.verifyMode ?? null,
            inOutMode: log.inOutMode ?? null,
            workCode: log.workCode ?? null,
            deviceId: log.deviceId,
            status,
            minutesLate,
            minutesEarly,
            hoursWorked,
            source: 'device',
            day,
          },
        })
        inserted++
        if (!lastPunchTime || log.punchTime > new Date(lastPunchTime)) lastPunchTime = log.punchTime.toISOString()
      }
    } catch (e: any) {
      lastError = e?.message || String(e)
      console.error('ZKTeco pull failed:', e)
    }

    await audit(user, 'sync', {
      entity: 'AttendanceRecord',
      entityId: host,
      details: `ZKTeco sync from ${host}:${port} — pulled ${pulled}, inserted ${inserted}, skipped ${skipped}${lastError ? ` (last error: ${lastError})` : ''}`,
      ipAddress: getIp(req),
    })

    return NextResponse.json({
      success: true,
      device: { host, port },
      pulled,
      inserted,
      skipped,
      lastPunchTime,
      lastError,
      message: lastError
        ? `Device reachable, but live protocol pull failed (${lastError}). Use /api/attendance/import to upload a CSV export from ZKTeco's Attend software as a fallback.`
        : `Sync complete — ${inserted} new record(s) inserted, ${skipped} skipped (already in DB or unmatched staff).`,
    })
  } catch (e: any) {
    console.error('Attendance sync:', e)
    return NextResponse.json({ error: 'Failed to sync attendance: ' + (e?.message || 'unknown error') }, { status: 500 })
  }
}

// Probe TCP reachability. Resolves true if the socket connects within `timeoutMs`.
function probeTcp(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new (require('net').Socket)()
    let done = false
    const finish = (ok: boolean) => {
      if (done) return
      done = true
      socket.destroy()
      resolve(ok)
    }
    socket.setTimeout(timeoutMs)
    socket.once('connect', () => finish(true))
    socket.once('timeout', () => finish(false))
    socket.once('error', () => finish(false))
    socket.connect(port, host)
  })
}

// Match a ZKTeo user ID (typically IPPIS number or staffId) to a Staff record.
async function matchStaff(zkUserId: string): Promise<{ id: string; staffId: string; departmentId: string | null } | null> {
  if (!zkUserId) return null
  // Try IPPIS first (most ZKTeco enrollments use IPPIS as the user ID)
  const byIppis = await db.staff.findFirst({ where: { ippisNumber: String(zkUserId) }, select: { id: true, staffId: true, departmentId: true } })
  if (byIppis) return byIppis
  // Then try staffId (e.g. ICT/001)
  const byStaffId = await db.staff.findFirst({ where: { staffId: String(zkUserId) }, select: { id: true, staffId: true, departmentId: true } })
  if (byStaffId) return byStaffId
  return null
}
