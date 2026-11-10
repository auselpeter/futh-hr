import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const types = await db.leaveType.findMany({ orderBy: [{ code: 'asc' }] })
    return NextResponse.json({ leaveTypes: types })
  } catch (e: any) {
    console.error('LeaveTypes list:', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
