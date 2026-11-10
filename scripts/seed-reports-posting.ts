// Seed script for report templates + planning officer + posting/transfer sample data
// Run with: bun run /home/z/my-project/scripts/seed-reports-posting.ts

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()
const pw = (s: string) => bcrypt.hashSync(s, 10)

const REPORT_TEMPLATES = [
  { code: 'STAFF_DIRECTORY',    name: 'Staff Directory Report',         description: 'Complete staff listing with department, designation, and contact info',  category: 'HR',         accessLevel: 'management', module: 'staff',           format: 'both', hasDateRange: false, hasDeptFilter: true,  sortOrder: 10 },
  { code: 'LEAVE_REPORT',       name: 'Leave Applications Report',     description: 'Leave applications by period and department',                            category: 'HR',         accessLevel: 'management', module: 'leaves',          format: 'both', hasDateRange: true,  hasDeptFilter: true,  sortOrder: 20 },
  { code: 'DUTY_REPORT',        name: 'Duty Performance Report',        description: 'Duty assignments and achieved scores',                                    category: 'Performance', accessLevel: 'management', module: 'duties',          format: 'both', hasDateRange: true,  hasDeptFilter: true,  sortOrder: 30 },
  { code: 'PROMOTION_REPORT',   name: 'Promotions Report',              description: 'Promotion records with from/to positions',                                 category: 'HR',         accessLevel: 'management', module: 'promotions',      format: 'both', hasDateRange: true,  hasDeptFilter: true,  sortOrder: 40 },
  { code: 'TRAINING_REPORT',    name: 'Training Programs Report',        description: 'Training programs with enrollment counts',                                category: 'HR',         accessLevel: 'officer',    module: 'trainings',        format: 'both', hasDateRange: true,  hasDeptFilter: false, sortOrder: 50 },
  { code: 'PROJECT_REPORT',     name: 'Projects Report',                description: 'Project portfolio with budget and progress',                              category: 'Operations', accessLevel: 'management', module: 'projects',        format: 'both', hasDateRange: true,  hasDeptFilter: true,  sortOrder: 60 },
  { code: 'PV_REPORT',          name: 'Payment Voucher Report',         description: 'Payment vouchers with payee, amount, and status',                          category: 'Finance',    accessLevel: 'directorate',module: 'payment_vouchers', format: 'both', hasDateRange: true,  hasDeptFilter: false, sortOrder: 70 },
  { code: 'DEPARTMENT_RATINGS', name: 'Department Ratings Report',      description: 'Performance leaderboard by department',                                    category: 'Performance', accessLevel: 'management', module: 'department_ratings', format: 'both', hasDateRange: false, hasDeptFilter: false, sortOrder: 80 },
  { code: 'AUDIT_LOG_REPORT',   name: 'Audit Log Report',                description: 'System audit trail',                                                      category: 'Compliance', accessLevel: 'executive',  module: 'audit_logs',       format: 'both', hasDateRange: true,  hasDeptFilter: false, sortOrder: 90 },
  { code: 'PAYROLL_REPORT',     name: 'Payroll Summary Report',         description: 'Payroll summary by department',                                            category: 'Finance',    accessLevel: 'directorate',module: 'payroll',         format: 'both', hasDateRange: true,  hasDeptFilter: true,  sortOrder: 100 },
  { code: 'RETIREMENT_REPORT', name: 'Retirement Report',               description: 'Retirement applications and benefits',                                      category: 'HR',         accessLevel: 'management', module: 'retirements',      format: 'both', hasDateRange: true,  hasDeptFilter: true,  sortOrder: 110 },
  { code: 'APPRaisal_REPORT',  name: 'Appraisal & Review Report',       description: 'Annual/monthly/quarterly appraisal scores',                                category: 'Performance', accessLevel: 'management', module: 'appraisals',      format: 'both', hasDateRange: true,  hasDeptFilter: true,  sortOrder: 120 },
]

async function main() {
  console.log('Seeding report templates + planning officer + posting data...')

  // 1. Report templates
  for (const t of REPORT_TEMPLATES) {
    await db.reportTemplate.upsert({
      where: { code: t.code },
      update: {
        name: t.name, description: t.description, category: t.category,
        accessLevel: t.accessLevel, module: t.module, format: t.format,
        hasDateRange: t.hasDateRange, hasDeptFilter: t.hasDeptFilter,
        sortOrder: t.sortOrder, isActive: true,
      },
      create: { ...t, isActive: true },
    })
  }
  console.log(`✓ ${REPORT_TEMPLATES.length} report templates seeded`)

  // 2. Planning officer user (creates postings for approval)
  const planningDept = await db.department.findUnique({ where: { code: 'ADMIN' } })
  const planningDsg = await db.designation.findUnique({ where: { code: 'AD' } })
  if (planningDept && planningDsg) {
    const existing = await db.user.findUnique({ where: { username: 'planning' } })
    if (!existing) {
      // Ensure email is unique
      let email = 'planning@futhlafia.gov.ng'
      let emailOk = false
      while (!emailOk) {
        const taken = await db.user.findUnique({ where: { email } })
        if (taken) {
          email = `planning${Math.floor(Math.random() * 1000)}@futhlafia.gov.ng`
        } else {
          emailOk = true
        }
      }
      const u = await db.user.create({
        data: {
          username: 'planning',
          email,
          fullName: 'Mrs. Aisha Bello',
          role: 'AD',
          passwordHash: pw('admin123'),
          departmentId: planningDept.id,
          designationId: planningDsg.id,
          isActive: true,
        },
      })
      // Create linked staff record
      const existingStaff = await db.staff.findUnique({ where: { staffId: 'FUTH/013' } })
      if (!existingStaff) {
        await db.staff.create({
          data: {
            staffId: 'FUTH/013',
            surname: 'Bello',
            firstName: 'Aisha',
            fullName: 'Aisha Bello',
            gender: 'Female',
            email: 'planning@futhlafia.gov.ng',
            position: 'Planning Officer',
            rank: 'Officer',
            status: 'active',
            departmentId: planningDept.id,
            userId: u.id,
          },
        })
        const s = await db.staff.findUnique({ where: { staffId: 'FUTH/013' } })
        if (s) await db.user.update({ where: { id: u.id }, data: { staffId: s.id } })
      }
      console.log('✓ Planning officer (planning / admin123) created')
    } else {
      console.log('✓ Planning officer already exists')
    }
  }

  // 3. Sample posting/transfer records
  const allStaff = await db.staff.findMany({ include: { department: true } })
  const ictDept = await db.department.findUnique({ where: { code: 'ICT' } })
  const surgDept = await db.department.findUnique({ where: { code: 'SURG' } })
  const medDept = await db.department.findUnique({ where: { code: 'MED' } })
  const finDept = await db.department.findUnique({ where: { code: 'FIN' } })
  const adminDept = await db.department.findUnique({ where: { code: 'ADMIN' } })
  const planningUser = await db.user.findUnique({ where: { username: 'planning' } })

  if (allStaff.length >= 3 && planningUser) {
    const samples = [
      { staffId: allStaff[0].id, type: 'posting', from: allStaff[0].departmentId, to: ictDept?.id || null, fromPos: 'Officer', toPos: 'Senior Officer', reason: 'Routine posting for capacity strengthening', status: 'Submitted' },
      { staffId: allStaff[1].id, type: 'transfer', from: allStaff[1].departmentId, to: surgDept?.id || null, fromPos: 'Nurse', toPos: 'Theatre Nurse', reason: 'Transfer to support surgery department', status: 'Planning Reviewed' },
      { staffId: allStaff[2].id, type: 'redeployment', from: allStaff[2].departmentId, to: medDept?.id || null, fromPos: 'Accountant', toPos: 'Finance Officer', reason: 'Redeployment due to operational needs', status: 'HOD Approved' },
    ]
    let ptCount = 0
    for (const s of samples) {
      if (!s.staffId || !s.to) continue
      const existing = await db.postingTransfer.findFirst({ where: { staffId: s.staffId, reason: s.reason } })
      if (!existing) {
        const seq = `PT-${new Date().getFullYear()}-${String(++ptCount).padStart(6, '0')}`
        await db.postingTransfer.create({
          data: {
            refNumber: seq,
            staffId: s.staffId,
            type: s.type,
            fromDepartmentId: s.from,
            toDepartmentId: s.to,
            fromPosition: s.fromPos,
            toPosition: s.toPos,
            reason: s.reason,
            effectiveDate: new Date(Date.now() + 30 * 86400000),
            reportDeadline: new Date(Date.now() + 45 * 86400000),
            handoverDate: new Date(Date.now() + 14 * 86400000),
            status: s.status,
            state: 'open',
            createdById: planningUser.id,
          },
        })
      }
    }
    console.log(`✓ ${samples.length} posting/transfer samples seeded`)
  }

  console.log('Reports + posting seed complete!')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await db.$disconnect() })
