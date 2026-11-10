import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { buildScopeFilter, applyScope } from '@/lib/scope'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params

    const posting = await db.postingTransfer.findUnique({
      where: { id },
      include: {
        staff: {
          select: { id: true, staffId: true, fullName: true, position: true, rank: true, department: { select: { id: true, code: true, name: true } } },
        },
        toDepartment: { select: { id: true, code: true, name: true } },
        toDesignation: { select: { id: true, code: true, name: true } },
      },
    })
    if (!posting) return NextResponse.json({ error: 'Posting not found' }, { status: 404 })

    const scopeWhere = buildScopeFilter(user, 'postingTransfer')
    const finalWhere = applyScope({ id }, scopeWhere)
    const accessible = await db.postingTransfer.findFirst({ where: finalWhere, select: { id: true } })
    if (!accessible) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    return NextResponse.json({ posting })
  } catch (e: any) {
    console.error('PT get:', e)
    return NextResponse.json({ error: 'Failed to fetch posting' }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const body = await req.json()
    const existing = await db.postingTransfer.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Posting not found' }, { status: 404 })

    const role = user.activeRole || user.role
    const isCreator = existing.createdById === user.id
    const isPrivileged = ['SUPER_ADMIN', 'ADMIN', 'CMD', 'DFA', 'AD', 'HOD'].includes(role)
    if (!isCreator && !isPrivileged) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }
    if (!['Draft', 'Submitted', 'Planning Reviewed'].includes(existing.status)) {
      return NextResponse.json({ error: 'Cannot edit a posting in the approval workflow' }, { status: 400 })
    }
    const allowedKeys = ['reason', 'detailedReason', 'effectiveDate', 'reportDeadline', 'handoverDate', 'toPosition', 'toDepartmentId', 'toDesignationId', 'progress']
    const data: any = {}
    for (const k of allowedKeys) {
      if (body[k] !== undefined) {
        if (['effectiveDate', 'reportDeadline', 'handoverDate'].includes(k)) data[k] = body[k] ? new Date(body[k]) : null
        else data[k] = body[k] === '' ? null : body[k]
      }
    }
    const updated = await db.postingTransfer.update({ where: { id }, data })
    return NextResponse.json({ posting: updated })
  } catch (e: any) {
    console.error('PT patch:', e)
    return NextResponse.json({ error: 'Failed to update posting' }, { status: 500 })
  }
}
