import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { buildScopeFilter, applyScope } from '@/lib/scope'

// GET /api/attendance?staffId=&departmentId=&dateFrom=&dateTo=&shiftId=&status=&deviceId=&day=&q=&limit=&offset=
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { searchParams } = new URL(req.url)
    const staffId = searchParams.get('staffId')
    const departmentId = searchParams.get('departmentId')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const shiftId = searchParams.get('shiftId')
    const status = searchParams.get('status')
    const deviceId = searchParams.get('deviceId')
    const day = searchParams.get('day') // YYYY-MM-DD
    const q = searchParams.get('q') || ''
    const limit = Math.min(parseInt(searchParams.get('limit') || '200'), 1000)
    const offset = parseInt(searchParams.get('offset') || '0')

    const where: any = {}
    if (staffId) where.staffId = staffId
    if (shiftId) where.shiftId = shiftId
    if (status) where.status = status
    if (deviceId) where.deviceId = deviceId
    if (day) where.day = day
    if (departmentId) where.staff = { departmentId }
    if (q) {
      where.OR = [
        { staff: { fullName: { contains: q } } },
        { staff: { staffId: { contains: q } } },
        { staff: { ippisNumber: { contains: q } } },
      ]
    }
    if (dateFrom || dateTo) {
      where.punchTime = {}
      if (dateFrom) where.punchTime.gte = new Date(dateFrom)
      if (dateTo) {
        const end = new Date(dateTo)
        end.setHours(23, 59, 59, 999)
        where.punchTime.lte = end
      }
    }

    // Scope to user's department (HOD/HOU see only their dept; admins/SUPER see all)
    const scopeWhere = buildScopeFilter(user, 'attendance')
    const finalWhere = applyScope(where, scopeWhere)

    const [records, total] = await Promise.all([
      db.attendanceRecord.findMany({
        where: finalWhere,
        orderBy: [{ punchTime: 'desc' }],
        take: limit,
        skip: offset,
        include: {
          staff: {
            select: {
              id: true, staffId: true, fullName: true, position: true,
              department: { select: { id: true, code: true, name: true, isClinical: true } },
              unit: { select: { id: true, code: true, name: true } },
            },
          },
          shift: { select: { id: true, code: true, name: true, type: true, startTime: true, endTime: true } },
        },
      }),
      db.attendanceRecord.count({ where: finalWhere }),
    ])
    return NextResponse.json({ records, total, limit, offset })
  } catch (e: any) {
    console.error('Attendance list:', e)
    return NextResponse.json({ error: 'Failed to fetch attendance records' }, { status: 500 })
  }
}
