import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'

// POST /api/duties/[id]/upload-evidence
// Multipart form: `file` (required) + optional `notes`
// Sets: evidenceUrl, evidenceFileName, evidenceNotes, evidenceUploadedAt,
//       completedAt=now, status=Completed
// Audit the upload.
const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'zip']
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params

    const existing = await db.duty.findUnique({ where: { id }, include: { staff: true } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Scope check — staff can upload evidence to their own duty; HOD/HOU/admins/AppraisalOfficer can also
    const role = user.activeRole || user.role
    const myUnitId = user.staff?.unitId || null
    const myDeptId = user.departmentId
    const canUpload =
      ['SUPER_ADMIN', 'ADMIN', 'APPRAISAL_OFFICER', 'CMD', 'CMA', 'AD', 'DFA'].includes(role) ||
      (role === 'HOD' && existing.staff?.departmentId === myDeptId) ||
      (role === 'HOU' && (existing.staff?.unitId === myUnitId || existing.staff?.departmentId === myDeptId)) ||
      (role === 'STAFF' && existing.staffId === user.staffId)
    if (!canUpload) {
      return NextResponse.json({ error: 'You do not have permission to upload evidence for this duty' }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const notes = (formData.get('notes') as string | null) || ''

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large. Max 10MB' }, { status: 413 })
    }

    const ext = (file.name.split('.').pop() || '').toLowerCase()
    if (!ext || !ALLOWED_EXT.includes(ext)) {
      return NextResponse.json({ error: `File type .${ext} not allowed` }, { status: 415 })
    }

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'duty')
    await mkdir(uploadDir, { recursive: true })
    const filename = `${randomUUID()}.${ext}`
    const fullPath = path.join(uploadDir, filename)
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(fullPath, buffer)
    const url = `/uploads/duty/${filename}`

    const updated = await db.duty.update({
      where: { id },
      data: {
        evidenceUrl: url,
        evidenceFileName: file.name,
        evidenceNotes: notes || existing.evidenceNotes || null,
        evidenceUploadedAt: new Date(),
        completedAt: new Date(),
        // If the duty was Assigned/In Progress/Overdue, mark as Completed.
        // If already Approved/Rejected, leave the status (reviewer's decision stands).
        status: ['Approved', 'Rejected'].includes(existing.status) ? existing.status : 'Completed',
      },
      include: { staff: { select: { id: true, fullName: true } } },
    })

    await audit(user, 'upload', {
      entity: 'Duty',
      entityId: id,
      details: `Uploaded evidence "${file.name}" (${file.size} bytes) for duty "${existing.title}"`,
      ipAddress: getIp(req),
    })

    return NextResponse.json({ duty: updated, url, fileName: file.name })
  } catch (e: any) {
    console.error('Upload evidence error:', e)
    return NextResponse.json({ error: 'Failed to upload evidence' }, { status: 500 })
  }
}
