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
    const training = await db.training.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, code: true, name: true } },
        enrollments: {
          include: {
            staff: {
              select: { id: true, staffId: true, fullName: true, position: true, rank: true, department: { select: { id: true, code: true, name: true } } },
            },
          },
        },
        _count: { select: { enrollments: true } },
      },
    })
    if (!training) return NextResponse.json({ error: 'Training not found' }, { status: 404 })

    const scopeWhere = buildScopeFilter(user, 'training')
    const finalWhere = applyScope({ id }, scopeWhere)
    const accessible = await db.training.findFirst({ where: finalWhere, select: { id: true } })
    if (!accessible) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    return NextResponse.json({ training })
  } catch (e: any) {
    console.error('Training get:', e)
    return NextResponse.json({ error: 'Failed to fetch training' }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const body = await req.json()
    const existing = await db.training.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Training not found' }, { status: 404 })

    const role = user.activeRole || user.role
    const isCreator = existing.createdById === user.id
    const isPrivileged = ['SUPER_ADMIN', 'ADMIN', 'CMD', 'CMA', 'AD', 'DFA', 'HOD', 'HOU'].includes(role)
    if (!isCreator && !isPrivileged) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }
    const allowedKeys = [
      'title', 'description', 'type', 'category', 'provider', 'facilitator', 'location', 'mode',
      'startDate', 'endDate', 'durationHours', 'cost', 'fundingSource', 'maxParticipants',
      'departmentId', 'status', 'isActive',
    ]
    const data: any = {}
    for (const k of allowedKeys) {
      if (body[k] !== undefined) {
        if (['startDate', 'endDate'].includes(k)) data[k] = body[k] ? new Date(body[k]) : null
        else if (['durationHours', 'cost', 'maxParticipants'].includes(k)) data[k] = body[k] === null || body[k] === '' ? null : Number(body[k])
        else data[k] = body[k] === '' ? null : body[k]
      }
    }
    const updated = await db.training.update({ where: { id }, data })
    return NextResponse.json({ training: updated })
  } catch (e: any) {
    console.error('Training patch:', e)
    return NextResponse.json({ error: 'Failed to update training' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const existing = await db.training.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Training not found' }, { status: 404 })

    const role = user.activeRole || user.role
    const isCreator = existing.createdById === user.id
    const isPrivileged = ['SUPER_ADMIN', 'ADMIN', 'CMD', 'CMA', 'AD', 'DFA', 'HOD'].includes(role)
    if (!isCreator && !isPrivileged) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    await db.training.delete({ where: { id } })
    await audit(user, 'delete', { entity: 'Training', entityId: id, details: `Deleted training ${existing.code}`, ipAddress: getIp(req) })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('Training delete:', e)
    return NextResponse.json({ error: 'Failed to delete training' }, { status: 500 })
  }
}
