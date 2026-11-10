// Seed script for extended modules: units, retirements, trainings, projects, department ratings
// Run with: bun run /home/z/my-project/scripts/seed-extended-modules.ts

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  console.log('Seeding extended modules (units, retirements, trainings, projects)...')

  // 1. Units — sub-departmental divisions
  const medDept = await db.department.findUnique({ where: { code: 'MED' } })
  const ictDept = await db.department.findUnique({ where: { code: 'ICT' } })
  const surgDept = await db.department.findUnique({ where: { code: 'SURG' } })
  const nursDept = await db.department.findUnique({ where: { code: 'NURS' } })

  const units = [
    { code: 'ICU',  name: 'Intensive Care Unit',        description: 'ICU for critical patients',  departmentCode: 'MED' },
    { code: 'ER',   name: 'Emergency Room',              description: '24/7 emergency services',       departmentCode: 'MED' },
    { code: 'THEATRE', name: 'Operating Theatre',         description: 'Surgical operations suite',   departmentCode: 'SURG' },
    { code: 'NET',  name: 'Network Operations',          description: 'Network & infrastructure',    departmentCode: 'ICT' },
    { code: 'DEV',  name: 'Software Development',        description: 'Application development unit', departmentCode: 'ICT' },
    { code: 'THEATRE_NURS', name: 'Theatre Nursing',     description: 'Theatre nursing unit',         departmentCode: 'NURS' },
  ]
  for (const u of units) {
    const dept = await db.department.findUnique({ where: { code: u.departmentCode } })
    if (!dept) continue
    // Only assign HOU to one unit (ICU) — the rest get null
    const houUser = u.code === 'ICU' ? await db.user.findFirst({ where: { role: 'HOU' } }) : null
    await db.unit.upsert({
      where: { code: u.code },
      update: { name: u.name, description: u.description, departmentId: dept.id, houUserId: houUser?.id || null, isActive: true },
      create: { code: u.code, name: u.name, description: u.description, departmentId: dept.id, houUserId: houUser?.id || null, isActive: true },
    })
  }
  console.log(`✓ ${units.length} units seeded`)

  // 2. Sample retirements
  const allStaff = await db.staff.findMany({ include: { department: true, user: true } })
  const hodIct = await db.user.findUnique({ where: { username: 'hod_ict' } })
  if (allStaff.length >= 4 && hodIct) {
    const samples = [
      { staffIdx: 0, type: 'compulsory', reason: 'Mandatory retirement at 60 years', yearsOfService: 35, gradeLevel: 'GL 16' },
      { staffIdx: 1, type: 'voluntary', reason: 'Voluntary early retirement', yearsOfService: 25, gradeLevel: 'GL 14' },
    ]
    let count = 0
    for (const s of samples) {
      const staff = allStaff[s.staffIdx]
      if (!staff) continue
      const existing = await db.retirement.findFirst({ where: { staffId: staff.id } })
      if (!existing) {
        const refNumber = `RTM-${new Date().getFullYear()}-${String(++count).padStart(6, '0')}`
        await db.retirement.create({
          data: {
            refNumber,
            staffId: staff.id,
            type: s.type,
            reason: s.reason,
            dateOfBirth: new Date(1965, 5, 12),
            retirementDate: new Date(Date.now() + 60 * 86400000),
            lastWorkingDate: new Date(Date.now() + 30 * 86400000),
            yearsOfService: s.yearsOfService,
            dateOfFirstAppointment: new Date(1990, 9, 1),
            currentSalaryAtRetirement: 450000,
            gradeLevelAtRetirement: s.gradeLevel,
            gratuityAmount: 5000000,
            pensionBalance: 8500000,
            leaveEncashment: 320000,
            pensionAdministrator: 'Premium Pensions Limited',
            pensionPin: 'PEN-1234567890',
            nhfRefundAmount: 250000,
            nhisRefundAmount: 60000,
            status: 'Submitted',
            state: 'open',
            createdById: hodIct.id,
          },
        })
      }
    }
    console.log(`✓ ${samples.length} retirement samples seeded`)
  }

  // 3. Sample training programs
  const trainings = [
    {
      title: 'ICD-10 Coding Workshop',
      description: 'Training on ICD-10 diagnostic coding for medical records staff',
      type: 'workshop', category: 'Clinical', provider: 'WHO Nigeria', facilitator: 'Dr. Adamu Idris', location: 'FUTH Training Room A',
      mode: 'physical', daysFromNow: 14, durationHours: 24, cost: 250000, maxParticipants: 30, status: 'Open',
    },
    {
      title: 'Cybersecurity Awareness Training',
      description: 'Mandatory cybersecurity awareness for all ICT and admin staff',
      type: 'course', category: 'IT', provider: 'Nigerian Computer Society', facilitator: 'Engr. Bola Ade',
      location: 'Online (Zoom)', mode: 'online', daysFromNow: 7, durationHours: 8, cost: 0, maxParticipants: 100, status: 'Open',
    },
    {
      title: 'Project Management Professional (PMP)',
      description: 'PMP certification preparation course',
      type: 'certification', category: 'Management', provider: 'PMI Nigeria', facilitator: 'Mr. Kunle Peters',
      location: 'FUTH Boardroom', mode: 'hybrid', daysFromNow: 30, durationHours: 40, cost: 850000, maxParticipants: 20, status: 'Open',
    },
    {
      title: 'Financial Management for Non-Finance Managers',
      description: 'Basic financial management training for HODs',
      type: 'workshop', category: 'Finance', provider: 'ICAN Lafia Chapter', facilitator: 'Mrs. Halima Suleiman',
      location: 'Finance Conference Room', mode: 'physical', daysFromNow: -10, durationHours: 16, cost: 0, maxParticipants: 25, status: 'Completed',
    },
  ]
  const adminUser = await db.user.findFirst({ where: { role: 'SUPER_ADMIN' } })
  if (adminUser) {
    let tCount = 0
    for (const t of trainings) {
      const code = `TRN-${new Date().getFullYear()}-${String(++tCount).padStart(3, '0')}`
      const existing = await db.training.findUnique({ where: { code } })
      if (!existing) {
        await db.training.create({
          data: {
            code,
            title: t.title,
            description: t.description,
            type: t.type,
            category: t.category,
            provider: t.provider,
            facilitator: t.facilitator,
            location: t.location,
            mode: t.mode,
            startDate: new Date(Date.now() + t.daysFromNow * 86400000),
            endDate: new Date(Date.now() + (t.daysFromNow + 3) * 86400000),
            durationHours: t.durationHours,
            cost: t.cost,
            fundingSource: 'Internal',
            maxParticipants: t.maxParticipants,
            status: t.status,
            isActive: true,
            createdById: adminUser.id,
          },
        })
      }
    }
    console.log(`✓ ${trainings.length} training programs seeded`)

    // Enroll a few staff in the first training
    const firstTraining = await db.training.findFirst({ orderBy: { createdAt: 'asc' } })
    if (firstTraining && allStaff.length >= 3) {
      for (let i = 0; i < Math.min(3, allStaff.length); i++) {
        const existing = await db.trainingEnrollment.findUnique({
          where: { trainingId_staffId: { trainingId: firstTraining.id, staffId: allStaff[i].id } },
        })
        if (!existing) {
          await db.trainingEnrollment.create({
            data: { trainingId: firstTraining.id, staffId: allStaff[i].id, status: 'Enrolled' },
          })
        }
      }
      console.log('✓ Sample training enrollments seeded')
    }
  }

  // 4. Sample projects
  const projects = [
    {
      title: 'ICT Infrastructure Modernisation',
      description: 'Modernisation of all ICT infrastructure including servers, network, and end-user devices.',
      type: 'infrastructure', category: 'IT', priority: 'High',
      budget: 25000000, fundingSource: 'FG Special Intervention',
      daysFromNow: -30, durationDays: 180, progress: 35, status: 'In Progress',
    },
    {
      title: 'New ICU Construction',
      description: 'Construction of a new 12-bed intensive care unit for the Internal Medicine department.',
      type: 'infrastructure', category: 'Construction', priority: 'Critical',
      budget: 85000000, fundingSource: 'Capital Budget',
      daysFromNow: -60, durationDays: 365, progress: 60, status: 'In Progress',
    },
    {
      title: 'Staff Training Programme 2026',
      description: 'Capacity building and continuous training programme for all clinical and non-clinical staff.',
      type: 'training', category: 'Training', priority: 'Normal',
      budget: 5500000, fundingSource: 'Internal',
      daysFromNow: -15, durationDays: 90, progress: 15, status: 'Planned',
    },
    {
      title: 'Annual Performance Review',
      description: 'Institutional annual performance review for 2025 — all departments.',
      type: 'institutional', category: 'Performance', priority: 'High',
      budget: 800000, fundingSource: 'Internal',
      daysFromNow: -90, durationDays: 60, progress: 100, status: 'Completed',
    },
  ]
  if (adminUser) {
    let pCount = 0
    for (const p of projects) {
      const code = `PRJ-${new Date().getFullYear()}-${String(++pCount).padStart(3, '0')}`
      const existing = await db.project.findUnique({ where: { code } })
      if (!existing) {
        const dept = await db.department.findFirst({ where: { code: p.category === 'IT' ? 'ICT' : 'ADMIN' } })
        const startDate = new Date(Date.now() + p.daysFromNow * 86400000)
        const endDate = new Date(startDate.getTime() + p.durationDays * 86400000)
        await db.project.create({
          data: {
            code,
            title: p.title,
            description: p.description,
            type: p.type,
            category: p.category,
            priority: p.priority,
            departmentId: dept?.id || null,
            startDate,
            endDate,
            budget: p.budget,
            spent: Math.floor(p.budget * (p.progress / 100) * 0.8),
            currency: 'NGN',
            fundingSource: p.fundingSource,
            progress: p.progress,
            status: p.status,
            state: 'open',
            isActive: true,
            createdById: adminUser.id,
          },
        })
        // Add a few milestones and members
        const project = await db.project.findUnique({ where: { code } })
        if (project && allStaff.length >= 2) {
          await db.projectMember.create({ data: { projectId: project.id, staffId: allStaff[0].id, role: 'Project Lead' } })
          if (allStaff[1]) await db.projectMember.create({ data: { projectId: project.id, staffId: allStaff[1].id, role: 'Member' } })
          await db.projectMilestone.create({
            data: { projectId: project.id, title: 'Project kickoff', dueDate: new Date(startDate.getTime() + 7 * 86400000), status: p.progress > 10 ? 'Completed' : 'Pending', createdById: adminUser.id }
          })
          await db.projectMilestone.create({
            data: { projectId: project.id, title: 'Mid-project review', dueDate: new Date(startDate.getTime() + p.durationDays / 2 * 86400000), status: p.progress > 50 ? 'Completed' : 'Pending', createdById: adminUser.id }
          })
          await db.projectMilestone.create({
            data: { projectId: project.id, title: 'Final delivery', dueDate: endDate, status: p.progress >= 100 ? 'Completed' : 'Pending', createdById: adminUser.id }
          })
        }
      }
    }
    console.log(`✓ ${projects.length} projects seeded with members & milestones`)
  }

  console.log('Extended modules seeding complete!')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await db.$disconnect() })
