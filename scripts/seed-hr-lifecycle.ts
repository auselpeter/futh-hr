// Seed script: add sample promotion, termination, resignation records
// Run with: bun run /home/z/my-project/scripts/seed-hr-lifecycle.ts

import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

async function main() {
  console.log('Seeding HR lifecycle sample data...')

  const staff1 = await db.staff.findFirst({ where: { staffId: 'FUTH/001' } })
  const staff2 = await db.staff.findFirst({ where: { staffId: 'FUTH/002' } })
  const staff3 = await db.staff.findFirst({ where: { staffId: 'FUTH/003' } })
  const hodSurgUser = await db.user.findUnique({ where: { username: 'hod_surg' } })
  const dfaUser = await db.user.findUnique({ where: { username: 'dfa' } })
  const cmdUser = await db.user.findUnique({ where: { username: 'cmd' } })

  // Sample Promotion
  if (staff1 && hodSurgUser) {
    const existing = await db.promotion.findUnique({ where: { refNumber: 'PRM-2026-000001' } })
    if (!existing) {
      await db.promotion.create({
        data: {
          refNumber: 'PRM-2026-000001',
          staffId: staff1.id,
          currentPosition: 'ICT Officer',
          currentRank: 'Officer',
          currentSalary: 120000,
          newPosition: 'Senior ICT Officer',
          newRank: 'Senior Officer',
          newSalary: 180000,
          type: 'promotion',
          effectiveDate: new Date(2026, 0, 1),
          reason: 'Excellent performance review for 2025',
          justification: 'Recommended by HOD based on consistent delivery of ICT projects and mentorship of junior staff.',
          status: 'HOD Approved',
          state: 'open',
          hodId: hodSurgUser.id,
          hodName: hodSurgUser.fullName,
          hodRemarks: 'Strongly recommended — staff has consistently delivered above expectations.',
          hodSignedAt: new Date(),
          createdById: hodSurgUser.id,
        },
      })
      console.log('✓ Sample promotion created: PRM-2026-000001')
    }
  }

  // Sample Termination
  if (staff2 && cmdUser && dfaUser) {
    const existing = await db.termination.findUnique({ where: { refNumber: 'TRM-2026-000001' } })
    if (!existing) {
      await db.termination.create({
        data: {
          refNumber: 'TRM-2026-000001',
          staffId: staff2.id,
          type: 'retirement',
          reason: 'Mandatory retirement at age 60',
          detailedReason: 'Staff attaining the mandatory retirement age of 60 years on 31 December 2026.',
          noticeDate: new Date(2026, 5, 1),
          effectiveDate: new Date(2026, 11, 31),
          lastWorkingDate: new Date(2026, 11, 30),
          exitInterviewConducted: true,
          handoverCompleted: false,
          assetsReturned: false,
          finalSalary: 350000,
          gratuityAmount: 4200000,
          pensionBalance: 2800000,
          leaveEncashment: 140000,
          status: 'HOD Approved',
          state: 'open',
          hodId: hodSurgUser?.id,
          hodName: hodSurgUser?.fullName,
          hodRemarks: 'Acknowledged — staff has served meritoriously for 28 years.',
          hodSignedAt: new Date(),
          createdById: cmdUser.id,
        },
      })
      console.log('✓ Sample termination created: TRM-2026-000001')
    }
  }

  // Sample Resignation
  if (staff3) {
    const existing = await db.resignation.findUnique({ where: { refNumber: 'RSG-2026-000001' } })
    if (!existing) {
      await db.resignation.create({
        data: {
          refNumber: 'RSG-2026-000001',
          staffId: staff3.id,
          reason: 'Relocating abroad for family reasons',
          detailedReason: 'I wish to relocate with my family to the United Kingdom. My last working day will be 28 February 2026.',
          resignationDate: new Date(2026, 0, 15),
          noticeDate: new Date(2026, 0, 15),
          effectiveDate: new Date(2026, 1, 28),
          lastWorkingDate: new Date(2026, 1, 28),
          exitInterviewConducted: false,
          handoverCompleted: false,
          assetsReturned: false,
          finalSalary: 280000,
          gratuityAmount: 0,
          pensionBalance: 1850000,
          leaveEncashment: 95000,
          status: 'Submitted',
          state: 'open',
          createdById: staff3.userId || cmdUser?.id || hodSurgUser?.id || '',
        },
      })
      console.log('✓ Sample resignation created: RSG-2026-000001')
    }
  }

  console.log('Done!')
}

main().catch(console.error).finally(() => db.$disconnect())
