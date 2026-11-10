import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'
import { buildScopeFilter, applyScope } from '@/lib/scope'

async function generateTrainingCode(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `TRN-${year}-`
  const existing = await db.training.findMany({
    where: { code: { startsWith: prefix } },
    select: { code: true },
  })
  let max = 0
  for (const r of existing) {
    const seqStr = r.code.replace(prefix, '')
    const seq = parseInt(seqStr, 10)
    if (!isNaN(seq) && seq > max) max = seq
  }
  return `${prefix}${String(max + 1).padStart(3, '0')}`
}

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const q = searchParams.get('q') || ''

    const where: any = { isActive: true }
    if (status) where.status = status
    if (q) {
      where.OR = [
        { code: { contains: q } },
        { title: { contains: q } },
        { provider: { contains: q } },
      ]
    }
    const scopeWhere = buildScopeFilter(user, 'training')
    const finalWhere = applyScope(where, scopeWhere)

    const trainings = await db.training.findMany({
      where: finalWhere,
      orderBy: [{ startDate: 'desc' }],
      include: {
        department: { select: { id: true, code: true, name: true } },
        _count: { select: { enrollments: true } },
      },
    })
    return NextResponse.json({ trainings })
  } catch (e: any) {
    console.error('Trainings list:', e)
    return NextResponse.json({ error: 'Failed to fetch trainings' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = user.activeRole || user.role
    if (['STAFF', 'REGISTRY_OFFICER'].includes(role)) {
      return NextResponse.json({ error: 'Not authorized to create trainings' }, { status: 403 })
    }
    const body = await req.json()
    const {
      title, description, type, category, provider, facilitator, location, mode,
      startDate, endDate, durationHours, cost, fundingSource,
      maxParticipants, departmentId,
    } = body || {}

    if (!title || !startDate || !endDate) {
      return NextResponse.json({ error: 'title, startDate and endDate are required' }, { status: 400 })
    }

    const code = await generateTrainingCode()
    const training = await db.training.create({
      data: {
        code,
        title,
        description: description || null,
        type: type || 'workshop',
        category: category || null,
        provider: provider || null,
        facilitator: facilitator || null,
        location: location || null,
        mode: mode || 'physical',
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        durationHours: durationHours ? Number(durationHours) : null,
        cost: cost ? Number(cost) : null,
        fundingSource: fundingSource || null,
        maxParticipants: maxParticipants ? Number(maxParticipants) : null,
        departmentId: departmentId || null,
        status: 'Open',
        isActive: true,
        createdById: user.id,
      },
    })

    await audit(user, 'create', { entity: 'Training', entityId: training.id, details: `Created training ${code} — ${title}`, ipAddress: getIp(req) })
    return NextResponse.json({ training })
  } catch (e: any) {
    console.error('Training create:', e)
    return NextResponse.json({ error: 'Failed to create training' }, { status: 500 })
  }
}
