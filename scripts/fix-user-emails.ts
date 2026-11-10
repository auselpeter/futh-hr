/**
 * Fix duplicate and malformed emails in the User table.
 *
 * Issues found:
 *   1. 2 case-insensitive duplicate emails (yakubuwusa@gmail.com, safiyanuiliya1997@gmail.com)
 *   2. 2 malformed emails with wrong characters (usmaniliyasu506"gmail.com, hassanilyasudalibi@gmail.cim)
 *   3. 12 emails with spaces (need to strip spaces)
 *   4. Some emails have mixed case that could cause MySQL UNIQUE constraint issues
 *
 * Fix strategy:
 *   - Strip spaces from all emails
 *   - Fix obvious typos (gmail.cim → gmail.com, " → @)
 *   - For duplicates: append a number to the second occurrence
 *   - Lowercase all emails (MySQL UNIQUE is case-insensitive by default)
 */
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('Fixing user emails...')

  const allUsers = await prisma.user.findMany({ select: { id: true, email: true, username: true } })
  console.log(`Total users: ${allUsers.length}`)

  let fixed = 0
  const seenEmails = new Set<string>()

  for (const u of allUsers) {
    let email = u.email || ''

    // Fix: strip spaces
    email = email.replace(/\s+/g, '')

    // Fix: obvious typos
    email = email.replace('"', '@')           // usmaniliyasu506"gmail.com → usmaniliyasu506@gmail.com
    email = email.replace('gmail.cim', 'gmail.com')  // gmail.cim → gmail.com
    email = email.replace('G.MAIL.COM', 'gmail.com')
    email = email.replace('g.mail.com', 'gmail.com')

    // Fix: remove trailing junk (e.g. "emailNO.ESSON MAIRIGA...")
    email = email.replace(/(.+@[^@]+).*/i, '$1')  // keep only the first valid email pattern

    // Fix: if email is not a valid email, replace with auto-generated
    if (!email || !email.includes('@') || email.length < 5) {
      email = `${u.username}@futhlafia.gov.ng`
    }

    // Lowercase
    email = email.toLowerCase()

    // Fix duplicates: if this email was already seen, append a suffix
    if (seenEmails.has(email)) {
      let suffix = 1
      let newEmail = email.replace('@', `${suffix}@`)
      while (seenEmails.has(newEmail)) {
        suffix++
        newEmail = email.replace('@', `${suffix}@`)
      }
      email = newEmail
    }
    seenEmails.add(email)

    if (email !== u.email) {
      await prisma.user.update({ where: { id: u.id }, data: { email } })
      fixed++
    }
  }

  console.log(`Fixed ${fixed} user emails`)

  // Verify: check for any remaining duplicates
  const users2 = await prisma.user.findMany({ select: { email: true } })
  const emails = users2.map(u => (u.email || '').toLowerCase())
  const dupes = emails.filter((e, i) => emails.indexOf(e) !== i)
  console.log(`Remaining duplicates: ${dupes.length}`)
  if (dupes.length > 0) {
    for (const d of dupes) console.log(`  DUPLICATE: ${d}`)
  }
}

main().catch(e => { console.error(e); process.exit(1) }).finally(async () => { await prisma.$disconnect() })
