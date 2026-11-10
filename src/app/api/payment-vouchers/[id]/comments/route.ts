import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const body = await req.json()
    const text = body.body
    if (!text || !text.trim()) return NextResponse.json({ error: 'Comment body is required' }, { status: 400 })

    const pv = await db.paymentVoucher.findUnique({ where: { id } })
    if (!pv) return NextResponse.json({ error: 'Payment voucher not found' }, { status: 404 })

    const comment = await db.pVComment.create({
      data: {
        pvId: id,
        userId: user.id,
        body: text.trim(),
        type: body.type || 'comment',
      },
      include: { user: { select: { id: true, fullName: true, role: true } } },
    })
    await audit(user, 'create', { entity: 'PVComment', entityId: comment.id, details: `Commented on PV ${pv.refNumber}`, ipAddress: getIp(req) })
    return NextResponse.json({ comment })
  } catch (e: any) {
    console.error('PV comment:', e)
    return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 })
  }
}
