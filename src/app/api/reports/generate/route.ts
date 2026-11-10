import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'

// POST /api/reports/generate — generate a new report from a template
// Body: { templateId, startDate?, endDate?, departmentId? }
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json()
    const { templateId, startDate, endDate, departmentId } = body || {}
    if (!templateId) return NextResponse.json({ error: 'templateId is required' }, { status: 400 })

    const template = await db.reportTemplate.findUnique({ where: { id: templateId } })
    if (!template || !template.isActive) {
      return NextResponse.json({ error: 'Template not found or inactive' }, { status: 404 })
    }

    // Build the report data based on the template code / module
    let rows: any[] = []
    const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1)
    const end = endDate ? new Date(endDate) : new Date()
    const deptFilter = departmentId ? { departmentId } : {}

    switch (template.code) {
      case 'STAFF_DIRECTORY':
      case 'STAFF_LIST':
      case 'STAFF_REPORT': {
        const staff = await db.staff.findMany({
          where: deptFilter,
          orderBy: { fullName: 'asc' },
          include: { department: { select: { code: true, name: true } }, designation: { select: { code: true, name: true } } },
        })
        rows = staff.map((s) => ({
          StaffID: s.staffId,
          FullName: s.fullName,
          Department: s.department?.name || '',
          Designation: s.designation?.name || '',
          Position: s.position || '',
          Rank: s.rank || '',
          Status: s.status,
          Email: s.email || '',
          Phone: s.phone || '',
          DateHired: s.dateHired ? new Date(s.dateHired).toISOString().split('T')[0] : '',
        }))
        break
      }
      case 'LEAVE_REPORT':
      case 'LEAVES_REPORT': {
        const leaves = await db.leave.findMany({
          where: {
            ...(departmentId ? { staff: { departmentId } } : {}),
            createdAt: { gte: start, lte: end },
          },
          orderBy: { createdAt: 'desc' },
          include: { staff: { select: { fullName: true, staffId: true, department: { select: { name: true } } } }, leaveType: { select: { name: true } } },
        })
        rows = leaves.map((l) => ({
          RefNumber: l.refNumber,
          Staff: l.staff?.fullName || '',
          StaffID: l.staff?.staffId || '',
          Department: l.staff?.department?.name || '',
          LeaveType: l.leaveType?.name || '',
          StartDate: new Date(l.startDate).toISOString().split('T')[0],
          EndDate: new Date(l.endDate).toISOString().split('T')[0],
          Days: l.daysRequested,
          Reason: l.reason,
          Status: l.status,
        }))
        break
      }
      case 'DUTY_REPORT':
      case 'DUTIES_REPORT': {
        const duties = await db.duty.findMany({
          where: {
            ...(departmentId ? { staff: { departmentId } } : {}),
            createdAt: { gte: start, lte: end },
          },
          orderBy: { createdAt: 'desc' },
          include: { staff: { select: { fullName: true, staffId: true, department: { select: { name: true } } } } },
        })
        rows = duties.map((d) => ({
          Title: d.title,
          Staff: d.staff?.fullName || '',
          StaffID: d.staff?.staffId || '',
          Department: d.staff?.department?.name || '',
          Type: d.type,
          Status: d.status,
          TargetScore: d.targetScore,
          AchievedScore: d.achievedScore || 0,
          Period: d.period || '',
        }))
        break
      }
      case 'PROMOTION_REPORT':
      case 'PROMOTIONS_REPORT': {
        const promos = await db.promotion.findMany({
          where: { createdAt: { gte: start, lte: end } },
          orderBy: { createdAt: 'desc' },
          include: { staff: { select: { fullName: true, staffId: true, department: { select: { name: true } } } } },
        })
        rows = promos.map((p) => ({
          RefNumber: p.refNumber,
          Staff: p.staff?.fullName || '',
          StaffID: p.staff?.staffId || '',
          Department: p.staff?.department?.name || '',
          From: p.currentPosition || '',
          To: p.newPosition || '',
          Type: p.type,
          EffectiveDate: p.effectiveDate ? new Date(p.effectiveDate).toISOString().split('T')[0] : '',
          Status: p.status,
        }))
        break
      }
      case 'TRAINING_REPORT':
      case 'TRAININGS_REPORT': {
        const trainings = await db.training.findMany({
          where: { startDate: { gte: start, lte: end } },
          include: { department: { select: { name: true } }, _count: { select: { enrollments: true } } },
        })
        rows = trainings.map((t) => ({
          Code: t.code,
          Title: t.title,
          Type: t.type,
          Provider: t.provider || '',
          StartDate: new Date(t.startDate).toISOString().split('T')[0],
          EndDate: new Date(t.endDate).toISOString().split('T')[0],
          Enrolled: t._count?.enrollments || 0,
          Status: t.status,
        }))
        break
      }
      case 'PROJECT_REPORT':
      case 'PROJECTS_REPORT': {
        const projects = await db.project.findMany({
          where: { startDate: { gte: start, lte: end } },
          include: { department: { select: { name: true } }, _count: { select: { members: true, milestones: true } } },
        })
        rows = projects.map((p) => ({
          Code: p.code,
          Title: p.title,
          Type: p.type,
          Priority: p.priority,
          Department: p.department?.name || '',
          Budget: p.budget || 0,
          Spent: p.spent,
          Progress: p.progress,
          Status: p.status,
        }))
        break
      }
      case 'PV_REPORT':
      case 'PAYMENT_VOUCHER_REPORT': {
        const pvs = await db.paymentVoucher.findMany({
          where: { createdAt: { gte: start, lte: end } },
          include: { requisition: { select: { refNumber: true } } },
        })
        rows = pvs.map((p) => ({
          RefNumber: p.refNumber,
          PVType: p.pvType,
          Payee: p.payeeName,
          VoucherNumber: p.voucherNumber || '',
          AmountNaira: p.amountNaira,
          AmountKobo: p.amountKobo,
          Requisition: p.requisition?.refNumber || '',
          Status: p.status,
          PaidAt: p.paidAt ? new Date(p.paidAt).toISOString().split('T')[0] : '',
        }))
        break
      }
      default: {
        // Generic — return staff count by department
        const departments = await db.department.findMany({
          where: { isActive: true },
          include: { _count: { select: { staff: true, users: true, units: true } } },
        })
        rows = departments.map((d) => ({
          Code: d.code,
          Name: d.name,
          Faculty: d.faculty || '',
          StaffCount: d._count?.staff || 0,
          UserCount: d._count?.users || 0,
          UnitCount: d._count?.units || 0,
        }))
      }
    }

    const fileName = `${template.code}_${new Date().toISOString().split('T')[0]}`
    const report = await db.generatedReport.create({
      data: {
        templateId,
        startDate: start,
        endDate: end,
        departmentId: departmentId || null,
        filters: JSON.stringify({ startDate, endDate, departmentId }),
        fileName,
        fileUrl: null,
        data: JSON.stringify(rows),
        generatedById: user.id,
      },
      include: {
        template: { select: { id: true, code: true, name: true, category: true } },
      },
    })

    await audit(user, 'create', { entity: 'GeneratedReport', entityId: report.id, details: `Generated ${template.name} (${rows.length} rows)`, ipAddress: getIp(req) })
    return NextResponse.json({ report, rows })
  } catch (e: any) {
    console.error('Report generate:', e)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}
