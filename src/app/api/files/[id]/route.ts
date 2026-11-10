import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, isRegistry } from '@/lib/auth'
import { fileInclude } from '@/lib/prisma-helpers'
import { audit, getIp } from '@/lib/audit'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const file = await db.registryFile.findUnique({ where: { id }, include: fileInclude })
    if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 })
    return NextResponse.json({ file })
  } catch { return NextResponse.json({ error: 'Failed to fetch file' }, { status: 500 }) }
}

// PATCH /api/files/[id] — Registry officers and admins can edit the file's
// fileNumber (the institutional file reference number), as well as other
// editable fields like subject, description, priority, volume, externalName, etc.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!isRegistry(user.role)) return NextResponse.json({ error: 'Only Registry Officers / Admins can edit file metadata' }, { status: 403 })
    const { id } = await params
    const body = await req.json()
    const { fileNumber: newFileNumber, subject, description, priority, volume, externalName, externalOrg, externalEmail, externalPhone } = body || {}

    const existing = await db.registryFile.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'File not found' }, { status: 404 })

    const data: any = {}
    const changes: string[] = []

    if (newFileNumber !== undefined) {
      const trimmed = String(newFileNumber).trim()
      if (!trimmed) return NextResponse.json({ error: 'File number cannot be empty' }, { status: 400 })
      if (trimmed !== existing.fileNumber) {
        const taken = await db.registryFile.findFirst({ where: { fileNumber: trimmed, NOT: { id } } })
        if (taken) return NextResponse.json({ error: `File number "${trimmed}" is already in use by another file (${taken.subject}).` }, { status: 400 })
        data.fileNumber = trimmed
        changes.push(`file number: "${existing.fileNumber}" → "${trimmed}"`)
      }
    }
    if (subject !== undefined && subject !== existing.subject) { data.subject = String(subject); changes.push('subject') }
    if (description !== undefined && description !== existing.description) { data.description = String(description); changes.push('description') }
    if (priority !== undefined && priority !== existing.priority) { data.priority = String(priority); changes.push('priority') }
    if (volume !== undefined && volume !== existing.volume) { data.volume = volume ? String(volume) : null; changes.push('volume') }
    if (existing.type === 'external') {
      if (externalName !== undefined && externalName !== existing.externalName) { data.externalName = externalName ? String(externalName) : null; changes.push('external name') }
      if (externalOrg !== undefined && externalOrg !== existing.externalOrg) { data.externalOrg = externalOrg ? String(externalOrg) : null; changes.push('external org') }
      if (externalEmail !== undefined && externalEmail !== existing.externalEmail) { data.externalEmail = externalEmail ? String(externalEmail) : null; changes.push('external email') }
      if (externalPhone !== undefined && externalPhone !== existing.externalPhone) { data.externalPhone = externalPhone ? String(externalPhone) : null; changes.push('external phone') }
    }

    if (Object.keys(data).length === 0) return NextResponse.json({ error: 'No changes to save' }, { status: 400 })

    const file = await db.registryFile.update({ where: { id }, data, include: fileInclude })
    await audit(user, 'update', { entity: 'RegistryFile', entityId: id, details: `Edited file ${existing.fileNumber}${data.fileNumber ? ` → ${data.fileNumber}` : ''} — changed: ${changes.join(', ')}`, ipAddress: getIp(req) })
    return NextResponse.json({ file })
  } catch (e: any) { console.error('File PATCH error:', e); return NextResponse.json({ error: 'Failed to update file' }, { status: 500 }) }
}
