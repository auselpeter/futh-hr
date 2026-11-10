import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const body = await req.json()
    const { title, description, dueDate } = body
    if (!title || !dueDate) return NextResponse.json({ error: 'title and dueDate are required' }, { status: 400 })

    const project = await db.project.findUnique({ where: { id } })
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    const milestone = await db.projectMilestone.create({
      data: {
        projectId: id,
        title,
        description: description || null,
        dueDate: new Date(dueDate),
        status: 'Pending',
        createdById: user.id,
      },
    })
    await audit(user, 'create', { entity: 'ProjectMilestone', entityId: milestone.id, details: `Added milestone "${title}" to project ${project.code}`, ipAddress: getIp(req) })
    return NextResponse.json({ milestone })
  } catch (e: any) {
    console.error('Add milestone:', e)
    return NextResponse.json({ error: 'Failed to add milestone' }, { status: 500 })
  }
}
