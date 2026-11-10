import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const leave = await db.leave.findUnique({
      where: { id },
      include: {
        staff: { include: { department: true } },
        leaveType: true,
      },
    })
    if (!leave) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ leave })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const body = await req.json()
    const data: any = {}
    for (const k of ['startDate', 'endDate', 'reason', 'address', 'phone', 'certificateUrl', 'daysApproved']) {
      if (body[k] !== undefined) {
        if (k === 'startDate' || k === 'endDate') data[k] = body[k] ? new Date(body[k]) : undefined
        else data[k] = body[k]
      }
    }
    const leave = await db.leave.update({ where: { id }, data, include: { staff: true, leaveType: true } })
    await audit(user, 'update', { entity: 'Leave', entityId: id, details: `Updated leave ${leave.refNumber}`, ipAddress: getIp(req) })
    return NextResponse.json({ leave })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
