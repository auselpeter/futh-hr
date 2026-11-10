import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'
import { buildScopeFilter, applyScope } from '@/lib/scope'

async function generateRetirementRef(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `RTM-${year}-`
  const existing = await db.retirement.findMany({
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
      if (role === 'HOD' || role === 'HOU') where.status = 'Submitted'
      else if (role === 'DFA') where.status = 'HOD Approved'
      else if (role === 'CMD') where.status = 'DFA Approved'
      else where.status = { in: ['Submitted', 'HOD Approved', 'DFA Approved'] }
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
    const scopeWhere = buildScopeFilter(user, 'retirement')
    const finalWhere = applyScope(where, scopeWhere)

    const retirements = await db.retirement.findMany({
      where: finalWhere,
      orderBy: [{ createdAt: 'desc' }],
      include: {
        staff: {
          select: { id: true, staffId: true, fullName: true, position: true, rank: true, department: { select: { id: true, code: true, name: true } } },
        },
      },
    })
    return NextResponse.json({ retirements })
  } catch (e: any) {
    console.error('Retirements list:', e)
    return NextResponse.json({ error: 'Failed to fetch retirements' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = user.activeRole || user.role
    if (['STAFF', 'REGISTRY_OFFICER'].includes(role)) {
      return NextResponse.json({ error: 'Not authorized to create retirements' }, { status: 403 })
    }
    const body = await req.json()
    const {
      staffId, type, reason, detailedReason, dateOfBirth, retirementDate, lastWorkingDate,
      yearsOfService, dateOfFirstAppointment, currentSalaryAtRetirement, gradeLevelAtRetirement,
      gratuityAmount, pensionBalance, leaveEncashment, pensionAdministrator, pensionPin,
      nhfRefundAmount, nhisRefundAmount, clearanceFormUrl,
    } = body || {}

    if (!staffId || !retirementDate || !reason) {
      return NextResponse.json({ error: 'staffId, retirementDate and reason are required' }, { status: 400 })
    }

    const refNumber = await generateRetirementRef()
    const retirement = await db.retirement.create({
      data: {
        refNumber,
        staffId,
        type: type || 'compulsory',
        reason,
        detailedReason: detailedReason || null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        retirementDate: new Date(retirementDate),
        lastWorkingDate: lastWorkingDate ? new Date(lastWorkingDate) : null,
        yearsOfService: yearsOfService ? Number(yearsOfService) : null,
        dateOfFirstAppointment: dateOfFirstAppointment ? new Date(dateOfFirstAppointment) : null,
        currentSalaryAtRetirement: currentSalaryAtRetirement ? Number(currentSalaryAtRetirement) : null,
        gradeLevelAtRetirement: gradeLevelAtRetirement || null,
        gratuityAmount: gratuityAmount ? Number(gratuityAmount) : null,
        pensionBalance: pensionBalance ? Number(pensionBalance) : null,
        leaveEncashment: leaveEncashment ? Number(leaveEncashment) : null,
        pensionAdministrator: pensionAdministrator || null,
        pensionPin: pensionPin || null,
        nhfRefundAmount: nhfRefundAmount ? Number(nhfRefundAmount) : null,
        nhisRefundAmount: nhisRefundAmount ? Number(nhisRefundAmount) : null,
        clearanceFormUrl: clearanceFormUrl || null,
        status: 'Submitted',
        state: 'open',
        createdById: user.id,
      },
      include: { staff: true },
    })

    try {
      const approvers = await db.user.findMany({
        where: { role: { in: ['HOD', 'DFA', 'CMD', 'SUPER_ADMIN', 'ADMIN'] }, isActive: true },
      })
      await db.notification.createMany({
        data: approvers.map((u) => ({
          userId: u.id,
          title: 'New retirement application',
          body: `${retirement.staff?.fullName || 'Staff'} — ${type || 'retirement'} (${refNumber})`,
          type: 'approval',
          link: `/?view=retirements`,
        })),
      })
    } catch (n) {
      console.error('Retirement notify failed:', n)
    }

    await audit(user, 'create', { entity: 'Retirement', entityId: retirement.id, details: `Created retirement ${refNumber} for ${retirement.staff?.fullName || 'staff'}`, ipAddress: getIp(req) })
    return NextResponse.json({ retirement })
  } catch (e: any) {
    console.error('Retirement create:', e)
    return NextResponse.json({ error: 'Failed to create retirement' }, { status: 500 })
  }
}
