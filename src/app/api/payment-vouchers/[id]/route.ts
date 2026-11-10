import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { buildScopeFilter, applyScope } from '@/lib/scope'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params

    const pv = await db.paymentVoucher.findUnique({
      where: { id },
      include: {
        requisition: { select: { id: true, refNumber: true, subject: true, description: true } },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: { user: { select: { id: true, fullName: true, role: true } } },
        },
        attachments: true,
      },
    })
    if (!pv) return NextResponse.json({ error: 'Payment voucher not found' }, { status: 404 })

    const scopeWhere = buildScopeFilter(user, 'paymentVoucher')
    const finalWhere = applyScope({ id }, scopeWhere)
    const accessible = await db.paymentVoucher.findFirst({ where: finalWhere, select: { id: true } })
    if (!accessible) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    return NextResponse.json({ paymentVoucher: pv })
  } catch (e: any) {
    console.error('PV get:', e)
    return NextResponse.json({ error: 'Failed to fetch payment voucher' }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const body = await req.json()

    const existing = await db.paymentVoucher.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Payment voucher not found' }, { status: 404 })

    const role = user.activeRole || user.role
    const isCreator = existing.createdById === user.id
    const isPrivileged = ['SUPER_ADMIN', 'ADMIN', 'CMD', 'DFA', 'AD', 'HOD'].includes(role)
    if (!isCreator && !isPrivileged) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }
    if (!['Draft', 'Raised'].includes(existing.status)) {
      return NextResponse.json({ error: 'Cannot edit a PV that is already in audit' }, { status: 400 })
    }

    const allowedKeys = [
      'pvType', 'voteNumber', 'subHead', 'voucherNumber', 'classificationCode',
      'departmentalNumber', 'payeeName', 'payeeAddress', 'payeePhone', 'chequeNumber',
      'amountNaira', 'amountKobo', 'amountInWords', 'lineItems', 'payableAt', 'paymentStation',
    ]
    const data: any = {}
    for (const k of allowedKeys) {
      if (body[k] !== undefined) {
        if (['amountNaira', 'amountKobo'].includes(k)) data[k] = Number(body[k]) || 0
        else data[k] = body[k] === '' ? null : body[k]
      }
    }

    const updated = await db.paymentVoucher.update({ where: { id }, data })
    return NextResponse.json({ paymentVoucher: updated })
  } catch (e: any) {
    console.error('PV patch:', e)
    return NextResponse.json({ error: 'Failed to update payment voucher' }, { status: 500 })
  }
}
