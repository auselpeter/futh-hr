import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'
import { buildScopeFilter, applyScope } from '@/lib/scope'

async function generateProjectCode(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `PRJ-${year}-`
  const existing = await db.project.findMany({
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
        { description: { contains: q } },
      ]
    }
    const scopeWhere = buildScopeFilter(user, 'project')
    const finalWhere = applyScope(where, scopeWhere)

    const projects = await db.project.findMany({
      where: finalWhere,
      orderBy: [{ createdAt: 'desc' }],
      include: {
        department: { select: { id: true, code: true, name: true } },
        _count: { select: { members: true, milestones: true } },
      },
    })
    return NextResponse.json({ projects })
  } catch (e: any) {
    console.error('Projects list:', e)
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = user.activeRole || user.role
    if (['STAFF', 'REGISTRY_OFFICER'].includes(role)) {
      return NextResponse.json({ error: 'Not authorized to create projects' }, { status: 403 })
    }
    const body = await req.json()
    const {
      title, description, type, category, priority, departmentId,
      startDate, endDate, budget, currency, fundingSource,
    } = body || {}

    if (!title || !startDate) {
      return NextResponse.json({ error: 'title and startDate are required' }, { status: 400 })
    }

    const code = await generateProjectCode()
    const project = await db.project.create({
      data: {
        code,
        title,
        description: description || null,
        type: type || 'institutional',
        category: category || null,
        priority: priority || 'Normal',
        departmentId: departmentId || null,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        budget: budget ? Number(budget) : null,
        currency: currency || 'NGN',
        fundingSource: fundingSource || null,
        progress: 0,
        status: 'Planned',
        state: 'open',
        isActive: true,
        createdById: user.id,
      },
      include: { department: true },
    })

    await audit(user, 'create', { entity: 'Project', entityId: project.id, details: `Created project ${code} — ${title}`, ipAddress: getIp(req) })
    return NextResponse.json({ project })
  } catch (e: any) {
    console.error('Project create:', e)
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }
}
