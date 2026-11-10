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
    const { staffId, role } = body
    if (!staffId) return NextResponse.json({ error: 'staffId is required' }, { status: 400 })

    const project = await db.project.findUnique({ where: { id } })
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    const existing = await db.projectMember.findUnique({
      where: { projectId_staffId: { projectId: id, staffId } },
    })
    if (existing) return NextResponse.json({ error: 'Member already exists' }, { status: 400 })

    const member = await db.projectMember.create({
      data: { projectId: id, staffId, role: role || 'Member' },
      include: { staff: { select: { id: true, staffId: true, fullName: true } } },
    })
    await audit(user, 'create', { entity: 'ProjectMember', entityId: member.id, details: `Added ${member.staff?.fullName} to project ${project.code}`, ipAddress: getIp(req) })
    return NextResponse.json({ member })
  } catch (e: any) {
    console.error('Add member:', e)
    return NextResponse.json({ error: 'Failed to add member' }, { status: 500 })
  }
}
