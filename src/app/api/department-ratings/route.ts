import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

// GET /api/department-ratings?period=YYYY-MM
// Returns array of { id, code, name, staffCount, dutyCount, avgScore, period }
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { searchParams } = new URL(req.url)
    const period = searchParams.get('period') || ''
    // Parse period "YYYY-MM" to year + month (1-12)
    let year: number | undefined
    let month: number | undefined
    let periodStr = period
    if (period && /^\d{4}-\d{2}$/.test(period)) {
      const [y, m] = period.split('-').map(Number)
      year = y
      month = m
      periodStr = `${y}-${String(m).padStart(2, '0')}`
    } else if (period && /^\d{4}$/.test(period)) {
      year = parseInt(period, 10)
      periodStr = period
    }

    const departments = await db.department.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { staff: true } },
      },
    })

    // For each department, count duties and average achieved score
    const ratings = []
    for (const d of departments) {
      const dutyWhere: any = { staff: { departmentId: d.id } }
      if (year) dutyWhere.period = { contains: periodStr }
      const duties = await db.duty.findMany({
        where: dutyWhere,
        select: { achievedScore: true, targetScore: true, status: true },
      })
      const dutyCount = duties.length
      const scored = duties.filter((x) => x.achievedScore !== null && x.achievedScore !== undefined)
      const avgScore = scored.length
        ? scored.reduce((sum, x) => sum + (Number(x.achievedScore) || 0), 0) / scored.length
        : 0
      const staffCount = d._count?.staff || 0
      ratings.push({
        id: d.id,
        code: d.code,
        name: d.name,
        staffCount,
        dutyCount,
        avgScore: Math.round(avgScore * 100) / 100,
        period: periodStr,
      })
    }

    return NextResponse.json({ ratings })
  } catch (e: any) {
    console.error('Department ratings:', e)
    return NextResponse.json({ error: 'Failed to fetch department ratings' }, { status: 500 })
  }
}
