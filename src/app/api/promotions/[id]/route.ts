import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'
import { buildScopeFilter, applyScope } from '@/lib/scope'

// GET /api/promotions/[id] — fetch a single promotion with all relations
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params

    const promotion = await db.promotion.findUnique({
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
    if (!promotion) return NextResponse.json({ error: 'Promotion not found' }, { status: 404 })

    // Apply scope filter — ensure the user is allowed to see this promotion
    const scopeWhere = buildScopeFilter(user, 'promotion')
    const finalWhere = applyScope({ id }, scopeWhere)
    const accessible = await db.promotion.findFirst({ where: finalWhere, select: { id: true } })
    if (!accessible) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    return NextResponse.json({ promotion })
  } catch (e: any) {
    console.error('Promotion get:', e)
    return NextResponse.json({ error: 'Failed to fetch promotion' }, { status: 500 })
  }
}

// PATCH /api/promotions/[id] — update a Draft promotion (only creator or admin)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const body = await req.json()

    const existing = await db.promotion.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Promotion not found' }, { status: 404 })

    const role = user.activeRole || user.role
    const isCreator = existing.createdById === user.id
    const isPrivileged = ['SUPER_ADMIN', 'ADMIN', 'CMD', 'DFA', 'AD', 'HOD'].includes(role)
    if (!isCreator && !isPrivileged) {
      return NextResponse.json({ error: 'Not authorized to edit this promotion' }, { status: 403 })
    }
    // Only allow edits while in Draft or Submitted state
    if (!['Draft', 'Submitted'].includes(existing.status)) {
      return NextResponse.json({ error: 'Cannot edit a promotion that is already in the approval workflow' }, { status: 400 })
    }

    const allowedKeys = [
      'type', 'currentPosition', 'currentRank', 'currentSalary',
      'newPosition', 'newRank', 'newSalary', 'newDepartmentId', 'newDesignationId',
      'effectiveDate', 'reason', 'justification', 'status', 'state',
    ]
    const data: any = {}
    for (const k of allowedKeys) {
      if (body[k] !== undefined) {
        if (k === 'effectiveDate') data.effectiveDate = new Date(body[k])
        else if (k === 'currentSalary' || k === 'newSalary') data[k] = body[k] === null || body[k] === '' ? null : Number(body[k])
        else data[k] = body[k] === '' ? null : body[k]
      }
    }

    const updated = await db.promotion.update({ where: { id }, data, include: { staff: true } })
    await audit(user, 'update', { entity: 'Promotion', entityId: id, details: `Updated promotion ${updated.refNumber}`, ipAddress: getIp(req) })
    return NextResponse.json({ promotion: updated })
  } catch (e: any) {
    console.error('Promotion patch:', e)
    return NextResponse.json({ error: 'Failed to update promotion' }, { status: 500 })
  }
}
