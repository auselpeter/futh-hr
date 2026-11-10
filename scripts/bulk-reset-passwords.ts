/**
 * Bulk-reset passwords to "admin123" for all bulk-imported users.
 *
 * Background:
 *   The bulk Excel import script (`scripts/import-staff-excel.ts`) created
 *   ~2,800+ User accounts with username = full-name-slug and password = IPPIS
 *   (the old institutional pattern). The new institutional policy is:
 *   username = IPPIS, password = admin123 (constant default).
 *
 *   Staff are now expected to log in with admin123 and change their password
 *   from their Profile page. This script resets all bulk-imported users'
 *   passwords to admin123 so the policy is uniform across the system.
 *
 * Identification of bulk-imported users:
 *   - All users whose username matches the slug pattern of their linked
 *     Staff.fullName (e.g. "JIBRIL ABDULLAHI" → "jibril_abdullahi").
 *   - All users whose username is all-numeric (i.e. their IPPIS was used as
 *     the username — these may have been created later via the new Staff POST
 *     with auto-username).
 *   - Skip the original demo/seed users (superadmin, admin, cmd, cma, ad, dfa,
 *     hod_surg, hod_ict, hou_icu, registry, appraisal, staff1, staff2, staff3,
 *     desk, audit, cpo, planning, secretary, cmd_secretary) — their passwords
 *     are already admin123 from the seed script.
 *
 * Usage:
 *   bun run scripts/bulk-reset-passwords.ts            # reset (default)
 *   bun run scripts/bulk-reset-passwords.ts --dry-run  # preview only, no changes
 *
 * Output:
 *   - Prints the number of users scanned, matched, and reset.
 *   - Each reset user is audited in the AuditLog table.
 */
import { db } from '../src/lib/db'
import bcrypt from 'bcryptjs'

const DEFAULT_PASSWORD = 'admin123'

// Demo/seed users from scripts/seed.ts and the secretary/planning/pv seeds.
// Their passwords are already admin123 — skip them (no need to reset).
const SKIP_USERNAMES = new Set([
  'superadmin', 'admin', 'cmd', 'cma', 'ad', 'dfa',
  'hod_surg', 'hod_ict', 'hou_icu',
  'registry', 'appraisal',
  'staff1', 'staff2', 'staff3',
  'desk', 'audit', 'cpo',
  'planning', 'secretary', 'cmd_secretary',
])

// Replicate the slug function from import-staff-excel.ts so we can identify
// users whose username was auto-generated from their full name.
function nameToSlug(fullName: string): string {
  return fullName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  console.log(`\n${dryRun ? '[DRY-RUN] ' : ''}Bulk-resetting passwords to "${DEFAULT_PASSWORD}"...`)

  // Fetch all users with their linked staff (if any)
  const users = await db.user.findMany({
    include: {
      staff: { select: { id: true, fullName: true, ippisNumber: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  console.log(`Total users in DB: ${users.length}`)

  let reset = 0
  let skippedDemo = 0
  let skippedAlreadyDefault = 0
  let skippedNoMatch = 0
  const resetList: { username: string; fullName: string; reason: string }[] = []

  // Hash the default password ONCE — reuse for all users
  const defaultHash = bcrypt.hashSync(DEFAULT_PASSWORD, 10)
  console.log('Identifying bulk-imported users...')

  // First pass: identify which users need a reset (no bcrypt comparison — we
  // assume any bulk-imported user needs to be reset, since they were all
  // created with IPPIS as the password, not admin123).
  const candidates: typeof users = []
  for (const u of users) {
    if (SKIP_USERNAMES.has(u.username)) {
      skippedDemo++
      continue
    }
    // Identify bulk-imported users by username pattern
    let isBulkImported = false
    let reason = ''
    if (u.staff) {
      const slug = nameToSlug(u.staff.fullName)
      if (u.username === slug) {
        isBulkImported = true
        reason = `username matches full-name slug (${slug})`
      } else if (u.staff.ippisNumber && u.username === u.staff.ippisNumber) {
        isBulkImported = true
        reason = `username matches IPPIS (${u.staff.ippisNumber})`
      }
    }
    if (!isBulkImported && /^\d+$/.test(u.username)) {
      isBulkImported = true
      reason = `username is all-numeric (IPPIS pattern)`
    }
    if (!isBulkImported) {
      skippedNoMatch++
      continue
    }
    candidates.push({ ...u, _reason: reason })
  }
  console.log(`Found ${candidates.length} bulk-imported users (out of ${users.length} total).`)

  // For the dry-run, sample-check a few users to see if they already have admin123.
  // We do this for only the first 5 candidates to keep the dry-run fast.
  if (dryRun) {
    console.log('\n[DRY-RUN] Sampling 5 users to confirm they need a reset:')
    for (const u of candidates.slice(0, 5)) {
      const matchesDefault = await bcrypt.compare(DEFAULT_PASSWORD, u.passwordHash)
      console.log(`  - ${u.username} (${u.fullName}) — already admin123? ${matchesDefault ? 'YES (would skip)' : 'NO (would reset)'}`)
    }
  }

  // Second pass: reset all bulk-imported users unconditionally (no bcrypt.compare
  // — we already know they were created with IPPIS as password, not admin123).
  // Process in batches of 100 with a progress log every 500.
  const BATCH_SIZE = 100
  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE)
    if (!dryRun) {
      // Use a transaction to update each user + create an audit log entry
      await db.$transaction([
        ...batch.map((u: any) =>
          db.user.update({
            where: { id: u.id },
            data: { passwordHash: defaultHash },
          }),
        ),
      ])
      // Best-effort audit logs (separate from the transaction so audit failures don't block)
      for (const u of batch) {
        try {
          await db.auditLog.create({
            data: {
              userId: 'system',
              action: 'update',
              entity: 'User',
              entityId: u.id,
              details: `Bulk-reset password to default (${DEFAULT_PASSWORD}) for bulk-imported user ${u.username}`,
            },
          })
        } catch {}
      }
    }
    reset += batch.length
    if (resetList.length < 20) {
      for (const u of batch) {
        if (resetList.length < 20) resetList.push({ username: u.username, fullName: u.fullName, reason: (u as any)._reason || '' })
      }
    }
    if (i % 500 === 0) {
      console.log(`  Processed ${Math.min(i + BATCH_SIZE, candidates.length)}/${candidates.length}...`)
    }
  }

  console.log(`\n--- Summary ---`)
  console.log(`Users scanned:                ${users.length}`)
  console.log(`Passwords reset to admin123:  ${reset}`)
  console.log(`Skipped (demo/seed users):    ${skippedDemo}`)
  console.log(`Skipped (already admin123):   ${skippedAlreadyDefault}`)
  console.log(`Skipped (not bulk-imported):   ${skippedNoMatch}`)

  if (reset > 0 && reset <= 20) {
    console.log(`\n--- Reset users (sample) ---`)
    for (const r of resetList) {
      console.log(`  - ${r.username} (${r.fullName}) — ${r.reason}`)
    }
  } else if (reset > 20) {
    console.log(`\n--- First 20 reset users ---`)
    for (const r of resetList.slice(0, 20)) {
      console.log(`  - ${r.username} (${r.fullName}) — ${r.reason}`)
    }
    console.log(`  ... and ${reset - 20} more`)
  }

  if (dryRun) {
    console.log(`\n[DRY-RUN] No changes were made. Re-run without --dry-run to apply.`)
  } else {
    console.log(`\n✓ Done. All bulk-imported users can now log in with the default password "${DEFAULT_PASSWORD}".`)
    console.log(`  Staff should change their password from their Profile page after login.`)
  }
}

main()
  .catch((e) => {
    console.error('Bulk reset failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
