/**
 * Backfill `fileNumber` for all existing Document rows.
 * Format: FUTH/DOC/{CAT}/{YEAR}/{SEQ:04d}
 * where CAT is a 3-letter code per category and YEAR is the document's createdAt year.
 *
 * Run with: bun run scripts/backfill-document-numbers.ts
 */
import { db } from '../src/lib/db'

const CATEGORY_CODES: Record<string, string> = {
  staff_hardcopy: 'HDC',
  committee_file: 'COM',
  institutional: 'INS',
  personal_image: 'IMG',
  personal_signature: 'SIG',
  other: 'OTH',
}

async function main() {
  console.log('Backfilling fileNumber for existing Document rows...')
  const docs = await db.document.findMany({ orderBy: [{ createdAt: 'asc' }] })
  console.log(`Found ${docs.length} document(s)`)

  // Track per-category sequence counters
  const seqByCat: Record<string, number> = {}

  for (const doc of docs) {
    if (doc.fileNumber) {
      console.log(`✓ skip ${doc.id} — already has fileNumber ${doc.fileNumber}`)
      continue
    }
    const catCode = CATEGORY_CODES[doc.category] || 'OTH'
    const year = new Date(doc.createdAt).getFullYear()
    const key = `${catCode}-${year}`
    seqByCat[key] = (seqByCat[key] || 0) + 1
    const seq = seqByCat[key]
    const fileNumber = `FUTH/DOC/${catCode}/${year}/${String(seq).padStart(4, '0')}`
    await db.document.update({ where: { id: doc.id }, data: { fileNumber } })
    console.log(`✓ ${doc.id}: ${doc.title.slice(0, 40)} → ${fileNumber}`)
  }
  console.log('Done.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await db.$disconnect() })
