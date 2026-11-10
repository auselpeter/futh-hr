import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const report = await db.generatedReport.findUnique({
      where: { id },
      include: {
        template: { select: { id: true, code: true, name: true, category: true } },
      },
    })
    if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

    // Only the generator or admins can view reports
    const role = user.activeRole || user.role
    if (report.generatedById !== user.id && !['SUPER_ADMIN', 'ADMIN', 'CMD'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json({ report })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to fetch report' }, { status: 500 })
  }
}
