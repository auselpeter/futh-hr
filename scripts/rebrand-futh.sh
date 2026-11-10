#!/bin/bash
# Rebrand FUTH Lafia strings across the codebase.
# Applies the user's requested changes:
#   "FUTH Lafia"                                   -> "FUTH LAFIA"
#   "Federal University Teaching Hospital, Lafia"  -> "FEDERAL UNIVERSITY TEACHING HOSPITAL"
#   "Federal University Teaching Hospital"          -> "FEDERAL UNIVERSITY TEACHING HOSPITAL"
#   "Performance Management & Human Resource System" -> "HUMAN RESOURCES MANAGEMENT SYSTEM"
#   "HR & Performance Management System"             -> "HUMAN RESOURCES MANAGEMENT SYSTEM"
#   "FUTH Lafia HR & Performance Management System"  -> "FUTH LAFIA HR · HUMAN RESOURCES MANAGEMENT SYSTEM"
#   "FUTH Lafia HR System"                           -> "FUTH LAFIA HR System"
#   "FUTH Lafia PMS"                                 -> "FUTH LAFIA PMS"
#   "FUTH Lafia logo"                                -> "FUTH LAFIA logo"
#   "FUTH Lafia HR"                                  -> "FUTH LAFIA HR"
#   "Performance Management"                         -> "Human Resources Management"  (only in layout.tsx keywords)

set -e

cd /home/z/my-project

# Files to update (only source files — skip SQL dumps, worklog, tool-results, screenshots).
FILES=(
  src/components/futh/LoginScreen.tsx
  src/components/futh/AppShell.tsx
  src/components/futh/Topbar.tsx
  src/components/futh/Sidebar.tsx
  src/components/futh/Dashboard.tsx
  src/components/futh/CMDDashboard.tsx
  src/components/futh/Settings.tsx
  src/components/futh/TwoFactorSetup.tsx
  src/components/futh/UserManagement.tsx
  src/components/futh/RequisitionDetail.tsx
  src/components/futh/Promotions.tsx
  src/components/futh/PostingTransfer.tsx
  src/components/futh/Terminations.tsx
  src/components/futh/Retirements.tsx
  src/components/futh/Reports.tsx
  src/components/futh/Trainings.tsx
  src/components/futh/Leaves.tsx
  src/components/futh/PaymentVouchers.tsx
  src/components/futh/Appraisals.tsx
  src/components/futh/Resignations.tsx
  src/components/futh/StaffDirectory.tsx
  src/components/futh/DepartmentRatings.tsx
  src/app/layout.tsx
  src/app/globals.css
  src/lib/print.ts
  src/lib/twofactor.ts
  prisma/schema.prisma
)

apply_replacements() {
  local f="$1"
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
}

echo "Rebranding ${#FILES[@]} files..."

for f in "${FILES[@]}"; do
  if [ -f "$f" ]; then
    apply_replacements "$f"
    echo "  ✓ $f"
  else
    echo "  ! SKIP (not found): $f"
  fi
done

echo ""
echo "Done. Now run: bun run lint  &&  restart dev server"
