import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'

// Permission helper: who can upload any document category (manager-level)?
const MANAGER_ROLES = ['SUPER_ADMIN', 'ADMIN', 'REGISTRY_OFFICER', 'SECRETARY', 'CMD_SECRETARY', 'AD']
const PERSONAL_CATEGORIES = ['personal_image', 'personal_signature']

function isManager(role: string) {
  return MANAGER_ROLES.includes(role)
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const doc = await db.document.findUnique({
      where: { id },
      include: {
        staff: { select: { id: true, fullName: true, staffId: true } },
        committee: { select: { id: true, code: true, name: true } },
        uploadedBy: { select: { id: true, fullName: true, username: true, role: true } },
      },
    })
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

    // Non-managers can only see docs they uploaded, docs linked to their staff record, or public docs
    const role = user.activeRole || user.role
    if (!isManager(role)) {
      const meStaffId = user.staffId
      const visible = doc.uploadedById === user.id || (meStaffId && doc.staffId === meStaffId) || doc.isPublic
      if (!visible) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ document: doc })
  } catch (e: any) {
    console.error('Document get error:', e)
    return NextResponse.json({ error: 'Failed to fetch document' }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const role = user.activeRole || user.role
    const manager = isManager(role)

    const existing = await db.document.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

    // Permission: managers can edit any. Non-managers can edit only their own personal docs.
    const canEdit = manager || (existing.uploadedById === user.id && PERSONAL_CATEGORIES.includes(existing.category))
    if (!canEdit) {
      return NextResponse.json({ error: 'You can only edit your own uploaded documents' }, { status: 403 })
    }

    const body = await req.json()
    const data: any = {}
    if (body.title !== undefined) data.title = String(body.title)
    if (body.description !== undefined) data.description = body.description || null
    if (body.tags !== undefined) data.tags = body.tags || null
    if (body.documentDate !== undefined) data.documentDate = body.documentDate ? new Date(body.documentDate) : null
    if (body.isPublic !== undefined && manager) data.isPublic = !!body.isPublic
    // Non-managers cannot change category or staffId (would defeat permission gating)
    if (manager) {
      if (body.category !== undefined) data.category = String(body.category)
      if (body.staffId !== undefined) data.staffId = body.staffId || null
      if (body.committeeId !== undefined) data.committeeId = body.committeeId || null
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 })
    }

    const updated = await db.document.update({
      where: { id },
      data,
      include: {
        staff: { select: { id: true, fullName: true, staffId: true } },
        committee: { select: { id: true, code: true, name: true } },
        uploadedBy: { select: { id: true, fullName: true, username: true, role: true } },
      },
    })
    await audit(user, 'update', { entity: 'Document', entityId: id, details: `Updated document "${updated.title}"`, ipAddress: getIp(req) })
    return NextResponse.json({ document: updated })
  } catch (e: any) {
    console.error('Document patch error:', e)
    return NextResponse.json({ error: 'Failed to update document' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const role = user.activeRole || user.role
    const manager = isManager(role)

    const existing = await db.document.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

    // Permission: managers can delete any. Non-managers can delete only their own personal docs.
    const canDelete = manager || (existing.uploadedById === user.id && PERSONAL_CATEGORIES.includes(existing.category))
    if (!canDelete) {
      return NextResponse.json({ error: 'You can only delete your own uploaded documents' }, { status: 403 })
    }

    await db.document.delete({ where: { id } })
    await audit(user, 'delete', { entity: 'Document', entityId: id, details: `Deleted document "${existing.title}"`, ipAddress: getIp(req) })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('Document delete error:', e)
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 })
  }
}
