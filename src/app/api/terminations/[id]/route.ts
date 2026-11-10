import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'
import { buildScopeFilter, applyScope } from '@/lib/scope'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params

    const termination = await db.termination.findUnique({
      where: { id },
      include: {
        staff: {
          select: {
            id: true, staffId: true, fullName: true, position: true, rank: true,
            department: { select: { id: true, code: true, name: true } },
          },
        },
      },
    })
    if (!termination) return NextResponse.json({ error: 'Termination not found' }, { status: 404 })

    const scopeWhere = buildScopeFilter(user, 'termination')
    const finalWhere = applyScope({ id }, scopeWhere)
    const accessible = await db.termination.findFirst({ where: finalWhere, select: { id: true } })
    if (!accessible) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    return NextResponse.json({ termination })
  } catch (e: any) {
    console.error('Termination get:', e)
    return NextResponse.json({ error: 'Failed to fetch termination' }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const body = await req.json()

    const existing = await db.termination.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Termination not found' }, { status: 404 })

    const role = user.activeRole || user.role
    const isCreator = existing.createdById === user.id
    const isPrivileged = ['SUPER_ADMIN', 'ADMIN', 'CMD', 'DFA', 'AD', 'HOD'].includes(role)
    if (!isCreator && !isPrivileged) {
      return NextResponse.json({ error: 'Not authorized to edit this termination' }, { status: 403 })
    }
    if (!['Draft', 'Submitted'].includes(existing.status)) {
      return NextResponse.json({ error: 'Cannot edit a termination that is already in the approval workflow' }, { status: 400 })
    }

    const allowedKeys = [
      'type', 'reason', 'detailedReason',
      'noticeDate', 'effectiveDate', 'lastWorkingDate',
      'finalSalary', 'gratuityAmount', 'pensionBalance', 'leaveEncashment',
      'clearanceFormUrl', 'status', 'state',
      'exitInterviewConducted', 'exitInterviewNotes',
      'handoverCompleted', 'assetsReturned',
    ]
    const data: any = {}
    for (const k of allowedKeys) {
      if (body[k] !== undefined) {
        if (['noticeDate', 'effectiveDate', 'lastWorkingDate'].includes(k)) {
          data[k] = body[k] ? new Date(body[k]) : null
        } else if (['finalSalary', 'gratuityAmount', 'pensionBalance', 'leaveEncashment'].includes(k)) {
          data[k] = body[k] === null || body[k] === '' ? null : Number(body[k])
        } else if (['exitInterviewConducted', 'handoverCompleted', 'assetsReturned'].includes(k)) {
          data[k] = Boolean(body[k])
        } else {
          data[k] = body[k] === '' ? null : body[k]
        }
      }
    }

    const updated = await db.termination.update({ where: { id }, data, include: { staff: true } })
    await audit(user, 'update', { entity: 'Termination', entityId: id, details: `Updated termination ${updated.refNumber}`, ipAddress: getIp(req) })
    return NextResponse.json({ termination: updated })
  } catch (e: any) {
    console.error('Termination patch:', e)
    return NextResponse.json({ error: 'Failed to update termination' }, { status: 500 })
  }
}
