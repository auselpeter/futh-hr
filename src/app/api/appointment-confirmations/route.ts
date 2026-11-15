import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'
import { buildScopeFilter, applyScope } from '@/lib/scope'

// Generate next ref number in the format FUTH/CONF/{YEAR}/{SEQ:06d}
// e.g. FUTH/CONF/2026/000001
async function generateConfirmationRef(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `FUTH/CONF/${year}/`
  const existing = await db.appointmentConfirmation.findMany({
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

// GET /api/appointment-confirmations?tab=all|mine|pending_my_approval|approved|rejected&q=...
// Returns list of appointment confirmations filtered by tab + scope.
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
        { currentPosition: { contains: q } },
        { currentRank: { contains: q } },
      ]
    }

    const scopeWhere = buildScopeFilter(user, 'appointmentConfirmation')
    const finalWhere = applyScope(where, scopeWhere)

    const confirmations = await db.appointmentConfirmation.findMany({
      where: finalWhere,
      orderBy: [{ createdAt: 'desc' }],
      include: {
        staff: {
          select: {
            id: true, staffId: true, fullName: true, position: true, rank: true,
            dateHired: true, confirmationDate: true, retirementDate: true,
            department: { select: { id: true, code: true, name: true } },
          },
        },
      },
    })
    return NextResponse.json({ confirmations })
  } catch (e: any) {
    console.error('Appointment confirmations list:', e)
    return NextResponse.json({ error: 'Failed to fetch appointment confirmations' }, { status: 500 })
  }
}

// POST /api/appointment-confirmations
// Body: { staffId, dateOfFirstAppointment?, dateHired?, serviceYearsRequired?, currentPosition?, currentRank?, currentGradeLevel?, currentDepartmentId?, newGradeLevel?, newStep?, confirmationLetterUrl?, assessmentFormUrl?, remarks?, justification?, expectedConfirmationDate? }
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = user.activeRole || user.role
    if (role === 'STAFF') {
      return NextResponse.json({ error: 'Not authorized to create appointment confirmation records' }, { status: 403 })
    }

    const body = await req.json()
    const {
      staffId, dateOfFirstAppointment, dateHired, serviceYearsRequired,
      currentPosition, currentRank, currentGradeLevel, currentDepartmentId,
      newGradeLevel, newStep, confirmationLetterUrl, assessmentFormUrl,
      remarks, justification, expectedConfirmationDate,
    } = body || {}

    if (!staffId) {
      return NextResponse.json({ error: 'staffId is required' }, { status: 400 })
    }

    const staff = await db.staff.findUnique({
      where: { id: staffId },
      include: { department: { select: { id: true, code: true, name: true } } },
    })
    if (!staff) {
      return NextResponse.json({ error: 'Staff record not found' }, { status: 404 })
    }

    // Auto-fill from the staff record where the caller didn't provide values
    const serviceYears = typeof serviceYearsRequired === 'number' ? serviceYearsRequired : 2
    const firstAppointmentDate = dateOfFirstAppointment ? new Date(dateOfFirstAppointment) : (staff.dateHired ?? null)
    const hireDate = dateHired ? new Date(dateHired) : (staff.dateHired ?? null)

    // Compute expectedConfirmationDate = firstAppointmentDate + serviceYears
    // unless the caller explicitly provided one.
    let expectedDate: Date | null = null
    if (expectedConfirmationDate) {
      expectedDate = new Date(expectedConfirmationDate)
    } else if (firstAppointmentDate) {
      expectedDate = new Date(firstAppointmentDate)
      expectedDate.setFullYear(expectedDate.getFullYear() + serviceYears)
    }

    const refNumber = await generateConfirmationRef()
    const confirmation = await db.appointmentConfirmation.create({
      data: {
        refNumber,
        staffId,
        dateOfFirstAppointment: firstAppointmentDate,
        dateHired: hireDate,
        expectedConfirmationDate: expectedDate,
        serviceYearsRequired: serviceYears,
        currentPosition: currentPosition || staff.position || null,
        currentRank: currentRank || staff.rank || null,
        currentGradeLevel: currentGradeLevel || staff.gradeLevel || null,
        currentDepartmentId: currentDepartmentId || staff.departmentId || null,
        newGradeLevel: newGradeLevel || null,
        newStep: newStep || null,
        confirmationLetterUrl: confirmationLetterUrl || null,
        assessmentFormUrl: assessmentFormUrl || null,
        remarks: remarks || null,
        justification: justification || null,
        status: 'Submitted',
        state: 'open',
        createdById: user.id,
      },
      include: { staff: true },
    })

    // Notify HOD/DFA/CMD about the new confirmation request (best-effort)
    try {
      const approvers = await db.user.findMany({
        where: { role: { in: ['HOD', 'DFA', 'CMD', 'SUPER_ADMIN', 'ADMIN'] }, isActive: true },
      })
      await db.notification.createMany({
        data: approvers.map((u) => ({
          userId: u.id,
          title: 'New appointment confirmation request',
          body: `${staff.fullName} — confirmation request (${refNumber}) submitted for approval`,
          type: 'approval',
          link: `/?view=appointment-confirmations`,
        })),
      })
    } catch (n) {
      console.error('Appointment confirmation notify failed:', n)
    }

    await audit(user, 'create', {
      entity: 'AppointmentConfirmation',
      entityId: confirmation.id,
      details: `Created appointment confirmation ${refNumber} for ${staff.fullName} (expected: ${expectedDate ? expectedDate.toISOString().slice(0, 10) : '—'})`,
      ipAddress: getIp(req),
    })

    return NextResponse.json({ confirmation })
  } catch (e: any) {
    console.error('Appointment confirmation create:', e)
    return NextResponse.json({ error: 'Failed to create appointment confirmation' }, { status: 500 })
  }
}
