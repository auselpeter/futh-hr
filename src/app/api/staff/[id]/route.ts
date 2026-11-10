import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, isAdmin, isRegistry } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'

const fullInclude = {
  department: true,
  designation: true,
  user: { select: { id: true, username: true, role: true, isActive: true } },
  nextOfKin: true,
  bankDetails: true,
  academicBackground: true,
  dependants: true,
  duties: { orderBy: [{ period: 'desc' }] },
  annualReviews: { orderBy: [{ period: 'desc' }], take: 5 },
  monthlyAppraisals: { orderBy: [{ year: 'desc' }, { month: 'desc' }], take: 12 },
  quarterlyReviews: { orderBy: [{ year: 'desc' }, { quarter: 'desc' }], take: 4 },
  assessments: { orderBy: [{ period: 'desc' }], take: 5 },
  appraisals: { orderBy: [{ period: 'desc' }], take: 5 },
  leaves: { orderBy: [{ createdAt: 'desc' }], take: 10, include: { leaveType: true } },
} as const

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const staff = await db.staff.findUnique({ where: { id }, include: fullInclude })
    if (!staff) return NextResponse.json({ error: 'Staff not found' }, { status: 404 })
    return NextResponse.json({ staff })
  } catch (e: any) {
    console.error('Staff GET error:', e)
    return NextResponse.json({ error: 'Failed to fetch staff' }, { status: 500 })
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const effectiveRole = user.activeRole || user.role
    if (!isAdmin(effectiveRole) && !isRegistry(effectiveRole)) {
      return NextResponse.json({ error: 'Only administrators or Registry Officers can edit staff records' }, { status: 403 })
    }
    const { id } = await params
    const body = await req.json()

    const allowed = [
      'ippisNumber', 'surname', 'firstName', 'otherNames', 'gender', 'email', 'phone', 'altPhone',
      'dateOfBirth', 'maritalStatus', 'nationality', 'religion', 'stateOfOrigin', 'lga',
      'ninNumber', 'tinNumber', 'pensionNumber', 'nhfNumber', 'nhisNumber',
      'residentialAddress', 'permanentAddress', 'cityOfResidence', 'stateOfResidence',
      'position', 'rank', 'employmentType', 'dateHired', 'confirmationDate', 'retirementDate',
      'status', 'departmentId', 'designationId', 'unitId',
      'fileNumber', 'gradeLevel', 'step', 'cadre',
      'avatarUrl', 'signatureUrl', 'thumbprintUrl', 'pictureUrl',
    ]
    const dateFields = ['dateHired', 'dateOfBirth', 'confirmationDate', 'retirementDate']
    // Foreign-key fields — empty strings must become null (otherwise Prisma throws
    // a foreign-key constraint violation because '' isn't a valid Department/Designation id).
    const nullableIdFields = ['departmentId', 'designationId']
    const data: any = {}
    for (const k of allowed) {
      if (body[k] !== undefined) {
        if (dateFields.includes(k)) {
          if (body[k] === null || body[k] === '') data[k] = null
          else data[k] = new Date(body[k])
        } else if (body[k] === null) {
          data[k] = null
        } else if (nullableIdFields.includes(k) && body[k] === '') {
          data[k] = null
        } else {
          data[k] = String(body[k])
        }
      }
    }

    // Recompute fullName
    if (data.surname !== undefined || data.firstName !== undefined || data.otherNames !== undefined) {
      const existing = await db.staff.findUnique({ where: { id } })
      if (existing) {
        const fn = data.firstName ?? existing.firstName
        const on = data.otherNames !== undefined ? data.otherNames : existing.otherNames
        const sn = data.surname ?? existing.surname
        data.fullName = on ? `${fn} ${on} ${sn}` : `${fn} ${sn}`
      }
    }

    const staff = await db.staff.update({
      where: { id },
      data,
      include: {
        department: true, designation: true,
        user: { select: { id: true, username: true, role: true, isActive: true } },
      },
    })
    await audit(user, 'update', { entity: 'Staff', entityId: id, details: `Updated staff record: ${staff.fullName}`, ipAddress: getIp(req) })
    return NextResponse.json({ staff })
  } catch (e: any) {
    console.error('Update staff error:', e)
    return NextResponse.json({ error: 'Failed to update staff record' }, { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const effectiveRole = user.activeRole || user.role
    if (!isAdmin(effectiveRole) && !isRegistry(effectiveRole)) {
      return NextResponse.json({ error: 'Only administrators or Registry Officers can delete staff records' }, { status: 403 })
    }

    const { id } = await params
    const { searchParams } = new URL(req.url)
    const deleteUserToo = searchParams.get('deleteUser') === 'true'

    const existing = await db.staff.findUnique({
      where: { id },
      include: { user: { select: { id: true, username: true, fullName: true } } },
    })
    if (!existing) return NextResponse.json({ error: 'Staff not found' }, { status: 404 })

    const staffFullName = existing.fullName
    const staffIdValue = existing.staffId
    const linkedUserId = existing.user?.id
    const linkedUserUsername = existing.user?.username

    // Use a transaction to:
    //   1. Null-out the User.staffId link on the linked user (so we can safely delete the Staff record
    //      even if Prisma's SetNull default doesn't apply for some driver edge case)
    //   2. Optionally delete the linked User account too (only if deleteUserToo=true)
    //   3. Delete the Staff record — all related records (NextOfKin, BankDetail, AcademicBackground,
    //      Dependant, Duty, AnnualReview, MonthlyAppraisal, QuarterlyReview, Assessment, Appraisal,
    //      Leave, Promotion, Termination, Resignation, Retirement, PostingTransfer, TrainingEnrollment,
    //      ProjectMember, etc.) cascade-delete via Prisma schema's onDelete: Cascade.
    await db.$transaction(async (tx) => {
      if (linkedUserId) {
        await tx.user.update({
          where: { id: linkedUserId },
          data: { staffId: null },
        })
        if (deleteUserToo) {
          await tx.user.delete({ where: { id: linkedUserId } })
        }
      }
      await tx.staff.delete({ where: { id } })
    })

    await audit(user, 'delete', {
      entity: 'Staff',
      entityId: id,
      details: `Deleted staff record: ${staffFullName} (${staffIdValue})${deleteUserToo && linkedUserId ? ` + linked user ${linkedUserUsername}` : ''}`,
      ipAddress: getIp(req),
    })

    return NextResponse.json({
      success: true,
      deleted: { staffId: id, staffFullName, staffIdValue, linkedUserId: deleteUserToo ? linkedUserId : null, linkedUserUsername: deleteUserToo ? linkedUserUsername : null },
    })
  } catch (e: any) {
    console.error('Delete staff error:', e)
    return NextResponse.json({ error: 'Failed to delete staff record' }, { status: 500 })
  }
}
