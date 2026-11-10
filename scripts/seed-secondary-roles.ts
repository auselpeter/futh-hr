// Seed script: add secondary roles to some demo users for role-switching demo
// Run with: bun run /home/z/my-project/scripts/seed-secondary-roles.ts

import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

async function main() {
  console.log('Adding secondary roles to demo users...')

  // hod_surg (HOD) → also APPRAISAL_OFFICER (can act as Appraisal Officer when needed)
  const hodSurg = await db.user.findUnique({ where: { username: 'hod_surg' } })
  if (hodSurg) {
    await db.user.update({
      where: { id: hodSurg.id },
      data: { secondaryRoles: 'APPRAISAL_OFFICER' },
    })
    console.log(`✓ hod_surg secondary roles: HOD + APPRAISAL_OFFICER`)
  }

  // cma (CMA) → also AD (can act as Administrator)
  const cma = await db.user.findUnique({ where: { username: 'cma' } })
  if (cma) {
    await db.user.update({
      where: { id: cma.id },
      data: { secondaryRoles: 'AD,REGISTRY_OFFICER' },
    })
    console.log(`✓ cma secondary roles: CMA + AD + REGISTRY_OFFICER`)
  }

  // ad (AD) → also REGISTRY_OFFICER
  const ad = await db.user.findUnique({ where: { username: 'ad' } })
  if (ad) {
    await db.user.update({
      where: { id: ad.id },
      data: { secondaryRoles: 'REGISTRY_OFFICER' },
    })
    console.log(`✓ ad secondary roles: AD + REGISTRY_OFFICER`)
  }

  // dfa (DFA) → also HOD (for Finance dept) — so they can switch to HOD view
  const dfa = await db.user.findUnique({ where: { username: 'dfa' } })
  if (dfa) {
    await db.user.update({
      where: { id: dfa.id },
      data: { secondaryRoles: 'HOD' },
    })
    console.log(`✓ dfa secondary roles: DFA + HOD`)
  }

  console.log('Done!')
}

main().catch(console.error).finally(() => db.$disconnect())
