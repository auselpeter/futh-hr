// Seed script for FUTH Lafia HR System
// Run with: bun run /home/z/my-project/scripts/seed.ts

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

const pw = (s: string) => bcrypt.hashSync(s, 10)

async function main() {
  console.log('Seeding FUTH HR system...')

  // 1. Departments
  const departments = [
    { code: 'ADMIN', name: 'Administration', faculty: 'Administration' },
    { code: 'ICT', name: 'Information & Communication Technology', faculty: 'Administration' },
    { code: 'SURG', name: 'Surgery', faculty: 'Clinical Services' },
    { code: 'MED', name: 'Internal Medicine', faculty: 'Clinical Services' },
    { code: 'OBG', name: 'Obstetrics & Gynaecology', faculty: 'Clinical Services' },
    { code: 'PAED', name: 'Paediatrics', faculty: 'Clinical Services' },
    { code: 'LAB', name: 'Medical Laboratory', faculty: 'Diagnostics' },
    { code: 'RAD', name: 'Radiology', faculty: 'Diagnostics' },
    { code: 'PHARM', name: 'Pharmacy', faculty: 'Clinical Services' },
    { code: 'NURS', name: 'Nursing Services', faculty: 'Clinical Services' },
    { code: 'FIN', name: 'Finance & Accounts', faculty: 'Administration' },
    { code: 'HR', name: 'Human Resources', faculty: 'Administration' },
    { code: 'REG', name: 'Registry', faculty: 'Administration' },
    { code: 'MAINT', name: 'Works & Maintenance', faculty: 'Administration' },
  ]

  for (const d of departments) {
    await db.department.upsert({
      where: { code: d.code },
      update: { name: d.name, faculty: d.faculty, isActive: true },
      create: { ...d, isActive: true },
    })
  }
  console.log(`✓ ${departments.length} departments seeded`)

  // 2. Designations (CMD, CMA, AD, HOD, HOU, DFA, APPRAISAL_OFFICER, REGISTRY_OFFICER, STAFF)
  const designations = [
    { code: 'CMD',  name: 'Chief Medical Director',     description: 'Hospital chief executive — top-level approver', rank: 1000, level: 'executive' },
    { code: 'CMA',  name: 'Chief Medical Administrator', description: 'Chief administrative officer — second to CMD', rank: 900,  level: 'executive' },
    { code: 'AD',   name: 'Administrator',               description: 'Administrator — directorate-level officer', rank: 800,  level: 'directorate' },
    { code: 'DFA',  name: 'Director of Finance & Administration', description: 'Director of Finance & Administration (DFA)', rank: 750, level: 'directorate' },
    { code: 'HOD',  name: 'Head of Department',          description: 'Head of Department', rank: 700,  level: 'management' },
    { code: 'HOU',  name: 'Head of Unit',                description: 'Head of Unit — unit-level manager', rank: 600,  level: 'management' },
    { code: 'AO',   name: 'Appraisal Officer',          description: 'Appraisal Officer — performance reviews', rank: 400,  level: 'officer' },
    { code: 'REG',  name: 'Registry Officer',           description: 'Registry Officer — file creation & routing', rank: 300,  level: 'officer' },
    { code: 'STF',  name: 'Staff',                       description: 'Staff — base level employee', rank: 100,  level: 'staff' },
  ]

  for (const dsg of designations) {
    await db.designation.upsert({
      where: { code: dsg.code },
      update: { name: dsg.name, description: dsg.description, rank: dsg.rank, level: dsg.level, isActive: true },
      create: { ...dsg, isActive: true },
    })
  }
  console.log(`✓ ${designations.length} designations seeded`)

  // 3. Demo Users (one per role)
  const demoUsers = [
    { username: 'superadmin',  fullName: 'System Administrator', email: 'superadmin@futhlafia.gov.ng', role: 'SUPER_ADMIN',      password: 'admin123', designationCode: 'STF', deptCode: 'ADMIN' },
    { username: 'admin',      fullName: 'System Admin',          email: 'admin@futhlafia.gov.ng',     role: 'ADMIN',            password: 'admin123', designationCode: 'STF', deptCode: 'ADMIN' },
    { username: 'cmd',        fullName: 'Dr. Aminu Mohammed',     email: 'cmd@futhlafia.gov.ng',       role: 'CMD',              password: 'admin123', designationCode: 'CMD', deptCode: 'ADMIN' },
    { username: 'cma',        fullName: 'Barr. Fatima Bello',     email: 'cma@futhlafia.gov.ng',       role: 'CMA',              password: 'admin123', designationCode: 'CMA', deptCode: 'ADMIN' },
    { username: 'ad',         fullName: 'Mr. Kabir Yusuf',        email: 'ad@futhlafia.gov.ng',        role: 'AD',               password: 'admin123', designationCode: 'AD',  deptCode: 'ADMIN' },
    { username: 'dfa',        fullName: 'Mrs. Halima Suleiman',   email: 'dfa@futhlafia.gov.ng',       role: 'DFA',              password: 'admin123', designationCode: 'DFA', deptCode: 'FIN' },
    { username: 'hod_surg',   fullName: 'Dr. Bola Ahmed',         email: 'hod.surgery@futhlafia.gov.ng',role: 'HOD',              password: 'admin123', designationCode: 'HOD', deptCode: 'SURG' },
    { username: 'hod_ict',     fullName: 'Engr. Nnamdi Oke',      email: 'hod.ict@futhlafia.gov.ng',   role: 'HOD',              password: 'admin123', designationCode: 'HOD', deptCode: 'ICT' },
    { username: 'hou_icu',    fullName: 'Dr. Maryam Garba',       email: 'hou.icu@futhlafia.gov.ng',   role: 'HOU',              password: 'admin123', designationCode: 'HOU', deptCode: 'MED' },
    { username: 'registry',   fullName: 'Mr. John Idris',         email: 'registry@futhlafia.gov.ng',  role: 'REGISTRY_OFFICER', password: 'admin123', designationCode: 'REG', deptCode: 'REG' },
    { username: 'appraisal',  fullName: 'Mr. Sani Musa',          email: 'appraisal@futhlafia.gov.ng',role: 'APPRAISAL_OFFICER',password: 'admin123', designationCode: 'AO',  deptCode: 'HR' },
    { username: 'staff1',     fullName: 'Mr. Peter Ade',           email: 'staff1@futhlafia.gov.ng',    role: 'STAFF',            password: 'admin123', designationCode: 'STF', deptCode: 'ICT' },
    { username: 'staff2',     fullName: 'Miss Aisha Lamido',       email: 'staff2@futhlafia.gov.ng',    role: 'STAFF',            password: 'admin123', designationCode: 'STF', deptCode: 'SURG' },
    { username: 'staff3',     fullName: 'Mr. Chidi Obi',           email: 'staff3@futhlafia.gov.ng',    role: 'STAFF',            password: 'admin123', designationCode: 'STF', deptCode: 'FIN' },
  ]

  for (const u of demoUsers) {
    const dept = await db.department.findUnique({ where: { code: u.deptCode } })
    const dsg = await db.designation.findUnique({ where: { code: u.designationCode } })
    if (!dept || !dsg) continue
    await db.user.upsert({
      where: { username: u.username },
      update: {
        email: u.email,
        fullName: u.fullName,
        role: u.role,
        passwordHash: pw(u.password),
        departmentId: dept.id,
        designationId: dsg.id,
        isActive: true,
      },
      create: {
        username: u.username,
        email: u.email,
        fullName: u.fullName,
        role: u.role,
        passwordHash: pw(u.password),
        departmentId: dept.id,
        designationId: dsg.id,
        isActive: true,
      },
    })

    // Set HOD as head of their department
    if (u.role === 'HOD' && dept) {
      const user = await db.user.findUnique({ where: { username: u.username } })
      if (user) {
        await db.department.update({ where: { id: dept.id }, data: { hodUserId: user.id } })
      }
    }
  }
  console.log(`✓ ${demoUsers.length} demo users seeded`)

  // 4. Sample Staff records (linked to users)
  const sampleStaff = [
    { staffId: 'FUTH/001', surname: 'Ade',     firstName: 'Peter',     gender: 'Male',   email: 'staff1@futhlafia.gov.ng',    position: 'ICT Officer',         rank: 'Officer',           deptCode: 'ICT',  username: 'staff1' },
    { staffId: 'FUTH/002', surname: 'Lamido',  firstName: 'Aisha',     gender: 'Female', email: 'staff2@futhlafia.gov.ng',    position: 'Nurse',                rank: 'Nursing Officer II',deptCode: 'SURG', username: 'staff2' },
    { staffId: 'FUTH/003', surname: 'Obi',     firstName: 'Chidi',    gender: 'Male',   email: 'staff3@futhlafia.gov.ng',    position: 'Accountant',           rank: 'Accountant II',     deptCode: 'FIN',  username: 'staff3' },
    { staffId: 'FUTH/004', surname: 'Ahmed',   firstName: 'Bola',     gender: 'Female', email: 'hod.surgery@futhlafia.gov.ng',position: 'Consultant Surgeon',  rank: 'Consultant',        deptCode: 'SURG', username: 'hod_surg' },
    { staffId: 'FUTH/005', surname: 'Oke',      firstName: 'Nnamdi',  gender: 'Male',   email: 'hod.ict@futhlafia.gov.ng',   position: 'ICT Manager',          rank: 'Manager',          deptCode: 'ICT',  username: 'hod_ict' },
    { staffId: 'FUTH/006', surname: 'Garba',    firstName: 'Maryam',  gender: 'Female', email: 'hou.icu@futhlafia.gov.ng',    position: 'Senior Registrar',    rank: 'Registrar',        deptCode: 'MED',  username: 'hou_icu' },
    { staffId: 'FUTH/007', surname: 'Idris',    firstName: 'John',    gender: 'Male',   email: 'registry@futhlafia.gov.ng',  position: 'Registry Officer',     rank: 'Officer',           deptCode: 'REG',  username: 'registry' },
    { staffId: 'FUTH/008', surname: 'Musa',     firstName: 'Sani',    gender: 'Male',   email: 'appraisal@futhlafia.gov.ng', position: 'Appraisal Officer',    rank: 'Officer',           deptCode: 'HR',  username: 'appraisal' },
    { staffId: 'FUTH/009', surname: 'Mohammed', firstName: 'Aminu',  gender: 'Male',   email: 'cmd@futhlafia.gov.ng',       position: 'Chief Medical Director',rank: 'CMD',              deptCode: 'ADMIN', username: 'cmd' },
    { staffId: 'FUTH/010', surname: 'Bello',    firstName: 'Fatima', gender: 'Female', email: 'cma@futhlafia.gov.ng',        position: 'Chief Medical Admin', rank: 'CMA',               deptCode: 'ADMIN', username: 'cma' },
    { staffId: 'FUTH/011', surname: 'Yusuf',    firstName: 'Kabir',   gender: 'Male',   email: 'ad@futhlafia.gov.ng',         position: 'Administrator',        rank: 'Administrator',     deptCode: 'ADMIN', username: 'ad' },
    { staffId: 'FUTH/012', surname: 'Suleiman', firstName: 'Halima', gender: 'Female', email: 'dfa@futhlafia.gov.ng',        position: 'DFA',                  rank: 'Director',          deptCode: 'FIN',  username: 'dfa' },
  ]

  for (const s of sampleStaff) {
    const dept = await db.department.findUnique({ where: { code: s.deptCode } })
    const user = await db.user.findUnique({ where: { username: s.username } })
    if (!dept || !user) continue
    const fullName = `${s.firstName} ${s.surname}`
    await db.staff.upsert({
      where: { staffId: s.staffId },
      update: {
        surname: s.surname,
        firstName: s.firstName,
        fullName,
        gender: s.gender,
        email: s.email,
        position: s.position,
        rank: s.rank,
        departmentId: dept.id,
        userId: user.id,
      },
      create: {
        staffId: s.staffId,
        surname: s.surname,
        firstName: s.firstName,
        fullName,
        gender: s.gender,
        email: s.email,
        position: s.position,
        rank: s.rank,
        status: 'active',
        departmentId: dept.id,
        userId: user.id,
      },
    })
    // Link user.staffId
    const staffRec = await db.staff.findUnique({ where: { staffId: s.staffId } })
    if (staffRec) {
      await db.user.update({ where: { id: user.id }, data: { staffId: staffRec.id } })
    }
  }
  console.log(`✓ ${sampleStaff.length} staff records seeded`)

  // 5. Sample Requisitions (so dashboards have data immediately)
  const registryUser = await db.user.findUnique({ where: { username: 'registry' } })
  const cmdUser = await db.user.findUnique({ where: { username: 'cmd' } })
  const hodSurgUser = await db.user.findUnique({ where: { username: 'hod_surg' } })
  const dfaUser = await db.user.findUnique({ where: { username: 'dfa' } })
  const staff1User = await db.user.findUnique({ where: { username: 'staff1' } })
  const cmaUser = await db.user.findUnique({ where: { username: 'cma' } })

  if (registryUser && cmdUser && hodSurgUser && dfaUser && staff1User && cmaUser) {
    const reqSamples = [
      {
        refNumber: 'FUTH/REQ/SVC/2025/0001',
        type: 'service',
        subject: 'Request for ICT infrastructure audit',
        description: 'We request an audit of all ICT infrastructure in the Surgery department to identify gaps and recommend upgrades for the Q1 2026 procurement cycle.',
        comment: 'Initial request from HOD Surgery — please route to ICT HOD for technical review.',
        priority: 'High',
        createdById: hodSurgUser.id,
        targetDesignationId: (await db.designation.findUnique({ where: { code: 'HOD' } }))?.id,
        targetDepartmentId: (await db.department.findUnique({ where: { code: 'ICT' } }))?.id,
        status: 'Submitted', state: 'open',
      },
      {
        refNumber: 'FUTH/REQ/EXP/2025/0001',
        type: 'expense',
        subject: 'Reimbursement for travel to conference',
        description: 'Reimbursement for flight and accommodation for the West African Health Conference held in Accra from 12-15 November 2025.',
        comment: 'All receipts attached. Total claim: 850,000 NGN.',
        amount: 850000,
        priority: 'Normal',
        createdById: staff1User.id,
        targetUserId: hodSurgUser.id,
        status: 'Submitted', state: 'open',
      },
      {
        refNumber: 'FUTH/REQ/OTH/2025/0001',
        type: 'other',
        subject: 'Request for office reallocation',
        description: 'Request to reallocate office space on the 3rd floor of the admin block for the new HR team.',
        comment: 'Please route to AD Administration for approval.',
        priority: 'Normal',
        createdById: registryUser.id,
        targetDesignationId: (await db.designation.findUnique({ where: { code: 'AD' } }))?.id,
        status: 'Submitted', state: 'open',
      },
      {
        refNumber: 'FUTH/REQ/EXP/2025/0002',
        type: 'expense',
        subject: 'Capital expenditure for ICU equipment',
        description: 'Approval requested for the procurement of 5 patient monitors and 3 ventilators for the ICU. Estimated cost: 28,500,000 NGN.',
        comment: 'Vendor quotes attached. Urgent — please route to CMD for final approval.',
        amount: 28500000,
        priority: 'Urgent',
        createdById: dfaUser.id,
        targetUserId: cmdUser.id,
        status: 'Submitted', state: 'open',
      },
      {
        refNumber: 'FUTH/REQ/SVC/2025/0002',
        type: 'service',
        subject: 'Generator servicing request',
        description: 'Request for servicing of the two standby generators (250 KVA & 100 KVA) servicing the theatre block.',
        comment: 'Last serviced in March 2025. Currently due.',
        priority: 'High',
        createdById: registryUser.id,
        targetDesignationId: (await db.designation.findUnique({ where: { code: 'HOD' } }))?.id,
        targetDepartmentId: (await db.department.findUnique({ where: { code: 'MAINT' } }))?.id,
        status: 'Submitted', state: 'open',
      },
    ]

    for (const r of reqSamples) {
      const existing = await db.requisition.findUnique({ where: { refNumber: r.refNumber } })
      if (!existing) {
        await db.requisition.create({
          data: {
            ...r,
            assigneeId: r.targetUserId,
          } as any,
        })
        // Create initial route
        const req = await db.requisition.findUnique({ where: { refNumber: r.refNumber } })
        if (req) {
          await db.requisitionRoute.create({
            data: {
              requisitionId: req.id,
              fromUserId: r.createdById,
              toUserId: r.targetUserId,
              toDesignationId: r.targetDesignationId,
              toDepartmentId: r.targetDepartmentId,
              action: 'submit',
              remarks: 'Requisition submitted',
            },
          })
        }
      }
    }
    console.log('✓ Sample requisitions seeded')
  }

  // 6. Sample mail to CMD
  if (cmdUser && cmaUser && hodSurgUser) {
    const mails = [
      { subject: 'Monthly executive briefing — October 2025', body: 'Sir, please find attached the monthly executive briefing for October 2025. Key highlights: clinical operations metrics, finance summary, staffing updates.', fromId: cmaUser.id, toId: cmdUser.id, priority: 'Normal' },
      { subject: 'URGENT: ICU equipment procurement request', body: 'Sir, the Director of Finance has raised an urgent requisition (FUTH/REQ/EXP/2025/0002) for ICU equipment procurement totalling 28.5M NGN. Awaiting your approval.', fromId: cmaUser.id, toId: cmdUser.id, priority: 'Urgent' },
      { subject: 'Surgery department quarterly review', body: 'Sir, please find attached the Q3 2025 performance review for the Surgery department. We had 1,240 major surgical procedures with 98.2% success rate.', fromId: hodSurgUser.id, toId: cmdUser.id, priority: 'High' },
      { subject: 'Staff promotion recommendations', body: 'Sir, the HR committee has finalized the 2025 promotion recommendations. 47 staff are recommended for promotion effective 1 January 2026. Awaiting your endorsement.', fromId: cmaUser.id, toId: cmdUser.id, priority: 'High' },
    ]
    for (const m of mails) {
      const exists = await db.mailMessage.findFirst({ where: { subject: m.subject, fromId: m.fromId, toId: m.toId } })
      if (!exists) {
        await db.mailMessage.create({ data: m })
      }
    }
    console.log('✓ Sample CMD mail seeded')
  }

  console.log('Seeding complete!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
