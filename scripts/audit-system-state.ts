import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('=== SYSTEM AUDIT ===\n')
  const schema = fs.readFileSync('/home/z/my-project/prisma/schema.prisma', 'utf8')
  const checks: [string, boolean][] = [
    ['CommitteeMember model', schema.includes('model CommitteeMember')],
    ['Committee.termOfReference', schema.includes('termOfReference')],
    ['Committee.budget', schema.includes('budget')],
    ['Committee.members2', schema.includes('members2')],
    ['PasswordResetRequest model', schema.includes('model PasswordResetRequest')],
    ['User.unitId field', /unitId\s+String\?/m.test(schema)],
    ['User.committeeMembersAdded', schema.includes('committeeMembersAdded')],
    ['User.passwordResetsResolved', schema.includes('passwordResetsResolved')],
    ['Staff.committeeMemberships', schema.includes('committeeMemberships')],
  ]
  for (const [name, ok] of checks) console.log(`  ${ok ? '✓' : '✗ MISSING'} ${name}`)

  console.log('\n2. Database tables:')
  try {
    const c = await prisma.committee.count(); console.log(`  ✓ Committee (${c})`)
    try { const cm = await (prisma as any).committeeMember.count(); console.log(`  ✓ CommitteeMember (${cm})`) } catch { console.log('  ✗ CommitteeMember MISSING') }
    try { const pw = await (prisma as any).passwordResetRequest.count(); console.log(`  ✓ PasswordResetRequest (${pw})`) } catch { console.log('  ✗ PasswordResetRequest MISSING') }
    console.log(`  ✓ Department: ${await prisma.department.count()}`)
    console.log(`  ✓ Unit: ${await prisma.unit.count()}`)
    console.log(`  ✓ Staff: ${await prisma.staff.count()}`)
    console.log(`  ✓ User: ${await prisma.user.count()}`)
  } catch (e: any) { console.log(`  ✗ ${e.message}`) }

  console.log('\n3. API files:')
  const apiChecks: [string, boolean][] = [
    ['/api/auth/login (IPPIS)', fs.readFileSync('/home/z/my-project/src/app/api/auth/login/route.ts','utf8').includes('IPPIS')],
    ['/api/auth/change-password', fs.existsSync('/home/z/my-project/src/app/api/auth/change-password/route.ts')],
    ['/api/password-resets', fs.existsSync('/home/z/my-project/src/app/api/password-resets/route.ts')],
    ['/api/password-resets/[id]', fs.existsSync('/home/z/my-project/src/app/api/password-resets/[id]/route.ts')],
    ['/api/users enhanced search', fs.readFileSync('/home/z/my-project/src/app/api/users/route.ts','utf8').includes('ippisNumber')],
    ['/api/documents staff-only', !fs.readFileSync('/home/z/my-project/src/app/api/documents/route.ts','utf8').includes('isPublic: true')],
  ]
  for (const [name, ok] of apiChecks) console.log(`  ${ok ? '✓' : '✗ MISSING'} ${name}`)

  console.log('\n4. Branding:')
  const ls = fs.readFileSync('/home/z/my-project/src/components/futh/LoginScreen.tsx','utf8')
  console.log(`  ${ls.includes('FUTH LAFIA') ? '✓' : '✗'} FUTH LAFIA`)
  console.log(`  ${ls.includes('FEDERAL UNIVERSITY TEACHING HOSPITAL') ? '✓' : '✗'} FEDERAL UNIVERSITY TEACHING HOSPITAL`)
  console.log(`  ${ls.includes('HUMAN RESOURCES MANAGEMENT SYSTEM') ? '✓' : '✗'} HUMAN RESOURCES MANAGEMENT SYSTEM`)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(async () => { await prisma.$disconnect() })
