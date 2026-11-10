import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const requisition = await db.requisition.findUnique({ where: { id } })
    if (!requisition) return NextResponse.json({ error: 'Requisition not found' }, { status: 404 })

    const body = await req.json()
    const { body: commentBody } = body || {}
    if (!commentBody || !String(commentBody).trim()) {
      return NextResponse.json({ error: 'Comment cannot be empty' }, { status: 400 })
    }
    const comment = await db.requisitionComment.create({
      data: {
        requisitionId: id,
        userId: user.id,
        body: String(commentBody).trim(),
      },
      include: { user: { include: { designation: true } } },
    })
    // Notify creator / assignee
    const notifyTargets = new Set<string>()
    if (requisition.createdById !== user.id) notifyTargets.add(requisition.createdById)
    if (requisition.assigneeId && requisition.assigneeId !== user.id) notifyTargets.add(requisition.assigneeId)
    for (const uid of Array.from(notifyTargets)) {
      await db.notification.create({
        data: {
          userId: uid,
          title: `New comment on ${requisition.refNumber}`,
          body: `${user.fullName}: ${String(commentBody).trim().slice(0, 80)}`,
          type: 'requisition',
          link: `requisition:${id}`,
        },
      })
    }
    await audit(user, 'create', { entity: 'RequisitionComment', entityId: comment.id, details: `Commented on ${requisition.refNumber}: ${String(commentBody).slice(0, 80)}`, ipAddress: getIp(req) })
    return NextResponse.json({ comment })
  } catch (e: any) {
    console.error('Comment error:', e)
    return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 })
  }
}
