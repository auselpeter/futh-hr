import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { buildScopeFilter, applyScope } from '@/lib/scope'

type PendingItem = {
  type: 'requisition' | 'file' | 'leave' | 'promotion' | 'termination' | 'resignation'
  id: string
  refNumber: string
  subject: string
  status: string
  priority: string
  createdAt: Date
  link: string
}

/**
 * GET /api/dashboard/pending
 *
 * Returns the aggregated count of pending items awaiting the current user's
 * action across all six lifecycle entity types, plus a flat list of the most
 * recent 10 pending items (across all types).
 *
 * Scoping:
 *  - Requisitions: assigneeId = user OR (assigneeId IS NULL AND targetDesignationId = user.designationId), AND state != closed_permanently
 *  - Files: currentHolderId = user OR (currentHolderId IS NULL AND targetDesignationId = user.designationId), AND state != archived
 *  - Leaves: status Pending → HOD, HOD Approved → DFA, DFA Approved → CMD
 *  - Promotions: status Submitted → HOD, HOD Approved → DFA, DFA Approved → CMD
 *  - Terminations: same as Promotions
 *  - Resignations: status Submitted → HOD, HOD Acknowledged → DFA, DFA Approved → CMD
 */
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = user.activeRole || user.role

    // =================== Requisitions ===================
    const reqScope = buildScopeFilter(user, 'requisition')
    const reqWhere = applyScope(
      {
        AND: [
          { state: { not: 'closed_permanently' } },
          {
            OR: [
              { assigneeId: user.id },
              {
                assigneeId: null,
                targetDesignationId: user.designationId ?? undefined,
              },
            ],
          },
        ],
      },
      reqScope,
    )
    const requisitions = await db.requisition.findMany({
      where: reqWhere,
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true, refNumber: true, subject: true, status: true, priority: true, createdAt: true,
      },
    })

    // =================== Files ===================
    const fileScope = buildScopeFilter(user, 'file')
    const fileWhere = applyScope(
      {
        AND: [
          { state: { not: 'archived' } },
          {
            OR: [
              { currentHolderId: user.id },
              {
                currentHolderId: null,
                targetDesignationId: user.designationId ?? undefined,
              },
            ],
          },
        ],
      },
      fileScope,
    )
    const files = await db.registryFile.findMany({
      where: fileWhere,
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true, fileNumber: true, subject: true, status: true, priority: true, createdAt: true,
      },
    })

    // =================== Leaves ===================
    // Pending for: HOD when status=Pending, DFA when status=HOD Approved, CMD when status=DFA Approved
    const leaveStatuses: string[] = []
    if (role === 'HOD' || role === 'HOU' || role === 'SUPER_ADMIN' || role === 'ADMIN') leaveStatuses.push('Pending')
    if (role === 'DFA' || role === 'SUPER_ADMIN' || role === 'ADMIN') leaveStatuses.push('HOD Approved')
    if (role === 'CMD' || role === 'SUPER_ADMIN' || role === 'ADMIN') leaveStatuses.push('DFA Approved')
    // For SUPER_ADMIN/ADMIN/CMD/DFA/AD without specific role match, default to all "open" leaves
    let leaveWhere: any = { state: { notIn: ['approved', 'rejected', 'cancelled'] } }
    if (leaveStatuses.length > 0) {
      leaveWhere = { ...leaveWhere, status: { in: leaveStatuses } }
    }
    const leaveScope = buildScopeFilter(user, 'leave')
    leaveWhere = applyScope(leaveWhere, leaveScope)
    const leaves = await db.leave.findMany({
      where: leaveWhere,
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true, refNumber: true, reason: true, status: true, createdAt: true,
        staff: { select: { fullName: true } },
        leaveType: { select: { name: true } },
      },
    })

    // =================== Promotions ===================
    const promoStatuses: string[] = []
    if (role === 'HOD' || role === 'HOU' || role === 'SUPER_ADMIN' || role === 'ADMIN') promoStatuses.push('Submitted')
    if (role === 'DFA' || role === 'SUPER_ADMIN' || role === 'ADMIN') promoStatuses.push('HOD Approved')
    if (role === 'CMD' || role === 'SUPER_ADMIN' || role === 'ADMIN') promoStatuses.push('DFA Approved')
    let promoWhere: any = { state: { notIn: ['approved', 'rejected', 'cancelled'] } }
    if (promoStatuses.length > 0) {
      promoWhere = { ...promoWhere, status: { in: promoStatuses } }
    }
    const promoScope = buildScopeFilter(user, 'promotion')
    promoWhere = applyScope(promoWhere, promoScope)
    const promotions = await db.promotion.findMany({
      where: promoWhere,
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true, refNumber: true, currentPosition: true, newPosition: true, status: true, createdAt: true,
        staff: { select: { fullName: true } },
      },
    })

    // =================== Terminations ===================
    const termStatuses: string[] = []
    if (role === 'HOD' || role === 'HOU' || role === 'SUPER_ADMIN' || role === 'ADMIN') termStatuses.push('Submitted')
    if (role === 'DFA' || role === 'SUPER_ADMIN' || role === 'ADMIN') termStatuses.push('HOD Approved')
    if (role === 'CMD' || role === 'SUPER_ADMIN' || role === 'ADMIN') termStatuses.push('DFA Approved')
    let termWhere: any = { state: { notIn: ['approved', 'rejected', 'cancelled'] } }
    if (termStatuses.length > 0) {
      termWhere = { ...termWhere, status: { in: termStatuses } }
    }
    const termScope = buildScopeFilter(user, 'termination')
    termWhere = applyScope(termWhere, termScope)
    const terminations = await db.termination.findMany({
      where: termWhere,
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true, refNumber: true, reason: true, type: true, status: true, createdAt: true,
        staff: { select: { fullName: true } },
      },
    })

    // =================== Resignations ===================
    const resStatuses: string[] = []
    if (role === 'HOD' || role === 'HOU' || role === 'SUPER_ADMIN' || role === 'ADMIN') resStatuses.push('Submitted')
    if (role === 'DFA' || role === 'SUPER_ADMIN' || role === 'ADMIN') resStatuses.push('HOD Acknowledged')
    if (role === 'CMD' || role === 'SUPER_ADMIN' || role === 'ADMIN') resStatuses.push('DFA Approved')
    let resWhere: any = { state: { notIn: ['approved', 'rejected', 'cancelled'] }, isWithdrawn: false }
    if (resStatuses.length > 0) {
      resWhere = { ...resWhere, status: { in: resStatuses } }
    }
    const resScope = buildScopeFilter(user, 'resignation')
    resWhere = applyScope(resWhere, resScope)
    const resignations = await db.resignation.findMany({
      where: resWhere,
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true, refNumber: true, reason: true, status: true, createdAt: true,
        staff: { select: { fullName: true } },
      },
    })

    // =================== Aggregate ===================
    const toPending = (item: any, type: PendingItem['type'], refKey: string, subjectKey: string, link: string): PendingItem => ({
      type,
      id: item.id,
      refNumber: item[refKey] as string,
      subject: item[subjectKey] || item.staff?.fullName || '—',
      status: item.status,
      priority: item.priority || 'Normal',
      createdAt: item.createdAt,
      link,
    })

    const allPending: PendingItem[] = [
      ...requisitions.map((r) => toPending(r, 'requisition', 'refNumber', 'subject', `requisition:${r.id}`)),
      ...files.map((f) => toPending(f, 'file', 'fileNumber', 'subject', `file:${f.id}`)),
      ...leaves.map((l) => ({ type: 'leave' as const, id: l.id, refNumber: l.refNumber, subject: `${l.staff?.fullName || ''} — ${l.leaveType?.name || 'Leave'}`, status: l.status, priority: 'Normal', createdAt: l.createdAt, link: `leave:${l.id}` })),
      ...promotions.map((p) => ({ type: 'promotion' as const, id: p.id, refNumber: p.refNumber, subject: `${p.staff?.fullName || ''} — ${p.currentPosition || ''} → ${p.newPosition || ''}`, status: p.status, priority: 'Normal', createdAt: p.createdAt, link: `promotion:${p.id}` })),
      ...terminations.map((t) => ({ type: 'termination' as const, id: t.id, refNumber: t.refNumber, subject: `${t.staff?.fullName || ''} — ${t.reason || t.type || ''}`, status: t.status, priority: 'Normal', createdAt: t.createdAt, link: `termination:${t.id}` })),
      ...resignations.map((r) => ({ type: 'resignation' as const, id: r.id, refNumber: r.refNumber, subject: `${r.staff?.fullName || ''} — ${r.reason || ''}`, status: r.status, priority: 'Normal', createdAt: r.createdAt, link: `resignation:${r.id}` })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

    const counts = {
      requisitions: requisitions.length,
      files: files.length,
      leaves: leaves.length,
      promotions: promotions.length,
      terminations: terminations.length,
      resignations: resignations.length,
    }

    return NextResponse.json({
      counts,
      total: counts.requisitions + counts.files + counts.leaves + counts.promotions + counts.terminations + counts.resignations,
      recent: allPending.slice(0, 10),
    })
  } catch (e: any) {
    console.error('Dashboard pending error:', e)
    return NextResponse.json({ error: 'Failed to fetch pending items' }, { status: 500 })
  }
}
