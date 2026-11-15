import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'

// GET /api/shifts?departmentId=...
// Returns all shifts (optionally filtered by department) — global shifts (no
// departmentId) are always returned alongside department-specific ones.
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { searchParams } = new URL(req.url)
    const departmentId = searchParams.get('departmentId')
    const includeInactive = searchParams.get('includeInactive') === 'true'

    const where: any = {}
    if (departmentId) {
      // Return shifts for this department + all global shifts (no departmentId)
      where.OR = [
        { departmentId },
        { departmentId: null },
      ]
    }
    if (!includeInactive) where.isActive = true

    const shifts = await db.shift.findMany({
      where,
      orderBy: [
        { departmentId: 'asc' }, // global (null) shifts first
        { type: 'asc' },
        { startTime: 'asc' },
      ],
      include: {
        department: { select: { id: true, code: true, name: true, isClinical: true } },
        _count: { select: { staffShifts: true, attendance: true } },
      },
    })
    return NextResponse.json({ shifts })
  } catch (e: any) {
    console.error('Shifts list:', e)
    return NextResponse.json({ error: 'Failed to fetch shifts' }, { status: 500 })
  }
}

// POST /api/shifts
// Body: { code, name, description?, startTime, endTime, graceMinutes?, crossesMidnight?, type, departmentId?, isCallDuty?, isActive? }
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = user.activeRole || user.role
    if (!['SUPER_ADMIN', 'ADMIN', 'REGISTRY_OFFICER', 'PLANNING_OFFICER'].includes(role)) {
      return NextResponse.json({ error: 'Only admins / registry / planning can create shifts' }, { status: 403 })
    }

    const body = await req.json()
    const { code, name, description, startTime, endTime, graceMinutes, crossesMidnight, type, departmentId, isCallDuty, isActive } = body || {}

    if (!code || !name || !startTime || !endTime) {
      return NextResponse.json({ error: 'code, name, startTime and endTime are required' }, { status: 400 })
    }
    // Validate HH:MM 24h format
    const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/
    if (!timeRe.test(startTime) || !timeRe.test(endTime)) {
      return NextResponse.json({ error: 'startTime and endTime must be HH:MM 24h format' }, { status: 400 })
    }

    // Validate uniqueness per (code, departmentId) — same code can be reused
    // across departments but not twice for the same department.
    const existing = await db.shift.findFirst({
      where: { code, departmentId: departmentId || null },
    })
    if (existing) {
      return NextResponse.json({ error: `Shift with code ${code} already exists${departmentId ? ' for this department' : ' (global)'}` }, { status: 409 })
    }

    // Auto-detect crossesMidnight if not provided (start > end means crossing midnight)
    const shouldCrossMidnight = crossesMidnight !== undefined ? !!crossesMidnight : (startTime > endTime)

    const shift = await db.shift.create({
      data: {
        code: String(code).toUpperCase(),
        name: String(name),
        description: description || null,
        startTime: String(startTime),
        endTime: String(endTime),
        graceMinutes: typeof graceMinutes === 'number' ? graceMinutes : 15,
        crossesMidnight: shouldCrossMidnight,
        type: type || (shouldCrossMidnight ? 'night' : 'standard'),
        departmentId: departmentId || null,
        isCallDuty: !!isCallDuty,
        isActive: isActive !== undefined ? !!isActive : true,
      },
      include: { department: { select: { id: true, code: true, name: true, isClinical: true } } },
    })
    await audit(user, 'create', { entity: 'Shift', entityId: shift.id, details: `Created shift ${shift.code} — ${shift.name} (${shift.startTime}-${shift.endTime}${shouldCrossMidnight ? ' (overnight)' : ''})${departmentId ? ` for dept ${shift.department?.code}` : ' (global)'}`, ipAddress: getIp(req) })
    return NextResponse.json({ shift })
  } catch (e: any) {
    console.error('Shift create:', e)
    return NextResponse.json({ error: 'Failed to create shift' }, { status: 500 })
  }
}
