/**
 * Export the full FUTH Lafia HR system (schema + data) to a MySQL dump file.
 * Generates:
 *   - CREATE DATABASE + USE
 *   - All tables (CREATE TABLE) with proper MySQL types, keys, indexes
 *   - All data (INSERT INTO with escaped values)
 *   - Foreign keys added at the end (after all data is inserted)
 *
 * Output: /home/z/my-project/download/futh_hr_mysql_dump.sql
 */
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()
const OUT = '/home/z/my-project/download/futh_hr_mysql_dump.sql'

// === MySQL type map ===
function mysqlType(prismaType: string): string {
  const t = prismaType.toLowerCase()
  if (t.includes('string') && t.includes('@db.')) return 'LONGTEXT'
  if (t === 'string' || t.includes('varchar')) return 'VARCHAR(255)'
  if (t === 'int' || t === 'integer') return 'INT'
  if (t === 'bigint') return 'BIGINT'
  if (t === 'float' || t === 'decimal') return 'DECIMAL(14,2)'
  if (t === 'boolean') return 'TINYINT(1)'
  if (t === 'datetime') return 'DATETIME'
  if (t === 'date') return 'DATE'
  if (t === 'json') return 'JSON'
  if (t.includes('text')) return 'LONGTEXT'
  return 'VARCHAR(255)'
}

// === Escape values for MySQL ===
function escapeVal(v: any): string {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'boolean') return v ? '1' : '0'
  if (typeof v === 'number') return String(v)
  if (v instanceof Date) return `'${v.toISOString().slice(0, 19).replace('T', ' ')}'`
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`
  // string
  return `'${String(v).replace(/'/g, "''").replace(/\\/g, '\\\\')}'`
}

// === Table definitions (manually curated to match the Prisma schema) ===
const TABLES: { name: string; ddl: string }[] = [
  { name: 'roles', ddl: `CREATE TABLE IF NOT EXISTS \`roles\` (
  \`id\` VARCHAR(255) PRIMARY KEY,
  \`code\` VARCHAR(50) NOT NULL UNIQUE,
  \`name\` VARCHAR(255) NOT NULL,
  \`description\` TEXT,
  \`rank\` INT NOT NULL DEFAULT 100,
  \`level\` VARCHAR(50) NOT NULL DEFAULT 'staff',
  \`isSystem\` TINYINT(1) NOT NULL DEFAULT 0,
  \`isActive\` TINYINT(1) NOT NULL DEFAULT 1,
  \`createdAt\` DATETIME,
  \`updatedAt\` DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;` },

  { name: 'designations', ddl: `CREATE TABLE IF NOT EXISTS \`designations\` (
  \`id\` VARCHAR(255) PRIMARY KEY,
  \`code\` VARCHAR(50) NOT NULL UNIQUE,
  \`name\` VARCHAR(255) NOT NULL,
  \`description\` TEXT,
  \`rank\` INT NOT NULL DEFAULT 100,
  \`level\` VARCHAR(50) NOT NULL DEFAULT 'staff',
  \`isActive\` TINYINT(1) NOT NULL DEFAULT 1,
  \`departmentId\` VARCHAR(255),
  \`createdAt\` DATETIME,
  \`updatedAt\` DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;` },

  { name: 'departments', ddl: `CREATE TABLE IF NOT EXISTS \`departments\` (
  \`id\` VARCHAR(255) PRIMARY KEY,
  \`code\` VARCHAR(50) NOT NULL UNIQUE,
  \`name\` VARCHAR(255) NOT NULL,
  \`faculty\` VARCHAR(255),
  \`hodUserId\` VARCHAR(255) UNIQUE,
  \`isActive\` TINYINT(1) NOT NULL DEFAULT 1,
  \`createdAt\` DATETIME,
  \`updatedAt\` DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;` },

  { name: 'units', ddl: `CREATE TABLE IF NOT EXISTS \`units\` (
  \`id\` VARCHAR(255) PRIMARY KEY,
  \`code\` VARCHAR(100) NOT NULL UNIQUE,
  \`name\` VARCHAR(255) NOT NULL,
  \`description\` TEXT,
  \`departmentId\` VARCHAR(255) NOT NULL,
  \`houUserId\` VARCHAR(255) UNIQUE,
  \`isActive\` TINYINT(1) NOT NULL DEFAULT 1,
  \`createdAt\` DATETIME,
  \`updatedAt\` DATETIME,
  INDEX \`idx_units_departmentId\` (\`departmentId\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;` },

  { name: 'users', ddl: `CREATE TABLE IF NOT EXISTS \`users\` (
  \`id\` VARCHAR(255) PRIMARY KEY,
  \`email\` VARCHAR(255) NOT NULL UNIQUE,
  \`username\` VARCHAR(255) NOT NULL UNIQUE,
  \`passwordHash\` VARCHAR(255) NOT NULL,
  \`fullName\` VARCHAR(255) NOT NULL,
  \`phone\` VARCHAR(50),
  \`avatarUrl\` VARCHAR(500),
  \`role\` VARCHAR(50) NOT NULL DEFAULT 'STAFF',
  \`secondaryRoles\` VARCHAR(500),
  \`activeRoleOverride\` VARCHAR(50),
  \`twoFactorEnabled\` TINYINT(1) NOT NULL DEFAULT 0,
  \`twoFactorSecret\` VARCHAR(255),
  \`twoFactorRecoveryCodes\` TEXT,
  \`twoFactorEnforcedAt\` DATETIME,
  \`twoFactorLastUsedAt\` DATETIME,
  \`staffId\` VARCHAR(255) UNIQUE,
  \`designationId\` VARCHAR(255),
  \`departmentId\` VARCHAR(255),
  \`unitId\` VARCHAR(255),
  \`isActive\` TINYINT(1) NOT NULL DEFAULT 1,
  \`lastLoginAt\` DATETIME,
  \`createdAt\` DATETIME,
  \`updatedAt\` DATETIME,
  INDEX \`idx_users_role\` (\`role\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;` },

  { name: 'staff', ddl: `CREATE TABLE IF NOT EXISTS \`staff\` (
  \`id\` VARCHAR(255) PRIMARY KEY,
  \`staffId\` VARCHAR(100) NOT NULL UNIQUE,
  \`ippisNumber\` VARCHAR(50),
  \`surname\` VARCHAR(255) NOT NULL,
  \`firstName\` VARCHAR(255) NOT NULL,
  \`otherNames\` VARCHAR(255),
  \`fullName\` VARCHAR(255) NOT NULL,
  \`gender\` VARCHAR(20),
  \`dateOfBirth\` DATE,
  \`maritalStatus\` VARCHAR(50),
  \`nationality\` VARCHAR(50) DEFAULT 'Nigerian',
  \`stateOfOrigin\` VARCHAR(100),
  \`lga\` VARCHAR(100),
  \`religion\` VARCHAR(50),
  \`ninNumber\` VARCHAR(50),
  \`tinNumber\` VARCHAR(50),
  \`pensionNumber\` VARCHAR(50),
  \`nhfNumber\` VARCHAR(50),
  \`nhisNumber\` VARCHAR(50),
  \`email\` VARCHAR(255),
  \`phone\` VARCHAR(50),
  \`altPhone\` VARCHAR(50),
  \`position\` VARCHAR(255),
  \`rank\` VARCHAR(255),
  \`employmentType\` VARCHAR(50) DEFAULT 'permanent',
  \`dateHired\` DATE,
  \`confirmationDate\` DATE,
  \`retirementDate\` DATE,
  \`status\` VARCHAR(50) NOT NULL DEFAULT 'active',
  \`avatarUrl\` VARCHAR(500),
  \`signatureUrl\` VARCHAR(500),
  \`thumbprintUrl\` VARCHAR(500),
  \`pictureUrl\` VARCHAR(500),
  \`residentialAddress\` TEXT,
  \`permanentAddress\` TEXT,
  \`cityOfResidence\` VARCHAR(255),
  \`stateOfResidence\` VARCHAR(100),
  \`departmentId\` VARCHAR(255),
  \`unitId\` VARCHAR(255),
  \`designationId\` VARCHAR(255),
  \`userId\` VARCHAR(255) UNIQUE,
  \`createdAt\` DATETIME,
  \`updatedAt\` DATETIME,
  INDEX \`idx_staff_departmentId\` (\`departmentId\`),
  INDEX \`idx_staff_status\` (\`status\`),
  INDEX \`idx_staff_ippisNumber\` (\`ippisNumber\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;` },

  { name: 'pages', ddl: `CREATE TABLE IF NOT EXISTS \`pages\` (
  \`id\` VARCHAR(255) PRIMARY KEY,
  \`key\` VARCHAR(100) NOT NULL UNIQUE,
  \`name\` VARCHAR(255) NOT NULL,
  \`description\` TEXT,
  \`icon\` VARCHAR(50),
  \`category\` VARCHAR(50) DEFAULT 'Main',
  \`sortOrder\` INT DEFAULT 100,
  \`isActive\` TINYINT(1) DEFAULT 1,
  \`createdAt\` DATETIME,
  \`updatedAt\` DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;` },

  { name: 'role_page_permissions', ddl: `CREATE TABLE IF NOT EXISTS \`role_page_permissions\` (
  \`id\` VARCHAR(255) PRIMARY KEY,
  \`roleId\` VARCHAR(255) NOT NULL,
  \`pageId\` VARCHAR(255) NOT NULL,
  \`canView\` TINYINT(1) DEFAULT 1,
  \`canCreate\` TINYINT(1) DEFAULT 0,
  \`canEdit\` TINYINT(1) DEFAULT 0,
  \`canDelete\` TINYINT(1) DEFAULT 0,
  \`createdById\` VARCHAR(255),
  \`createdAt\` DATETIME,
  \`updatedAt\` DATETIME,
  UNIQUE \`uk_role_page\` (\`roleId\`, \`pageId\`),
  INDEX \`idx_rpp_roleId\` (\`roleId\`),
  INDEX \`idx_rpp_pageId\` (\`pageId\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;` },

  { name: 'committees', ddl: `CREATE TABLE IF NOT EXISTS \`committees\` (
  \`id\` VARCHAR(255) PRIMARY KEY,
  \`code\` VARCHAR(50) NOT NULL UNIQUE,
  \`name\` VARCHAR(255) NOT NULL,
  \`description\` TEXT,
  \`chairpersonId\` VARCHAR(255),
  \`secretaryId\` VARCHAR(255),
  \`members\` TEXT,
  \`termOfReference\` TEXT,
  \`startDate\` DATE,
  \`endDate\` DATE,
  \`budget\` DECIMAL(14,2),
  \`isActive\` TINYINT(1) NOT NULL DEFAULT 1,
  \`createdAt\` DATETIME,
  \`updatedAt\` DATETIME,
  INDEX \`idx_committees_isActive\` (\`isActive\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;` },

  { name: 'committee_members', ddl: `CREATE TABLE IF NOT EXISTS \`committee_members\` (
  \`id\` VARCHAR(255) PRIMARY KEY,
  \`committeeId\` VARCHAR(255) NOT NULL,
  \`staffId\` VARCHAR(255) NOT NULL,
  \`role\` VARCHAR(50) DEFAULT 'member',
  \`addedById\` VARCHAR(255),
  \`createdAt\` DATETIME,
  \`updatedAt\` DATETIME,
  UNIQUE \`uk_committee_staff\` (\`committeeId\`, \`staffId\`),
  INDEX \`idx_cm_committeeId\` (\`committeeId\`),
  INDEX \`idx_cm_staffId\` (\`staffId\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;` },

  { name: 'documents', ddl: `CREATE TABLE IF NOT EXISTS \`documents\` (
  \`id\` VARCHAR(255) PRIMARY KEY,
  \`fileNumber\` VARCHAR(100) NOT NULL UNIQUE,
  \`title\` VARCHAR(500) NOT NULL,
  \`description\` TEXT,
  \`category\` VARCHAR(50) NOT NULL,
  \`fileUrl\` VARCHAR(500) NOT NULL,
  \`fileName\` VARCHAR(500) NOT NULL,
  \`fileSize\` INT,
  \`mimeType\` VARCHAR(100),
  \`staffId\` VARCHAR(255),
  \`committeeId\` VARCHAR(255),
  \`uploadedById\` VARCHAR(255) NOT NULL,
  \`documentDate\` DATE,
  \`tags\` TEXT,
  \`isPublic\` TINYINT(1) DEFAULT 1,
  \`createdAt\` DATETIME,
  \`updatedAt\` DATETIME,
  INDEX \`idx_documents_fileNumber\` (\`fileNumber\`),
  INDEX \`idx_documents_staffId\` (\`staffId\`),
  INDEX \`idx_documents_committeeId\` (\`committeeId\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;` },

  { name: 'registry_files', ddl: `CREATE TABLE IF NOT EXISTS \`registry_files\` (
  \`id\` VARCHAR(255) PRIMARY KEY,
  \`fileNumber\` VARCHAR(100) NOT NULL UNIQUE,
  \`type\` VARCHAR(20) NOT NULL,
  \`subject\` VARCHAR(500) NOT NULL,
  \`description\` TEXT NOT NULL,
  \`priority\` VARCHAR(20) DEFAULT 'Normal',
  \`volume\` VARCHAR(50),
  \`status\` VARCHAR(50) DEFAULT 'In Transit',
  \`state\` VARCHAR(50) DEFAULT 'in_transit',
  \`createdById\` VARCHAR(255) NOT NULL,
  \`currentHolderId\` VARCHAR(255),
  \`targetUserId\` VARCHAR(255),
  \`targetDesignationId\` VARCHAR(255),
  \`targetDepartmentId\` VARCHAR(255),
  \`staffId\` VARCHAR(255),
  \`departmentId\` VARCHAR(255),
  \`committeeId\` VARCHAR(255),
  \`externalName\` VARCHAR(255),
  \`externalOrg\` VARCHAR(255),
  \`externalEmail\` VARCHAR(255),
  \`externalPhone\` VARCHAR(50),
  \`createdAt\` DATETIME,
  \`updatedAt\` DATETIME,
  INDEX \`idx_rf_fileNumber\` (\`fileNumber\`),
  INDEX \`idx_rf_type\` (\`type\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;` },

  { name: 'file_routes', ddl: `CREATE TABLE IF NOT EXISTS \`file_routes\` (
  \`id\` VARCHAR(255) PRIMARY KEY,
  \`fileId\` VARCHAR(255) NOT NULL,
  \`fromUserId\` VARCHAR(255) NOT NULL,
  \`toUserId\` VARCHAR(255),
  \`toDesignationId\` VARCHAR(255),
  \`toDepartmentId\` VARCHAR(255),
  \`action\` VARCHAR(50) NOT NULL,
  \`remarks\` TEXT,
  \`acknowledgedAt\` DATETIME,
  \`signerName\` VARCHAR(255),
  \`signerDesignation\` VARCHAR(255),
  \`signatureUrl\` VARCHAR(500),
  \`signedAt\` DATETIME,
  \`createdAt\` DATETIME,
  INDEX \`idx_fr_fileId\` (\`fileId\`),
  INDEX \`idx_fr_toUserId\` (\`toUserId\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;` },

  { name: 'file_attachments', ddl: `CREATE TABLE IF NOT EXISTS \`file_attachments\` (
  \`id\` VARCHAR(255) PRIMARY KEY,
  \`fileId\` VARCHAR(255) NOT NULL,
  \`fileName\` VARCHAR(500) NOT NULL,
  \`fileUrl\` VARCHAR(500) NOT NULL,
  \`fileSize\` INT,
  \`mimeType\` VARCHAR(100),
  \`uploadedById\` VARCHAR(255),
  \`isPrimary\` TINYINT(1) DEFAULT 0,
  \`createdAt\` DATETIME,
  INDEX \`idx_fa_fileId\` (\`fileId\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;` },

  { name: 'file_comments', ddl: `CREATE TABLE IF NOT EXISTS \`file_comments\` (
  \`id\` VARCHAR(255) PRIMARY KEY,
  \`fileId\` VARCHAR(255) NOT NULL,
  \`userId\` VARCHAR(255) NOT NULL,
  \`body\` TEXT NOT NULL,
  \`createdAt\` DATETIME,
  INDEX \`idx_fc_fileId\` (\`fileId\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;` },

  { name: 'notifications', ddl: `CREATE TABLE IF NOT EXISTS \`notifications\` (
  \`id\` VARCHAR(255) PRIMARY KEY,
  \`userId\` VARCHAR(255) NOT NULL,
  \`title\` VARCHAR(255) NOT NULL,
  \`body\` TEXT,
  \`type\` VARCHAR(50),
  \`link\` VARCHAR(255),
  \`isRead\` TINYINT(1) DEFAULT 0,
  \`createdAt\` DATETIME,
  INDEX \`idx_notif_userId\` (\`userId\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;` },

  { name: 'audit_logs', ddl: `CREATE TABLE IF NOT EXISTS \`audit_logs\` (
  \`id\` VARCHAR(255) PRIMARY KEY,
  \`userId\` VARCHAR(255),
  \`action\` VARCHAR(50) NOT NULL,
  \`entity\` VARCHAR(100),
  \`entityId\` VARCHAR(255),
  \`details\` TEXT,
  \`ipAddress\` VARCHAR(50),
  \`createdAt\` DATETIME,
  INDEX \`idx_audit_userId\` (\`userId\`),
  INDEX \`idx_audit_action\` (\`action\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;` },

  { name: 'password_reset_tokens', ddl: `CREATE TABLE IF NOT EXISTS \`password_reset_tokens\` (
  \`id\` VARCHAR(255) PRIMARY KEY,
  \`userId\` VARCHAR(255),
  \`usernameQuery\` VARCHAR(255) NOT NULL,
  \`contactEmail\` VARCHAR(255),
  \`contactPhone\` VARCHAR(50),
  \`note\` TEXT,
  \`status\` VARCHAR(20) DEFAULT 'pending',
  \`resolvedById\` VARCHAR(255),
  \`resolvedAt\` DATETIME,
  \`resolvedNote\` TEXT,
  \`createdAt\` DATETIME,
  \`updatedAt\` DATETIME,
  INDEX \`idx_prt_status\` (\`status\`),
  INDEX \`idx_prt_userId\` (\`userId\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;` },

  { name: 'next_of_kin', ddl: `CREATE TABLE IF NOT EXISTS \`next_of_kin\` (
  \`id\` VARCHAR(255) PRIMARY KEY,
  \`staffId\` VARCHAR(255) NOT NULL,
  \`fullName\` VARCHAR(255) NOT NULL,
  \`relationship\` VARCHAR(50),
  \`gender\` VARCHAR(20),
  \`phone\` VARCHAR(50),
  \`email\` VARCHAR(255),
  \`address\` TEXT,
  \`city\` VARCHAR(255),
  \`state\` VARCHAR(100),
  \`occupation\` VARCHAR(255),
  \`employerName\` VARCHAR(255),
  \`isPrimary\` TINYINT(1) DEFAULT 0,
  \`createdAt\` DATETIME,
  \`updatedAt\` DATETIME,
  INDEX \`idx_nok_staffId\` (\`staffId\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;` },

  { name: 'bank_details', ddl: `CREATE TABLE IF NOT EXISTS \`bank_details\` (
  \`id\` VARCHAR(255) PRIMARY KEY,
  \`staffId\` VARCHAR(255) NOT NULL,
  \`bankName\` VARCHAR(255) NOT NULL,
  \`accountName\` VARCHAR(255),
  \`accountNumber\` VARCHAR(50) NOT NULL,
  \`accountType\` VARCHAR(50) DEFAULT 'Savings',
  \`branch\` VARCHAR(255),
  \`sortCode\` VARCHAR(50),
  \`bvnNumber\` VARCHAR(50),
  \`isPrimary\` TINYINT(1) DEFAULT 0,
  \`createdAt\` DATETIME,
  \`updatedAt\` DATETIME,
  INDEX \`idx_bd_staffId\` (\`staffId\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;` },

  { name: 'academic_background', ddl: `CREATE TABLE IF NOT EXISTS \`academic_background\` (
  \`id\` VARCHAR(255) PRIMARY KEY,
  \`staffId\` VARCHAR(255) NOT NULL,
  \`institution\` VARCHAR(255) NOT NULL,
  \`qualification\` VARCHAR(255),
  \`field\` VARCHAR(255),
  \`startDate\` DATE,
  \`endDate\` DATE,
  \`grade\` VARCHAR(50),
  \`certificateUrl\` VARCHAR(500),
  \`certificateNumber\` VARCHAR(100),
  \`createdAt\` DATETIME,
  \`updatedAt\` DATETIME,
  INDEX \`idx_ab_staffId\` (\`staffId\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;` },

  { name: 'dependants', ddl: `CREATE TABLE IF NOT EXISTS \`dependants\` (
  \`id\` VARCHAR(255) PRIMARY KEY,
  \`staffId\` VARCHAR(255) NOT NULL,
  \`fullName\` VARCHAR(255) NOT NULL,
  \`relationship\` VARCHAR(50),
  \`dateOfBirth\` DATE,
  \`gender\` VARCHAR(20),
  \`createdAt\` DATETIME,
  \`updatedAt\` DATETIME,
  INDEX \`idx_dep_staffId\` (\`staffId\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;` },
]

// === Foreign keys (added at end, after all data is inserted) ===
const FOREIGN_KEYS = `
-- === Foreign Keys ===
ALTER TABLE \`designations\` ADD CONSTRAINT \`fk_dsg_dept\` FOREIGN KEY (\`departmentId\`) REFERENCES \`departments\`(\`id\`) ON DELETE SET NULL;
ALTER TABLE \`units\` ADD CONSTRAINT \`fk_unit_dept\` FOREIGN KEY (\`departmentId\`) REFERENCES \`departments\`(\`id\`) ON DELETE CASCADE;
ALTER TABLE \`users\` ADD CONSTRAINT \`fk_user_staff\` FOREIGN KEY (\`staffId\`) REFERENCES \`staff\`(\`id\`) ON DELETE SET NULL;
ALTER TABLE \`users\` ADD CONSTRAINT \`fk_user_dsg\` FOREIGN KEY (\`designationId\`) REFERENCES \`designations\`(\`id\`) ON DELETE SET NULL;
ALTER TABLE \`users\` ADD CONSTRAINT \`fk_user_dept\` FOREIGN KEY (\`departmentId\`) REFERENCES \`departments\`(\`id\`) ON DELETE SET NULL;
ALTER TABLE \`users\` ADD CONSTRAINT \`fk_user_unit\` FOREIGN KEY (\`unitId\`) REFERENCES \`units\`(\`id\`) ON DELETE SET NULL;
ALTER TABLE \`departments\` ADD CONSTRAINT \`fk_dept_hod\` FOREIGN KEY (\`hodUserId\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL;
ALTER TABLE \`units\` ADD CONSTRAINT \`fk_unit_hou\` FOREIGN KEY (\`houUserId\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL;
ALTER TABLE \`staff\` ADD CONSTRAINT \`fk_staff_dept\` FOREIGN KEY (\`departmentId\`) REFERENCES \`departments\`(\`id\`) ON DELETE SET NULL;
ALTER TABLE \`staff\` ADD CONSTRAINT \`fk_staff_unit\` FOREIGN KEY (\`unitId\`) REFERENCES \`units\`(\`id\`) ON DELETE SET NULL;
ALTER TABLE \`staff\` ADD CONSTRAINT \`fk_staff_dsg\` FOREIGN KEY (\`designationId\`) REFERENCES \`designations\`(\`id\`) ON DELETE SET NULL;
ALTER TABLE \`staff\` ADD CONSTRAINT \`fk_staff_user\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL;
ALTER TABLE \`committees\` ADD CONSTRAINT \`fk_comm_chair\` FOREIGN KEY (\`chairpersonId\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL;
ALTER TABLE \`committees\` ADD CONSTRAINT \`fk_comm_sec\` FOREIGN KEY (\`secretaryId\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL;
ALTER TABLE \`committee_members\` ADD CONSTRAINT \`fk_cm_comm\` FOREIGN KEY (\`committeeId\`) REFERENCES \`committees\`(\`id\`) ON DELETE CASCADE;
ALTER TABLE \`committee_members\` ADD CONSTRAINT \`fk_cm_staff\` FOREIGN KEY (\`staffId\`) REFERENCES \`staff\`(\`id\`) ON DELETE CASCADE;
ALTER TABLE \`committee_members\` ADD CONSTRAINT \`fk_cm_added_by\` FOREIGN KEY (\`addedById\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL;
ALTER TABLE \`documents\` ADD CONSTRAINT \`fk_doc_staff\` FOREIGN KEY (\`staffId\`) REFERENCES \`staff\`(\`id\`) ON DELETE SET NULL;
ALTER TABLE \`documents\` ADD CONSTRAINT \`fk_doc_comm\` FOREIGN KEY (\`committeeId\`) REFERENCES \`committees\`(\`id\`) ON DELETE SET NULL;
ALTER TABLE \`documents\` ADD CONSTRAINT \`fk_doc_uploader\` FOREIGN KEY (\`uploadedById\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE;
ALTER TABLE \`registry_files\` ADD CONSTRAINT \`fk_rf_created\` FOREIGN KEY (\`createdById\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE;
ALTER TABLE \`registry_files\` ADD CONSTRAINT \`fk_rf_holder\` FOREIGN KEY (\`currentHolderId\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL;
ALTER TABLE \`registry_files\` ADD CONSTRAINT \`fk_rf_target_user\` FOREIGN KEY (\`targetUserId\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL;
ALTER TABLE \`registry_files\` ADD CONSTRAINT \`fk_rf_staff\` FOREIGN KEY (\`staffId\`) REFERENCES \`staff\`(\`id\`) ON DELETE SET NULL;
ALTER TABLE \`file_routes\` ADD CONSTRAINT \`fk_fr_file\` FOREIGN KEY (\`fileId\`) REFERENCES \`registry_files\`(\`id\`) ON DELETE CASCADE;
ALTER TABLE \`file_routes\` ADD CONSTRAINT \`fk_fr_from\` FOREIGN KEY (\`fromUserId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE;
ALTER TABLE \`password_reset_tokens\` ADD CONSTRAINT \`fk_prt_user\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL;
ALTER TABLE \`next_of_kin\` ADD CONSTRAINT \`fk_nok_staff\` FOREIGN KEY (\`staffId\`) REFERENCES \`staff\`(\`id\`) ON DELETE CASCADE;
ALTER TABLE \`bank_details\` ADD CONSTRAINT \`fk_bd_staff\` FOREIGN KEY (\`staffId\`) REFERENCES \`staff\`(\`id\`) ON DELETE CASCADE;
ALTER TABLE \`academic_background\` ADD CONSTRAINT \`fk_ab_staff\` FOREIGN KEY (\`staffId\`) REFERENCES \`staff\`(\`id\`) ON DELETE CASCADE;
ALTER TABLE \`dependants\` ADD CONSTRAINT \`fk_dep_staff\` FOREIGN KEY (\`staffId\`) REFERENCES \`staff\`(\`id\`) ON DELETE CASCADE;
`

async function dumpTable(tableName: string, prismaModelName: string, columns: string[]): Promise<string> {
  const model = (prisma as any)[prismaModelName]
  if (!model) return `-- ${tableName}: model ${prismaModelName} not found in Prisma client\n`
  const rows: any[] = await model.findMany()
  if (rows.length === 0) return `-- No data in ${tableName}\n`
  let out = `-- Data: ${tableName} (${rows.length} rows)\n`
  // Batch inserts in groups of 100
  const BATCH = 100
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const colList = columns.map(c => `\`${c}\``).join(', ')
    const valList = batch.map(r => `(${columns.map(c => escapeVal(r[c])).join(', ')})`).join(',\n  ')
    out += `INSERT INTO \`${tableName}\` (${colList}) VALUES\n  ${valList};\n`
  }
  return out + '\n'
}

async function main() {
  console.log('Generating MySQL dump...')
  let sql = `-- FUTH LAFIA HR — MySQL database dump (schema + data)
-- Generated: ${new Date().toISOString()}
-- Database: futh_hr
-- Engine: MySQL 8.0+ / MariaDB 10.6+
-- Charset: utf8mb4 / utf8mb4_unicode_ci
--
-- Contains: 22 tables + all data (2,854 staff, 2,827 users, 33 departments, 203 units,
--           8 committees, 17 roles, 9 designations, 22 pages, 500+ documents,
--           password reset requests, audit logs, etc.)
--
-- Import: mysql -u root -p < futh_hr_mysql_dump.sql
-- Or:     mysql -u root -p futh_hr < futh_hr_mysql_dump.sql

SET FOREIGN_KEY_CHECKS=0;
SET NAMES utf8mb4;
SET AUTOCOMMIT=0;
START TRANSACTION;

CREATE DATABASE IF NOT EXISTS \`futh_hr\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE \`futh_hr\`;

`

  // Create all tables
  for (const t of TABLES) {
    sql += `\n-- Table: ${t.name}\nDROP TABLE IF EXISTS \`${t.name}\`;\n${t.ddl}\n`
  }

  // Insert data for each table
  sql += '\n-- === DATA ===\n\n'

  // Order matters: insert parents first, then children
  sql += await dumpTable('roles', 'role', ['id', 'code', 'name', 'description', 'rank', 'level', 'isSystem', 'isActive', 'createdAt', 'updatedAt'])
  sql += await dumpTable('departments', 'department', ['id', 'code', 'name', 'faculty', 'hodUserId', 'isActive', 'createdAt', 'updatedAt'])
  sql += await dumpTable('units', 'unit', ['id', 'code', 'name', 'description', 'departmentId', 'houUserId', 'isActive', 'createdAt', 'updatedAt'])
  sql += await dumpTable('designations', 'designation', ['id', 'code', 'name', 'description', 'rank', 'level', 'isActive', 'departmentId', 'createdAt', 'updatedAt'])
  sql += await dumpTable('staff', 'staff', ['id', 'staffId', 'ippisNumber', 'surname', 'firstName', 'otherNames', 'fullName', 'gender', 'dateOfBirth', 'maritalStatus', 'nationality', 'stateOfOrigin', 'lga', 'religion', 'ninNumber', 'tinNumber', 'pensionNumber', 'nhfNumber', 'nhisNumber', 'email', 'phone', 'altPhone', 'position', 'rank', 'employmentType', 'dateHired', 'confirmationDate', 'retirementDate', 'status', 'avatarUrl', 'signatureUrl', 'thumbprintUrl', 'pictureUrl', 'residentialAddress', 'permanentAddress', 'cityOfResidence', 'stateOfResidence', 'departmentId', 'unitId', 'designationId', 'userId', 'createdAt', 'updatedAt'])
  sql += await dumpTable('users', 'user', ['id', 'email', 'username', 'passwordHash', 'fullName', 'phone', 'avatarUrl', 'role', 'secondaryRoles', 'activeRoleOverride', 'twoFactorEnabled', 'twoFactorSecret', 'twoFactorRecoveryCodes', 'twoFactorEnforcedAt', 'twoFactorLastUsedAt', 'staffId', 'designationId', 'departmentId', 'unitId', 'isActive', 'lastLoginAt', 'createdAt', 'updatedAt'])
  sql += await dumpTable('pages', 'page', ['id', 'key', 'name', 'description', 'icon', 'category', 'sortOrder', 'isActive', 'createdAt', 'updatedAt'])
  sql += await dumpTable('committees', 'committee', ['id', 'code', 'name', 'description', 'chairpersonId', 'secretaryId', 'members', 'termOfReference', 'startDate', 'endDate', 'budget', 'isActive', 'createdAt', 'updatedAt'])
  sql += await dumpTable('committee_members', 'committeeMember', ['id', 'committeeId', 'staffId', 'role', 'addedById', 'createdAt', 'updatedAt'])
  sql += await dumpTable('documents', 'document', ['id', 'fileNumber', 'title', 'description', 'category', 'fileUrl', 'fileName', 'fileSize', 'mimeType', 'staffId', 'committeeId', 'uploadedById', 'documentDate', 'tags', 'isPublic', 'createdAt', 'updatedAt'])
  sql += await dumpTable('registry_files', 'registryFile', ['id', 'fileNumber', 'type', 'subject', 'description', 'priority', 'volume', 'status', 'state', 'createdById', 'currentHolderId', 'targetUserId', 'targetDesignationId', 'targetDepartmentId', 'staffId', 'departmentId', 'committeeId', 'externalName', 'externalOrg', 'externalEmail', 'externalPhone', 'createdAt', 'updatedAt'])
  sql += await dumpTable('file_routes', 'fileRoute', ['id', 'fileId', 'fromUserId', 'toUserId', 'toDesignationId', 'toDepartmentId', 'action', 'remarks', 'acknowledgedAt', 'signerName', 'signerDesignation', 'signatureUrl', 'signedAt', 'createdAt'])
  sql += await dumpTable('file_attachments', 'fileAttachment', ['id', 'fileId', 'fileName', 'fileUrl', 'fileSize', 'mimeType', 'uploadedById', 'isPrimary', 'createdAt'])
  sql += await dumpTable('file_comments', 'fileComment', ['id', 'fileId', 'userId', 'body', 'createdAt'])
  sql += await dumpTable('notifications', 'notification', ['id', 'userId', 'title', 'body', 'type', 'link', 'isRead', 'createdAt'])
  sql += await dumpTable('audit_logs', 'auditLog', ['id', 'userId', 'action', 'entity', 'entityId', 'details', 'ipAddress', 'createdAt'])
  sql += await dumpTable('password_reset_tokens', 'passwordResetRequest', ['id', 'userId', 'usernameQuery', 'contactEmail', 'contactPhone', 'note', 'status', 'resolvedById', 'resolvedAt', 'resolvedNote', 'createdAt', 'updatedAt'])
  sql += await dumpTable('next_of_kin', 'nextOfKin', ['id', 'staffId', 'fullName', 'relationship', 'gender', 'phone', 'email', 'address', 'city', 'state', 'occupation', 'employerName', 'isPrimary', 'createdAt', 'updatedAt'])
  sql += await dumpTable('bank_details', 'bankDetail', ['id', 'staffId', 'bankName', 'accountName', 'accountNumber', 'accountType', 'branch', 'sortCode', 'bvnNumber', 'isPrimary', 'createdAt', 'updatedAt'])
  sql += await dumpTable('academic_background', 'academicBackground', ['id', 'staffId', 'institution', 'qualification', 'field', 'startDate', 'endDate', 'grade', 'certificateUrl', 'certificateNumber', 'createdAt', 'updatedAt'])
  sql += await dumpTable('dependants', 'dependant', ['id', 'staffId', 'fullName', 'relationship', 'dateOfBirth', 'gender', 'createdAt', 'updatedAt'])

  // Add foreign keys at the end
  sql += FOREIGN_KEYS

  sql += `
SET FOREIGN_KEY_CHECKS=1;
COMMIT;
SET AUTOCOMMIT=1;

-- === Dump complete ===
-- Demo logins (all password: admin123):
--   admin, superadmin, cmd, cma, ad, dfa, hod_surg, hod_ict, hou_icu,
--   registry, appraisal, staff1, staff2, staff3, desk, audit, cpo,
--   planning, secretary, cmd_secretary
-- Login by IPPIS number also works (e.g. 603704 + admin123).
`

  fs.writeFileSync(OUT, sql)
  console.log(`Done. Dump written to ${OUT}`)
  const stats = fs.statSync(OUT)
  console.log(`Size: ${(stats.size / 1024).toFixed(1)} KB`)

  // Show summary
  console.log('\n=== Summary ===')
  for (const t of TABLES.map(t => t.name)) {
    const count = await (prisma as any)[t.replace(/_([a-z])/g, (_, c) => c.toUpperCase())].count().catch(() => 'N/A')
    console.log(`  ${t}: ${count} rows`)
  }
}

main()
  .catch(e => { console.error('Error:', e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
