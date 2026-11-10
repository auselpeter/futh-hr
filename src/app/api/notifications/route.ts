import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ notifications: [] })
    const notifications = await db.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return NextResponse.json({ notifications })
  } catch (e: any) {
    return NextResponse.json({ notifications: [] })
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json().catch(() => ({}))
    const { id, all } = body || {}
    if (all) {
      await db.notification.updateMany({
        where: { userId: user.id, isRead: false },
        data: { isRead: true, readAt: new Date() },
      })
    } else if (id) {
      await db.notification.update({
        where: { id },
        data: { isRead: true, readAt: new Date() },
      })
    }
    return NextResponse.json({ message: 'Marked as read' })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to mark notifications as read' }, { status: 500 })
  }
}
