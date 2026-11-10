const fs = require('fs');
const path = require('path');

const SCHEMA = path.join(__dirname, 'prisma', 'schema.prisma');

const MODEL_TO_TABLE = {
  User: 'users', Staff: 'staff', Role: 'roles',
  Designation: 'designations', Department: 'departments', Unit: 'units',
  Page: 'pages', RolePagePermission: 'role_page_permissions',
  Committee: 'committees', CommitteeMember: 'committee_members',
  Document: 'documents', RegistryFile: 'registry_files',
  FileRoute: 'file_routes', FileAttachment: 'file_attachments',
  FileComment: 'file_comments', Notification: 'notifications',
  AuditLog: 'audit_logs', PasswordResetToken: 'password_reset_tokens',
  NextOfKin: 'next_of_kin', BankDetail: 'bank_details',
  AcademicBackground: 'academic_background', Dependant: 'dependants',
};

const src = fs.readFileSync(SCHEMA, 'utf8');
const lines = src.split('\n');
const out = [];
let inModel = false, braceDepth = 0, currentModel = null, hasMap = false;
let patched = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  out.push(line);
  const m = line.match(/^model\s+(\w+)\s*\{/);
  if (m) { inModel = true; currentModel = m[1]; hasMap = false; braceDepth = 1; continue; }
  if (inModel) {
    for (const ch of line) { if (ch === '{') braceDepth++; else if (ch === '}') braceDepth--; }
    if (line.includes('@@map')) hasMap = true;
    if (braceDepth === 0) {
      if (!hasMap && MODEL_TO_TABLE[currentModel]) {
        out.pop();
        out.push(`  @@map("${MODEL_TO_TABLE[currentModel]}")`);
        out.push(line);
        patched++;
        console.log(`  patched: ${currentModel} -> @@map("${MODEL_TO_TABLE[currentModel]}")`);
      }
      inModel = false; currentModel = null;
    }
  }
}
fs.writeFileSync(SCHEMA, out.join('\n'), 'utf8');
console.log(`\nDone. Patched ${patched} model(s).`);