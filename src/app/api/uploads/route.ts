import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'

const ALLOWED_EXT = [
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'rtf',
  'zip', 'rar', '7z',
]
// Bumped from 10MB to 50MB so users can upload large scanned PDFs / high-res
// passport photos without hitting the "unexpected end of JSON input" /
// "unexpected tokens" error that the body parser threw on 10MB+ files.
// For images, the client (FileUpload.tsx) compresses to ≤2MB before upload,
// so the 50MB ceiling is mostly for non-image documents.
const MAX_SIZE = 50 * 1024 * 1024 // 50MB

const VALID_TYPES = ['staff', 'signature', 'thumbprint', 'certificate', 'duty', 'avatar', 'picture', 'general', 'document', 'evidence', 'attendance', 'confirmation']

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
      return NextResponse.json({ error: `File too large. Max ${MAX_SIZE / (1024 * 1024)}MB (received ${(file.size / (1024 * 1024)).toFixed(2)}MB)` }, { status: 413 })
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
    // Surface the underlying error message so the client can show a meaningful
    // toast instead of the generic "Upload failed" — the previous behaviour
    // masked payload-too-large / JSON-parse errors as "unexpected tokens".
    return NextResponse.json({ error: e?.message || 'Upload failed' }, { status: 500 })
  }
}
