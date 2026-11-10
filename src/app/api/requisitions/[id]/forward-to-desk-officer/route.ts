import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'
import { requisitionInclude } from '@/lib/prisma-helpers'

// POST /api/requisitions/[id]/forward-to-desk-officer
// DFA-only: when a requisition has been DFA-approved (dfaSignedAt is set),
// DFA can forward it to a Desk Officer who will then raise a Payment Voucher.
//
// Body: { deskOfficerId, remarks }
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params

    const role = user.activeRole || user.role
    // DFA / SUPER_ADMIN / ADMIN / CMD can forward to a desk officer
    const canForward = ['DFA', 'SUPER_ADMIN', 'ADMIN', 'CMD'].includes(role)
    if (!canForward) {
      return NextResponse.json({ error: 'Only DFA (or admin) can forward a requisition to a Desk Officer' }, { status: 403 })
    }

    const requisition = await db.requisition.findUnique({ where: { id } })
    if (!requisition) return NextResponse.json({ error: 'Requisition not found' }, { status: 404 })

    // Only expense requisitions are eligible (PVs are raised against expense reqs)
    if (requisition.type !== 'expense') {
      return NextResponse.json({ error: 'Only expense requisitions can be forwarded to a Desk Officer for PV preparation' }, { status: 400 })
    }

    // The requisition must have been DFA-approved (dfaSignedAt set) before forwarding
    if (!requisition.dfaSignedAt) {
      return NextResponse.json({ error: 'Requisition must be DFA-approved before forwarding to a Desk Officer' }, { status: 400 })
    }
    if (requisition.state === 'closed_permanently') {
      return NextResponse.json({ error: 'This requisition is permanently closed' }, { status: 400 })
    }

    const body = await req.json()
    const { deskOfficerId, remarks } = body || {}
    if (!deskOfficerId) {
      return NextResponse.json({ error: 'deskOfficerId is required' }, { status: 400 })
    }

    // Verify the target is a Desk Officer (designation code DESK_OFFICER)
    const deskUser = await db.user.findUnique({
      where: { id: deskOfficerId },
      include: { designation: true },
    })
    if (!deskUser || !deskUser.isActive) {
      return NextResponse.json({ error: 'Desk Officer not found or inactive' }, { status: 400 })
    }
    if (deskUser.designation?.code !== 'DESK_OFFICER') {
      return NextResponse.json({ error: 'Selected user does not hold the Desk Officer designation' }, { status: 400 })
    }

    const updated = await db.$transaction(async (tx) => {
      // Assign the requisition to the desk officer
      const r = await tx.requisition.update({
        where: { id },
        data: {
          assigneeId: deskUser.id,
          targetUserId: deskUser.id,
          targetDesignationId: null,
          status: 'Forwarded to Desk Officer',
          state: 'forwarded',
        },
        include: requisitionInclude,
      })

      // Create a RequisitionRoute row capturing this forward
      await tx.requisitionRoute.create({
        data: {
          requisitionId: id,
          fromUserId: user.id,
          toUserId: deskUser.id,
          toDesignationId: deskUser.designationId,
          action: 'forward',
          remarks: remarks || 'Forwarded to Desk Officer for Payment Voucher preparation',
          signerName: user.fullName,
          signerDesignation: user.designation?.code || role,
          signedAt: new Date(),
          acknowledgedAt: new Date(),
        },
      })

      return r
    })

    // Notify the desk officer
    try {
      await db.notification.create({
        data: {
          userId: deskUser.id,
          title: `Requisition forwarded for PV: ${requisition.refNumber}`,
          body: `${user.fullName} forwarded ${requisition.refNumber} to you for Payment Voucher preparation`,
          type: 'requisition',
          link: `requisition:${requisition.id}`,
        },
      })
    } catch (n) {
      console.error('Notify desk officer failed:', n)
    }

    await audit(user, 'forward', {
      entity: 'Requisition',
      entityId: id,
      details: `Forwarded ${requisition.refNumber} to Desk Officer ${deskUser.fullName} for PV`,
      ipAddress: getIp(req),
    })

    return NextResponse.json({ requisition: updated })
  } catch (e: any) {
    console.error('Forward to desk officer error:', e)
    return NextResponse.json({ error: e.message || 'Failed to forward to desk officer' }, { status: 500 })
  }
}
