import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { buildScopeFilter, applyScope } from '@/lib/scope'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const project = await db.project.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, code: true, name: true } },
        members: {
          include: {
            staff: { select: { id: true, staffId: true, fullName: true, position: true, department: { select: { id: true, code: true, name: true } } } },
          },
        },
        milestones: { orderBy: { dueDate: 'asc' } },
        _count: { select: { members: true, milestones: true } },
      },
    })
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    const scopeWhere = buildScopeFilter(user, 'project')
    const finalWhere = applyScope({ id }, scopeWhere)
    const accessible = await db.project.findFirst({ where: finalWhere, select: { id: true } })
    if (!accessible) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    return NextResponse.json({ project })
  } catch (e: any) {
    console.error('Project get:', e)
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const body = await req.json()
    const existing = await db.project.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    const role = user.activeRole || user.role
    const isCreator = existing.createdById === user.id
    const isPrivileged = ['SUPER_ADMIN', 'ADMIN', 'CMD', 'CMA', 'AD', 'DFA', 'HOD', 'HOU'].includes(role)
    if (!isCreator && !isPrivileged) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }
    const allowedKeys = [
      'title', 'description', 'type', 'category', 'priority', 'departmentId',
      'startDate', 'endDate', 'budget', 'spent', 'currency', 'fundingSource',
      'progress', 'status', 'state', 'isActive',
    ]
    const data: any = {}
    for (const k of allowedKeys) {
      if (body[k] !== undefined) {
        if (['startDate', 'endDate', 'actualEndDate'].includes(k)) data[k] = body[k] ? new Date(body[k]) : null
        else if (['budget', 'spent', 'progress'].includes(k)) data[k] = body[k] === null || body[k] === '' ? null : Number(body[k])
        else data[k] = body[k] === '' ? null : body[k]
      }
    }
    const updated = await db.project.update({ where: { id }, data })
    return NextResponse.json({ project: updated })
  } catch (e: any) {
    console.error('Project patch:', e)
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 })
  }
}
