// One-off script: backfill new fields on existing Duty records.
// Run with: bun run /home/z/my-project/scripts/update-duties-fields.ts
//
// For each existing Duty record:
//   - type:        "Primary" if null/empty
//   - order:       its index within that staff's duties (1-based, ordered by createdAt)
//   - startDate:   createdAt (if null)
//   - dueDate:     createdAt + 30 days (if null)
//   - status:      "Assigned" if currently null/empty/legacy "Completed"; otherwise keep

import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

async function main() {
  console.log('Backfilling Duty records with new fields...')

  const all = await db.duty.findMany({ orderBy: [{ staffId: 'asc' }, { createdAt: 'asc' }] })
  console.log(`Found ${all.length} duty records`)

  // Group by staffId so we can compute per-staff order
  const byStaff = new Map<string, typeof all>()
  for (const d of all) {
    if (!byStaff.has(d.staffId)) byStaff.set(d.staffId, [])
    byStaff.get(d.staffId)!.push(d)
  }

  const updates: Array<() => Promise<unknown>> = []
  for (const [, list] of byStaff.entries()) {
    list.forEach((d, idx) => {
      const order = idx + 1
      const startDate = d.startDate ?? d.createdAt
      const dueDate = d.dueDate ?? new Date(d.createdAt.getTime() + 30 * 24 * 60 * 60 * 1000)
      const status = !d.status || d.status === 'Completed' ? 'Assigned' : d.status
      const type = d.type || 'Primary'
      if (
        d.order !== order ||
        d.startDate === null ||
        d.dueDate === null ||
        d.status !== status ||
        d.type !== type
      ) {
        updates.push(() =>
          db.duty.update({
            where: { id: d.id },
            data: { type, order, startDate, dueDate, status },
          }),
        )
      }
    })
  }

  console.log(`Queued ${updates.length} updates`)

  let updated = 0
  for (let i = 0; i < updates.length; i += 50) {
    const batch = updates.slice(i, i + 50)
    await Promise.all(batch.map((u) => u()))
    updated += batch.length
    process.stdout.write(`  ...updated ${updated}/${updates.length}\r`)
  }
  console.log('')

  console.log(`✓ Backfilled ${updates.length} duty records`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await db.$disconnect() })
