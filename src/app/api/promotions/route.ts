import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'
import { buildScopeFilter, applyScope } from '@/lib/scope'

async function generatePromotionRef(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `PRM-${year}-`
  const existing = await db.promotion.findMany({
    where: { refNumber: { startsWith: prefix } },
    select: { refNumber: true },
  })
  let max = 0
  for (const r of existing) {
    const seqStr = r.refNumber.replace(prefix, '')
    const seq = parseInt(seqStr, 10)
    if (!isNaN(seq) && seq > max) max = seq
  }
  return `${prefix}${String(max + 1).padStart(6, '0')}`
}

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { searchParams } = new URL(req.url)
    const tab = searchParams.get('tab') || 'all'
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const q = searchParams.get('q') || ''

    const where: any = {}
    if (status) where.status = status
    if (type) where.type = type
    if (tab === 'mine') where.createdById = user.id
    if (tab === 'pending_my_approval') {
      const role = user.activeRole || user.role
      if (role === 'HOD' || role === 'HOU') where.status = 'Submitted'
      else if (role === 'DFA') where.status = 'HOD Approved'
      else if (role === 'CMD') where.status = 'DFA Approved'
      else where.status = { in: ['Submitted', 'HOD Approved', 'DFA Approved'] }
    }
    if (tab === 'approved') where.state = 'approved'
    if (tab === 'rejected') where.state = 'rejected'
    if (q) {
      where.OR = [
        { refNumber: { contains: q } },
        { staff: { fullName: { contains: q } } },
        { staff: { staffId: { contains: q } } },
        { newPosition: { contains: q } },
        { currentPosition: { contains: q } },
      ]
    }

    const scopeWhere = buildScopeFilter(user, 'promotion')
    const finalWhere = applyScope(where, scopeWhere)

    const promotions = await db.promotion.findMany({
      where: finalWhere,
      orderBy: [{ createdAt: 'desc' }],
      include: {
        staff: {
          select: {
            id: true, staffId: true, fullName: true, position: true, rank: true,
            department: { select: { id: true, code: true, name: true } },
          },
        },
      },
    })
    return NextResponse.json({ promotions })
  } catch (e: any) {
    console.error('Promotions list:', e)
    return NextResponse.json({ error: 'Failed to fetch promotions' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json()
    const {
      staffId, type, currentPosition, currentRank, currentSalary,
      newPosition, newRank, newSalary, newDepartmentId, newDesignationId,
      effectiveDate, reason, justification,
    } = body || {}

    if (!staffId || !effectiveDate) {
      return NextResponse.json({ error: 'staffId and effectiveDate are required' }, { status: 400 })
    }

    const role = user.activeRole || user.role
    if (role === 'STAFF' || role === 'REGISTRY_OFFICER') {
      return NextResponse.json({ error: 'Not authorized to create promotions' }, { status: 403 })
    }

    // Auto-fill current position/rank/salary from staff record if not provided
    let cp = currentPosition ?? null
    let cr = currentRank ?? null
    let cs = currentSalary ?? null
    if (cp === null || cr === null || cs === null) {
      const staff = await db.staff.findUnique({ where: { id: staffId } })
      if (staff) {
        cp = cp ?? staff.position
        cr = cr ?? staff.rank
        cs = cs ?? (staff as any).currentSalary ?? null
      }
    }

    const refNumber = await generatePromotionRef()
    const promotion = await db.promotion.create({
      data: {
        refNumber,
        staffId,
        type: type || 'promotion',
        currentPosition: cp,
        currentRank: cr,
        currentSalary: cs,
        newPosition: newPosition || null,
        newRank: newRank || null,
        newSalary: newSalary ?? null,
        newDepartmentId: newDepartmentId || null,
        newDesignationId: newDesignationId || null,
        effectiveDate: new Date(effectiveDate),
        reason: reason || null,
        justification: justification || null,
        status: 'Submitted',
        state: 'open',
        createdById: user.id,
      },
      include: { staff: true },
    })

    // Notify HOD/DFA/CMD about the new promotion (best-effort)
    try {
      const approvers = await db.user.findMany({
        where: { role: { in: ['HOD', 'DFA', 'CMD', 'SUPER_ADMIN', 'ADMIN'] }, isActive: true },
      })
      await db.notification.createMany({
        data: approvers.map((u) => ({
          userId: u.id,
          title: 'New promotion request',
          body: `${promotion.staff?.fullName || 'Staff'} — promotion request (${refNumber}) submitted for approval`,
          type: 'approval',
          link: `/?view=promotions`,
        })),
      })
    } catch (n) {
      console.error('Promotion notify failed:', n)
    }

    await audit(user, 'create', { entity: 'Promotion', entityId: promotion.id, details: `Created promotion ${promotion.refNumber} for ${promotion.staff?.fullName || 'staff'} (${type || 'promotion'})`, ipAddress: getIp(req) })

    return NextResponse.json({ promotion })
  } catch (e: any) {
    console.error('Promotion create:', e)
    return NextResponse.json({ error: 'Failed to create promotion' }, { status: 500 })
  }
}
