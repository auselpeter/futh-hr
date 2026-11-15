import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = user.activeRole || user.role
    if (!['SUPER_ADMIN', 'ADMIN', 'REGISTRY_OFFICER', 'PLANNING_OFFICER'].includes(role)) {
      return NextResponse.json({ error: 'Only admins / registry / planning can edit shifts' }, { status: 403 })
    }
    const { id } = await params
    const body = await req.json()

    const allowed = ['code', 'name', 'description', 'startTime', 'endTime', 'graceMinutes', 'crossesMidnight', 'type', 'departmentId', 'isCallDuty', 'isActive']
    const data: any = {}
    for (const k of allowed) {
      if (body[k] !== undefined) {
        if (k === 'departmentId' && body[k] === '') data[k] = null
        else if (k === 'crossesMidnight' || k === 'isCallDuty' || k === 'isActive') data[k] = !!body[k]
        else if (k === 'graceMinutes') data[k] = Number(body[k])
        else data[k] = String(body[k])
      }
    }

    // Auto-detect crossesMidnight if startTime/endTime changed and crossesMidnight not provided
    if ((data.startTime || data.endTime) && data.crossesMidnight === undefined) {
      const existing = await db.shift.findUnique({ where: { id } })
      const st = data.startTime || existing?.startTime
      const et = data.endTime || existing?.endTime
      if (st && et) data.crossesMidnight = st > et
    }

    const shift = await db.shift.update({
      where: { id },
      data,
      include: { department: { select: { id: true, code: true, name: true, isClinical: true } } },
    })
    await audit(user, 'update', { entity: 'Shift', entityId: id, details: `Updated shift ${shift.code} — ${shift.name}`, ipAddress: getIp(req) })
    return NextResponse.json({ shift })
  } catch (e: any) {
    console.error('Shift update:', e)
    return NextResponse.json({ error: 'Failed to update shift' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = user.activeRole || user.role
    if (!['SUPER_ADMIN', 'ADMIN'].includes(role)) {
      return NextResponse.json({ error: 'Only admins can delete shifts' }, { status: 403 })
    }
    const { id } = await params
    const existing = await db.shift.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Shift not found' }, { status: 404 })

    // Soft-delete (deactivate) if there are existing attendance records or
    // staff-shift assignments pointing at this shift. Otherwise hard-delete.
    const [attCount, ssCount] = await Promise.all([
      db.attendanceRecord.count({ where: { shiftId: id } }),
      db.staffShift.count({ where: { shiftId: id } }),
    ])
    if (attCount > 0 || ssCount > 0) {
      const shift = await db.shift.update({ where: { id }, data: { isActive: false } })
      await audit(user, 'delete', { entity: 'Shift', entityId: id, details: `Soft-deleted (deactivated) shift ${shift.code} — ${attCount + ssCount} dependent records preserved`, ipAddress: getIp(req) })
      return NextResponse.json({ success: true, softDeleted: true })
    }
    await db.shift.delete({ where: { id } })
    await audit(user, 'delete', { entity: 'Shift', entityId: id, details: `Hard-deleted shift ${existing.code}`, ipAddress: getIp(req) })
    return NextResponse.json({ success: true, softDeleted: false })
  } catch (e: any) {
    console.error('Shift delete:', e)
    return NextResponse.json({ error: 'Failed to delete shift' }, { status: 500 })
  }
}
