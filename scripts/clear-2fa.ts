// Clear 2FA from executive accounts so user can log in
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

async function main() {
  console.log('Clearing 2FA from executive accounts...')
  const result = await db.user.updateMany({
    where: {
      OR: [
        { username: 'superadmin' },
        { username: 'cmd' },
        { username: 'cma' },
        { username: 'ad' },
        { username: 'dfa' },
        { username: 'admin' },
      ],
    },
    data: {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorRecoveryCodes: null,
      twoFactorEnforcedAt: null,
      twoFactorLastUsedAt: null,
    },
  })
  console.log(`✓ Cleared 2FA from ${result.count} executive accounts`)

  // Also clear any active role override
  const clearedOverrides = await db.user.updateMany({
    where: { activeRoleOverride: { not: null } },
    data: { activeRoleOverride: null },
  })
  console.log(`✓ Cleared ${clearedOverrides.count} role override(s)`)

  console.log('\nYou can now log in with:')
  console.log('  superadmin / admin123')
  console.log('  cmd / admin123')
  console.log('  cma / admin123')
  console.log('  ad / admin123')
  console.log('  dfa / admin123')
  console.log('  admin / admin123')
}

main().catch(console.error).finally(() => db.$disconnect())
