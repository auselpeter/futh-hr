import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'
//import { computeGrade } from '../route'

// POST /api/duties/[id]/review
// Body: { achievedScore: number, remarks: string, signatureUrl?: string, decision?: 'approve' | 'reject' }
// Only HOU, HOD, APPRAISAL_OFFICER, SUPER_ADMIN, ADMIN can review.
// Sets: achievedScore, grade (auto-calc), reviewedById, reviewedByName,

//       reviewedAt, reviewRemarks, status=Approved (or Rejected if score < 50)

function computeGrade(achieved: number): string {
  if (achieved >= 90) return 'A+'
  if (achieved >= 80) return 'A'
  if (achieved >= 70) return 'B'
  if (achieved >= 60) return 'C'
  if (achieved >= 50) return 'D'
  return 'F'
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const body = await req.json()
    const { achievedScore, remarks } = body || {}

    if (achievedScore === undefined || achievedScore === null) {
      return NextResponse.json({ error: 'achievedScore is required' }, { status: 400 })
    }
    const score = Number(achievedScore)
    if (isNaN(score) || score < 0 || score > 100) {
      return NextResponse.json({ error: 'achievedScore must be a number 0-100' }, { status: 400 })
    }

    const role = user.activeRole || user.role
    const ALLOWED_REVIEWERS = ['SUPER_ADMIN', 'ADMIN', 'HOD', 'HOU', 'APPRAISAL_OFFICER', 'CMD', 'CMA', 'AD', 'DFA']
    if (!ALLOWED_REVIEWERS.includes(role)) {
      return NextResponse.json({ error: 'Your role cannot review duties' }, { status: 403 })
    }

    const existing = await db.duty.findUnique({
      where: { id },
      include: { staff: true },
    })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Must be Completed to be reviewable (admins can override)
    if (existing.status !== 'Completed' && !['SUPER_ADMIN', 'ADMIN'].includes(role)) {
      return NextResponse.json(
        { error: `Duty must be in 'Completed' status to review (currently '${existing.status}')` },
        { status: 400 },
      )
    }

    // Scope check: HOD/HOU can only review duties of staff in their dept/unit
    const myUnitId = user.staff?.unitId || null
    const myDeptId = user.departmentId
    const inScope =
      ['SUPER_ADMIN', 'ADMIN', 'APPRAISAL_OFFICER', 'CMD', 'CMA', 'AD', 'DFA'].includes(role) ||
      (role === 'HOD' && existing.staff?.departmentId === myDeptId) ||
      (role === 'HOU' && (existing.staff?.unitId === myUnitId || existing.staff?.departmentId === myDeptId))
    if (!inScope) {
      return NextResponse.json({ error: 'You can only review duties of staff in your department/unit' }, { status: 403 })
    }

    const grade = computeGrade(score)
    // Status: Approved if score >= 50, Rejected otherwise (reviewer can also pass
    // an explicit `decision` field to override — e.g. reject a 90-score duty for
    // quality reasons).
    const decision = (body.decision as string | undefined)?.toLowerCase()
    const newStatus =
      decision === 'reject' ? 'Rejected'
      : decision === 'approve' ? 'Approved'
      : (score >= 50 ? 'Approved' : 'Rejected')

    const updated = await db.duty.update({
      where: { id },
      data: {
        achievedScore: score,
        grade,
        reviewedById: user.id,
        reviewedByName: user.fullName,
        reviewedAt: new Date(),
        reviewRemarks: remarks || null,
        scoreNotes: remarks || null,
        status: newStatus,
      },
      include: {
        staff: { select: { id: true, fullName: true, staffId: true } },
      },
    })

    await audit(user, 'approve', {
      entity: 'Duty',
      entityId: id,
      details: `Reviewed duty "${existing.title}" → score=${score}, grade=${grade}, status=${newStatus}`,
      ipAddress: getIp(req),
    })

    return NextResponse.json({ duty: updated })
  } catch (e: any) {
    console.error('Duty review:', e)
    return NextResponse.json({ error: 'Failed to review duty' }, { status: 500 })
  }
}
