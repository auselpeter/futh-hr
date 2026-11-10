// Seed script for payment voucher samples + audit workflow data
// Run with: bun run /home/z/my-project/scripts/seed-pv.ts

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  console.log('Seeding payment voucher samples...')

  const dfaUser = await db.user.findUnique({ where: { username: 'dfa' } })
  const hodIctUser = await db.user.findUnique({ where: { username: 'hod_ict' } })
  const adminUser = await db.user.findFirst({ where: { role: 'SUPER_ADMIN' } })
  const auditUser = await db.user.findFirst({ where: { role: 'ADMIN' } })

  if (!dfaUser && !adminUser) {
    console.log('⚠ No DFA or admin user found — skipping PV seed')
    return
  }
  const creator = dfaUser || adminUser
  if (!creator) return

  const reqs = await db.requisition.findMany({ where: { type: 'expense' } })

  const samples = [
    {
      pvType: 'treasury_f1', voucherNumber: 'V-2026-0001', voteNumber: 'V0120501', subHead: 'SH-2204',
      payeeName: 'MediTech Nigeria Ltd', payeeAddress: '12 Adeola Odeku St, Victoria Island, Lagos', payeePhone: '+234 803 555 1234',
      amountNaira: 850000, amountInWords: 'Eight hundred and fifty thousand naira only',
      lineItems: 'Medical equipment supply (5 patient monitors + 3 ventilators)',
      payableAt: 'FUTH Lafia', paymentStation: 'Finance Office',
      status: 'Pending Audit', requisitionIdx: 0,
    },
    {
      pvType: 'treasury_f1', voucherNumber: 'V-2026-0002', voteNumber: 'V0120502', subHead: 'SH-2205',
      payeeName: 'John Idris', payeeAddress: 'Staff Quarters, FUTH Lafia', payeePhone: '+234 805 666 7890',
      amountNaira: 250000, amountInWords: 'Two hundred and fifty thousand naira only',
      lineItems: 'Imprest for staff training in Lagos',
      payableAt: 'FUTH Lafia', paymentStation: 'Finance Office',
      status: 'Audit Reviewed', requisitionIdx: 1,
    },
    {
      pvType: 'contract', voucherNumber: 'V-2026-0003', voteNumber: 'V0120503', subHead: 'SH-2206',
      payeeName: 'BuildWell Construction Ltd', payeeAddress: 'Plot 7, Industrial Layout, Kano', payeePhone: '+234 802 111 2222',
      amountNaira: 12500000, amountInWords: 'Twelve million, five hundred thousand naira only',
      lineItems: 'Construction of new ICU ward — phase 1 (site preparation and foundation)',
      payableAt: 'FUTH Lafia', paymentStation: 'Finance Office',
      status: 'Payment Authorized', requisitionIdx: -1,
    },
    {
      pvType: 'treasury_f1', voucherNumber: 'V-2026-0004', voteNumber: 'V0120501', subHead: 'SH-2204',
      payeeName: 'Power Energy Nig. Ltd', payeeAddress: '15 Marafa Estate, Kaduna', payeePhone: '+234 803 999 0000',
      amountNaira: 1450000, amountInWords: 'One million, four hundred and fifty thousand naira only',
      lineItems: 'Supply and installation of 250KVA standby generator',
      payableAt: 'FUTH Lafia', paymentStation: 'Finance Office',
      status: 'Paid', requisitionIdx: -1,
    },
    {
      pvType: 'refund', voucherNumber: 'V-2026-0005', voteNumber: 'V0120504', subHead: 'SH-2207',
      payeeName: 'Mr. Peter Ade', payeeAddress: 'FUTH Staff Quarters', payeePhone: '+234 801 234 5678',
      amountNaira: 85000, amountInWords: 'Eighty-five thousand naira only',
      lineItems: 'Reimbursement for workshop registration fee',
      payableAt: 'FUTH Lafia', paymentStation: 'Finance Office',
      status: 'Draft', requisitionIdx: -1,
    },
  ]

  let pvCount = 0
  for (const s of samples) {
    const refNumber = `PV-${new Date().getFullYear()}-${String(++pvCount).padStart(6, '0')}`
    const existing = await db.paymentVoucher.findUnique({ where: { refNumber } })
    if (existing) continue

    const requisitionId = s.requisitionIdx >= 0 && reqs[s.requisitionIdx] ? reqs[s.requisitionIdx].id : null
    const data: any = {
      refNumber,
      requisitionId,
      pvType: s.pvType,
      voucherNumber: s.voucherNumber,
      voteNumber: s.voteNumber,
      subHead: s.subHead,
      payeeName: s.payeeName,
      payeeAddress: s.payeeAddress,
      payeePhone: s.payeePhone,
      amountNaira: s.amountNaira,
      amountInWords: s.amountInWords,
      lineItems: s.lineItems,
      payableAt: s.payableAt,
      paymentStation: s.paymentStation,
      status: s.status,
      state: s.status === 'Paid' ? 'paid' : s.status === 'Rejected' ? 'rejected' : 'open',
      createdById: creator.id,
    }

    // Add workflow fields based on status
    if (s.status !== 'Draft') {
      data.deskOfficerId = (hodIctUser || creator).id
      data.deskOfficerName = (hodIctUser || creator).fullName
      data.raisedAt = new Date(Date.now() - 5 * 86400000)
    }
    if (s.status === 'Audit Reviewed' || s.status === 'Payment Authorized' || s.status === 'Paid') {
      data.auditOfficerId = (auditUser || creator).id
      data.auditOfficerName = (auditUser || creator).fullName
      data.auditComments = 'Documents verified and amounts correct.'
      data.auditReviewedAt = new Date(Date.now() - 4 * 86400000)
    }
    if (s.status === 'Payment Authorized' || s.status === 'Paid') {
      data.auditApprovedAt = new Date(Date.now() - 3 * 86400000)
      data.dfaApprovedPV = true
      data.dfaApprovedAt = new Date(Date.now() - 2 * 86400000)
      data.paymentAuthorizedAt = new Date(Date.now() - 1 * 86400000)
    }
    if (s.status === 'Paid') {
      data.payingOfficerId = creator.id
      data.payingOfficerName = creator.fullName
      data.paidAt = new Date(Date.now() - 12 * 3600000)
      data.paidBy = creator.id
    }
    await db.paymentVoucher.create({ data })

    // Add a comment for non-draft PVs
    if (s.status !== 'Draft' && auditUser) {
      await db.pVComment.create({
        data: {
          pvId: (await db.paymentVoucher.findUnique({ where: { refNumber } }))?.id || '',
          userId: auditUser.id,
          body: 'Voucher reviewed and supporting documents verified.',
          type: 'audit',
        },
      }).catch(() => {})
    }
  }
  console.log(`✓ ${samples.length} payment voucher samples seeded`)

  console.log('Payment voucher seeding complete!')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await db.$disconnect() })
