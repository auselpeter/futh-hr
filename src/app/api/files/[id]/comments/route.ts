import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const file = await db.registryFile.findUnique({ where: { id } })
    if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 })
    const body = await req.json()
    const { body: commentBody } = body || {}
    if (!commentBody || !String(commentBody).trim()) {
      return NextResponse.json({ error: 'Comment cannot be empty' }, { status: 400 })
    }
    const comment = await db.fileComment.create({
      data: {
        fileId: id,
        userId: user.id,
        body: String(commentBody).trim(),
      },
      include: { user: { include: { designation: true } } },
    })
    const notifyTargets = new Set<string>()
    if (file.createdById !== user.id) notifyTargets.add(file.createdById)
    if (file.currentHolderId && file.currentHolderId !== user.id) notifyTargets.add(file.currentHolderId)
    for (const uid of Array.from(notifyTargets)) {
      await db.notification.create({
        data: {
          userId: uid,
          title: `New comment on ${file.fileNumber}`,
          body: `${user.fullName}: ${String(commentBody).trim().slice(0, 80)}`,
          type: 'file',
          link: `file:${id}`,
        },
      })
    }
    return NextResponse.json({ comment })
  } catch (e: any) {
    console.error('File comment error:', e)
    return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 })
  }
}
