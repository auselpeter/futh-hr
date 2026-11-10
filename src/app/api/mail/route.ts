import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'
import { mailInclude } from '@/lib/prisma-helpers'

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const folder = searchParams.get('folder') || 'inbox' // inbox | sent | archived | starred
    const filter = searchParams.get('filter') || 'all' // all | unread | starred | archived

    const where: any = {}
    if (folder === 'inbox') {
      where.toId = user.id
      if (filter === 'unread') where.isRead = false
      else if (filter === 'starred') where.isStarred = true
      else if (filter === 'archived') where.isArchived = true
      else where.isArchived = false
    } else if (folder === 'sent') {
      where.fromId = user.id
    } else if (folder === 'archived') {
      where.toId = user.id
      where.isArchived = true
    } else if (folder === 'starred') {
      where.toId = user.id
      where.isStarred = true
    }

    const mail = await db.mailMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: mailInclude,
    })

    return NextResponse.json({ mail })
  } catch (e: any) {
    console.error('Mail list error:', e)
    return NextResponse.json({ error: 'Failed to fetch mail' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { subject, body: mailBody, toId, priority, requisitionId, fileId, parentId } = body || {}

    if (!subject || !mailBody || !toId) {
      return NextResponse.json({ error: 'Subject, body and recipient are required' }, { status: 400 })
    }

    const recipient = await db.user.findUnique({ where: { id: String(toId) } })
    if (!recipient || !recipient.isActive) {
      return NextResponse.json({ error: 'Recipient not found or inactive' }, { status: 400 })
    }

    const mail = await db.$transaction(async (tx) => {
      const m = await tx.mailMessage.create({
        data: {
          subject: String(subject),
          body: String(mailBody),
          fromId: user.id,
          toId: String(toId),
          priority: priority || 'Normal',
          requisitionId: requisitionId || null,
          fileId: fileId || null,
          parentId: parentId || null,
        },
        include: mailInclude,
      })
      await tx.notification.create({
        data: {
          userId: String(toId),
          title: `New mail: ${m.subject}`,
          body: `${user.fullName} sent you a message`,
          type: 'mail',
          link: `mail:${m.id}`,
        },
      })
      return m
    })

    await audit(user, 'create', { entity: 'MailMessage', entityId: mail.id, details: `Sent mail "${mail.subject}" to ${recipient.fullName}`, ipAddress: getIp(req) })

    return NextResponse.json({ mail })
  } catch (e: any) {
    console.error('Mail create error:', e)
    return NextResponse.json({ error: 'Failed to send mail' }, { status: 500 })
  }
}
