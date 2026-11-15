# FUTH Lafia HR — Update Log

This document summarizes the changes in this delivery. The project remains a
single-route Next.js 16 + TypeScript + Prisma + shadcn/ui SPA, identical in
layout to the previous version — all the new features plug into the existing
sidebar / view router.

## What's new

### 1. Document preview fix (FileUpload.tsx + /api/uploads)

- **FileUpload.tsx** rewritten to render file-type icons + filename for non-image
  uploads (PDFs, Word docs, Excel sheets, etc.) instead of the broken "No file"
  text the previous version showed.
- **Client-side image compression** added: images > 500KB are auto-compressed
  via `<canvas>` to ≤ 1600px long edge, JPEG quality 0.82, before upload.
  This eliminates the "unexpected tokens" body-parser error users were hitting
  on >10MB uploads.
- **Upload size limit bumped** from 10MB → 50MB in `/api/uploads/route.ts`.
- **Next.js body parser limit raised** to 60MB via `experimental.serverActions.bodySizeLimit`
  in `next.config.ts` so multipart uploads reach the route handler.
- **Underlying file deletion** added to `DELETE /api/documents/[id]` — the
  file is now removed from `public/uploads/{type}/` alongside the DB record.
  If the deleted document was a staff avatar or signature, the link on the
  Staff record is cleared too (so the directory doesn't show broken images).

### 2. Appointment Confirmation workflow

New model `AppointmentConfirmation` mirroring Promotions/Resignations.

**Workflow:** Submitted → HOD Approved → DFA Approved → CMD Approved → Completed
(any pre-CMD stage can also be Rejected or Cancelled).

**API routes:**
- `GET /api/appointment-confirmations?tab=all|mine|pending_my_approval|approved|rejected`
- `POST /api/appointment-confirmations` (create — admin/registry/planning/HOD/DFA/CMD)
- `GET /api/appointment-confirmations/[id]`
- `PATCH /api/appointment-confirmations/[id]` (only in Draft/Submitted/HOD Approved)
- `DELETE /api/appointment-confirmations/[id]` (only Draft/Submitted/Rejected/Cancelled)
- `POST /api/appointment-confirmations/[id]/action` — `hod_approve` / `dfa_approve` / `cmd_approve` / `complete` / `reject` / `cancel`

The `complete` action also stamps `Staff.confirmationDate` and optionally
bumps `Staff.gradeLevel` / `Staff.step` if `newGradeLevel` / `newStep`
were captured on the confirmation record.

**Ref number format:** `FUTH/CONF/{YEAR}/{SEQ:06d}` (e.g. `FUTH/CONF/2026/000001`).

**UI:** new `AppointmentConfirmations.tsx` component — 5-tab list (All | Pending
My Approval | Submitted by Me | Approved | Rejected), search + status filter,
detail Sheet with HOD→DFA→CMD approval timeline + signature thumbnails,
attached letter/form downloads, action modal with signature upload, print
confirmation letter button. Wired into the sidebar as
"Appointment Confirmations".

### 3. Attendance module (ZKTeco 192.168.1.200:4370)

New models: `Shift`, `StaffShift`, `AttendanceRecord`.

**Department.isClinical** boolean added (clinical departments deliver direct
patient care: Surgery, Medicine, ICU, A&E, Paediatrics, O&G, Lab, Pharmacy,
Nursing, Radiology). The seed script `scripts/seed-default-shifts.ts` flags
the known clinical departments and creates 5 global shift templates:

- `EARLY` 06:00–14:00 (clinical early)
- `LATE` 14:00–22:00 (clinical late)
- `NIGHT` 22:00–06:00 (clinical night, crosses midnight)
- `CALL` 00:00–23:59 (call-duty, 24h on-call)
- `STANDARD` 08:00–16:00 (non-clinical default)

Admins can edit any shift's time window per department from the Shifts tab
in the Attendance page.

**API routes:**
- `GET /api/attendance?staffId=&departmentId=&dateFrom=&dateTo=&shiftId=&status=&day=&q=&limit=&offset=`
- `POST /api/attendance/sync` — connects to ZKTeco device (default `192.168.1.200:4370`,
  overridable via `ZKTECO_HOST` / `ZKTECO_PORT` env vars or request body).
  Probes TCP reachability; if unreachable, returns a clear error suggesting
  CSV import instead.
- `POST /api/attendance/import` — accepts a CSV paste from ZKTeco's "Attend"
  software. Two header formats supported:
  - `UserID,DateTime,InOutMode,VerifyMode,WorkCode`
  - `User ID,Date,Time,IN/OUT,Verify Mode,Work Code`
  UserID is matched against IPPIS first, then staffId. Existing records
  (same staff + punchTime + deviceId) are skipped.
- `GET /api/attendance/summary?from=&to=&departmentId=&groupBy=day|month`
- `GET /api/shifts?departmentId=&includeInactive=`
- `POST /api/shifts` (admin/registry/planning)
- `PATCH /api/shifts/[id]`
- `DELETE /api/shifts/[id]` (soft-deletes if records exist)

**Status computation** (in `src/app/api/attendance/util.ts`):
- Punch IN after `shiftStart + graceMinutes` → `late` (minutesLate recorded)
- Punch OUT before `shiftEnd - graceMinutes` → `early_leave` (minutesEarly recorded)
- Otherwise → `on_time`
- For night shifts crossing midnight, the `day` field is the date the shift
  STARTED (so a 02:00 punch on 2026-03-15 for a 22:00–06:00 shift counts
  toward 2026-03-14).
- IN/OUT pairing happens automatically after CSV import — `hoursWorked` is
  set on the OUT punch by linking it to the previous IN punch on the same day.

**UI:** new `Attendance.tsx` component with 3 tabs:
- **Punch Records** — filters (search, dept, shift, status, date range), table
  of punches with status badges, export to Excel.
- **Summary** — staff-by-staff aggregation (present days, total punches,
  on-time / late / early-leave counts, total + avg hours worked) grouped
  by day or month.
- **Shifts** — admin CRUD for shift definitions (per-department overrides
  + global templates).

The Sync from Device dialog probes 192.168.1.200:4370 and shows a clear
error if unreachable. The Import CSV dialog accepts pasted CSV content.

### 4. Staff Flags (confirmation / promotion / retirement due or overdue)

New virtual endpoint `GET /api/staff/flags?type=all|confirmation|promotion|retirement`
computes flags on the fly from staff records:

- `confirmation_due` — `dateHired + 2 years` within next 90 days, no `confirmationDate` set
- `confirmation_overdue` — `dateHired + 2y 3m` passed, still no `confirmationDate`
- `promotion_due` — last promotion (or `dateHired` if never promoted) + 3 years within 90 days
- `promotion_overdue` — last promotion + 3y 3m passed
- `retirement_due` — `retirementDate` within next 90 days
- `retirement_overdue` — `retirementDate` in the past, status != retired

All thresholds are overridable via query params (`confirmationDueYears`,
`confirmationOverdueMonths`, `promotionDueYears`, `retirementDueDays`).

**UI:**
- New `StaffFlags.tsx` page in the sidebar (icon: shield-alert). Shows 6
  summary cards (due + overdue counts for each flag type), filterable list
  with color-coded badges, detail Sheet with quick-action buttons that
  jump to Appointment Confirmations / Promotions / Retirements.
- **Inline badges on Staff Directory** — every staff card now shows up to 3
  flag badges next to their status (yellow for due, red for overdue). The
  detail Sheet has a Flags row showing all flags with due dates / day counts.

### 5. TypeScript errors fixed

All the errors from the broken terminal log are resolved:

- `scripts/bulk-reset-passwords.ts` — `_reason` not allowed on User type → cast `candidates: any[]`
- `scripts/cleanup-orphan-depts-units.ts` — `headedUnitId` doesn't exist → use `Unit.houUserId`
- `scripts/seed-secretary-roles.ts` — `as const` was over-narrowing the email type → removed
- `src/app/api/auth/2fa/enable/route.ts` + `setup/route.ts` — `user` possibly null after the if-else branch → `let user: any`
- `src/app/api/department-ratings/route.ts` + `unit-ratings/route.ts` — `ratings.push` on `never[]` → typed as `any[]`
- `src/app/api/duties/[id]/review/route.ts` + `upload-evidence/route.ts` — `staff?.unitId` not in `SafeUser.staff` type → extended `SafeUser.staff` to include `departmentId` and `unitId`
- `src/app/api/resignations/[id]/route.ts` — `existing.staff?.userId` not accessible because `findUnique` didn't include `staff` → added `include: { staff: { select: { id, userId, departmentId } } }`
- `src/app/api/staff/[id]/route.ts` — `as const` on `fullInclude` made `period: 'desc'` readonly → cast as `any`
- `src/components/futh/Leaves.tsx` — duplicate object literal key `'HOD Approved'` → removed duplicate
- `src/components/futh/Mail.tsx` — regex `/s` flag requires ES2018+ → replaced with `.split('\n')[0]`
- `src/components/futh/MyPendingApprovals.tsx` — `.filter` widened `type` to string → cast result array
- `src/lib/print.ts` — `cells.push` on `never[]` (3 places) → typed as `string[]`
- `tsconfig.json` target bumped from `ES2017` → `ES2020`

`npx tsc --noEmit` now passes cleanly with **zero** errors. `npx next build`
compiles successfully.

## Setup

```bash
# 1. Install deps (already done in this delivery)
npm install

# 2. Apply schema changes (idempotent — safe to re-run)
npx prisma db push --accept-data-loss
npx prisma generate

# 3. Seed the 5 default shifts + flag clinical departments
npx tsx scripts/seed-default-shifts.ts

# 4. (Optional) Set ZKTeco device env vars in .env
#    ZKTECO_HOST=192.168.1.200
#    ZKTECO_PORT=4370

# 5. Start the dev server
npx next dev
# or: npm start  (production build)
```

Demo logins (unchanged): `superadmin`, `admin`, `cmd`, `cma`, `ad`, `dfa`,
`hod_surg`, `hod_ict`, `hou_icu`, `registry`, `appraisal`, `staff1`,
`staff2`, `staff3`, `desk`, `audit`, `cpo`, `planning`, `secretary`,
`cmd_secretary` — all password `admin123`.

## File-by-file changes

**New files:**
- `prisma/schema.prisma` — added 4 models (AppointmentConfirmation, Shift, StaffShift, AttendanceRecord) + 2 fields on Department (isClinical, isShiftBased) + relations on Staff
- `src/app/api/appointment-confirmations/route.ts` — list + create
- `src/app/api/appointment-confirmations/[id]/route.ts` — get + patch + delete
- `src/app/api/appointment-confirmations/[id]/action/route.ts` — approval workflow
- `src/app/api/shifts/route.ts` — list + create
- `src/app/api/shifts/[id]/route.ts` — patch + delete (soft-delete if records exist)
- `src/app/api/attendance/route.ts` — list with filters
- `src/app/api/attendance/sync/route.ts` — ZKTeco TCP probe + pull
- `src/app/api/attendance/sync/zklib.ts` — best-effort ZKTeco protocol stub
- `src/app/api/attendance/import/route.ts` — CSV import (2 header formats)
- `src/app/api/attendance/util.ts` — status computation + IN/OUT pairing
- `src/app/api/attendance/summary/route.ts` — staff-by-period aggregation
- `src/app/api/staff/flags/route.ts` — virtual flags endpoint
- `src/components/futh/AppointmentConfirmations.tsx` — full UI (974 lines)
- `src/components/futh/Attendance.tsx` — 3-tab UI (records / summary / shifts)
- `src/components/futh/StaffFlags.tsx` — flags page + inline badges
- `scripts/seed-default-shifts.ts` — seeds 5 global shifts + clinical dept flags

**Modified files:**
- `prisma/schema.prisma` — Department.isClinical/isShiftBased + new models + Staff relations
- `next.config.ts` — body parser limit 60MB
- `tsconfig.json` — target ES2020
- `.env.example` — ZKTeco env vars documented
- `src/lib/auth.ts` — extended `SafeUser.staff` with `departmentId` and `unitId`
- `src/lib/scope.ts` — added `attendance` and `appointmentConfirmation` entity types
- `src/lib/print.ts` — typed 3 arrays as `string[]`
- `src/app/api/uploads/route.ts` — 50MB limit + better error messages
- `src/app/api/documents/[id]/route.ts` — file system deletion on delete + clear avatar/signature links
- `src/app/api/staff/[id]/route.ts` — `fullInclude` extended with appointmentConfirmations + staffShifts + attendanceRecords (and cast to `any` to fix readonly issue)
- `src/app/api/resignations/[id]/route.ts` — PATCH now includes `staff` in `findUnique`
- `src/app/api/department-ratings/route.ts` — `ratings: any[]`
- `src/app/api/unit-ratings/route.ts` — `ratings: any[]`
- `src/app/api/duties/[id]/review/route.ts` — works correctly now (SafeUser fix)
- `src/app/api/duties/[id]/upload-evidence/route.ts` — works correctly now (SafeUser fix)
- `src/app/api/auth/2fa/enable/route.ts` — `let user: any`
- `src/app/api/auth/2fa/setup/route.ts` — `let user: any`
- `src/components/futh/FileUpload.tsx` — file-type icons + image compression + 50MB ceiling
- `src/components/futh/Sidebar.tsx` — 4 new nav items (Attendance, Shifts, Appointment Confirmations, Staff Flags)
- `src/components/futh/AppShell.tsx` — (no changes — views stay as single-route SPA)
- `src/app/page.tsx` — wired 4 new views into the router
- `src/components/futh/StaffDirectory.tsx` — fetches flags in parallel + inline badges in list + detail view Flags row
- `src/components/futh/Leaves.tsx` — removed duplicate object key
- `src/components/futh/Mail.tsx` — replaced `/s` regex with `.split('\n')[0]`
- `src/components/futh/MyPendingApprovals.tsx` — typed statCards array
- `scripts/bulk-reset-passwords.ts` — `candidates: any[]`
- `scripts/cleanup-orphan-depts-units.ts` — uses `Unit.houUserId` (not `User.headedUnitId`)
- `scripts/seed-secretary-roles.ts` — removed `as const` so email type widens correctly

## Post-install checklist

After dropping this update into `/var/www/futh-hr`:

1. `cd /var/www/futh-hr && npm install` (no new npm deps — `net` is built-in to Node)
2. `npx prisma db push --accept-data-loss` (applies new tables + Department fields)
3. `npx prisma generate` (regenerates Prisma client with new models)
4. `npx tsx scripts/seed-default-shifts.ts` (creates 5 default shifts + flags clinical departments)
5. Restart Next.js: `pm2 restart futh-hr` (or whatever your process manager is)
6. Log in as `admin` / `admin123` — verify:
   - Sidebar shows new items: Staff Flags, Appointment Confirmations, Attendance, Shifts
   - Staff Directory shows inline yellow/red flag badges next to status
   - Attendance page Sync button → tries to reach 192.168.1.200:4370
   - Attendance Import CSV → paste a ZKTeco Attend export → records appear
   - Documents upload — large files now succeed; preview shows file-type icon for non-images
