// Seed committees for the FUTH Lafia HR system
// Run with: bun run /home/z/my-project/scripts/seed-committees.ts

import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

const COMMITTEES = [
  { code: 'TENDERS',     name: 'Tenders Board',          description: 'Procurement tenders evaluation' },
  { code: 'DISCIPLINARY',name: 'Disciplinary Committee', description: 'Staff disciplinary matters' },
  { code: 'PROMOTIONS', name: 'Promotions Committee',    description: 'Annual promotions review' },
  { code: 'ETHICS',     name: 'Ethics Committee',         description: 'Medical and professional ethics' },
  { code: 'RESEARCH',   name: 'Research Committee',     description: 'Research ethics and approvals' },
  { code: 'AUDIT',      name: 'Audit Committee',        description: 'Internal audit and risk' },
  { code: 'GRIEVANCE',  name: 'Grievance Committee',     description: 'Staff grievances and welfare' },
  { code: 'APPOINTMENTS',name: 'Appointments Committee', description: 'Senior appointments and recruitments' },
]

async function main() {
  console.log('Seeding committees...')
  // Find CMD user as default chairperson for most committees
  const cmdUser = await db.user.findUnique({ where: { username: 'cmd' } })
  const cmaUser = await db.user.findUnique({ where: { username: 'cma' } })
  const dfaUser = await db.user.findUnique({ where: { username: 'dfa' } })
  const registryUser = await db.user.findUnique({ where: { username: 'registry' } })

  for (const c of COMMITTEES) {
    const chairId = c.code === 'AUDIT' ? cmaUser?.id : cmdUser?.id
    const secId = c.code === 'TENDERS' ? dfaUser?.id : registryUser?.id
    await db.committee.upsert({
      where: { code: c.code },
      update: {
        name: c.name,
        description: c.description,
        chairpersonId: chairId || null,
        secretaryId: secId || null,
        isActive: true,
      },
      create: {
        code: c.code,
        name: c.name,
        description: c.description,
        chairpersonId: chairId || null,
        secretaryId: secId || null,
        isActive: true,
      },
    })
  }
  console.log(`✓ ${COMMITTEES.length} committees seeded`)

  // Add a sample committee file
  const tendersCommittee = await db.committee.findUnique({ where: { code: 'TENDERS' } })
  if (tendersCommittee && registryUser) {
    const existing = await db.registryFile.findUnique({ where: { fileNumber: 'FUTH/REG/COM/2026/0001' } })
    if (!existing) {
      await db.registryFile.create({
        data: {
          fileNumber: 'FUTH/REG/COM/2026/0001',
          type: 'committee',
          subject: 'Tender evaluation — Supply of ICU equipment',
          description: 'Evaluation report for the tender submitted by three vendors for the supply of 5 patient monitors and 3 ventilators to the ICU.',
          priority: 'Urgent',
          createdById: registryUser.id,
          committeeId: tendersCommittee.id,
          status: 'Submitted',
          state: 'open',
        },
      })
      console.log('✓ Sample committee file created')
    }
  }

  console.log('Done!')
}

main().catch(console.error).finally(() => db.$disconnect())
