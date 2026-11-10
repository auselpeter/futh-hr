// Extended seed script for FUTH Lafia HR System (v2 — appraisal + leaves + enriched staff)
// Run with: bun run /home/z/my-project/scripts/seed-extended.ts

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  console.log('Seeding FUTH HR v2 extended data (appraisals, leaves, enriched staff, leave types)...')

  // 1. Leave Types
  const leaveTypes = [
    { code: 'annual',        name: 'Annual Leave',          defaultDays: 30, isPaid: true,  requiresCertificate: false },
    { code: 'study',        name: 'Study Leave',           defaultDays: 14, isPaid: true,  requiresCertificate: false },
    { code: 'sick',         name: 'Sick Leave',            defaultDays: 14, isPaid: true,  requiresCertificate: true  },
    { code: 'maternity',    name: 'Maternity Leave',       defaultDays: 90, isPaid: true,  requiresCertificate: true  },
    { code: 'paternity',    name: 'Paternity Leave',       defaultDays: 7,  isPaid: true,  requiresCertificate: false },
    { code: 'casual',       name: 'Casual Leave',          defaultDays: 5,  isPaid: true,  requiresCertificate: false },
    { code: 'compassionate',name: 'Compassionate Leave',   defaultDays: 5,  isPaid: true,  requiresCertificate: false },
    { code: 'examination', name: 'Examination Leave',     defaultDays: 7,  isPaid: true,  requiresCertificate: false },
    { code: 'sabbatical',  name: 'Sabbatical Leave',       defaultDays: 365,isPaid: false, requiresCertificate: false },
    { code: 'without_pay', name: 'Leave Without Pay',     defaultDays: 30, isPaid: false, requiresCertificate: false },
  ]
  for (const lt of leaveTypes) {
    await db.leaveType.upsert({
      where: { code: lt.code },
      update: { name: lt.name, defaultDays: lt.defaultDays, isPaid: lt.isPaid, requiresCertificate: lt.requiresCertificate, isActive: true },
      create: lt,
    })
  }
  console.log(`✓ ${leaveTypes.length} leave types seeded`)

  // 2. Update existing Staff with NIN/TIN/Pension + create enrichment records
  const allStaff = await db.staff.findMany({ include: { user: true } })
  let count = 0
  for (const s of allStaff) {
    const nin = `10${String(20000000000 + count).slice(-10)}`
    const tin = `TIN-${String(1000000 + count)}`
    const pension = `PEN-${String(200000 + count)}-${String(new Date().getFullYear())}`
    const updated = await db.staff.update({
      where: { id: s.id },
      data: {
        ninNumber: nin,
        tinNumber: tin,
        pensionNumber: pension,
        nhfNumber: `NHF-${String(300000 + count)}`,
        nhisNumber: `NHIS-${String(400000 + count)}`,
        dateOfBirth: new Date(1980 + (count % 15), count % 12, ((count * 3) % 28) + 1),
        maritalStatus: count % 3 === 0 ? 'Single' : 'Married',
        nationality: 'Nigerian',
        stateOfOrigin: ['Nasarawa', 'Kano', 'Lagos', 'Rivers', 'Kaduna'][count % 5],
        lga: ['Lafia', 'Kano Municipal', 'Ikeja', 'Port Harcourt', 'Kaduna North'][count % 5],
        residentialAddress: `${count + 1} Staff Quarters, FUTH Lafia`,
        permanentAddress: `${count + 1} Home Town Address, Nasarawa State`,
        cityOfResidence: 'Lafia',
        stateOfResidence: 'Nasarawa',
      },
    })

    // Create Next of Kin (primary)
    const existingNok = await db.nextOfKin.findFirst({ where: { staffId: s.id } })
    if (!existingNok) {
      await db.nextOfKin.create({
        data: {
          staffId: s.id,
          fullName: `${s.firstName} Spouse`,
          relationship: 'Spouse',
          phone: `+234 80${count + 1} 123 4567`,
          email: `nok.${count}@example.com`,
          address: `${count + 1} Family Home, Lafia`,
          city: 'Lafia',
          state: 'Nasarawa',
          occupation: 'Civil Servant',
          isPrimary: true,
        },
      })
    }

    // Create Bank Detail (primary)
    const existingBank = await db.bankDetail.findFirst({ where: { staffId: s.id } })
    if (!existingBank) {
      await db.bankDetail.create({
        data: {
          staffId: s.id,
          bankName: ['Zenith Bank', 'Access Bank', 'GTBank', 'First Bank', 'UBA'][count % 5],
          accountName: s.fullName,
          accountNumber: `${String(1000000000 + count * 1373)}`,
          accountType: 'Salary',
          bvnNumber: `2222222${String(2222 + count)}`,
          isPrimary: true,
        },
      })
    }

    // Create Academic Background
    const existingAcademic = await db.academicBackground.findFirst({ where: { staffId: s.id } })
    if (!existingAcademic) {
      await db.academicBackground.create({
        data: {
          staffId: s.id,
          institution: ['University of Jos', 'Ahmadu Bello University', 'University of Lagos', 'Bayero University Kano'][count % 4],
          qualification: ['BSc', 'MBBS', 'MSc', 'HND'][count % 4],
          field: ['Computer Science', 'Medicine', 'Accounting', 'Nursing'][count % 4],
          startDate: new Date(2005 + count, 9, 1),
          endDate: new Date(2009 + count, 7, 31),
          grade: ['First Class', 'Second Class Upper', 'Second Class Lower'][count % 3],
        },
      })
    }

    count++
  }
  console.log(`✓ ${count} staff enriched with NIN/TIN/Pension + Next of Kin + Bank + Academic records`)

  // 3. Sample Duties for first 5 staff
  const sampleDutyTitles = [
    'Clinical service delivery',
    'Patient consultation',
    'Surgical operations',
    'Inventory management',
    'Training & mentorship',
    'Research & publications',
    'Administrative tasks',
    'Audit & compliance',
  ]
  for (let i = 0; i < Math.min(5, allStaff.length); i++) {
    const s = allStaff[i]
    for (let j = 0; j < 3; j++) {
      const title = sampleDutyTitles[(i + j) % sampleDutyTitles.length]
      const existing = await db.duty.findFirst({ where: { staffId: s.id, title } })
      if (!existing) {
        await db.duty.create({
          data: {
            staffId: s.id,
            title,
            description: `Assigned duty: ${title} — period 2025`,
            weight: 1,
            targetScore: 100,
            achievedScore: 75 + (i * 5) + j,
            period: '2025',
          },
        })
      }
    }
  }
  console.log('✓ Sample duties seeded')

  // 4. Sample Annual Review for first 3 staff
  for (let i = 0; i < Math.min(3, allStaff.length); i++) {
    const s = allStaff[i]
    const existing = await db.annualReview.findFirst({ where: { staffId: s.id, period: '2025' } })
    if (!existing) {
      const score = 78 + i * 3
      const verdict = score >= 90 ? 'Outstanding' : score >= 80 ? 'Excellent' : score >= 70 ? 'Very Good' : score >= 60 ? 'Good' : score >= 50 ? 'Satisfactory' : 'Poor'
      await db.annualReview.create({
        data: {
          staffId: s.id,
          period: '2025',
          overallScore: score,
          assessmentScore: 80 + i,
          monthlyScore: 76 + i,
          quarterlyScore: 78 + i,
          appraisalScore: 82 + i,
          dutyScore: 74 + i,
          verdict,
          status: 'Completed',
          comments: 'Satisfactory performance throughout the year.',
          hodName: 'Dr. Bola Ahmed',
          hodSignedAt: new Date(),
          daName: 'Mrs. Halima Suleiman',
          daSignedAt: new Date(),
        },
      })
    }
  }
  console.log('✓ Sample annual reviews seeded')

  // 5. Sample Monthly Appraisals for first 4 staff (Q1 2026)
  for (let i = 0; i < Math.min(4, allStaff.length); i++) {
    const s = allStaff[i]
    for (let m = 1; m <= 3; m++) {
      const existing = await db.monthlyAppraisal.findFirst({ where: { staffId: s.id, year: 2026, month: m } })
      if (!existing) {
        const score = 75 + (i * 3) + (m % 3)
        await db.monthlyAppraisal.create({
          data: {
            staffId: s.id,
            period: `2026-${String(m).padStart(2, '0')}`,
            month: m,
            year: 2026,
            score,
            grade: score >= 90 ? 'A+' : score >= 80 ? 'A' : score >= 70 ? 'B' : score >= 60 ? 'C' : 'D',
            achievements: 'Met monthly targets and delivered assigned duties.',
            challenges: 'Resource constraints in week 2.',
            recommendations: 'Improve resource allocation in subsequent months.',
            status: 'Submitted',
          },
        })
      }
    }
  }
  console.log('✓ Sample monthly appraisals seeded (Q1 2026)')

  // 6. Sample Leave Application
  if (allStaff.length > 0) {
    const s = allStaff[0]
    const annualType = await db.leaveType.findUnique({ where: { code: 'annual' } })
    if (annualType) {
      const existing = await db.leave.findFirst({ where: { staffId: s.id } })
      if (!existing) {
        await db.leave.create({
          data: {
            refNumber: 'LV-2026-000001',
            staffId: s.id,
            leaveTypeId: annualType.id,
            startDate: new Date(2026, 11, 15),
            endDate: new Date(2026, 11, 28),
            daysRequested: 14,
            reason: 'Annual vacation — travel to family home for the festive season.',
            address: 'Home Town, Nasarawa State',
            phone: '+234 801 234 5678',
            status: 'Pending',
            state: 'open',
          },
        })
      }
    }
  }
  console.log('✓ Sample leave application seeded')

  // 7. Sample Holidays for 2026
  const holidays = [
    { name: 'New Year\'s Day', date: new Date(2026, 0, 1),  type: 'public' },
    { name: 'Workers\' Day',    date: new Date(2026, 4, 1),  type: 'public' },
    { name: 'Democracy Day',   date: new Date(2026, 5, 12), type: 'public' },
    { name: 'Independence Day',date: new Date(2026, 9, 1),  type: 'public' },
    { name: 'Christmas Day',   date: new Date(2026, 11, 25),type: 'public' },
    { name: 'Boxing Day',      date: new Date(2026, 11, 26),type: 'public' },
    { name: 'Eid al-Fitr',     date: new Date(2026, 2, 20), type: 'religious' },
    { name: 'Eid al-Adha',    date: new Date(2026, 5, 27), type: 'religious' },
    { name: 'Good Friday',    date: new Date(2026, 3, 3),  type: 'religious' },
    { name: 'Easter Monday',  date: new Date(2026, 3, 6),  type: 'religious' },
  ]
  for (const h of holidays) {
    const existing = await db.holiday.findFirst({ where: { name: h.name, date: h.date } })
    if (!existing) {
      await db.holiday.create({ data: h })
    }
  }
  console.log(`✓ ${holidays.length} holidays seeded`)

  console.log('Extended seeding complete!')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await db.$disconnect() })
