import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, isAdmin } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'
import bcrypt from 'bcryptjs'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await getCurrentUser()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!isAdmin(me.role)) return NextResponse.json({ error: 'Forbidden — admin access required' }, { status: 403 })
    const { id } = await params
    const body = await req.json()
    const { status, newPassword, resolvedNote } = body || {}
    const existing = await db.passwordResetRequest.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Reset request not found' }, { status: 404 })
    if (!['resolved', 'dismissed'].includes(status)) return NextResponse.json({ error: 'Status must be "resolved" or "dismissed"' }, { status: 400 })
    let finalPassword: string | null = null
    if (status === 'resolved') {
      finalPassword = newPassword && String(newPassword).trim() ? String(newPassword).trim() : 'admin123'
      if (existing.userId) await db.user.update({ where: { id: existing.userId }, data: { passwordHash: bcrypt.hashSync(finalPassword, 10) } })
    }
    const updated = await db.passwordResetRequest.update({
      where: { id },
      data: { status, resolvedById: me.id, resolvedAt: new Date(), resolvedNote: resolvedNote || (status === 'resolved' ? `Password reset to ${finalPassword === 'admin123' ? 'default (admin123)' : 'custom password'}` : 'Dismissed by admin') },
      include: { user: { select: { id: true, fullName: true, username: true, email: true, role: true } }, resolvedBy: { select: { id: true, fullName: true } } },
    })
    await audit(me, 'update', { entity: 'PasswordResetRequest', entityId: id, details: `${status === 'resolved' ? 'Resolved' : 'Dismissed'} password reset request for "${existing.usernameQuery}"${finalPassword ? ` — password set to ${finalPassword === 'admin123' ? 'default' : 'custom'}` : ''}`, ipAddress: getIp(req) })
    return NextResponse.json({ request: updated, ...(finalPassword ? { resetPassword: finalPassword } : {}) })
  } catch (e: any) { return NextResponse.json({ error: 'Failed to update' }, { status: 500 }) }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await getCurrentUser()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!isAdmin(me.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const { id } = await params
    await db.passwordResetRequest.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch { return NextResponse.json({ error: 'Failed to delete' }, { status: 500 }) }
}
