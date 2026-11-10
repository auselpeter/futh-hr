import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'
import { buildScopeFilter, applyScope } from '@/lib/scope'

async function generateTerminationRef(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `TRM-${year}-`
  const existing = await db.termination.findMany({
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
        { reason: { contains: q } },
      ]
    }

    const scopeWhere = buildScopeFilter(user, 'termination')
    const finalWhere = applyScope(where, scopeWhere)

    const terminations = await db.termination.findMany({
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
    return NextResponse.json({ terminations })
  } catch (e: any) {
    console.error('Terminations list:', e)
    return NextResponse.json({ error: 'Failed to fetch terminations' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = user.activeRole || user.role
    if (role === 'STAFF' || role === 'REGISTRY_OFFICER') {
      return NextResponse.json({ error: 'Not authorized to create terminations' }, { status: 403 })
    }
    const body = await req.json()
    const {
      staffId, type, reason, detailedReason,
      noticeDate, effectiveDate, lastWorkingDate,
      finalSalary, gratuityAmount, pensionBalance, leaveEncashment,
      clearanceFormUrl,
    } = body || {}

    if (!staffId || !effectiveDate || !reason) {
      return NextResponse.json({ error: 'staffId, effectiveDate and reason are required' }, { status: 400 })
    }

    const refNumber = await generateTerminationRef()
    const termination = await db.termination.create({
      data: {
        refNumber,
        staffId,
        type: type || 'termination',
        reason,
        detailedReason: detailedReason || null,
        noticeDate: noticeDate ? new Date(noticeDate) : null,
        effectiveDate: new Date(effectiveDate),
        lastWorkingDate: lastWorkingDate ? new Date(lastWorkingDate) : null,
        finalSalary: finalSalary ?? null,
        gratuityAmount: gratuityAmount ?? null,
        pensionBalance: pensionBalance ?? null,
        leaveEncashment: leaveEncashment ?? null,
        clearanceFormUrl: clearanceFormUrl || null,
        status: 'Submitted',
        state: 'open',
        createdById: user.id,
      },
      include: { staff: true },
    })

    // Notify HOD/DFA/CMD (best-effort)
    try {
      const approvers = await db.user.findMany({
        where: { role: { in: ['HOD', 'DFA', 'CMD', 'SUPER_ADMIN', 'ADMIN'] }, isActive: true },
      })
      await db.notification.createMany({
        data: approvers.map((u) => ({
          userId: u.id,
          title: 'New termination request',
          body: `${termination.staff?.fullName || 'Staff'} — ${type || 'termination'} (${refNumber}) submitted for approval`,
          type: 'approval',
          link: `/?view=terminations`,
        })),
      })
    } catch (n) {
      console.error('Termination notify failed:', n)
    }

    await audit(user, 'create', { entity: 'Termination', entityId: termination.id, details: `Created termination ${termination.refNumber} for ${termination.staff?.fullName || 'staff'} (${type || 'termination'})`, ipAddress: getIp(req) })

    return NextResponse.json({ termination })
  } catch (e: any) {
    console.error('Termination create:', e)
    return NextResponse.json({ error: 'Failed to create termination' }, { status: 500 })
  }
}
