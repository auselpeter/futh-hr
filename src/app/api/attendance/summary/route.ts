import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { buildScopeFilter, applyScope } from '@/lib/scope'

// GET /api/attendance/summary?from=&to=&departmentId=&groupBy=day|month
//
// Returns aggregated attendance stats per staff per period:
//   { staff, period, totalPunches, inPunches, outPunches, onTime, late, earlyLeave,
//     avgHoursWorked, totalHoursWorked, presentDays, absentDays }
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const departmentId = searchParams.get('departmentId')
    const groupBy = searchParams.get('groupBy') || 'day'

    if (!from || !to) {
      return NextResponse.json({ error: 'from and to are required (YYYY-MM-DD)' }, { status: 400 })
    }
    const fromDate = new Date(from)
    const toDate = new Date(to)
    toDate.setHours(23, 59, 59, 999)

    // Pull all records in the range, scope-filtered.
    const where: any = {
      punchTime: { gte: fromDate, lte: toDate },
    }
    if (departmentId) where.staff = { departmentId }
    const scopeWhere = buildScopeFilter(user, 'attendance')
    const finalWhere = applyScope(where, scopeWhere)

    const records = await db.attendanceRecord.findMany({
      where: finalWhere,
      orderBy: [{ punchTime: 'asc' }],
      include: {
        staff: {
          select: {
            id: true, staffId: true, fullName: true, position: true,
            department: { select: { id: true, code: true, name: true, isClinical: true } },
          },
        },
      },
    })

    // Group records by (staffId, period)
    const summaryMap = new Map<string, any>()
    for (const r of records) {
      const periodKey = groupBy === 'month' ? r.day.slice(0, 7) : r.day // YYYY-MM or YYYY-MM-DD
      const key = `${r.staffId}|${periodKey}`
      if (!summaryMap.has(key)) {
        summaryMap.set(key, {
          staff: r.staff,
          period: periodKey,
          totalPunches: 0,
          inPunches: 0,
          outPunches: 0,
          onTime: 0,
          late: 0,
          earlyLeave: 0,
          totalHoursWorked: 0,
          hoursWorkedCount: 0,
          presentDays: new Set<string>(),
        })
      }
      const s = summaryMap.get(key)
      s.totalPunches++
      if (r.punchType === 'in') s.inPunches++
      if (r.punchType === 'out') s.outPunches++
      if (r.status === 'on_time') s.onTime++
      if (r.status === 'late') s.late++
      if (r.status === 'early_leave') s.earlyLeave++
      if (r.hoursWorked != null) {
        s.totalHoursWorked += r.hoursWorked
        s.hoursWorkedCount++
      }
      s.presentDays.add(r.day)
    }

    const summary = Array.from(summaryMap.values()).map((s) => ({
      staff: s.staff,
      period: s.period,
      totalPunches: s.totalPunches,
      inPunches: s.inPunches,
      outPunches: s.outPunches,
      onTime: s.onTime,
      late: s.late,
      earlyLeave: s.earlyLeave,
      avgHoursWorked: s.hoursWorkedCount > 0 ? Math.round((s.totalHoursWorked / s.hoursWorkedCount) * 100) / 100 : null,
      totalHoursWorked: Math.round(s.totalHoursWorked * 100) / 100,
      presentDays: s.presentDays.size,
    }))

    return NextResponse.json({ summary, totalStaff: summary.length, groupBy })
  } catch (e: any) {
    console.error('Attendance summary:', e)
    return NextResponse.json({ error: 'Failed to fetch attendance summary' }, { status: 500 })
  }
}
