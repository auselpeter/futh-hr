import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'

// Permission helper: who can upload any document category (manager-level)?
const MANAGER_ROLES = ['SUPER_ADMIN', 'ADMIN', 'REGISTRY_OFFICER', 'SECRETARY', 'CMD_SECRETARY', 'AD']
// Personal categories — STAFF can only upload these, and only for themselves
const PERSONAL_CATEGORIES = ['personal_image', 'personal_signature']

// Category → short code used in the generated file number.
// Format: FUTH/DOC/{CAT}/{YEAR}/{SEQ:04d}  e.g. FUTH/DOC/HDC/2026/0001
const CATEGORY_CODES: Record<string, string> = {
  staff_hardcopy: 'HDC',
  committee_file: 'COM',
  institutional: 'INS',
  personal_image: 'IMG',
  personal_signature: 'SIG',
  other: 'OTH',
}

function isManager(role: string) {
  return MANAGER_ROLES.includes(role)
}

/**
 * Generate the next sequential file number for a document of the given category.
 * Pattern: FUTH/DOC/{CAT}/{YEAR}/{SEQ:04d}
 *  - CAT = 3-letter category code (HDC, COM, INS, IMG, SIG, OTH)
 *  - YEAR = current year (4 digits)
 *  - SEQ = next sequence number for that (category, year) pair, zero-padded to 4 digits.
 *
 * Sequences are tracked per (category, year) by scanning existing Document rows
 * with the matching prefix and adding 1 to the max found.
 */
async function generateDocumentRef(category: string): Promise<string> {
  const year = new Date().getFullYear()
  const catCode = CATEGORY_CODES[category] || 'OTH'
  const prefix = `FUTH/DOC/${catCode}/${year}/`
  const existing = await db.document.findMany({
    where: { fileNumber: { startsWith: prefix } },
    select: { fileNumber: true },
  })
  let max = 0
  for (const r of existing) {
    if (!r.fileNumber) continue
    const seqStr = r.fileNumber.replace(prefix, '')
    const seq = parseInt(seqStr, 10)
    if (!isNaN(seq) && seq > max) max = seq
  }
  return `${prefix}${String(max + 1).padStart(4, '0')}`
}

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')
    const staffId = searchParams.get('staffId')
    const committeeId = searchParams.get('committeeId')
    const q = searchParams.get('q') || ''

    const role = user.activeRole || user.role
    const manager = isManager(role)

    // Build a where clause using AND so that the search filter and the
    // permission scope are evaluated together (not merged into a single OR
    // that would let the permission scope bypass the search filter).
    const andClauses: any[] = []

    // Search filter (only applied when there's a query)
    if (q) {
      andClauses.push({
        OR: [
          { title: { contains: q } },
          { description: { contains: q } },
          { fileName: { contains: q } },
          { tags: { contains: q } },
          { fileNumber: { contains: q } },
        ],
      })
    }

    // Other direct filters
    if (category) andClauses.push({ category })
    if (staffId) andClauses.push({ staffId })
    if (committeeId) andClauses.push({ committeeId })

    // Permission scope:
    // - Managers: see all documents (no scope filter)
    // - STAFF / others: see documents where they are the uploader OR the linked staff OR isPublic=true
    if (!manager) {
      const meStaffId = user.staffId
      const scopeOrs: any[] = [{ uploadedById: user.id }]
      if (meStaffId) scopeOrs.push({ staffId: meStaffId })
      andClauses.push({ OR: scopeOrs })
    }

    const where: any = andClauses.length > 0 ? { AND: andClauses } : {}

    const limit = Math.min(parseInt(searchParams.get('limit') || '200'), 500)
    const offset = parseInt(searchParams.get('offset') || '0')

    const docs = await db.document.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
      skip: offset,
      include: {
        staff: { select: { id: true, fullName: true, staffId: true } },
        committee: { select: { id: true, code: true, name: true } },
        uploadedBy: { select: { id: true, fullName: true, username: true, role: true } },
      },
    })
    const total = await db.document.count({ where })
    return NextResponse.json({ documents: docs, total, limit, offset })
  } catch (e: any) {
    console.error('Documents list error:', e)
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = user.activeRole || user.role
    const manager = isManager(role)

    const body = await req.json()
    const {
      title, description, category, fileUrl, fileName, fileSize, mimeType,
      staffId, committeeId, documentDate, tags, isPublic,
    } = body || {}

    if (!title || !category || !fileUrl || !fileName) {
      return NextResponse.json({ error: 'title, category, fileUrl and fileName are required' }, { status: 400 })
    }

    // === Permission gate ===
    // STAFF (and any non-manager role): can ONLY upload personal_image / personal_signature,
    // and the staffId MUST be their own staffId (or auto-filled from the session).
    let finalStaffId: string | null = staffId || null
    let finalCategory = String(category)
    let finalIsPublic = isPublic !== undefined ? !!isPublic : true

    if (!manager) {
      if (!PERSONAL_CATEGORIES.includes(finalCategory)) {
        return NextResponse.json(
          { error: 'As a non-manager user, you can only upload your own image (personal_image) or signature (personal_signature).' },
          { status: 403 },
        )
      }
      // Force staffId to the user's own staffId (if they have one)
      if (!user.staffId) {
        return NextResponse.json(
          { error: 'Your account is not linked to a staff record. Contact HR/Registry to link your staff record first.' },
          { status: 403 },
        )
      }
      finalStaffId = user.staffId
      // Personal uploads are visible only to the user + managers (not public by default)
      finalIsPublic = false
    }

    // Managers: if they pass a staffId or committeeId, validate them
    if (manager) {
      if (finalStaffId) {
        const staff = await db.staff.findUnique({ where: { id: finalStaffId } })
        if (!staff) return NextResponse.json({ error: 'Linked staff record not found' }, { status: 400 })
      }
      if (committeeId) {
        const committee = await db.committee.findUnique({ where: { id: committeeId } })
        if (!committee) return NextResponse.json({ error: 'Linked committee not found' }, { status: 400 })
      }
    }

    // If a manager uploads a personal_image / personal_signature for a specific staff,
    // also update the Staff record's avatarUrl / signatureUrl so the image/signature is
    // reflected across the system (staff directory, appraisals, print templates, etc.).
    if (finalStaffId && finalCategory === 'personal_image') {
      await db.staff.update({ where: { id: finalStaffId }, data: { avatarUrl: fileUrl } }).catch(() => {})
    }
    if (finalStaffId && finalCategory === 'personal_signature') {
      await db.staff.update({ where: { id: finalStaffId }, data: { signatureUrl: fileUrl } }).catch(() => {})
    }

    // === Duplicate file detection ===
    // Check if a document with the same fileUrl already exists. If yes, return the
    // existing document with a `duplicate: true` flag so the frontend can warn the
    // user instead of creating a redundant record.
    const existingByUrl = await db.document.findFirst({
      where: { fileUrl: String(fileUrl) },
      include: {
        staff: { select: { id: true, fullName: true, staffId: true } },
        committee: { select: { id: true, code: true, name: true } },
        uploadedBy: { select: { id: true, fullName: true, username: true, role: true } },
      },
    })
    if (existingByUrl) {
      await audit(user, 'create', {
        entity: 'Document',
        entityId: existingByUrl.id,
        details: `Duplicate upload blocked: file "${fileName}" already exists as "${existingByUrl.title}" (${existingByUrl.fileNumber || '—'}, uploaded by ${existingByUrl.uploadedBy?.fullName || '—'})`,
        ipAddress: getIp(req),
      }).catch(() => {})
      return NextResponse.json({
        duplicate: true,
        message: `This file has already been uploaded as "${existingByUrl.title}" (${existingByUrl.fileNumber || '—'}) by ${existingByUrl.uploadedBy?.fullName || '—'} on ${existingByUrl.createdAt ? new Date(existingByUrl.createdAt).toLocaleDateString() : '—'}.`,
        existingDocument: existingByUrl,
      })
    }

    // Also flag duplicates by fileName + staffId or committeeId (in case the file was
    // re-uploaded under a different URL — e.g. user re-scanned a hardcopy).
    if (finalStaffId || committeeId) {
      const dupWhere: any = { fileName: String(fileName) }
      if (finalStaffId) dupWhere.staffId = finalStaffId
      else if (committeeId) dupWhere.committeeId = committeeId
      const existingByName = await db.document.findFirst({
        where: dupWhere,
        include: {
          staff: { select: { id: true, fullName: true, staffId: true } },
          committee: { select: { id: true, code: true, name: true } },
          uploadedBy: { select: { id: true, fullName: true, username: true, role: true } },
        },
      })
      if (existingByName) {
        await audit(user, 'create', {
          entity: 'Document',
          entityId: existingByName.id,
          details: `Duplicate upload blocked by name match: "${fileName}" already exists as "${existingByName.title}" (${existingByName.fileNumber || '—'}) for the same ${finalStaffId ? 'staff' : 'committee'}`,
          ipAddress: getIp(req),
        }).catch(() => {})
        return NextResponse.json({
          duplicate: true,
          message: `A document with the same file name "${fileName}" was already uploaded for this ${finalStaffId ? 'staff member' : 'committee'} as "${existingByName.title}" (${existingByName.fileNumber || '—'}) on ${existingByName.createdAt ? new Date(existingByName.createdAt).toLocaleDateString() : '—'}.`,
          existingDocument: existingByName,
        })
      }
    }

    // === Generate the next file number for this category ===
    // Format: FUTH/DOC/{CAT}/{YEAR}/{SEQ:04d}
    const fileNumber = await generateDocumentRef(finalCategory)

    const doc = await db.document.create({
      data: {
        fileNumber,
        title: String(title),
        description: description || null,
        category: finalCategory,
        fileUrl: String(fileUrl),
        fileName: String(fileName),
        fileSize: fileSize ? Number(fileSize) : null,
        mimeType: mimeType || null,
        staffId: finalStaffId || null,
        committeeId: committeeId || null,
        uploadedById: user.id,
        documentDate: documentDate ? new Date(documentDate) : null,
        tags: tags || null,
        isPublic: finalIsPublic,
      },
      include: {
        staff: { select: { id: true, fullName: true, staffId: true } },
        committee: { select: { id: true, code: true, name: true } },
        uploadedBy: { select: { id: true, fullName: true, username: true, role: true } },
      },
    })

    await audit(user, 'create', {
      entity: 'Document',
      entityId: doc.id,
      details: `Uploaded ${finalCategory} document ${fileNumber} — "${title}"${finalStaffId ? ` (staffId=${finalStaffId})` : ''}${committeeId ? ` (committeeId=${committeeId})` : ''}`,
      ipAddress: getIp(req),
    })
    return NextResponse.json({ document: doc })
  } catch (e: any) {
    console.error('Document create error:', e)
    return NextResponse.json({ error: 'Failed to create document' }, { status: 500 })
  }
}
