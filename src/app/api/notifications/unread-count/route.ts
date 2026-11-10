import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ count: 0 })
    const count = await db.notification.count({
      where: { userId: user.id, isRead: false },
    })
    return NextResponse.json({ count })
  } catch (e: any) {
    return NextResponse.json({ count: 0 })
  }
}
