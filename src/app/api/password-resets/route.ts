import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, isAdmin } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const where: any = {}
    if (status) where.status = status
    if (!isAdmin(user.role)) where.userId = user.id
    const requests = await db.passwordResetRequest.findMany({
      where, orderBy: [{ createdAt: 'desc' }],
      include: { user: { select: { id: true, fullName: true, username: true, email: true, role: true } }, resolvedBy: { select: { id: true, fullName: true } } },
      take: 200,
    })
    return NextResponse.json({ requests })
  } catch (e: any) { return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 }) }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { usernameQuery, contactEmail, contactPhone, note } = body || {}
    if (!usernameQuery || !String(usernameQuery).trim()) return NextResponse.json({ error: 'Username or IPPIS number is required' }, { status: 400 })
    const q = String(usernameQuery).trim()
    let user = await db.user.findUnique({ where: { username: q.toLowerCase() } })
    if (!user) user = await db.user.findFirst({ where: { staff: { ippisNumber: q } } })
    if (!user) user = await db.user.findFirst({ where: { staff: { staffId: q } } })
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const throttleWhere = user ? { userId: user.id, status: 'pending', createdAt: { gte: since } } : { usernameQuery: q, status: 'pending', createdAt: { gte: since } }
    const recentCount = await db.passwordResetRequest.count({ where: throttleWhere })
    if (recentCount >= 3) return NextResponse.json({ error: 'You already have 3 pending reset requests.' }, { status: 429 })
    const request = await db.passwordResetRequest.create({
      data: { userId: user?.id || null, usernameQuery: q, contactEmail: contactEmail || null, contactPhone: contactPhone || null, note: note || null, status: 'pending' },
      include: { user: { select: { id: true, fullName: true, username: true, email: true, role: true } } },
    })
    try { await db.auditLog.create({ data: { userId: user?.id || 'unknown', action: 'create', entity: 'PasswordResetRequest', entityId: request.id, details: `Forgot-password request for "${q}"`, ipAddress: getIp(req) } }) } catch {}
    return NextResponse.json({ request })
  } catch (e: any) { return NextResponse.json({ error: 'Failed to submit' }, { status: 500 }) }
}
