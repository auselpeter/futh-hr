import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, isRegistry } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'
import { fileInclude } from '@/lib/prisma-helpers'
import { generateFileNumber } from '@/lib/ref-number'
import { buildScopeFilter, applyScope } from '@/lib/scope'

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const tab = searchParams.get('tab') || 'all'
    const q = searchParams.get('q') || ''
    const type = searchParams.get('type')
    const priority = searchParams.get('priority')
    const committeeId = searchParams.get('committeeId')

    const where: any = {}
    if (q) {
      where.OR = [
        { fileNumber: { contains: q } },
        { subject: { contains: q } },
        { description: { contains: q } },
      ]
    }
    if (type) where.type = type
    if (priority) where.priority = priority
    if (committeeId) where.committeeId = committeeId

    if (tab === 'pending') {
      where.AND = [
        { state: { notIn: ['archived', 'completed'] } },
        {
          OR: [
            { currentHolderId: user.id },
            {
              targetDesignationId: user.designationId ?? undefined,
              currentHolderId: null,
            },
          ],
        },
      ]
    } else if (tab === 'mine') {
      where.createdById = user.id
    } else if (tab === 'archived') {
      where.state = 'archived'
    }

    // Apply role-based data scope
    const scopeWhere = buildScopeFilter(user, 'file')
    const finalWhere = applyScope(where, scopeWhere)

    const files = await db.registryFile.findMany({
      where: finalWhere,
      orderBy: { createdAt: 'desc' },
      include: fileInclude,
    })

    return NextResponse.json({ files })
  } catch (e: any) {
    console.error('Files list error:', e)
    return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Only registry officers / admins / CMD can create files
    if (!isRegistry(user.role)) {
      return NextResponse.json({ error: 'Only Registry Officers / Admins can create files' }, { status: 403 })
    }

    const body = await req.json()
    const {
      type,
      subject,
      description,
      priority,
      volume,
      targetUserId,
      targetDesignationId,
      targetDepartmentId,
      staffId,
      departmentId,
      externalName,
      externalOrg,
      externalEmail,
      externalPhone,
      committeeId,
    } = body || {}

    if (!type || !subject || !description) {
      return NextResponse.json({ error: 'Type, subject and description are required' }, { status: 400 })
    }
    if (!['individual', 'department', 'external', 'committee'].includes(type)) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
    }
    if (!targetUserId && !targetDesignationId) {
      return NextResponse.json({ error: 'You must select a recipient (staff or designation)' }, { status: 400 })
    }
    if (type === 'individual' && !staffId) {
      return NextResponse.json({ error: 'Individual files require a staff record' }, { status: 400 })
    }
    if (type === 'department' && !departmentId) {
      return NextResponse.json({ error: 'Department files require a department' }, { status: 400 })
    }
    if (type === 'external' && !externalName) {
      return NextResponse.json({ error: 'External files require a name' }, { status: 400 })
    }
    if (type === 'committee' && !committeeId) {
      return NextResponse.json({ error: 'Committee files require a committee' }, { status: 400 })
    }

    const fileNumber = await generateFileNumber(type)

    // Resolve current holder
    let currentHolderId: string | null = targetUserId || null
    if (!currentHolderId && targetDesignationId) {
      const targetUser = await db.user.findFirst({
        where: { designationId: targetDesignationId, isActive: true },
        orderBy: { createdAt: 'asc' },
      })
      if (targetUser) currentHolderId = targetUser.id
    }

    const file = await db.$transaction(async (tx) => {
      const f = await tx.registryFile.create({
        data: {
          fileNumber,
          type,
          subject: String(subject),
          description: String(description),
          priority: priority || 'Normal',
          volume: volume || null,
          status: 'In Transit',
          state: 'in_transit',
          createdById: user.id,
          currentHolderId,
          targetUserId: targetUserId || null,
          targetDesignationId: targetDesignationId || null,
          targetDepartmentId: targetDepartmentId || null,
          staffId: type === 'individual' ? staffId : null,
          departmentId: type === 'department' ? departmentId : null,
          externalName: type === 'external' ? externalName : null,
          externalOrg: type === 'external' ? externalOrg || null : null,
          externalEmail: type === 'external' ? externalEmail || null : null,
          externalPhone: type === 'external' ? externalPhone || null : null,
          committeeId: type === 'committee' ? committeeId : null,
        },
        include: fileInclude,
      })

      await tx.fileRoute.create({
        data: {
          fileId: f.id,
          fromUserId: user.id,
          toUserId: targetUserId || currentHolderId || null,
          toDesignationId: targetDesignationId || null,
          toDepartmentId: targetDepartmentId || null,
          action: 'forward',
          remarks: `File created & dispatched to recipient`,
        },
      })

      // Notify recipient
      if (currentHolderId && currentHolderId !== user.id) {
        await tx.notification.create({
          data: {
            userId: currentHolderId,
            title: `New file received: ${f.fileNumber}`,
            body: `${user.fullName} created & forwarded a ${type} file: ${f.subject}`,
            type: 'file',
            link: `file:${f.id}`,
          },
        })
      }

      return f
    })

    await audit(user, 'create', { entity: 'RegistryFile', entityId: file.id, details: `Created file ${file.fileNumber} (${file.subject})`, ipAddress: getIp(req) })

    return NextResponse.json({ file })
  } catch (e: any) {
    console.error('Create file error:', e)
    return NextResponse.json({ error: 'Failed to create file' }, { status: 500 })
  }
}
