import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { buildScopeFilter, applyScope } from '@/lib/scope'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params

    const retirement = await db.retirement.findUnique({
      where: { id },
      include: {
        staff: {
          select: { id: true, staffId: true, fullName: true, position: true, rank: true, department: { select: { id: true, code: true, name: true } } },
        },
      },
    })
    if (!retirement) return NextResponse.json({ error: 'Retirement not found' }, { status: 404 })

    const scopeWhere = buildScopeFilter(user, 'retirement')
    const finalWhere = applyScope({ id }, scopeWhere)
    const accessible = await db.retirement.findFirst({ where: finalWhere, select: { id: true } })
    if (!accessible) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    return NextResponse.json({ retirement })
  } catch (e: any) {
    console.error('Retirement get:', e)
    return NextResponse.json({ error: 'Failed to fetch retirement' }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const body = await req.json()
    const existing = await db.retirement.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Retirement not found' }, { status: 404 })

    const role = user.activeRole || user.role
    const isCreator = existing.createdById === user.id
    const isPrivileged = ['SUPER_ADMIN', 'ADMIN', 'CMD', 'DFA', 'AD', 'HOD'].includes(role)
    if (!isCreator && !isPrivileged) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }
    if (!['Draft', 'Submitted'].includes(existing.status)) {
      return NextResponse.json({ error: 'Cannot edit a retirement in the approval workflow' }, { status: 400 })
    }
    const allowedKeys = [
      'type', 'reason', 'detailedReason', 'dateOfBirth', 'retirementDate', 'lastWorkingDate',
      'yearsOfService', 'dateOfFirstAppointment', 'currentSalaryAtRetirement', 'gradeLevelAtRetirement',
      'gratuityAmount', 'pensionBalance', 'leaveEncashment', 'pensionAdministrator', 'pensionPin',
      'nhfRefundAmount', 'nhisRefundAmount', 'clearanceFormUrl',
      'exitInterviewConducted', 'exitInterviewNotes', 'handoverCompleted', 'assetsReturned',
    ]
    const data: any = {}
    for (const k of allowedKeys) {
      if (body[k] !== undefined) {
        if (['dateOfBirth', 'retirementDate', 'lastWorkingDate', 'dateOfFirstAppointment'].includes(k)) data[k] = body[k] ? new Date(body[k]) : null
        else if (['currentSalaryAtRetirement', 'gratuityAmount', 'pensionBalance', 'leaveEncashment', 'nhfRefundAmount', 'nhisRefundAmount', 'yearsOfService'].includes(k)) data[k] = body[k] === null || body[k] === '' ? null : Number(body[k])
        else if (['exitInterviewConducted', 'handoverCompleted', 'assetsReturned'].includes(k)) data[k] = Boolean(body[k])
        else data[k] = body[k] === '' ? null : body[k]
      }
    }
    const updated = await db.retirement.update({ where: { id }, data, include: { staff: true } })
    return NextResponse.json({ retirement: updated })
  } catch (e: any) {
    console.error('Retirement patch:', e)
    return NextResponse.json({ error: 'Failed to update retirement' }, { status: 500 })
  }
}
