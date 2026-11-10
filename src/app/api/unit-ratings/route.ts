import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

// GET /api/unit-ratings?period=YYYY-MM
// Returns array of { id, code, name, staffCount, dutyCount, avgScore, period }
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { searchParams } = new URL(req.url)
    const period = searchParams.get('period') || ''
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

    const units = await db.unit.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: { department: { select: { id: true, code: true, name: true } }, _count: { select: { staff: true } } },
    })

    const ratings = []
    for (const u of units) {
      const dutyWhere: any = { staff: { unitId: u.id } }
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
      const staffCount = u._count?.staff || 0
      ratings.push({
        id: u.id,
        code: u.code,
        name: u.name,
        staffCount,
        dutyCount,
        avgScore: Math.round(avgScore * 100) / 100,
        period: periodStr,
        department: u.department,
      })
    }

    return NextResponse.json({ ratings })
  } catch (e: any) {
    console.error('Unit ratings:', e)
    return NextResponse.json({ error: 'Failed to fetch unit ratings' }, { status: 500 })
  }
}
