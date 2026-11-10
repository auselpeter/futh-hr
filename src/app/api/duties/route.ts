import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'
import { buildScopeFilter, applyScope } from '@/lib/scope'

function computeGrade(achieved: number): string {
  if (achieved >= 90) return 'A+'
  if (achieved >= 80) return 'A'
  if (achieved >= 70) return 'B'
  if (achieved >= 60) return 'C'
  if (achieved >= 50) return 'D'
  return 'F'
}

function computeRating(achieved: number): string {
  if (achieved >= 90) return 'Outstanding'
  if (achieved >= 80) return 'Excellent'
  if (achieved >= 70) return 'Very Good'
  if (achieved >= 60) return 'Good'
  if (achieved >= 50) return 'Satisfactory'
  return 'Poor'
}

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { searchParams } = new URL(req.url)
    const staffId = searchParams.get('staffId')
    const period = searchParams.get('period')

    const where: any = {}
    if (staffId) where.staffId = staffId
    if (period) where.period = period

    // Apply role-based data scope
    const scopeWhere = buildScopeFilter(user, 'duty')
    const finalWhere = applyScope(where, scopeWhere)

    const duties = await db.duty.findMany({
      where: finalWhere,
      orderBy: [{ period: 'desc' }, { createdAt: 'desc' }],
      include: { staff: { select: { id: true, staffId: true, fullName: true, position: true } } },
    })
    return NextResponse.json({ duties })
  } catch (e: any) {
    console.error('Duties list:', e)
    return NextResponse.json({ error: 'Failed to fetch duties' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Only HOD, HOU, APPRAISAL_OFFICER, SUPER_ADMIN, ADMIN can assign/create duties.
    // STAFF cannot create duties — they can only view and upload evidence of completion.
    const role = (user as any).activeRole || user.role
    const designationCode = (user as any).designation?.code || ''
    const canManageDuties =
      ['SUPER_ADMIN', 'ADMIN', 'HOD', 'HOU', 'APPRAISAL_OFFICER'].includes(role) ||
      designationCode === 'PLANNING_OFFICER'
    if (!canManageDuties) {
      return NextResponse.json(
        { error: 'Only HOD, Head of Unit, Appraisal Officer, or Admin can assign duties. Staff can only view and upload evidence.' },
        { status: 403 },
      )
    }

    const body = await req.json()
    const { staffId, title, description, weight, targetScore, achievedScore, period, type, order, startDate, dueDate, status } = body || {}
    if (!staffId || !title) {
      return NextResponse.json({ error: 'staffId and title required' }, { status: 400 })
    }
    const achieved = achievedScore !== undefined && achievedScore !== null ? Number(achievedScore) : null
    const grade = achieved !== null ? computeGrade(achieved) : null
    const rating = achieved !== null ? computeRating(achieved) : null

    // Auto-calc durationDays from startDate + dueDate
    let durationDays: number | null = null
    if (startDate && dueDate) {
      const diff = new Date(dueDate).getTime() - new Date(startDate).getTime()
      durationDays = Math.ceil(diff / (1000 * 60 * 60 * 24))
    }

    const duty = await db.duty.create({
      data: {
        staffId, title: String(title),
        description: description || null,
        weight: Number(weight) || 1,
        targetScore: Number(targetScore) || 100,
        achievedScore: achieved,
        grade,
        rating,
        period: period || new Date().toISOString().slice(0, 7), // YYYY-MM
        type: type || 'Primary',
        order: Number(order) || 1,
        startDate: startDate ? new Date(startDate) : null,
        dueDate: dueDate ? new Date(dueDate) : null,
        durationDays,
        status: status || 'Assigned',
      },
      include: { staff: { select: { id: true, staffId: true, fullName: true } } },
    })
    await audit(user, 'create', { entity: 'Duty', entityId: duty.id, details: `Created duty ${duty.title} for ${duty.staff?.fullName || 'staff'}`, ipAddress: getIp(req) })
    return NextResponse.json({ duty })
  } catch (e: any) {
    console.error('Duty create:', e)
    return NextResponse.json({ error: 'Failed to create duty' }, { status: 500 })
  }
}
