import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, isAdmin } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const committees = await db.committee.findMany({
      orderBy: [{ code: 'asc' }],
      include: {
        chairperson: { select: { id: true, fullName: true, role: true } },
        secretary: { select: { id: true, fullName: true, role: true } },
        members2: {
          include: {
            staff: { select: { id: true, staffId: true, fullName: true, position: true, avatarUrl: true } },
            addedBy: { select: { id: true, fullName: true } },
          },
          orderBy: [{ createdAt: 'asc' }],
        },
        _count: { select: { files: true, documents: true, members2: true } },
      },
    })
    return NextResponse.json({ committees })
  } catch (e: any) {
    console.error('Committees list error:', e)
    return NextResponse.json({ error: 'Failed to fetch committees' }, { status: 500 })
  }
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

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!isAdmin(user.role)) return NextResponse.json({ error: 'Only administrators can create committees' }, { status: 403 })
    const body = await req.json()
    const { code, name, description, chairpersonId, secretaryId, members, members2, isActive, termOfReference, startDate, endDate, budget } = body || {}
    if (!code || !name) return NextResponse.json({ error: 'Code and name are required' }, { status: 400 })
    const existing = await db.committee.findUnique({ where: { code: String(code) } })
    if (existing) return NextResponse.json({ error: 'A committee with that code already exists' }, { status: 409 })

    const committee = await db.committee.create({
      data: {
        code: String(code).toUpperCase(), name: String(name), description: description || null,
        chairpersonId: chairpersonId || null, secretaryId: secretaryId || null, members: members || null,
        isActive: isActive ?? true,
        termOfReference: termOfReference || null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        budget: budget != null && budget !== '' ? Number(budget) : null,
      },
      include: {
        chairperson: { select: { id: true, fullName: true, role: true } },
        secretary: { select: { id: true, fullName: true, role: true } },
        members2: { include: { staff: { select: { id: true, staffId: true, fullName: true, position: true, avatarUrl: true } }, addedBy: { select: { id: true, fullName: true } } } },
        _count: { select: { files: true, documents: true, members2: true } },
      },
    })

    const memberList = Array.isArray(members2) ? members2 : null
    if (memberList) await syncMembers(committee.id, memberList, user.id)

    const refreshed = await db.committee.findUnique({
      where: { id: committee.id },
      include: {
        chairperson: { select: { id: true, fullName: true, role: true } },
        secretary: { select: { id: true, fullName: true, role: true } },
        members2: { include: { staff: { select: { id: true, staffId: true, fullName: true, position: true, avatarUrl: true } }, addedBy: { select: { id: true, fullName: true } } }, orderBy: [{ createdAt: 'asc' }] },
        _count: { select: { files: true, documents: true, members2: true } },
      },
    })

    await audit(user, 'create', { entity: 'Committee', entityId: committee.id, details: `Created committee ${committee.code} — ${committee.name}${memberList ? ` (${memberList.length} members)` : ''}${budget ? ` · budget ₦${Number(budget).toLocaleString()}` : ''}`, ipAddress: getIp(req) })
    return NextResponse.json({ committee: refreshed })
  } catch (e: any) {
    console.error('Create committee error:', e)
    return NextResponse.json({ error: 'Failed to create committee' }, { status: 500 })
  }
}
