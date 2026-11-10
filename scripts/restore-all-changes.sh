#!/bin/bash
# Comprehensive restore script — re-applies ALL rolled-back changes in one shot.
# Run: bash scripts/restore-all-changes.sh
set -e
cd /home/z/my-project

echo "=== 1. Restoring login 3-stage IPPIS lookup ==="
# Patch /api/auth/login to add 3-stage lookup (username → IPPIS → staffId)
python3 << 'PYEOF'
import re
f = '/home/z/my-project/src/app/api/auth/login/route.ts'
content = open(f).read()
if 'IPPIS' in content and 'staff.ippisNumber' in content:
    print('  Already has IPPIS lookup — skipping')
else:
    old = '''    const user = await db.user.findUnique({
      where: { username: String(username).trim().toLowerCase() },
      include: { designation: true, department: true, staff: true },
    })
    if (!user) {
      // Best-effort audit of failed login (no user context)
      try {
        await db.auditLog.create({
          data: {
            userId: 'unknown',
            action: 'login_failed',
            entity: 'User',
            details: `Unknown username: ${username}`,
            ipAddress: getIp(req),
          },
        })
      } catch {}
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }'''
    new = '''    // === Username / IPPIS lookup ===
    // The institutional policy is: username = IPPIS Number. But the user may type
    // their IPPIS, their custom username, or even their staffId — look up the
    // User by username first, then by linked Staff.ippisNumber, then by
    // linked Staff.staffId (FUTH/001 etc.).
    const trimmed = String(username).trim().toLowerCase()
    let user = await db.user.findUnique({
      where: { username: trimmed },
      include: { designation: true, department: true, staff: true },
    })
    if (!user) {
      // Try matching by IPPIS Number on the linked Staff record
      user = await db.user.findFirst({
        where: { staff: { ippisNumber: String(username).trim() } },
        include: { designation: true, department: true, staff: true },
      })
    }
    if (!user) {
      // Try matching by Staff.staffId (FUTH internal staff number, e.g. "FUTH/001")
      user = await db.user.findFirst({
        where: { staff: { staffId: String(username).trim() } },
        include: { designation: true, department: true, staff: true },
      })
    }
    if (!user) {
      // Best-effort audit of failed login (no user context)
      try {
        await db.auditLog.create({
          data: {
            userId: 'unknown',
            action: 'login_failed',
            entity: 'User',
            details: `Unknown username / IPPIS: ${username}`,
            ipAddress: getIp(req),
          },
        })
      } catch {}
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }'''
    if old in content:
        content = content.replace(old, new)
        open(f, 'w').write(content)
        print('  ✓ Patched login route with 3-stage IPPIS lookup')
    else:
        print('  ! Could not find expected block in login route — manual fix needed')
PYEOF

echo ""
echo "=== 2. Restoring schema (CommitteeMember, PasswordResetRequest, Committee fields) ==="
python3 << 'PYEOF'
f = '/home/z/my-project/prisma/schema.prisma'
content = open(f).read()
changed = False

# Check if CommitteeMember model exists
if 'model CommitteeMember' not in content:
    # Find the Committee model and add new fields + CommitteeMember model after it
    # Also check if Committee already has the new fields
    if 'termOfReference' not in content:
        old_committee = '''  members     String?   // JSON list of member IDs/names
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  files       RegistryFile[]
  documents   Document[]

  @@index([isActive])
}'''
        new_committee = '''  members     String?   // JSON list of member IDs/names (legacy)
  termOfReference String?
  startDate       DateTime?
  endDate         DateTime?
  budget          Float?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  files       RegistryFile[]
  documents   Document[]
  members2    CommitteeMember[]

  @@index([isActive])
}

model CommitteeMember {
  id          String   @id @default(cuid())
  committeeId String
  committee   Committee @relation(fields: [committeeId], references: [id], onDelete: Cascade)
  staffId     String
  staff       Staff    @relation(fields: [staffId], references: [id], onDelete: Cascade)
  role        String   @default("member")
  addedById   String?
  addedBy     User?    @relation("CommitteeMemberAddedBy", fields: [addedById], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([committeeId, staffId])
  @@index([committeeId])
  @@index([staffId])
}'''
        if old_committee in content:
            content = content.replace(old_committee, new_committee)
            changed = True
            print('  ✓ Added CommitteeMember model + Committee fields')
        else:
            print('  ! Could not find Committee model block to patch')

# Check if PasswordResetRequest model exists
if 'model PasswordResetRequest' not in content:
    # Add after CommitteeMember model (or after Committee if CommitteeMember was just added)
    prm = '''model PasswordResetRequest {
  id          String   @id @default(cuid())
  userId      String?
  user        User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  usernameQuery String
  contactEmail String?
  contactPhone String?
  note        String?
  status      String   @default("pending")
  resolvedById String?
  resolvedBy   User?   @relation("PasswordResetResolvedBy", fields: [resolvedById], references: [id])
  resolvedAt   DateTime?
  resolvedNote String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([status])
  @@index([userId])
}

'''
    # Insert before the first "model FileRoute" or before "model Requisition" or at end
    if 'model FileRoute' in content:
        content = content.replace('model FileRoute {', prm + 'model FileRoute {')
        changed = True
        print('  ✓ Added PasswordResetRequest model')
    else:
        content += '\n' + prm
        changed = True
        print('  ✓ Added PasswordResetRequest model (at end)')

# Check if User has passwordResetRequests / passwordResetsResolved back-relations
if 'passwordResetsResolved' not in content:
    old_pv = '''  // PV comments
  pvComments PVComment[]

  @@index([role])
}'''
    new_pv = '''  // Committee members added by this user (audit)
  committeeMembersAdded CommitteeMember[] @relation("CommitteeMemberAddedBy")

  // Password resets — requests submitted for this user, and requests resolved by this admin
  passwordResetRequests  PasswordResetRequest[]
  passwordResetsResolved PasswordResetRequest[] @relation("PasswordResetResolvedBy")

  // PV comments
  pvComments PVComment[]

  @@index([role])
}'''
    if old_pv in content:
        content = content.replace(old_pv, new_pv)
        changed = True
        print('  ✓ Added User back-relations (committeeMembersAdded, passwordResetsResolved)')
    else:
        print('  ! Could not find PV comments block to patch for User back-relations')

# Check if Unit has users back-relation
if 'users    User[]   @relation("UserUnit")' not in content:
    old_unit = '''  staff    Staff[]
  projects Project[]
  postingsTo PostingTransfer[]

  @@index([departmentId])
}'''
    new_unit = '''  staff    Staff[]
  projects Project[]
  postingsTo PostingTransfer[]
  users    User[]   @relation("UserUnit")

  @@index([departmentId])
}'''
    if old_unit in content:
        content = content.replace(old_unit, new_unit)
        changed = True
        print('  ✓ Added Unit.users back-relation')

# Check if Staff has committeeMemberships back-relation
if 'committeeMemberships' not in content:
    old_staff = '''  // Documents linked to this staff record (e.g. personal image/signature, hardcopy scans)
  documents Document[]

  @@index([departmentId])'''
    new_staff = '''  // Documents linked to this staff record (e.g. personal image/signature, hardcopy scans)
  documents Document[]

  // Committee memberships — proper m2m via CommitteeMember join table
  committeeMemberships CommitteeMember[]

  @@index([departmentId])'''
    if old_staff in content:
        content = content.replace(old_staff, new_staff)
        changed = True
        print('  ✓ Added Staff.committeeMemberships back-relation')

if changed:
    open(f, 'w').write(content)
    print('  Schema updated')
else:
    print('  Schema already up to date')
PYEOF

echo ""
echo "=== 3. Creating missing API directories ==="
mkdir -p /home/z/my-project/src/app/api/auth/change-password
mkdir -p /home/z/my-project/src/app/api/password-resets/\[id\]
echo "  ✓ Directories created"

echo ""
echo "=== 4. Restoring /api/documents staff-only scope ==="
python3 << 'PYEOF'
f = '/home/z/my-project/src/app/api/documents/route.ts'
content = open(f).read()
if 'isPublic: true' in content and 'scopeOrs.push({ isPublic: true })' in content:
    content = content.replace('      scopeOrs.push({ isPublic: true })\n', '')
    open(f, 'w').write(content)
    print('  ✓ Removed isPublic:true from non-manager scope')
else:
    print('  Already staff-only scope or pattern not found')
PYEOF

echo ""
echo "=== 5. Restoring /api/users enhanced search ==="
python3 << 'PYEOF'
f = '/home/z/my-project/src/app/api/users/route.ts'
content = open(f).read()
if 'ippisNumber' in content and 'staff: { ippisNumber' in content:
    print('  Already has enhanced search — skipping')
else:
    old = '''    if (search) {
      where.OR = [
        { fullName: { contains: search } },
        { username: { contains: search } },
        { email: { contains: search } },
      ]
    }'''
    new = '''    if (search) {
      where.OR = [
        { fullName: { contains: search } },
        { username: { contains: search } },
        { email: { contains: search } },
        { staff: { ippisNumber: { contains: search } } },
        { staff: { staffId: { contains: search } } },
        { designation: { code: { contains: search } } },
        { designation: { name: { contains: search } } },
        { department: { code: { contains: search } } },
        { department: { name: { contains: search } } },
      ]
    }'''
    if old in content:
        content = content.replace(old, new)
        open(f, 'w').write(content)
        print('  ✓ Added enhanced search (IPPIS, designation, department)')
    else:
        print('  ! Could not find search block to patch')
PYEOF

echo ""
echo "=== 6. Restoring branding (FUTH LAFIA etc.) ==="
# Run the rebrand script if it exists, or do inline replacements
for f in \
  src/components/futh/LoginScreen.tsx \
  src/components/futh/AppShell.tsx \
  src/components/futh/Topbar.tsx \
  src/components/futh/Sidebar.tsx \
  src/components/futh/Dashboard.tsx \
  src/components/futh/Settings.tsx \
  src/components/futh/TwoFactorSetup.tsx \
  src/components/futh/UserManagement.tsx \
  src/components/futh/CMDDashboard.tsx \
  src/app/layout.tsx \
  src/lib/print.ts \
  src/lib/twofactor.ts \
  src/components/futh/RequisitionDetail.tsx \
  src/components/futh/Promotions.tsx \
  src/components/futh/PostingTransfer.tsx \
  src/components/futh/Terminations.tsx \
  src/components/futh/Retirements.tsx \
  src/components/futh/Reports.tsx \
  src/components/futh/Trainings.tsx \
  src/components/futh/Leaves.tsx \
  src/components/futh/PaymentVouchers.tsx \
  src/components/futh/Appraisals.tsx \
  src/components/futh/Resignations.tsx \
  src/components/futh/StaffDirectory.tsx \
  src/components/futh/DepartmentRatings.tsx \
  src/app/globals.css \
  prisma/schema.prisma; do
  if [ -f "$f" ]; then
    sed -i \
      -e 's|FUTH Lafia HR & Performance Management System|FUTH LAFIA HR · HUMAN RESOURCES MANAGEMENT SYSTEM|g' \
      -e 's|FUTH Lafia HR &amp; Performance Management System|FUTH LAFIA HR &amp; HUMAN RESOURCES MANAGEMENT SYSTEM|g' \
      -e 's|Performance Management & Human Resource System|HUMAN RESOURCES MANAGEMENT SYSTEM|g' \
      -e 's|HR & Performance Management System|HUMAN RESOURCES MANAGEMENT SYSTEM|g' \
      -e 's|Federal University Teaching Hospital, Lafia|FEDERAL UNIVERSITY TEACHING HOSPITAL|g' \
      -e 's|Federal University Teaching Hospital|FEDERAL UNIVERSITY TEACHING HOSPITAL|g' \
      -e 's|FUTH Lafia PMS|FUTH LAFIA PMS|g' \
      -e 's|FUTH Lafia HR System|FUTH LAFIA HR System|g' \
      -e 's|FUTH Lafia HR|FUTH LAFIA HR|g' \
      -e 's|FUTH Lafia logo|FUTH LAFIA logo|g' \
      -e 's|FUTH Lafia|FUTH LAFIA|g' \
      -e 's|Performance Management &amp; Human Resource System|HUMAN RESOURCES MANAGEMENT SYSTEM|g' \
      -e 's|Performance Management|Human Resources Management|g' \
      "$f"
  fi
done
# Fix print.ts broken double-replacement
sed -i 's|FUTH LAFIA HR FUTH LAFIA HR &amp; Human Resources Management Systemamp; HUMAN RESOURCES MANAGEMENT SYSTEM|FUTH LAFIA HR · HUMAN RESOURCES MANAGEMENT SYSTEM|g' src/lib/print.ts 2>/dev/null || true
# Drop ", LAFIA" from print.ts registry cover sheet
sed -i 's|FEDERAL UNIVERSITY TEACHING HOSPITAL, LAFIA|FEDERAL UNIVERSITY TEACHING HOSPITAL|g' src/lib/print.ts 2>/dev/null || true
echo "  ✓ Branding applied to all files"

echo ""
echo "=== Done with automated patches. Now writing new files... ==="
