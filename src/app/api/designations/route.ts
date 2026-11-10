import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, isAdmin } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const designations = await db.designation.findMany({
      orderBy: { rank: 'desc' },
      include: { _count: { select: { users: true, staff: true } } },
    })
    return NextResponse.json({ designations })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to fetch designations' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!isAdmin(user.role)) {
      return NextResponse.json({ error: 'Only administrators can create designations' }, { status: 403 })
    }
    const body = await req.json()
    const { code, name, description, rank, level } = body || {}
    if (!code || !name) {
      return NextResponse.json({ error: 'Code and name are required' }, { status: 400 })
    }
    const existing = await db.designation.findUnique({ where: { code: String(code).toUpperCase() } })
    if (existing) {
      return NextResponse.json({ error: 'Designation with that code already exists' }, { status: 409 })
    }
    const designation = await db.designation.create({
      data: {
        code: String(code).toUpperCase(),
        name: String(name),
        description: description ? String(description) : null,
        rank: Number(rank) || 100,
        level: level || 'staff',
      },
      include: { _count: { select: { users: true, staff: true } } },
    })
    await audit(user, 'create', { entity: 'Designation', entityId: designation.id, details: `Created designation ${code} — ${name}`, ipAddress: getIp(req) })
    return NextResponse.json({ designation })
  } catch (e: any) {
    console.error('Create designation error:', e)
    return NextResponse.json({ error: 'Failed to create designation' }, { status: 500 })
  }
}
