import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'
import { buildScopeFilter, applyScope } from '@/lib/scope'

async function generatePVRef(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `PV-${year}-`
  const existing = await db.paymentVoucher.findMany({
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
    if (tab === 'pending_audit') where.status = { in: ['Draft', 'Raised', 'Pending Audit', 'Query Raised', 'Audit Approved', 'Payment Authorized'] }
    if (tab === 'mine') where.createdById = user.id
    if (tab === 'paid') where.state = 'paid'
    if (tab === 'rejected') where.state = 'rejected'
    if (q) {
      where.OR = [
        { refNumber: { contains: q } },
        { payeeName: { contains: q } },
        { voucherNumber: { contains: q } },
      ]
    }

    const scopeWhere = buildScopeFilter(user, 'paymentVoucher')
    const finalWhere = applyScope(where, scopeWhere)

    const paymentVouchers = await db.paymentVoucher.findMany({
      where: finalWhere,
      orderBy: [{ createdAt: 'desc' }],
      include: {
        requisition: { select: { id: true, refNumber: true, subject: true } },
        _count: { select: { comments: true, attachments: true } },
      },
    })
    return NextResponse.json({ paymentVouchers })
  } catch (e: any) {
    console.error('PV list:', e)
    return NextResponse.json({ error: 'Failed to fetch payment vouchers' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = user.activeRole || user.role
    if (['STAFF', 'REGISTRY_OFFICER'].includes(role)) {
      return NextResponse.json({ error: 'Not authorized to create payment vouchers' }, { status: 403 })
    }
    const body = await req.json()
    const {
      requisitionId, pvType, voteNumber, subHead, voucherNumber, classificationCode,
      departmentalNumber, payeeName, payeeAddress, payeePhone, payeeAccountNumber, payeeBankName, chequeNumber,
      amountNaira, amountKobo, amountInWords, lineItems, payableAt, paymentStation,
    } = body || {}

    if (!payeeName || amountNaira === undefined || amountNaira === '') {
      return NextResponse.json({ error: 'payeeName and amountNaira are required' }, { status: 400 })
    }

    const refNumber = await generatePVRef()
    const paymentVoucher = await db.paymentVoucher.create({
      data: {
        refNumber,
        requisitionId: requisitionId || null,
        pvType: pvType || 'treasury_f1',
        voteNumber: voteNumber || null,
        subHead: subHead || null,
        voucherNumber: voucherNumber || null,
        classificationCode: classificationCode || null,
        departmentalNumber: departmentalNumber || null,
        payeeName,
        payeeAddress: payeeAddress || null,
        payeePhone: payeePhone || null,
        payeeAccountNumber: payeeAccountNumber || null,
        payeeBankName: payeeBankName || null,
        chequeNumber: chequeNumber || null,
        amountNaira: Number(amountNaira) || 0,
        amountKobo: Number(amountKobo) || 0,
        amountInWords: amountInWords || null,
        lineItems: lineItems || null,
        payableAt: payableAt || null,
        paymentStation: paymentStation || null,
        status: 'Draft',
        state: 'open',
        createdById: user.id,
      },
      include: { requisition: { select: { refNumber: true, subject: true } } },
    })

    // Notify DFA / Audit users
    try {
      const targets = await db.user.findMany({
        where: { role: { in: ['DFA', 'SUPER_ADMIN', 'ADMIN'] }, isActive: true },
      })
      await db.notification.createMany({
        data: targets.map((u) => ({
          userId: u.id,
          title: 'New payment voucher',
          body: `PV ${refNumber} for ${payeeName} — ${Number(amountNaira).toLocaleString()} NGN`,
          type: 'approval',
          link: `/?view=payment-vouchers`,
        })),
      })
    } catch (n) {
      console.error('PV notify failed:', n)
    }

    await audit(user, 'create', { entity: 'PaymentVoucher', entityId: paymentVoucher.id, details: `Created PV ${refNumber} for ${payeeName}`, ipAddress: getIp(req) })
    return NextResponse.json({ paymentVoucher })
  } catch (e: any) {
    console.error('PV create:', e)
    return NextResponse.json({ error: 'Failed to create payment voucher' }, { status: 500 })
  }
}
