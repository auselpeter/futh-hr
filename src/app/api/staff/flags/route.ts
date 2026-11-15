import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

// GET /api/staff/flags?type=confirmation|promotion|retirement|all
//
// Returns staff whose:
//   - Confirmation is due (dateHired + 2 years, no confirmationDate set, within 90 days of due date)
//   - Confirmation is overdue (>2 years 3 months since dateHired, still no confirmationDate)
//   - Promotion is due (>=3 years since last promotion or since dateHired if no promotion ever)
//   - Promotion is overdue (>3 years 3 months since last promotion)
//   - Retirement is due (retirementDate within next 90 days)
//   - Retirement is overdue (retirementDate in the past and status != 'retired')
//
// All thresholds can be overridden via query params: confirmationDueYears,
// confirmationOverdueMonths, promotionDueYears, retirementDueDays.
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const filterType = searchParams.get('type') || 'all'
    const confirmationDueYears = Number(searchParams.get('confirmationDueYears') || 2)
    const confirmationOverdueMonths = Number(searchParams.get('confirmationOverdueMonths') || 3)
    const promotionDueYears = Number(searchParams.get('promotionDueYears') || 3)
    const promotionOverdueMonths = Number(searchParams.get('promotionOverdueMonths') || 3)
    const retirementDueDays = Number(searchParams.get('retirementDueDays') || 90)

    const now = new Date()
    const confirmationDueMs = confirmationDueYears * 365 * 24 * 60 * 60 * 1000
    const confirmationOverdueMs = (confirmationDueYears * 12 + confirmationOverdueMonths) * 30 * 24 * 60 * 60 * 1000
    const promotionDueMs = promotionDueYears * 365 * 24 * 60 * 60 * 1000
    const promotionOverdueMs = (promotionDueYears * 12 + promotionOverdueMonths) * 30 * 24 * 60 * 60 * 1000
    const retirementDueMs = retirementDueDays * 24 * 60 * 60 * 1000

    // Pull all active staff with their department + last promotion
    const staff = await db.staff.findMany({
      where: { status: { in: ['active', 'on_leave'] } },
      orderBy: [{ fullName: 'asc' }],
      include: {
        department: { select: { id: true, code: true, name: true, isClinical: true } },
        promotions: {
          where: { state: 'approved' },
          orderBy: [{ createdAt: 'desc' }],
          take: 1,
          select: { id: true, refNumber: true, effectiveDate: true, createdAt: true },
        },
      },
    })

    const flags: any[] = []
    for (const s of staff) {
      const staffFlags: any[] = []

      // === Confirmation flags ===
      // Eligible only if employment type is permanent/contract AND no confirmationDate set
      if (!s.confirmationDate && s.dateHired && (s.employmentType === 'permanent' || s.employmentType === 'contract')) {
        const elapsed = now.getTime() - s.dateHired.getTime()
        const dueDate = new Date(s.dateHired.getTime() + confirmationDueMs)
        const overdueDate = new Date(s.dateHired.getTime() + confirmationOverdueMs)
        if (now > overdueDate) {
          staffFlags.push({
            type: 'confirmation_overdue',
            label: 'Confirmation Overdue',
            severity: 'critical',
            dueDate: dueDate.toISOString().slice(0, 10),
            overdueDate: overdueDate.toISOString().slice(0, 10),
            daysOverdue: Math.round((now.getTime() - overdueDate.getTime()) / (24 * 60 * 60 * 1000)),
          })
        } else if (elapsed >= confirmationDueMs - retirementDueMs) {
          // Due within the next 90 days OR already due but not yet overdue
          staffFlags.push({
            type: 'confirmation_due',
            label: 'Confirmation Due',
            severity: 'warning',
            dueDate: dueDate.toISOString().slice(0, 10),
            daysUntilDue: Math.round((dueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
          })
        }
      }

      // === Promotion flags ===
      // Last promotion date OR dateHired (whichever is later)
      const lastPromotion = s.promotions[0]
      const promoBaseline = lastPromotion ? lastPromotion.effectiveDate || lastPromotion.createdAt : s.dateHired
      if (promoBaseline) {
        const elapsed = now.getTime() - promoBaseline.getTime()
        const dueDate = new Date(promoBaseline.getTime() + promotionDueMs)
        const overdueDate = new Date(promoBaseline.getTime() + promotionOverdueMs)
        if (now > overdueDate) {
          staffFlags.push({
            type: 'promotion_overdue',
            label: 'Promotion Overdue',
            severity: 'critical',
            dueDate: dueDate.toISOString().slice(0, 10),
            overdueDate: overdueDate.toISOString().slice(0, 10),
            daysOverdue: Math.round((now.getTime() - overdueDate.getTime()) / (24 * 60 * 60 * 1000)),
            lastPromotionRef: lastPromotion?.refNumber || null,
            lastPromotionDate: lastPromotion ? (lastPromotion.effectiveDate || lastPromotion.createdAt).toISOString().slice(0, 10) : null,
          })
        } else if (elapsed >= promotionDueMs - retirementDueMs) {
          staffFlags.push({
            type: 'promotion_due',
            label: 'Promotion Due',
            severity: 'warning',
            dueDate: dueDate.toISOString().slice(0, 10),
            daysUntilDue: Math.round((dueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
            lastPromotionRef: lastPromotion?.refNumber || null,
            lastPromotionDate: lastPromotion ? (lastPromotion.effectiveDate || lastPromotion.createdAt).toISOString().slice(0, 10) : null,
          })
        }
      }

      // === Retirement flags ===
      if (s.retirementDate) {
        const diff = s.retirementDate.getTime() - now.getTime()
        if (diff < 0) {
          // Overdue (retirement date in the past and status not 'retired')
          staffFlags.push({
            type: 'retirement_overdue',
            label: 'Retirement Overdue',
            severity: 'critical',
            dueDate: s.retirementDate.toISOString().slice(0, 10),
            daysOverdue: Math.round(-diff / (24 * 60 * 60 * 1000)),
          })
        } else if (diff <= retirementDueMs) {
          // Due within 90 days
          staffFlags.push({
            type: 'retirement_due',
            label: 'Retirement Due',
            severity: 'warning',
            dueDate: s.retirementDate.toISOString().slice(0, 10),
            daysUntilDue: Math.round(diff / (24 * 60 * 60 * 1000)),
          })
        }
      }

      // Filter by requested type
      const visible = filterType === 'all'
        ? staffFlags
        : staffFlags.filter((f) => f.type.startsWith(filterType))
      if (visible.length > 0) {
        flags.push({
          staff: {
            id: s.id, staffId: s.staffId, fullName: s.fullName, position: s.position, rank: s.rank,
            gradeLevel: s.gradeLevel, status: s.status,
            dateHired: s.dateHired, confirmationDate: s.confirmationDate, retirementDate: s.retirementDate,
            department: s.department,
          },
          flags: visible,
        })
      }
    }

    // Compute summary counts
    const summary = {
      staffFlagged: flags.length,
      confirmationDue: flags.filter((f) => f.flags.some((fl: any) => fl.type === 'confirmation_due')).length,
      confirmationOverdue: flags.filter((f) => f.flags.some((fl: any) => fl.type === 'confirmation_overdue')).length,
      promotionDue: flags.filter((f) => f.flags.some((fl: any) => fl.type === 'promotion_due')).length,
      promotionOverdue: flags.filter((f) => f.flags.some((fl: any) => fl.type === 'promotion_overdue')).length,
      retirementDue: flags.filter((f) => f.flags.some((fl: any) => fl.type === 'retirement_due')).length,
      retirementOverdue: flags.filter((f) => f.flags.some((fl: any) => fl.type === 'retirement_overdue')).length,
    }

    return NextResponse.json({ flags, summary })
  } catch (e: any) {
    console.error('Staff flags:', e)
    return NextResponse.json({ error: 'Failed to fetch staff flags' }, { status: 500 })
  }
}
