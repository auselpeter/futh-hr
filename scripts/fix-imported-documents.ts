/**
 * Fix imported staff documents:
 *   1. Set isPublic=true on all imported "Staff File —" documents so all staff can see them
 *   2. Create missing documents for staff whose file numbers collided during import
 *
 * Run with: bun run scripts/fix-imported-documents.ts
 */
import { db } from '../src/lib/db'

async function main() {
  console.log('=== Fix 1: Set isPublic=true on imported staff hardcopy documents ===')
  const updated = await db.document.updateMany({
    where: {
      title: { contains: 'Staff File —' },
      isPublic: false,
    },
    data: { isPublic: true },
  })
  console.log(`✓ Updated ${updated.count} documents to isPublic=true`)

  console.log()
  console.log('=== Fix 2: Find staff without documents and create them ===')
  // Get all staff IDs
  const allStaff = await db.staff.findMany({
    select: { id: true, staffId: true, fullName: true, ippisNumber: true, departmentId: true },
    orderBy: { createdAt: 'asc' },
  })
  console.log(`Total staff: ${allStaff.length}`)

  // Get all staff IDs that already have documents
  const existingDocs = await db.document.findMany({
    where: { title: { contains: 'Staff File —' } },
    select: { staffId: true },
  })
  const staffWithDocs = new Set(existingDocs.filter(d => d.staffId).map(d => d.staffId!))
  console.log(`Staff with documents: ${staffWithDocs.size}`)

  // Find staff without documents
  const staffWithoutDocs = allStaff.filter(s => !staffWithDocs.has(s.id))
  console.log(`Staff without documents: ${staffWithoutDocs.length}`)

  if (staffWithoutDocs.length === 0) {
    console.log('All staff have documents. Done!')
    return
  }

  // Get the registry user ID (for uploadedById)
  const registryUser = await db.user.findFirst({ where: { username: 'registry' } })
  const adminUser = await db.user.findFirst({ where: { username: 'admin' } })
  const uploadedById = registryUser?.id || adminUser?.id || ''

  // Find the max existing file number for HDC category
  const existingHdcDocs = await db.document.findMany({
    where: { fileNumber: { startsWith: 'FUTH/DOC/HDC/2026/' } },
    select: { fileNumber: true },
  })
  let maxSeq = 0
  for (const d of existingHdcDocs) {
    const seq = parseInt(d.fileNumber.replace('FUTH/DOC/HDC/2026/', ''), 10)
    if (!isNaN(seq) && seq > maxSeq) maxSeq = seq
  }
  console.log(`Max existing HDC sequence: ${maxSeq}`)

  // Create missing documents
  let created = 0
  let errors = 0
  for (let i = 0; i < staffWithoutDocs.length; i++) {
    const s = staffWithoutDocs[i]
    try {
      maxSeq++
      const fileNumber = `FUTH/DOC/HDC/2026/${String(maxSeq).padStart(4, '0')}`
      await db.document.create({
        data: {
          fileNumber,
          title: `Staff File — ${s.fullName} (${s.staffId})`,
          description: `Personal staff file imported from NR HR Excel. File No: ${s.staffId}`,
          category: 'staff_hardcopy',
          fileUrl: '/uploads/document/imported-placeholder.pdf',
          fileName: `imported-${s.staffId}.pdf`,
          staffId: s.id,
          uploadedById,
          isPublic: true,
          tags: 'imported,excel',
        },
      })
      created++
    } catch (e: any) {
      // Skip on unique constraint violation or other errors
      errors++
      maxSeq-- // Retry with next number on next iteration
    }
  }

  console.log()
  console.log('=== Summary ===')
  console.log(`Documents set to public: ${updated.count}`)
  console.log(`Missing documents created: ${created}`)
  console.log(`Errors: ${errors}`)
  console.log('Done.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await db.$disconnect() })
