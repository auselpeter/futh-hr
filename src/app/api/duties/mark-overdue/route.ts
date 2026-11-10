import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'

// POST /api/duties/mark-overdue
// Sweep that marks all duties with dueDate < now AND status in (Assigned, In Progress) as "Overdue".
// Returns count of duties marked overdue. Anyone authenticated can trigger it (idempotent).
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const now = new Date()
    const result = await db.duty.updateMany({
      where: {
        dueDate: { lt: now },
        status: { in: ['Assigned', 'In Progress'] },
      },
      data: { status: 'Overdue' },
    })

    if (result.count > 0) {
      await audit(user, 'update', {
        entity: 'Duty',
        entityId: 'mark-overdue-sweep',
        details: `Mark-overdue sweep: ${result.count} duties marked Overdue`,
        ipAddress: getIp(req),
      })
    }

    return NextResponse.json({ markedOverdue: result.count, ranAt: now.toISOString() })
  } catch (e: any) {
    console.error('Mark overdue error:', e)
    return NextResponse.json({ error: 'Failed to mark overdue' }, { status: 500 })
  }
}

// GET — convenience for cron-style triggers / smoke testing (same logic as POST)
export async function GET() {
  try {
    const now = new Date()
    const result = await db.duty.updateMany({
      where: {
        dueDate: { lt: now },
        status: { in: ['Assigned', 'In Progress'] },
      },
      data: { status: 'Overdue' },
    })
    return NextResponse.json({ markedOverdue: result.count, ranAt: now.toISOString() })
  } catch (e: any) {
    console.error('Mark overdue error:', e)
    return NextResponse.json({ error: 'Failed to mark overdue' }, { status: 500 })
  }
}
