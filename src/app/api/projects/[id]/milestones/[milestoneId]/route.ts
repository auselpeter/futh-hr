import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'

// PATCH /api/projects/[id]/milestones/[milestoneId]
// Body: { title?, description?, dueDate?, status?, weight?, completedAt? }
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; milestoneId: string }> },
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id, milestoneId } = await params
    const body = await req.json()

    const existing = await db.projectMilestone.findUnique({ where: { id: milestoneId }, include: { project: true } })
    if (!existing) return NextResponse.json({ error: 'Milestone not found' }, { status: 404 })
    if (existing.projectId !== id) {
      return NextResponse.json({ error: 'Milestone does not belong to this project' }, { status: 400 })
    }

    const role = user.activeRole || user.role
    if (!['SUPER_ADMIN', 'ADMIN', 'CMD', 'DFA', 'AD', 'HOD', 'HOU'].includes(role)) {
      return NextResponse.json({ error: 'Not authorized to update milestone' }, { status: 403 })
    }

    const data: any = {}
    if (body.title !== undefined) data.title = String(body.title)
    if (body.description !== undefined) data.description = body.description || null
    if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null
    if (body.weight !== undefined) data.weight = Number(body.weight)
    if (body.status !== undefined) {
      data.status = body.status
      if (body.status === 'Completed' && !existing.completedAt) data.completedAt = new Date()
      if (body.status !== 'Completed') data.completedAt = null
    }
    if (body.completedAt !== undefined) data.completedAt = body.completedAt ? new Date(body.completedAt) : null

    const updated = await db.projectMilestone.update({
      where: { id: milestoneId },
      data,
    })
    await audit(user, 'update', { entity: 'ProjectMilestone', entityId: milestoneId, details: `Updated milestone "${updated.title}" in project ${existing.project.code}${body.status ? ` (status=${body.status})` : ''}`, ipAddress: getIp(req) })
    return NextResponse.json({ milestone: updated })
  } catch (e: any) {
    console.error('Milestone patch:', e)
    return NextResponse.json({ error: 'Failed to update milestone' }, { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; milestoneId: string }> },
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id, milestoneId } = await params
    const existing = await db.projectMilestone.findUnique({ where: { id: milestoneId }, include: { project: true } })
    if (!existing) return NextResponse.json({ error: 'Milestone not found' }, { status: 404 })
    if (existing.projectId !== id) {
      return NextResponse.json({ error: 'Milestone does not belong to this project' }, { status: 400 })
    }
    const role = user.activeRole || user.role
    if (!['SUPER_ADMIN', 'ADMIN', 'CMD', 'DFA', 'AD', 'HOD', 'HOU'].includes(role)) {
      return NextResponse.json({ error: 'Not authorized to delete milestone' }, { status: 403 })
    }
    await db.projectMilestone.delete({ where: { id: milestoneId } })
    await audit(user, 'delete', { entity: 'ProjectMilestone', entityId: milestoneId, details: `Deleted milestone "${existing.title}" from project ${existing.project.code}`, ipAddress: getIp(req) })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('Milestone delete:', e)
    return NextResponse.json({ error: 'Failed to delete milestone' }, { status: 500 })
  }
}
