import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, isAdmin } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'

const committeeInclude = {
  chairperson: { select: { id: true, fullName: true, role: true } },
  secretary: { select: { id: true, fullName: true, role: true } },
  members2: {
    include: {
      staff: { select: { id: true, staffId: true, fullName: true, position: true, avatarUrl: true, department: { select: { code: true, name: true } }, designation: { select: { code: true, name: true } } } },
      addedBy: { select: { id: true, fullName: true } },
    },
    orderBy: [{ createdAt: 'asc' }],
  },
  _count: { select: { files: true, documents: true, members2: true } },
}

async function syncMembers(committeeId: string, members: { staffId: string; role?: string }[] | null | undefined, addedById: string) {
  if (!Array.isArray(members)) return
  const validStaff = await db.staff.findMany({ where: { id: { in: members.map((m) => m.staffId) } }, select: { id: true } })
  const validIds = new Set(validStaff.map((s) => s.id))
  const newIds = members.map((m) => m.staffId)
  await db.committeeMember.deleteMany({ where: { committeeId, NOT: { staffId: { in: newIds } } } })
  for (const m of members) {
    if (!validIds.has(m.staffId)) continue
    await db.committeeMember.upsert({
      where: { committeeId_staffId: { committeeId, staffId: m.staffId } },
      create: { committeeId, staffId: m.staffId, role: m.role || 'member', addedById },
      update: { role: m.role || 'member' },
    })
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const committee = await db.committee.findUnique({
      where: { id },
      include: {
        ...committeeInclude,
        files: { orderBy: { createdAt: 'desc' }, take: 50, include: { createdBy: { select: { id: true, fullName: true } }, currentHolder: { select: { id: true, fullName: true } } } },
      } as any,
    })
    if (!committee) return NextResponse.json({ error: 'Committee not found' }, { status: 404 })
    return NextResponse.json({ committee })
  } catch { return NextResponse.json({ error: 'Failed to fetch committee' }, { status: 500 }) }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!isAdmin(user.role)) return NextResponse.json({ error: 'Only administrators can edit committees' }, { status: 403 })
    const { id } = await params
    const body = await req.json()
    const { code, name, description, chairpersonId, secretaryId, members, members2, isActive, termOfReference, startDate, endDate, budget } = body || {}
    const existing = await db.committee.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Committee not found' }, { status: 404 })

    const data: any = {}
    if (code !== undefined) data.code = String(code).toUpperCase()
    if (name !== undefined) data.name = String(name)
    if (description !== undefined) data.description = description || null
    if (chairpersonId !== undefined) data.chairpersonId = chairpersonId || null
    if (secretaryId !== undefined) data.secretaryId = secretaryId || null
    if (members !== undefined) data.members = members || null
    if (isActive !== undefined) data.isActive = !!isActive
    if (termOfReference !== undefined) data.termOfReference = termOfReference || null
    if (startDate !== undefined) data.startDate = startDate ? new Date(startDate) : null
    if (endDate !== undefined) data.endDate = endDate ? new Date(endDate) : null
    if (budget !== undefined) data.budget = (budget === '' || budget == null) ? null : Number(budget)

    const committee = await db.committee.update({ where: { id }, data, include: committeeInclude as any })
    if (Array.isArray(members2)) await syncMembers(id, members2, user.id)
    const refreshed = await db.committee.findUnique({ where: { id }, include: committeeInclude as any })
    await audit(user, 'update', { entity: 'Committee', entityId: id, details: `Updated committee ${committee.code} — ${committee.name}`, ipAddress: getIp(req) })
    return NextResponse.json({ committee: refreshed })
  } catch (e: any) { console.error('Update committee error:', e); return NextResponse.json({ error: 'Failed to update committee' }, { status: 500 }) }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!isAdmin(user.role)) return NextResponse.json({ error: 'Only administrators can delete committees' }, { status: 403 })
    const { id } = await params
    const existing = await db.committee.findUnique({ where: { id }, include: { _count: { select: { files: true } } } })
    if (!existing) return NextResponse.json({ error: 'Committee not found' }, { status: 404 })
    if (existing._count.files > 0) return NextResponse.json({ error: 'Cannot delete a committee that has files. Deactivate it instead.' }, { status: 400 })
    await db.committee.delete({ where: { id } })
    await audit(user, 'delete', { entity: 'Committee', entityId: id, details: `Deleted committee ${existing.code} — ${existing.name}`, ipAddress: getIp(req) })
    return NextResponse.json({ ok: true })
  } catch (e: any) { return NextResponse.json({ error: 'Failed to delete committee' }, { status: 500 }) }
}
