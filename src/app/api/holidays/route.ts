import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { searchParams } = new URL(req.url)
    const year = searchParams.get('year')
    const where: any = { isActive: true }
    if (year) {
      const start = new Date(`${year}-01-01T00:00:00Z`)
      const end = new Date(`${Number(year) + 1}-01-01T00:00:00Z`)
      where.date = { gte: start, lt: end }
    }
    const holidays = await db.holiday.findMany({
      where,
      orderBy: [{ date: 'asc' }],
    })
    return NextResponse.json({ holidays })
  } catch (e: any) {
    console.error('Holidays list:', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
