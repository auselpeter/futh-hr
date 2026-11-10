import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'
import { mailInclude } from '@/lib/prisma-helpers'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const mail = await db.mailMessage.findUnique({
      where: { id },
      include: mailInclude,
    })
    if (!mail) return NextResponse.json({ error: 'Mail not found' }, { status: 404 })
    // Only sender or recipient can read
    if (mail.fromId !== user.id && mail.toId !== user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }
    // Mark as read if recipient reads it for the first time
    if (mail.toId === user.id && !mail.isRead) {
      await db.mailMessage.update({
        where: { id },
        data: { isRead: true, readAt: new Date() },
      })
    }
    const fresh = await db.mailMessage.findUnique({
      where: { id },
      include: mailInclude,
    })
    return NextResponse.json({ mail: fresh })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to fetch mail' }, { status: 500 })
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const body = await req.json()
    const { action } = body || {} // read | star | archive | unstar | unarchive
    const mail = await db.mailMessage.findUnique({ where: { id } })
    if (!mail) return NextResponse.json({ error: 'Mail not found' }, { status: 404 })
    if (mail.toId !== user.id && mail.fromId !== user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }
    const data: any = {}
    if (action === 'read') {
      data.isRead = true
      data.readAt = new Date()
    } else if (action === 'unread') {
      data.isRead = false
      data.readAt = null
    } else if (action === 'star') data.isStarred = true
    else if (action === 'unstar') data.isStarred = false
    else if (action === 'archive') {
      data.isArchived = true
      data.archivedAt = new Date()
    } else if (action === 'unarchive') {
      data.isArchived = false
      data.archivedAt = null
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
    const updated = await db.mailMessage.update({
      where: { id },
      data,
      include: mailInclude,
    })
    await audit(user, 'update', { entity: 'MailMessage', entityId: id, details: `Mail action: ${action} on "${updated.subject}"`, ipAddress: getIp(req) })
    return NextResponse.json({ mail: updated })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to update mail' }, { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const mail = await db.mailMessage.findUnique({ where: { id } })
    if (!mail) return NextResponse.json({ error: 'Mail not found' }, { status: 404 })
    if (mail.fromId !== user.id && mail.toId !== user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }
    await db.mailMessage.delete({ where: { id } })
    await audit(user, 'delete', { entity: 'MailMessage', entityId: id, details: `Deleted mail "${mail.subject}"`, ipAddress: getIp(req) })
    return NextResponse.json({ message: 'Deleted' })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to delete mail' }, { status: 500 })
  }
}
