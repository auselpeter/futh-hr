import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'
import { buildScopeFilter, applyScope } from '@/lib/scope'

async function generatePTRef(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `PT-${year}-`
  const existing = await db.postingTransfer.findMany({
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
    const q = searchParams.get('q') || ''

    const where: any = {}
    if (status) where.status = status
    if (tab === 'pending_my_approval') {
      const role = user.activeRole || user.role
      if (role === 'HOD' || role === 'HOU') where.status = 'Planning Reviewed'
      else if (role === 'DFA') where.status = 'HOD Approved'
      else if (role === 'CMD') where.status = 'DFA Approved'
      else where.status = { in: ['Submitted', 'Planning Reviewed', 'HOD Approved', 'DFA Approved'] }
    }
    if (tab === 'mine') where.createdById = user.id
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

    const scopeWhere = buildScopeFilter(user, 'postingTransfer')
    const finalWhere = applyScope(where, scopeWhere)

    const postings = await db.postingTransfer.findMany({
      where: finalWhere,
      orderBy: [{ createdAt: 'desc' }],
      include: {
        staff: {
          select: {
            id: true, staffId: true, fullName: true, position: true, rank: true,
            department: { select: { id: true, code: true, name: true } },
          },
        },
        toDepartment: { select: { id: true, code: true, name: true } },
        toDesignation: { select: { id: true, code: true, name: true } },
      },
    })
    return NextResponse.json({ postings })
  } catch (e: any) {
    console.error('PT list:', e)
    return NextResponse.json({ error: 'Failed to fetch postings' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = user.activeRole || user.role
    if (['STAFF', 'REGISTRY_OFFICER'].includes(role)) {
      return NextResponse.json({ error: 'Not authorized to create postings' }, { status: 403 })
    }
    const body = await req.json()
    const {
      staffId, type, fromDepartmentId, fromUnitId, fromPosition, fromDesignationId,
      toDepartmentId, toUnitId, toPosition, toDesignationId,
      reason, detailedReason, effectiveDate, reportDeadline, handoverDate,
    } = body || {}

    if (!staffId || !reason || !effectiveDate) {
      return NextResponse.json({ error: 'staffId, reason and effectiveDate are required' }, { status: 400 })
    }

    const refNumber = await generatePTRef()
    const posting = await db.postingTransfer.create({
      data: {
        refNumber,
        staffId,
        type: type || 'posting',
        fromDepartmentId: fromDepartmentId || null,
        fromUnitId: fromUnitId || null,
        fromPosition: fromPosition || null,
        fromDesignationId: fromDesignationId || null,
        toDepartmentId: toDepartmentId || null,
        toUnitId: toUnitId || null,
        toPosition: toPosition || null,
        toDesignationId: toDesignationId || null,
        reason,
        detailedReason: detailedReason || null,
        effectiveDate: new Date(effectiveDate),
        reportDeadline: reportDeadline ? new Date(reportDeadline) : null,
        handoverDate: handoverDate ? new Date(handoverDate) : null,
        status: 'Submitted',
        state: 'open',
        createdById: user.id,
      },
      include: { staff: true },
    })

    // Notify HOD/DFA/CMD
    try {
      const approvers = await db.user.findMany({
        where: { role: { in: ['HOD', 'DFA', 'CMD', 'SUPER_ADMIN', 'ADMIN', 'CMA', 'AD'] }, isActive: true },
      })
      await db.notification.createMany({
        data: approvers.map((u) => ({
          userId: u.id,
          title: 'New posting/transfer request',
          body: `${posting.staff?.fullName || 'Staff'} — ${type || 'posting'} (${refNumber}) submitted`,
          type: 'approval',
          link: `/?view=posting-transfer`,
        })),
      })
    } catch (n) {
      console.error('PT notify failed:', n)
    }

    await audit(user, 'create', { entity: 'PostingTransfer', entityId: posting.id, details: `Created posting ${refNumber} for ${posting.staff?.fullName || 'staff'}`, ipAddress: getIp(req) })
    return NextResponse.json({ posting })
  } catch (e: any) {
    console.error('PT create:', e)
    return NextResponse.json({ error: 'Failed to create posting' }, { status: 500 })
  }
}
