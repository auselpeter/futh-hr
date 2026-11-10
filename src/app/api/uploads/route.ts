import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'

const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt']
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

const VALID_TYPES = ['staff', 'signature', 'thumbprint', 'certificate', 'duty', 'avatar', 'picture', 'general', 'document', 'evidence']

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const type = (formData.get('type') as string) || 'general'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large. Max 10MB' }, { status: 413 })
    }

    const safeType = VALID_TYPES.includes(type) ? type : 'general'
    const ext = (file.name.split('.').pop() || '').toLowerCase()
    if (!ext || !ALLOWED_EXT.includes(ext)) {
      return NextResponse.json({ error: `File type .${ext} not allowed` }, { status: 415 })
    }

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', safeType)
    await mkdir(uploadDir, { recursive: true })

    const filename = `${randomUUID()}.${ext}`
    const fullPath = path.join(uploadDir, filename)
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(fullPath, buffer)

    const url = `/uploads/${safeType}/${filename}`
    await audit(user, 'upload', { entity: 'Upload', entityId: filename, details: `type=${safeType}, filename=${file.name} (${file.size} bytes)`, ipAddress: getIp(req) })
    return NextResponse.json({
      url,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || 'application/octet-stream',
    })
  } catch (e: any) {
    console.error('Upload error:', e)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
