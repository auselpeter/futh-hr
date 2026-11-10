import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'
import { buildScopeFilter, applyScope } from '@/lib/scope'

async function generateResignationRef(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `RSG-${year}-`
  const existing = await db.resignation.findMany({
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
    if (tab === 'mine') {
      // My own = created by me OR where I'm the staff
      where.OR = [
        { createdById: user.id },
        { staff: { userId: user.id } },
      ]
    }
    if (tab === 'pending_my_approval') {
      const role = user.activeRole || user.role
      if (role === 'HOD' || role === 'HOU') where.status = 'Submitted'
      else if (role === 'DFA') where.status = 'HOD Acknowledged'
      else if (role === 'CMD') where.status = 'DFA Approved'
      else where.status = { in: ['Submitted', 'HOD Acknowledged', 'DFA Approved'] }
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

    const scopeWhere = buildScopeFilter(user, 'resignation')
    const finalWhere = applyScope(where, scopeWhere)

    const resignations = await db.resignation.findMany({
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
    return NextResponse.json({ resignations })
  } catch (e: any) {
    console.error('Resignations list:', e)
    return NextResponse.json({ error: 'Failed to fetch resignations' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = user.activeRole || user.role
    const body = await req.json()
    const {
      staffId, reason, detailedReason,
      resignationDate, noticeDate, effectiveDate, lastWorkingDate,
      finalSalary, gratuityAmount, pensionBalance, leaveEncashment,
      clearanceFormUrl,
    } = body || {}

    if (!staffId || !effectiveDate || !reason) {
      return NextResponse.json({ error: 'staffId, effectiveDate and reason are required' }, { status: 400 })
    }

    // STAFF role can only create resignations for themselves
    if (role === 'STAFF') {
      const me = await db.staff.findUnique({ where: { userId: user.id } })
      if (!me || me.id !== staffId) {
        return NextResponse.json({ error: 'As STAFF you can only submit resignations for yourself' }, { status: 403 })
      }
    }

    const refNumber = await generateResignationRef()
    const resignation = await db.resignation.create({
      data: {
        refNumber,
        staffId,
        reason,
        detailedReason: detailedReason || null,
        resignationDate: resignationDate ? new Date(resignationDate) : new Date(),
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
          title: 'New resignation submitted',
          body: `${resignation.staff?.fullName || 'Staff'} — resignation (${refNumber}) submitted for acknowledgement`,
          type: 'approval',
          link: `/?view=resignations`,
        })),
      })
    } catch (n) {
      console.error('Resignation notify failed:', n)
    }

    await audit(user, 'create', { entity: 'Resignation', entityId: resignation.id, details: `Created resignation ${resignation.refNumber} for ${resignation.staff?.fullName || 'staff'}`, ipAddress: getIp(req) })

    return NextResponse.json({ resignation })
  } catch (e: any) {
    console.error('Resignation create:', e)
    return NextResponse.json({ error: 'Failed to create resignation' }, { status: 500 })
  }
}
