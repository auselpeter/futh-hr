// Seed script: add 5-10 sample Duty records with various statuses for the
// enhanced Duties module. Idempotent — uses unique title+staffId combos to
// avoid duplicates on re-runs.
//
// Run with: bun run /home/z/my-project/scripts/seed-duties-extended.ts

import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

const DAY = 24 * 60 * 60 * 1000

function grade(score: number): string {
  if (score >= 90) return 'A+'
  if (score >= 80) return 'A'
  if (score >= 70) return 'B'
  if (score >= 60) return 'C'
  if (score >= 50) return 'D'
  return 'F'
}

async function main() {
  console.log('Seeding extended Duty records...')

  const peter = await db.staff.findFirst({ where: { staffId: 'FUTH/001' } })
  const aisha = await db.staff.findFirst({ where: { staffId: 'FUTH/002' } })
  const chidi = await db.staff.findFirst({ where: { staffId: 'FUTH/003' } })
  const bola = await db.staff.findFirst({ where: { staffId: 'FUTH/004' } })
  const nnamdi = await db.staff.findFirst({ where: { staffId: 'FUTH/005' } })
  const maryam = await db.staff.findFirst({ where: { staffId: 'FUTH/006' } })
  const houIcu = await db.user.findUnique({ where: { username: 'hou_icu' } })

  if (!peter || !aisha || !chidi || !bola || !nnamdi || !maryam) {
    console.error('Required staff records not found — run the base seed first')
    process.exit(1)
  }

  const period = String(new Date().getFullYear())
  const now = new Date()

  type Seed = {
    staffId: string
    title: string
    description?: string
    type?: string
    order?: number
    startDate?: Date
    dueDate?: Date
    completedAt?: Date | null
    status: string
    achievedScore?: number | null
    targetScore?: number
    evidenceUrl?: string | null
    evidenceFileName?: string | null
    evidenceNotes?: string | null
    evidenceUploadedAt?: Date | null
    reviewedById?: string | null
    reviewedByName?: string | null
    reviewedAt?: Date | null
    reviewRemarks?: string | null
    weight?: number
  }

  const seeds: Seed[] = [
    // 2x Completed with evidence + achievedScore
    {
      staffId: peter.id,
      title: 'Q4 ICT Infrastructure Audit Report',
      description: 'Compile and submit the Q4 ICT infrastructure audit report covering all hospital systems, with recommendations for upgrades.',
      type: 'Primary',
      order: 1,
      startDate: new Date(now.getTime() - 20 * DAY),
      dueDate: new Date(now.getTime() - 5 * DAY),
      completedAt: new Date(now.getTime() - 6 * DAY),
      status: 'Completed',
      targetScore: 100,
      achievedScore: 85,
      evidenceUrl: '/uploads/duty/q4-ict-audit-report.pdf',
      evidenceFileName: 'Q4-ICT-Audit-Report.pdf',
      evidenceNotes: 'Report submitted to HOD ICT and acknowledged by CMD.',
      evidenceUploadedAt: new Date(now.getTime() - 6 * DAY),
      weight: 2,
    },
    {
      staffId: aisha.id,
      title: 'ICU Patient Care Plan Documentation',
      description: 'Document patient care plans for all ICU admissions during the period, including diagnosis, treatment, and outcome.',
      type: 'Routine',
      order: 2,
      startDate: new Date(now.getTime() - 25 * DAY),
      dueDate: new Date(now.getTime() - 3 * DAY),
      completedAt: new Date(now.getTime() - 4 * DAY),
      status: 'Completed',
      targetScore: 100,
      achievedScore: 92,
      evidenceUrl: '/uploads/duty/icu-care-plans.xlsx',
      evidenceFileName: 'ICU-Care-Plans-2025.xlsx',
      evidenceNotes: 'Compiled care plans for 47 ICU patients.',
      evidenceUploadedAt: new Date(now.getTime() - 4 * DAY),
      weight: 1,
    },

    // 2x Overdue (dueDate in the past, not completed)
    {
      staffId: chidi.id,
      title: 'Finance reconciliation — October 2025',
      description: 'Reconcile all finance postings for October 2025 and submit variance report to DFA.',
      type: 'Primary',
      order: 1,
      startDate: new Date(now.getTime() - 35 * DAY),
      dueDate: new Date(now.getTime() - 12 * DAY),
      status: 'Overdue',
      targetScore: 100,
      weight: 2,
    },
    {
      staffId: bola.id,
      title: 'Surgery Department Equipment Inventory',
      description: 'Conduct a complete inventory of surgical equipment and submit a replacement plan for outdated items.',
      type: 'Project-based',
      order: 3,
      startDate: new Date(now.getTime() - 45 * DAY),
      dueDate: new Date(now.getTime() - 18 * DAY),
      status: 'Overdue',
      targetScore: 100,
      weight: 1,
    },

    // 1x Approved (reviewed by HOU)
    {
      staffId: maryam.id,
      title: 'Internal Medicine Ward Round Schedule',
      description: 'Coordinate the weekly ward rounds for Internal Medicine and ensure all unit heads participate.',
      type: 'Routine',
      order: 1,
      startDate: new Date(now.getTime() - 30 * DAY),
      dueDate: new Date(now.getTime() - 10 * DAY),
      completedAt: new Date(now.getTime() - 9 * DAY),
      status: 'Approved',
      targetScore: 100,
      achievedScore: 88,
      evidenceUrl: '/uploads/duty/ward-round-schedule.pdf',
      evidenceFileName: 'Ward-Round-Schedule.pdf',
      evidenceNotes: 'Schedule published and circulated to all unit heads.',
      evidenceUploadedAt: new Date(now.getTime() - 9 * DAY),
      reviewedById: houIcu?.id || null,
      reviewedByName: houIcu?.fullName || 'Head of Unit',
      reviewedAt: new Date(now.getTime() - 7 * DAY),
      reviewRemarks: 'Excellent coordination. Schedule well-structured and inclusive of all units.',
      weight: 1,
    },

    // 2x In Progress
    {
      staffId: nnamdi.id,
      title: 'ICT Helpdesk Response Time Improvement Plan',
      description: 'Develop and implement a plan to reduce average helpdesk ticket response time from 48h to 12h.',
      type: 'Project-based',
      order: 2,
      startDate: new Date(now.getTime() - 8 * DAY),
      dueDate: new Date(now.getTime() + 14 * DAY),
      status: 'In Progress',
      targetScore: 100,
      weight: 2,
    },
    {
      staffId: peter.id,
      title: 'Network Security Hardening Phase 2',
      description: 'Implement phase 2 of the network security hardening plan — firewall rules, MFA enforcement, and endpoint protection.',
      type: 'Primary',
      order: 4,
      startDate: new Date(now.getTime() - 5 * DAY),
      dueDate: new Date(now.getTime() + 25 * DAY),
      status: 'In Progress',
      targetScore: 100,
      weight: 2,
    },

    // 2 more Assigned for demo variety
    {
      staffId: aisha.id,
      title: 'ICU Staff Training — New Ventilator Model',
      description: 'Attend vendor-led training on the new ventilator model and cascade training to ICU staff.',
      type: 'Secondary',
      order: 5,
      startDate: new Date(now.getTime() + 2 * DAY),
      dueDate: new Date(now.getTime() + 30 * DAY),
      status: 'Assigned',
      targetScore: 100,
      weight: 1,
    },
    {
      staffId: chidi.id,
      title: 'Year-end Finance Briefing Slides',
      description: 'Prepare year-end finance briefing slides for the CMD\'s town hall presentation.',
      type: 'Secondary',
      order: 6,
      startDate: new Date(now.getTime()),
      dueDate: new Date(now.getTime() + 21 * DAY),
      status: 'Assigned',
      targetScore: 100,
      weight: 1,
    },
  ]

  let created = 0
  let skipped = 0
  for (const s of seeds) {
    // Look up by staffId + title to be idempotent
    const existing = await db.duty.findFirst({ where: { staffId: s.staffId, title: s.title } })
    if (existing) {
      skipped++
      continue
    }
    const data: any = {
      staffId: s.staffId,
      title: s.title,
      description: s.description ?? null,
      type: s.type ?? 'Primary',
      order: s.order ?? 1,
      startDate: s.startDate ?? null,
      dueDate: s.dueDate ?? null,
      completedAt: s.completedAt ?? null,
      durationDays: s.startDate && s.dueDate
        ? Math.max(1, Math.round((s.dueDate.getTime() - s.startDate.getTime()) / DAY))
        : null,
      status: s.status,
      targetScore: s.targetScore ?? 100,
      achievedScore: s.achievedScore ?? null,
      grade: s.achievedScore != null ? grade(s.achievedScore) : null,
      evidenceUrl: s.evidenceUrl ?? null,
      evidenceFileName: s.evidenceFileName ?? null,
      evidenceNotes: s.evidenceNotes ?? null,
      evidenceUploadedAt: s.evidenceUploadedAt ?? null,
      reviewedById: s.reviewedById ?? null,
      reviewedByName: s.reviewedByName ?? null,
      reviewedAt: s.reviewedAt ?? null,
      reviewRemarks: s.reviewRemarks ?? null,
      weight: s.weight ?? 1,
      period,
    }
    await db.duty.create({ data })
    created++
  }

  console.log(`✓ Created ${created} new duties, skipped ${skipped} existing`)
  console.log('Done!')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await db.$disconnect() })
