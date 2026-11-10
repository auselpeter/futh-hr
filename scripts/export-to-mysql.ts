 
/**
 * Export SQLite database (via Prisma) → MySQL dump + Laravel 12 migrations + Laravel 12 skeleton zip.
 *
 * Outputs:
 *   /home/z/my-project/download/futh_pms_mysql_dump.sql
 *   /home/z/my-project/download/futh_laravel_migrations.zip
 *   /home/z/my-project/download/futh_laravel_12_skeleton.zip
 *
 * Usage: bun run scripts/export-to-mysql.ts
 */

import { db } from '../src/lib/db'
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'fs'
import { join, resolve } from 'path'
import { execSync } from 'child_process'

// ───────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────

function sqlEscape(v: any): string {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'boolean') return v ? '1' : '0'
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL'
  if (v instanceof Date) return `'${v.toISOString().slice(0, 19).replace('T', ' ')}'`
  if (typeof v === 'object') {
    return `'${JSON.stringify(v).replace(/'/g, "''").replace(/\\/g, '\\\\')}'`
  }
  let s = String(v)
  s = s.replace(/\\/g, '\\\\').replace(/'/g, "''").replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')
  return `'${s}'`
}

function phpEscape(s: any): string {
  if (s === null || s === undefined) return 'null'
  if (typeof s === 'boolean') return s ? 'true' : 'false'
  if (typeof s === 'number') return String(s)
  return `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

// ───────────────────────────────────────────────────────────
// Model catalog — describes every Prisma model & its MySQL column types
// ───────────────────────────────────────────────────────────

type ColumnDef = {
  name: string
  type: string  // mysql type e.g. "VARCHAR(255)", "DATETIME", "TEXT"
  nullable?: boolean
  primary?: boolean
  unique?: boolean
  default?: string  // mysql default
  index?: boolean
}

type ModelDef = {
  prisma: string
  table: string
  className: string  // Laravel model class name
  columns: ColumnDef[]
  fillable: string[]
  casts?: Record<string, string>
  belongsTo?: { name: string; class: string; fk: string }[]
  hasMany?: { name: string; class: string; fk: string }[]
  hasOne?: { name: string; class: string; fk: string }[]
}

// Shared column shortcuts
const idCol: ColumnDef = { name: 'id', type: 'VARCHAR(255)', primary: true }
const createdAt: ColumnDef = { name: 'created_at', type: 'DATETIME', nullable: true }
const updatedAt: ColumnDef = { name: 'updated_at', type: 'DATETIME', nullable: true }

const models: ModelDef[] = [
  {
    prisma: 'user', table: 'users', className: 'User',
    columns: [
      idCol,
      { name: 'email', type: 'VARCHAR(255)', unique: true },
      { name: 'username', type: 'VARCHAR(255)', unique: true },
      { name: 'passwordHash', type: 'VARCHAR(255)' },
      { name: 'fullName', type: 'VARCHAR(255)' },
      { name: 'phone', type: 'VARCHAR(50)', nullable: true },
      { name: 'avatarUrl', type: 'VARCHAR(500)', nullable: true },
      { name: 'role', type: 'VARCHAR(50)', default: "'STAFF'" },
      { name: 'secondaryRoles', type: 'VARCHAR(500)', nullable: true },
      { name: 'activeRoleOverride', type: 'VARCHAR(50)', nullable: true },
      { name: 'twoFactorEnabled', type: 'TINYINT(1)', default: '0' },
      { name: 'twoFactorSecret', type: 'VARCHAR(255)', nullable: true },
      { name: 'twoFactorRecoveryCodes', type: 'TEXT', nullable: true },
      { name: 'twoFactorEnforcedAt', type: 'DATETIME', nullable: true },
      { name: 'twoFactorLastUsedAt', type: 'DATETIME', nullable: true },
      { name: 'staffId', type: 'VARCHAR(255)', nullable: true, unique: true },
      { name: 'designationId', type: 'VARCHAR(255)', nullable: true, index: true },
      { name: 'departmentId', type: 'VARCHAR(255)', nullable: true, index: true },
      { name: 'isActive', type: 'TINYINT(1)', default: '1' },
      { name: 'lastLoginAt', type: 'DATETIME', nullable: true },
      createdAt, updatedAt,
    ],
    fillable: ['email', 'username', 'passwordHash', 'fullName', 'phone', 'avatarUrl', 'role', 'secondaryRoles', 'activeRoleOverride', 'twoFactorEnabled', 'twoFactorSecret', 'twoFactorRecoveryCodes', 'twoFactorEnforcedAt', 'twoFactorLastUsedAt', 'staffId', 'designationId', 'departmentId', 'isActive', 'lastLoginAt'],
    casts: { isActive: 'boolean', lastLoginAt: 'datetime', twoFactorEnabled: 'boolean', twoFactorEnforcedAt: 'datetime', twoFactorLastUsedAt: 'datetime' },
    belongsTo: [
      { name: 'staff', class: 'Staff', fk: 'staffId' },
      { name: 'designation', class: 'Designation', fk: 'designationId' },
      { name: 'department', class: 'Department', fk: 'departmentId' },
    ],
    hasMany: [
      { name: 'sentMail', class: 'MailMessage', fk: 'fromId' },
      { name: 'receivedMail', class: 'MailMessage', fk: 'toId' },
      { name: 'requisitionsCreated', class: 'Requisition', fk: 'createdById' },
      { name: 'notifications', class: 'Notification', fk: 'userId' },
      { name: 'auditLogs', class: 'AuditLog', fk: 'userId' },
    ],
  },
  {
    prisma: 'department', table: 'departments', className: 'Department',
    columns: [
      idCol,
      { name: 'code', type: 'VARCHAR(50)', unique: true },
      { name: 'name', type: 'VARCHAR(255)' },
      { name: 'faculty', type: 'VARCHAR(255)', nullable: true },
      { name: 'hodUserId', type: 'VARCHAR(255)', nullable: true, unique: true },
      { name: 'isActive', type: 'TINYINT(1)', default: '1' },
      createdAt, updatedAt,
    ],
    fillable: ['code', 'name', 'faculty', 'hodUserId', 'isActive'],
    casts: { isActive: 'boolean' },
    belongsTo: [{ name: 'hodUser', class: 'User', fk: 'hodUserId' }],
    hasMany: [
      { name: 'users', class: 'User', fk: 'departmentId' },
      { name: 'staff', class: 'Staff', fk: 'departmentId' },
      { name: 'designations', class: 'Designation', fk: 'departmentId' },
    ],
  },
  {
    prisma: 'designation', table: 'designations', className: 'Designation',
    columns: [
      idCol,
      { name: 'code', type: 'VARCHAR(50)', unique: true },
      { name: 'name', type: 'VARCHAR(255)' },
      { name: 'description', type: 'TEXT', nullable: true },
      { name: 'rank', type: 'INT', default: '100' },
      { name: 'level', type: 'VARCHAR(50)', default: "'staff'" },
      { name: 'isActive', type: 'TINYINT(1)', default: '1' },
      { name: 'departmentId', type: 'VARCHAR(255)', nullable: true, index: true },
      createdAt, updatedAt,
    ],
    fillable: ['code', 'name', 'description', 'rank', 'level', 'isActive', 'departmentId'],
    casts: { isActive: 'boolean', rank: 'integer' },
    belongsTo: [{ name: 'department', class: 'Department', fk: 'departmentId' }],
    hasMany: [
      { name: 'users', class: 'User', fk: 'designationId' },
      { name: 'staff', class: 'Staff', fk: 'designationId' },
    ],
  },
  {
    prisma: 'staff', table: 'staff', className: 'Staff',
    columns: [
      idCol,
      { name: 'staffId', type: 'VARCHAR(100)', unique: true },
      { name: 'ippisNumber', type: 'VARCHAR(50)', nullable: true },
      { name: 'surname', type: 'VARCHAR(255)' },
      { name: 'firstName', type: 'VARCHAR(255)' },
      { name: 'otherNames', type: 'VARCHAR(255)', nullable: true },
      { name: 'fullName', type: 'VARCHAR(255)' },
      { name: 'gender', type: 'VARCHAR(20)', nullable: true },
      { name: 'dateOfBirth', type: 'DATETIME', nullable: true },
      { name: 'maritalStatus', type: 'VARCHAR(50)', nullable: true },
      { name: 'nationality', type: 'VARCHAR(100)', nullable: true },
      { name: 'stateOfOrigin', type: 'VARCHAR(100)', nullable: true },
      { name: 'lga', type: 'VARCHAR(100)', nullable: true },
      { name: 'religion', type: 'VARCHAR(50)', nullable: true },
      { name: 'ninNumber', type: 'VARCHAR(50)', nullable: true, index: true },
      { name: 'tinNumber', type: 'VARCHAR(50)', nullable: true },
      { name: 'pensionNumber', type: 'VARCHAR(50)', nullable: true, index: true },
      { name: 'nhfNumber', type: 'VARCHAR(50)', nullable: true },
      { name: 'nhisNumber', type: 'VARCHAR(50)', nullable: true },
      { name: 'email', type: 'VARCHAR(255)', nullable: true },
      { name: 'phone', type: 'VARCHAR(50)', nullable: true },
      { name: 'altPhone', type: 'VARCHAR(50)', nullable: true },
      { name: 'position', type: 'VARCHAR(255)', nullable: true },
      { name: 'rank', type: 'VARCHAR(255)', nullable: true },
      { name: 'employmentType', type: 'VARCHAR(50)', nullable: true, default: "'permanent'" },
      { name: 'dateHired', type: 'DATETIME', nullable: true },
      { name: 'confirmationDate', type: 'DATETIME', nullable: true },
      { name: 'retirementDate', type: 'DATETIME', nullable: true },
      { name: 'status', type: 'VARCHAR(50)', default: "'active'", index: true },
      { name: 'avatarUrl', type: 'VARCHAR(500)', nullable: true },
      { name: 'signatureUrl', type: 'VARCHAR(500)', nullable: true },
      { name: 'thumbprintUrl', type: 'VARCHAR(500)', nullable: true },
      { name: 'pictureUrl', type: 'VARCHAR(500)', nullable: true },
      { name: 'residentialAddress', type: 'TEXT', nullable: true },
      { name: 'permanentAddress', type: 'TEXT', nullable: true },
      { name: 'cityOfResidence', type: 'VARCHAR(255)', nullable: true },
      { name: 'stateOfResidence', type: 'VARCHAR(255)', nullable: true },
      { name: 'departmentId', type: 'VARCHAR(255)', nullable: true, index: true },
      { name: 'designationId', type: 'VARCHAR(255)', nullable: true },
      { name: 'userId', type: 'VARCHAR(255)', nullable: true, unique: true },
      createdAt, updatedAt,
    ],
    fillable: ['staffId', 'ippisNumber', 'surname', 'firstName', 'otherNames', 'fullName', 'gender', 'dateOfBirth', 'maritalStatus', 'nationality', 'stateOfOrigin', 'lga', 'religion', 'ninNumber', 'tinNumber', 'pensionNumber', 'nhfNumber', 'nhisNumber', 'email', 'phone', 'altPhone', 'position', 'rank', 'employmentType', 'dateHired', 'confirmationDate', 'retirementDate', 'status', 'avatarUrl', 'signatureUrl', 'thumbprintUrl', 'pictureUrl', 'residentialAddress', 'permanentAddress', 'cityOfResidence', 'stateOfResidence', 'departmentId', 'designationId', 'userId'],
    casts: { dateOfBirth: 'datetime', dateHired: 'datetime', confirmationDate: 'datetime', retirementDate: 'datetime' },
    belongsTo: [
      { name: 'department', class: 'Department', fk: 'departmentId' },
      { name: 'designation', class: 'Designation', fk: 'designationId' },
      { name: 'user', class: 'User', fk: 'userId' },
    ],
    hasMany: [
      { name: 'nextOfKin', class: 'NextOfKin', fk: 'staffId' },
      { name: 'bankDetails', class: 'BankDetail', fk: 'staffId' },
      { name: 'academicBackground', class: 'AcademicBackground', fk: 'staffId' },
      { name: 'dependants', class: 'Dependant', fk: 'staffId' },
      { name: 'duties', class: 'Duty', fk: 'staffId' },
      { name: 'annualReviews', class: 'AnnualReview', fk: 'staffId' },
      { name: 'monthlyAppraisals', class: 'MonthlyAppraisal', fk: 'staffId' },
      { name: 'quarterlyReviews', class: 'QuarterlyReview', fk: 'staffId' },
      { name: 'assessments', class: 'Assessment', fk: 'staffId' },
      { name: 'appraisals', class: 'Appraisal', fk: 'staffId' },
      { name: 'leaves', class: 'Leave', fk: 'staffId' },
    ],
  },
  {
    prisma: 'nextOfKin', table: 'next_of_kin', className: 'NextOfKin',
    columns: [
      idCol,
      { name: 'staffId', type: 'VARCHAR(255)', index: true },
      { name: 'fullName', type: 'VARCHAR(255)' },
      { name: 'relationship', type: 'VARCHAR(50)', nullable: true },
      { name: 'gender', type: 'VARCHAR(20)', nullable: true },
      { name: 'phone', type: 'VARCHAR(50)', nullable: true },
      { name: 'email', type: 'VARCHAR(255)', nullable: true },
      { name: 'address', type: 'TEXT', nullable: true },
      { name: 'city', type: 'VARCHAR(255)', nullable: true },
      { name: 'state', type: 'VARCHAR(255)', nullable: true },
      { name: 'occupation', type: 'VARCHAR(255)', nullable: true },
      { name: 'employerName', type: 'VARCHAR(255)', nullable: true },
      { name: 'isPrimary', type: 'TINYINT(1)', default: '0' },
      createdAt, updatedAt,
    ],
    fillable: ['staffId', 'fullName', 'relationship', 'gender', 'phone', 'email', 'address', 'city', 'state', 'occupation', 'employerName', 'isPrimary'],
    casts: { isPrimary: 'boolean' },
    belongsTo: [{ name: 'staff', class: 'Staff', fk: 'staffId' }],
  },
  {
    prisma: 'bankDetail', table: 'bank_details', className: 'BankDetail',
    columns: [
      idCol,
      { name: 'staffId', type: 'VARCHAR(255)', index: true },
      { name: 'bankName', type: 'VARCHAR(255)' },
      { name: 'accountName', type: 'VARCHAR(255)' },
      { name: 'accountNumber', type: 'VARCHAR(50)' },
      { name: 'accountType', type: 'VARCHAR(50)', nullable: true, default: "'Savings'" },
      { name: 'branch', type: 'VARCHAR(255)', nullable: true },
      { name: 'sortCode', type: 'VARCHAR(50)', nullable: true },
      { name: 'bvnNumber', type: 'VARCHAR(50)', nullable: true },
      { name: 'isPrimary', type: 'TINYINT(1)', default: '0' },
      createdAt, updatedAt,
    ],
    fillable: ['staffId', 'bankName', 'accountName', 'accountNumber', 'accountType', 'branch', 'sortCode', 'bvnNumber', 'isPrimary'],
    casts: { isPrimary: 'boolean' },
    belongsTo: [{ name: 'staff', class: 'Staff', fk: 'staffId' }],
  },
  {
    prisma: 'academicBackground', table: 'academic_background', className: 'AcademicBackground',
    columns: [
      idCol,
      { name: 'staffId', type: 'VARCHAR(255)', index: true },
      { name: 'institution', type: 'VARCHAR(255)' },
      { name: 'qualification', type: 'VARCHAR(100)', nullable: true },
      { name: 'field', type: 'VARCHAR(255)', nullable: true },
      { name: 'startDate', type: 'DATETIME', nullable: true },
      { name: 'endDate', type: 'DATETIME', nullable: true },
      { name: 'grade', type: 'VARCHAR(100)', nullable: true },
      { name: 'certificateUrl', type: 'VARCHAR(500)', nullable: true },
      { name: 'certificateNumber', type: 'VARCHAR(100)', nullable: true },
      createdAt, updatedAt,
    ],
    fillable: ['staffId', 'institution', 'qualification', 'field', 'startDate', 'endDate', 'grade', 'certificateUrl', 'certificateNumber'],
    casts: { startDate: 'datetime', endDate: 'datetime' },
    belongsTo: [{ name: 'staff', class: 'Staff', fk: 'staffId' }],
  },
  {
    prisma: 'dependant', table: 'dependants', className: 'Dependant',
    columns: [
      idCol,
      { name: 'staffId', type: 'VARCHAR(255)', index: true },
      { name: 'fullName', type: 'VARCHAR(255)' },
      { name: 'relationship', type: 'VARCHAR(50)', nullable: true },
      { name: 'dateOfBirth', type: 'DATETIME', nullable: true },
      { name: 'gender', type: 'VARCHAR(20)', nullable: true },
      createdAt,
    ],
    fillable: ['staffId', 'fullName', 'relationship', 'dateOfBirth', 'gender'],
    casts: { dateOfBirth: 'datetime' },
    belongsTo: [{ name: 'staff', class: 'Staff', fk: 'staffId' }],
  },
  {
    prisma: 'duty', table: 'duties', className: 'Duty',
    columns: [
      idCol,
      { name: 'staffId', type: 'VARCHAR(255)', index: true },
      { name: 'title', type: 'VARCHAR(255)' },
      { name: 'description', type: 'TEXT', nullable: true },
      { name: 'weight', type: 'DECIMAL(10,2)', default: '1' },
      { name: 'targetScore', type: 'DECIMAL(10,2)', default: '100' },
      { name: 'achievedScore', type: 'DECIMAL(10,2)', nullable: true },
      { name: 'grade', type: 'VARCHAR(10)', nullable: true },
      { name: 'period', type: 'VARCHAR(20)', nullable: true },
      createdAt, updatedAt,
    ],
    fillable: ['staffId', 'title', 'description', 'weight', 'targetScore', 'achievedScore', 'grade', 'period'],
    casts: { weight: 'decimal', targetScore: 'decimal', achievedScore: 'decimal' },
    belongsTo: [{ name: 'staff', class: 'Staff', fk: 'staffId' }],
  },
  {
    prisma: 'annualReview', table: 'annual_reviews', className: 'AnnualReview',
    columns: [
      idCol,
      { name: 'staffId', type: 'VARCHAR(255)', index: true },
      { name: 'period', type: 'VARCHAR(20)', index: true },
      { name: 'overallScore', type: 'DECIMAL(10,2)', default: '0' },
      { name: 'assessmentScore', type: 'DECIMAL(10,2)', default: '0' },
      { name: 'monthlyScore', type: 'DECIMAL(10,2)', default: '0' },
      { name: 'quarterlyScore', type: 'DECIMAL(10,2)', default: '0' },
      { name: 'appraisalScore', type: 'DECIMAL(10,2)', default: '0' },
      { name: 'dutyScore', type: 'DECIMAL(10,2)', default: '0' },
      { name: 'verdict', type: 'VARCHAR(50)', nullable: true },
      { name: 'status', type: 'VARCHAR(50)', default: "'Draft'" },
      { name: 'comments', type: 'TEXT', nullable: true },
      { name: 'hodName', type: 'VARCHAR(255)', nullable: true },
      { name: 'hodSignatureUrl', type: 'VARCHAR(500)', nullable: true },
      { name: 'hodSignedAt', type: 'DATETIME', nullable: true },
      { name: 'daName', type: 'VARCHAR(255)', nullable: true },
      { name: 'daSignatureUrl', type: 'VARCHAR(500)', nullable: true },
      { name: 'daSignedAt', type: 'DATETIME', nullable: true },
      { name: 'annualReviewDuties', type: 'JSON', nullable: true },
      createdAt, updatedAt,
    ],
    fillable: ['staffId', 'period', 'overallScore', 'assessmentScore', 'monthlyScore', 'quarterlyScore', 'appraisalScore', 'dutyScore', 'verdict', 'status', 'comments', 'hodName', 'hodSignatureUrl', 'hodSignedAt', 'daName', 'daSignatureUrl', 'daSignedAt', 'annualReviewDuties'],
    casts: { overallScore: 'decimal', hodSignedAt: 'datetime', daSignedAt: 'datetime', annualReviewDuties: 'array' },
    belongsTo: [{ name: 'staff', class: 'Staff', fk: 'staffId' }],
  },
  {
    prisma: 'monthlyAppraisal', table: 'monthly_appraisals', className: 'MonthlyAppraisal',
    columns: [
      idCol,
      { name: 'staffId', type: 'VARCHAR(255)', index: true },
      { name: 'period', type: 'VARCHAR(20)' },
      { name: 'month', type: 'INT' },
      { name: 'year', type: 'INT' },
      { name: 'score', type: 'DECIMAL(10,2)', default: '0' },
      { name: 'grade', type: 'VARCHAR(10)', nullable: true },
      { name: 'achievements', type: 'TEXT', nullable: true },
      { name: 'challenges', type: 'TEXT', nullable: true },
      { name: 'recommendations', type: 'TEXT', nullable: true },
      { name: 'comments', type: 'TEXT', nullable: true },
      { name: 'status', type: 'VARCHAR(50)', default: "'Draft'" },
      { name: 'hodRemarks', type: 'TEXT', nullable: true },
      { name: 'houRemarks', type: 'TEXT', nullable: true },
      { name: 'hodName', type: 'VARCHAR(255)', nullable: true },
      { name: 'hodSignedAt', type: 'DATETIME', nullable: true },
      { name: 'houName', type: 'VARCHAR(255)', nullable: true },
      { name: 'houSignedAt', type: 'DATETIME', nullable: true },
      createdAt, updatedAt,
    ],
    fillable: ['staffId', 'period', 'month', 'year', 'score', 'grade', 'achievements', 'challenges', 'recommendations', 'comments', 'status', 'hodRemarks', 'houRemarks', 'hodName', 'hodSignedAt', 'houName', 'houSignedAt'],
    casts: { month: 'integer', year: 'integer', score: 'decimal', hodSignedAt: 'datetime', houSignedAt: 'datetime' },
    belongsTo: [{ name: 'staff', class: 'Staff', fk: 'staffId' }],
  },
  {
    prisma: 'quarterlyReview', table: 'quarterly_reviews', className: 'QuarterlyReview',
    columns: [
      idCol,
      { name: 'staffId', type: 'VARCHAR(255)', index: true },
      { name: 'period', type: 'VARCHAR(20)' },
      { name: 'quarter', type: 'INT' },
      { name: 'year', type: 'INT' },
      { name: 'averageScore', type: 'DECIMAL(10,2)', default: '0' },
      { name: 'grade', type: 'VARCHAR(10)', nullable: true },
      { name: 'summary', type: 'TEXT', nullable: true },
      { name: 'comments', type: 'TEXT', nullable: true },
      { name: 'status', type: 'VARCHAR(50)', default: "'Draft'" },
      createdAt, updatedAt,
    ],
    fillable: ['staffId', 'period', 'quarter', 'year', 'averageScore', 'grade', 'summary', 'comments', 'status'],
    casts: { quarter: 'integer', year: 'integer', averageScore: 'decimal' },
    belongsTo: [{ name: 'staff', class: 'Staff', fk: 'staffId' }],
  },
  {
    prisma: 'assessment', table: 'assessments', className: 'Assessment',
    columns: [
      idCol,
      { name: 'staffId', type: 'VARCHAR(255)', index: true },
      { name: 'period', type: 'VARCHAR(20)' },
      { name: 'knowledgeScore', type: 'DECIMAL(10,2)', default: '0' },
      { name: 'skillsScore', type: 'DECIMAL(10,2)', default: '0' },
      { name: 'attitudeScore', type: 'DECIMAL(10,2)', default: '0' },
      { name: 'communicationScore', type: 'DECIMAL(10,2)', default: '0' },
      { name: 'totalScore', type: 'DECIMAL(10,2)', default: '0' },
      { name: 'grade', type: 'VARCHAR(10)', nullable: true },
      { name: 'assessedById', type: 'VARCHAR(255)', nullable: true },
      { name: 'remarks', type: 'TEXT', nullable: true },
      { name: 'status', type: 'VARCHAR(50)', default: "'Draft'" },
      createdAt, updatedAt,
    ],
    fillable: ['staffId', 'period', 'knowledgeScore', 'skillsScore', 'attitudeScore', 'communicationScore', 'totalScore', 'grade', 'assessedById', 'remarks', 'status'],
    casts: { knowledgeScore: 'decimal', skillsScore: 'decimal', attitudeScore: 'decimal', communicationScore: 'decimal', totalScore: 'decimal' },
    belongsTo: [{ name: 'staff', class: 'Staff', fk: 'staffId' }],
  },
  {
    prisma: 'appraisal', table: 'appraisals', className: 'Appraisal',
    columns: [
      idCol,
      { name: 'staffId', type: 'VARCHAR(255)', index: true },
      { name: 'period', type: 'VARCHAR(20)' },
      { name: 'performanceScore', type: 'DECIMAL(10,2)', default: '0' },
      { name: 'achievementScore', type: 'DECIMAL(10,2)', default: '0' },
      { name: 'competencyScore', type: 'DECIMAL(10,2)', default: '0' },
      { name: 'totalScore', type: 'DECIMAL(10,2)', default: '0' },
      { name: 'grade', type: 'VARCHAR(10)', nullable: true },
      { name: 'appraisedById', type: 'VARCHAR(255)', nullable: true },
      { name: 'remarks', type: 'TEXT', nullable: true },
      { name: 'status', type: 'VARCHAR(50)', default: "'Draft'" },
      createdAt, updatedAt,
    ],
    fillable: ['staffId', 'period', 'performanceScore', 'achievementScore', 'competencyScore', 'totalScore', 'grade', 'appraisedById', 'remarks', 'status'],
    casts: { performanceScore: 'decimal', achievementScore: 'decimal', competencyScore: 'decimal', totalScore: 'decimal' },
    belongsTo: [{ name: 'staff', class: 'Staff', fk: 'staffId' }],
  },
  {
    prisma: 'leaveType', table: 'leave_types', className: 'LeaveType',
    columns: [
      idCol,
      { name: 'code', type: 'VARCHAR(50)', unique: true },
      { name: 'name', type: 'VARCHAR(255)' },
      { name: 'description', type: 'TEXT', nullable: true },
      { name: 'defaultDays', type: 'INT', default: '0' },
      { name: 'isPaid', type: 'TINYINT(1)', default: '1' },
      { name: 'requiresCertificate', type: 'TINYINT(1)', default: '0' },
      { name: 'isActive', type: 'TINYINT(1)', default: '1' },
      createdAt,
    ],
    fillable: ['code', 'name', 'description', 'defaultDays', 'isPaid', 'requiresCertificate', 'isActive'],
    casts: { isPaid: 'boolean', requiresCertificate: 'boolean', isActive: 'boolean', defaultDays: 'integer' },
    hasMany: [{ name: 'leaves', class: 'Leave', fk: 'leaveTypeId' }],
  },
  {
    prisma: 'leave', table: 'leaves', className: 'Leave',
    columns: [
      idCol,
      { name: 'refNumber', type: 'VARCHAR(100)', unique: true },
      { name: 'staffId', type: 'VARCHAR(255)', index: true },
      { name: 'leaveTypeId', type: 'VARCHAR(255)' },
      { name: 'startDate', type: 'DATETIME' },
      { name: 'endDate', type: 'DATETIME' },
      { name: 'daysRequested', type: 'INT' },
      { name: 'daysApproved', type: 'INT', nullable: true },
      { name: 'reason', type: 'TEXT' },
      { name: 'address', type: 'TEXT', nullable: true },
      { name: 'phone', type: 'VARCHAR(50)', nullable: true },
      { name: 'certificateUrl', type: 'VARCHAR(500)', nullable: true },
      { name: 'status', type: 'VARCHAR(50)', default: "'Pending'", index: true },
      { name: 'state', type: 'VARCHAR(50)', default: "'open'" },
      { name: 'hodId', type: 'VARCHAR(255)', nullable: true },
      { name: 'hodName', type: 'VARCHAR(255)', nullable: true },
      { name: 'hodRemarks', type: 'TEXT', nullable: true },
      { name: 'hodSignedAt', type: 'DATETIME', nullable: true },
      { name: 'dfaId', type: 'VARCHAR(255)', nullable: true },
      { name: 'dfaName', type: 'VARCHAR(255)', nullable: true },
      { name: 'dfaRemarks', type: 'TEXT', nullable: true },
      { name: 'dfaSignedAt', type: 'DATETIME', nullable: true },
      { name: 'cmdId', type: 'VARCHAR(255)', nullable: true },
      { name: 'cmdName', type: 'VARCHAR(255)', nullable: true },
      { name: 'cmdRemarks', type: 'TEXT', nullable: true },
      { name: 'cmdSignedAt', type: 'DATETIME', nullable: true },
      { name: 'rejectedById', type: 'VARCHAR(255)', nullable: true },
      { name: 'rejectedAt', type: 'DATETIME', nullable: true },
      { name: 'rejectReason', type: 'TEXT', nullable: true },
      { name: 'createdBy', type: 'VARCHAR(255)', nullable: true },
      createdAt, updatedAt,
    ],
    fillable: ['refNumber', 'staffId', 'leaveTypeId', 'startDate', 'endDate', 'daysRequested', 'daysApproved', 'reason', 'address', 'phone', 'certificateUrl', 'status', 'state', 'hodId', 'hodName', 'hodRemarks', 'hodSignedAt', 'dfaId', 'dfaName', 'dfaRemarks', 'dfaSignedAt', 'cmdId', 'cmdName', 'cmdRemarks', 'cmdSignedAt', 'rejectedById', 'rejectedAt', 'rejectReason', 'createdBy'],
    casts: { startDate: 'datetime', endDate: 'datetime', daysRequested: 'integer', daysApproved: 'integer', hodSignedAt: 'datetime', dfaSignedAt: 'datetime', cmdSignedAt: 'datetime', rejectedAt: 'datetime' },
    belongsTo: [
      { name: 'staff', class: 'Staff', fk: 'staffId' },
      { name: 'leaveType', class: 'LeaveType', fk: 'leaveTypeId' },
    ],
  },
  {
    prisma: 'holiday', table: 'holidays', className: 'Holiday',
    columns: [
      idCol,
      { name: 'name', type: 'VARCHAR(255)' },
      { name: 'description', type: 'TEXT', nullable: true },
      { name: 'date', type: 'DATETIME' },
      { name: 'type', type: 'VARCHAR(50)', default: "'public'" },
      { name: 'isActive', type: 'TINYINT(1)', default: '1' },
      createdAt,
    ],
    fillable: ['name', 'description', 'date', 'type', 'isActive'],
    casts: { date: 'datetime', isActive: 'boolean' },
  },
  {
    prisma: 'requisition', table: 'requisitions', className: 'Requisition',
    columns: [
      idCol,
      { name: 'refNumber', type: 'VARCHAR(100)', unique: true },
      { name: 'type', type: 'VARCHAR(50)', index: true },
      { name: 'subject', type: 'VARCHAR(255)' },
      { name: 'description', type: 'TEXT' },
      { name: 'comment', type: 'TEXT', nullable: true },
      { name: 'amount', type: 'DECIMAL(12,2)', nullable: true },
      { name: 'priority', type: 'VARCHAR(50)', default: "'Normal'" },
      { name: 'status', type: 'VARCHAR(50)', default: "'Submitted'", index: true },
      { name: 'state', type: 'VARCHAR(50)', default: "'open'" },
      { name: 'createdById', type: 'VARCHAR(255)' },
      { name: 'assigneeId', type: 'VARCHAR(255)', nullable: true, index: true },
      { name: 'targetUserId', type: 'VARCHAR(255)', nullable: true },
      { name: 'targetDesignationId', type: 'VARCHAR(255)', nullable: true, index: true },
      { name: 'targetDepartmentId', type: 'VARCHAR(255)', nullable: true },
      { name: 'departmentId', type: 'VARCHAR(255)', nullable: true },
      { name: 'closedAt', type: 'DATETIME', nullable: true },
      { name: 'closedById', type: 'VARCHAR(255)', nullable: true },
      { name: 'closureNote', type: 'TEXT', nullable: true },
      // Multi-signature workflow fields
      { name: 'cmdId', type: 'VARCHAR(255)', nullable: true },
      { name: 'cmdName', type: 'VARCHAR(255)', nullable: true },
      { name: 'cmdSignatureUrl', type: 'VARCHAR(500)', nullable: true },
      { name: 'cmdRemarks', type: 'TEXT', nullable: true },
      { name: 'cmdSignedAt', type: 'DATETIME', nullable: true },
      { name: 'dfaId', type: 'VARCHAR(255)', nullable: true },
      { name: 'dfaName', type: 'VARCHAR(255)', nullable: true },
      { name: 'dfaSignatureUrl', type: 'VARCHAR(500)', nullable: true },
      { name: 'dfaRemarks', type: 'TEXT', nullable: true },
      { name: 'dfaSignedAt', type: 'DATETIME', nullable: true },
      { name: 'daId', type: 'VARCHAR(255)', nullable: true },
      { name: 'daName', type: 'VARCHAR(255)', nullable: true },
      { name: 'daSignatureUrl', type: 'VARCHAR(500)', nullable: true },
      { name: 'daRemarks', type: 'TEXT', nullable: true },
      { name: 'daSignedAt', type: 'DATETIME', nullable: true },
      { name: 'hodId', type: 'VARCHAR(255)', nullable: true },
      { name: 'hodName', type: 'VARCHAR(255)', nullable: true },
      { name: 'hodSignatureUrl', type: 'VARCHAR(500)', nullable: true },
      { name: 'hodRemarks', type: 'TEXT', nullable: true },
      { name: 'hodSignedAt', type: 'DATETIME', nullable: true },
      createdAt, updatedAt,
    ],
    fillable: ['refNumber', 'type', 'subject', 'description', 'comment', 'amount', 'priority', 'status', 'state', 'createdById', 'assigneeId', 'targetUserId', 'targetDesignationId', 'targetDepartmentId', 'departmentId', 'closedAt', 'closedById', 'closureNote', 'cmdId', 'cmdName', 'cmdSignatureUrl', 'cmdRemarks', 'cmdSignedAt', 'dfaId', 'dfaName', 'dfaSignatureUrl', 'dfaRemarks', 'dfaSignedAt', 'daId', 'daName', 'daSignatureUrl', 'daRemarks', 'daSignedAt', 'hodId', 'hodName', 'hodSignatureUrl', 'hodRemarks', 'hodSignedAt'],
    casts: { amount: 'decimal', closedAt: 'datetime', cmdSignedAt: 'datetime', dfaSignedAt: 'datetime', daSignedAt: 'datetime', hodSignedAt: 'datetime' },
    belongsTo: [
      { name: 'createdBy', class: 'User', fk: 'createdById' },
      { name: 'assignee', class: 'User', fk: 'assigneeId' },
      { name: 'department', class: 'Department', fk: 'departmentId' },
    ],
    hasMany: [
      { name: 'routes', class: 'RequisitionRoute', fk: 'requisitionId' },
      { name: 'comments', class: 'RequisitionComment', fk: 'requisitionId' },
      { name: 'attachments', class: 'RequisitionAttachment', fk: 'requisitionId' },
    ],
  },
  {
    prisma: 'requisitionRoute', table: 'requisition_routes', className: 'RequisitionRoute',
    columns: [
      idCol,
      { name: 'requisitionId', type: 'VARCHAR(255)', index: true },
      { name: 'fromUserId', type: 'VARCHAR(255)' },
      { name: 'toUserId', type: 'VARCHAR(255)', nullable: true, index: true },
      { name: 'toDesignationId', type: 'VARCHAR(255)', nullable: true, index: true },
      { name: 'toDepartmentId', type: 'VARCHAR(255)', nullable: true },
      { name: 'action', type: 'VARCHAR(50)' },
      { name: 'remarks', type: 'TEXT', nullable: true },
      { name: 'acknowledgedAt', type: 'DATETIME', nullable: true },
      // Per-hop signature capture
      { name: 'signerName', type: 'VARCHAR(255)', nullable: true },
      { name: 'signerDesignation', type: 'VARCHAR(100)', nullable: true },
      { name: 'signatureUrl', type: 'VARCHAR(500)', nullable: true },
      { name: 'signedAt', type: 'DATETIME', nullable: true },
      createdAt,
    ],
    fillable: ['requisitionId', 'fromUserId', 'toUserId', 'toDesignationId', 'toDepartmentId', 'action', 'remarks', 'acknowledgedAt', 'signerName', 'signerDesignation', 'signatureUrl', 'signedAt'],
    casts: { acknowledgedAt: 'datetime', signedAt: 'datetime' },
    belongsTo: [
      { name: 'requisition', class: 'Requisition', fk: 'requisitionId' },
      { name: 'fromUser', class: 'User', fk: 'fromUserId' },
      { name: 'toUser', class: 'User', fk: 'toUserId' },
    ],
  },
  {
    prisma: 'requisitionComment', table: 'requisition_comments', className: 'RequisitionComment',
    columns: [
      idCol,
      { name: 'requisitionId', type: 'VARCHAR(255)', index: true },
      { name: 'userId', type: 'VARCHAR(255)' },
      { name: 'body', type: 'TEXT' },
      createdAt,
    ],
    fillable: ['requisitionId', 'userId', 'body'],
    belongsTo: [
      { name: 'requisition', class: 'Requisition', fk: 'requisitionId' },
      { name: 'user', class: 'User', fk: 'userId' },
    ],
  },
  {
    prisma: 'requisitionAttachment', table: 'requisition_attachments', className: 'RequisitionAttachment',
    columns: [
      idCol,
      { name: 'requisitionId', type: 'VARCHAR(255)', index: true },
      { name: 'fileName', type: 'VARCHAR(255)' },
      { name: 'fileUrl', type: 'VARCHAR(500)' },
      { name: 'fileSize', type: 'INT', nullable: true },
      { name: 'mimeType', type: 'VARCHAR(100)', nullable: true },
      { name: 'uploadedById', type: 'VARCHAR(255)', nullable: true },
      createdAt,
    ],
    fillable: ['requisitionId', 'fileName', 'fileUrl', 'fileSize', 'mimeType', 'uploadedById'],
    casts: { fileSize: 'integer' },
    belongsTo: [{ name: 'requisition', class: 'Requisition', fk: 'requisitionId' }],
  },
  {
    prisma: 'registryFile', table: 'registry_files', className: 'RegistryFile',
    columns: [
      idCol,
      { name: 'fileNumber', type: 'VARCHAR(100)', unique: true },
      { name: 'type', type: 'VARCHAR(50)' },
      { name: 'subject', type: 'VARCHAR(255)' },
      { name: 'description', type: 'TEXT' },
      { name: 'priority', type: 'VARCHAR(50)', default: "'Normal'" },
      { name: 'createdById', type: 'VARCHAR(255)' },
      { name: 'currentHolderId', type: 'VARCHAR(255)', nullable: true, index: true },
      { name: 'status', type: 'VARCHAR(50)', default: "'Draft'", index: true },
      { name: 'state', type: 'VARCHAR(50)', default: "'open'" },
      { name: 'staffId', type: 'VARCHAR(255)', nullable: true },
      { name: 'departmentId', type: 'VARCHAR(255)', nullable: true },
      { name: 'externalName', type: 'VARCHAR(255)', nullable: true },
      { name: 'externalOrg', type: 'VARCHAR(255)', nullable: true },
      { name: 'externalEmail', type: 'VARCHAR(255)', nullable: true },
      { name: 'externalPhone', type: 'VARCHAR(50)', nullable: true },
      { name: 'committeeId', type: 'VARCHAR(255)', nullable: true, index: true },
      { name: 'targetUserId', type: 'VARCHAR(255)', nullable: true },
      { name: 'targetDesignationId', type: 'VARCHAR(255)', nullable: true, index: true },
      { name: 'targetDepartmentId', type: 'VARCHAR(255)', nullable: true },
      // Closure signature fields
      { name: 'cmdSignatureUrl', type: 'VARCHAR(500)', nullable: true },
      { name: 'cmdSignedAt', type: 'DATETIME', nullable: true },
      { name: 'dfaSignatureUrl', type: 'VARCHAR(500)', nullable: true },
      { name: 'dfaSignedAt', type: 'DATETIME', nullable: true },
      { name: 'hodSignatureUrl', type: 'VARCHAR(500)', nullable: true },
      { name: 'hodSignedAt', type: 'DATETIME', nullable: true },
      { name: 'registrySignatureUrl', type: 'VARCHAR(500)', nullable: true },
      { name: 'registrySignedAt', type: 'DATETIME', nullable: true },
      { name: 'closedAt', type: 'DATETIME', nullable: true },
      { name: 'closedById', type: 'VARCHAR(255)', nullable: true },
      createdAt, updatedAt,
    ],
    fillable: ['fileNumber', 'type', 'subject', 'description', 'priority', 'createdById', 'currentHolderId', 'status', 'state', 'staffId', 'departmentId', 'externalName', 'externalOrg', 'externalEmail', 'externalPhone', 'committeeId', 'targetUserId', 'targetDesignationId', 'targetDepartmentId', 'cmdSignatureUrl', 'cmdSignedAt', 'dfaSignatureUrl', 'dfaSignedAt', 'hodSignatureUrl', 'hodSignedAt', 'registrySignatureUrl', 'registrySignedAt', 'closedAt', 'closedById'],
    casts: { closedAt: 'datetime', cmdSignedAt: 'datetime', dfaSignedAt: 'datetime', hodSignedAt: 'datetime', registrySignedAt: 'datetime' },
    belongsTo: [
      { name: 'createdBy', class: 'User', fk: 'createdById' },
      { name: 'currentHolder', class: 'User', fk: 'currentHolderId' },
      { name: 'department', class: 'Department', fk: 'departmentId' },
      { name: 'committee', class: 'Committee', fk: 'committeeId' },
    ],
    hasMany: [
      { name: 'routes', class: 'FileRoute', fk: 'fileId' },
      { name: 'attachments', class: 'FileAttachment', fk: 'fileId' },
      { name: 'comments', class: 'FileComment', fk: 'fileId' },
    ],
  },
  {
    prisma: 'fileRoute', table: 'file_routes', className: 'FileRoute',
    columns: [
      idCol,
      { name: 'fileId', type: 'VARCHAR(255)', index: true },
      { name: 'fromUserId', type: 'VARCHAR(255)' },
      { name: 'toUserId', type: 'VARCHAR(255)', nullable: true, index: true },
      { name: 'toDesignationId', type: 'VARCHAR(255)', nullable: true, index: true },
      { name: 'toDepartmentId', type: 'VARCHAR(255)', nullable: true },
      { name: 'action', type: 'VARCHAR(50)' },
      { name: 'remarks', type: 'TEXT', nullable: true },
      { name: 'acknowledgedAt', type: 'DATETIME', nullable: true },
      // Per-hop signature capture
      { name: 'signerName', type: 'VARCHAR(255)', nullable: true },
      { name: 'signerDesignation', type: 'VARCHAR(100)', nullable: true },
      { name: 'signatureUrl', type: 'VARCHAR(500)', nullable: true },
      { name: 'signedAt', type: 'DATETIME', nullable: true },
      createdAt,
    ],
    fillable: ['fileId', 'fromUserId', 'toUserId', 'toDesignationId', 'toDepartmentId', 'action', 'remarks', 'acknowledgedAt', 'signerName', 'signerDesignation', 'signatureUrl', 'signedAt'],
    casts: { acknowledgedAt: 'datetime', signedAt: 'datetime' },
    belongsTo: [{ name: 'file', class: 'RegistryFile', fk: 'fileId' }],
  },
  {
    prisma: 'fileAttachment', table: 'file_attachments', className: 'FileAttachment',
    columns: [
      idCol,
      { name: 'fileId', type: 'VARCHAR(255)', index: true },
      { name: 'fileName', type: 'VARCHAR(255)' },
      { name: 'fileUrl', type: 'VARCHAR(500)' },
      { name: 'fileSize', type: 'INT', nullable: true },
      { name: 'mimeType', type: 'VARCHAR(100)', nullable: true },
      { name: 'uploadedById', type: 'VARCHAR(255)', nullable: true },
      { name: 'isPrimary', type: 'TINYINT(1)', default: '0' },
      createdAt,
    ],
    fillable: ['fileId', 'fileName', 'fileUrl', 'fileSize', 'mimeType', 'uploadedById', 'isPrimary'],
    casts: { fileSize: 'integer', isPrimary: 'boolean' },
    belongsTo: [{ name: 'file', class: 'RegistryFile', fk: 'fileId' }],
  },
  {
    prisma: 'fileComment', table: 'file_comments', className: 'FileComment',
    columns: [
      idCol,
      { name: 'fileId', type: 'VARCHAR(255)', index: true },
      { name: 'userId', type: 'VARCHAR(255)' },
      { name: 'body', type: 'TEXT' },
      createdAt,
    ],
    fillable: ['fileId', 'userId', 'body'],
    belongsTo: [{ name: 'file', class: 'RegistryFile', fk: 'fileId' }],
  },
  {
    prisma: 'mailMessage', table: 'mail_messages', className: 'MailMessage',
    columns: [
      idCol,
      { name: 'subject', type: 'VARCHAR(255)' },
      { name: 'body', type: 'TEXT' },
      { name: 'fromId', type: 'VARCHAR(255)', index: true },
      { name: 'toId', type: 'VARCHAR(255)', index: true },
      { name: 'requisitionId', type: 'VARCHAR(255)', nullable: true },
      { name: 'fileId', type: 'VARCHAR(255)', nullable: true },
      { name: 'priority', type: 'VARCHAR(50)', default: "'Normal'" },
      { name: 'isRead', type: 'TINYINT(1)', default: '0' },
      { name: 'isArchived', type: 'TINYINT(1)', default: '0' },
      { name: 'isStarred', type: 'TINYINT(1)', default: '0' },
      { name: 'readAt', type: 'DATETIME', nullable: true },
      { name: 'archivedAt', type: 'DATETIME', nullable: true },
      { name: 'parentId', type: 'VARCHAR(255)', nullable: true },
      createdAt,
    ],
    fillable: ['subject', 'body', 'fromId', 'toId', 'requisitionId', 'fileId', 'priority', 'isRead', 'isArchived', 'isStarred', 'readAt', 'archivedAt', 'parentId'],
    casts: { isRead: 'boolean', isArchived: 'boolean', isStarred: 'boolean', readAt: 'datetime', archivedAt: 'datetime' },
    belongsTo: [
      { name: 'from', class: 'User', fk: 'fromId' },
      { name: 'to', class: 'User', fk: 'toId' },
      { name: 'parent', class: 'MailMessage', fk: 'parentId' },
    ],
    hasMany: [{ name: 'replies', class: 'MailMessage', fk: 'parentId' }],
  },
  {
    prisma: 'notification', table: 'notifications', className: 'Notification',
    columns: [
      idCol,
      { name: 'userId', type: 'VARCHAR(255)', index: true },
      { name: 'title', type: 'VARCHAR(255)' },
      { name: 'body', type: 'TEXT' },
      { name: 'type', type: 'VARCHAR(50)', default: "'info'" },
      { name: 'link', type: 'VARCHAR(500)', nullable: true },
      { name: 'isRead', type: 'TINYINT(1)', default: '0' },
      { name: 'readAt', type: 'DATETIME', nullable: true },
      createdAt,
    ],
    fillable: ['userId', 'title', 'body', 'type', 'link', 'isRead', 'readAt'],
    casts: { isRead: 'boolean', readAt: 'datetime' },
    belongsTo: [{ name: 'user', class: 'User', fk: 'userId' }],
  },
  {
    prisma: 'auditLog', table: 'audit_logs', className: 'AuditLog',
    columns: [
      idCol,
      { name: 'userId', type: 'VARCHAR(255)', index: true },
      { name: 'action', type: 'VARCHAR(255)' },
      { name: 'entity', type: 'VARCHAR(100)', nullable: true, index: true },
      { name: 'entityId', type: 'VARCHAR(255)', nullable: true },
      { name: 'details', type: 'TEXT', nullable: true },
      { name: 'ipAddress', type: 'VARCHAR(50)', nullable: true },
      createdAt,
    ],
    fillable: ['userId', 'action', 'entity', 'entityId', 'details', 'ipAddress'],
    belongsTo: [{ name: 'user', class: 'User', fk: 'userId' }],
  },
  // ============================================================
  // RBAC: Pages, Roles, RolePagePermissions, Committees
  // ============================================================
  {
    prisma: 'page', table: 'pages', className: 'Page',
    columns: [
      idCol,
      { name: 'key', type: 'VARCHAR(100)', unique: true },
      { name: 'name', type: 'VARCHAR(255)' },
      { name: 'description', type: 'TEXT', nullable: true },
      { name: 'icon', type: 'VARCHAR(100)', nullable: true },
      { name: 'category', type: 'VARCHAR(50)', default: "'Main'" },
      { name: 'sortOrder', type: 'INT', default: '100' },
      { name: 'isActive', type: 'TINYINT(1)', default: '1' },
      createdAt, updatedAt,
    ],
    fillable: ['key', 'name', 'description', 'icon', 'category', 'sortOrder', 'isActive'],
    casts: { isActive: 'boolean', sortOrder: 'integer' },
    hasMany: [{ name: 'rolePermissions', class: 'RolePagePermission', fk: 'pageId' }],
  },
  {
    prisma: 'role', table: 'roles', className: 'Role',
    columns: [
      idCol,
      { name: 'code', type: 'VARCHAR(50)', unique: true },
      { name: 'name', type: 'VARCHAR(255)' },
      { name: 'description', type: 'TEXT', nullable: true },
      { name: 'rank', type: 'INT', default: '100' },
      { name: 'level', type: 'VARCHAR(50)', default: "'staff'" },
      { name: 'isSystem', type: 'TINYINT(1)', default: '0' },
      { name: 'isActive', type: 'TINYINT(1)', default: '1' },
      createdAt, updatedAt,
    ],
    fillable: ['code', 'name', 'description', 'rank', 'level', 'isSystem', 'isActive'],
    casts: { isSystem: 'boolean', isActive: 'boolean', rank: 'integer' },
    hasMany: [{ name: 'rolePermissions', class: 'RolePagePermission', fk: 'roleId' }],
  },
  {
    prisma: 'rolePagePermission', table: 'role_page_permissions', className: 'RolePagePermission',
    columns: [
      idCol,
      { name: 'roleId', type: 'VARCHAR(255)', index: true },
      { name: 'pageId', type: 'VARCHAR(255)', index: true },
      { name: 'canView', type: 'TINYINT(1)', default: '1' },
      { name: 'canCreate', type: 'TINYINT(1)', default: '0' },
      { name: 'canEdit', type: 'TINYINT(1)', default: '0' },
      { name: 'canDelete', type: 'TINYINT(1)', default: '0' },
      { name: 'createdById', type: 'VARCHAR(255)', nullable: true },
      createdAt, updatedAt,
    ],
    fillable: ['roleId', 'pageId', 'canView', 'canCreate', 'canEdit', 'canDelete', 'createdById'],
    casts: { canView: 'boolean', canCreate: 'boolean', canEdit: 'boolean', canDelete: 'boolean' },
    belongsTo: [
      { name: 'role', class: 'Role', fk: 'roleId' },
      { name: 'page', class: 'Page', fk: 'pageId' },
    ],
  },
  {
    prisma: 'committee', table: 'committees', className: 'Committee',
    columns: [
      idCol,
      { name: 'code', type: 'VARCHAR(50)', unique: true },
      { name: 'name', type: 'VARCHAR(255)' },
      { name: 'description', type: 'TEXT', nullable: true },
      { name: 'chairpersonId', type: 'VARCHAR(255)', nullable: true },
      { name: 'secretaryId', type: 'VARCHAR(255)', nullable: true },
      { name: 'members', type: 'TEXT', nullable: true },
      { name: 'isActive', type: 'TINYINT(1)', default: '1', index: true },
      createdAt, updatedAt,
    ],
    fillable: ['code', 'name', 'description', 'chairpersonId', 'secretaryId', 'members', 'isActive'],
    casts: { isActive: 'boolean' },
    belongsTo: [
      { name: 'chairperson', class: 'User', fk: 'chairpersonId' },
      { name: 'secretary', class: 'User', fk: 'secretaryId' },
    ],
    hasMany: [{ name: 'files', class: 'RegistryFile', fk: 'committeeId' }],
  },
  // ============================================================
  // HR LIFECYCLE: Promotions, Terminations, Resignations
  // ============================================================
  {
    prisma: 'promotion', table: 'promotions', className: 'Promotion',
    columns: [
      idCol,
      { name: 'refNumber', type: 'VARCHAR(50)', unique: true },
      { name: 'staffId', type: 'VARCHAR(255)', index: true },
      { name: 'currentPosition', type: 'VARCHAR(255)', nullable: true },
      { name: 'currentRank', type: 'VARCHAR(100)', nullable: true },
      { name: 'currentSalary', type: 'DECIMAL(12,2)', nullable: true },
      { name: 'newPosition', type: 'VARCHAR(255)', nullable: true },
      { name: 'newRank', type: 'VARCHAR(100)', nullable: true },
      { name: 'newSalary', type: 'DECIMAL(12,2)', nullable: true },
      { name: 'newDepartmentId', type: 'VARCHAR(255)', nullable: true },
      { name: 'newDesignationId', type: 'VARCHAR(255)', nullable: true },
      { name: 'type', type: 'VARCHAR(50)', default: "'promotion'" },
      { name: 'effectiveDate', type: 'DATETIME' },
      { name: 'reason', type: 'TEXT', nullable: true },
      { name: 'justification', type: 'TEXT', nullable: true },
      { name: 'status', type: 'VARCHAR(50)', default: "'Submitted'", index: true },
      { name: 'state', type: 'VARCHAR(50)', default: "'open'" },
      { name: 'hodId', type: 'VARCHAR(255)', nullable: true },
      { name: 'hodName', type: 'VARCHAR(255)', nullable: true },
      { name: 'hodSignatureUrl', type: 'VARCHAR(500)', nullable: true },
      { name: 'hodRemarks', type: 'TEXT', nullable: true },
      { name: 'hodSignedAt', type: 'DATETIME', nullable: true },
      { name: 'dfaId', type: 'VARCHAR(255)', nullable: true },
      { name: 'dfaName', type: 'VARCHAR(255)', nullable: true },
      { name: 'dfaSignatureUrl', type: 'VARCHAR(500)', nullable: true },
      { name: 'dfaRemarks', type: 'TEXT', nullable: true },
      { name: 'dfaSignedAt', type: 'DATETIME', nullable: true },
      { name: 'cmdId', type: 'VARCHAR(255)', nullable: true },
      { name: 'cmdName', type: 'VARCHAR(255)', nullable: true },
      { name: 'cmdSignatureUrl', type: 'VARCHAR(500)', nullable: true },
      { name: 'cmdRemarks', type: 'TEXT', nullable: true },
      { name: 'cmdSignedAt', type: 'DATETIME', nullable: true },
      { name: 'rejectedById', type: 'VARCHAR(255)', nullable: true },
      { name: 'rejectedAt', type: 'DATETIME', nullable: true },
      { name: 'rejectReason', type: 'TEXT', nullable: true },
      { name: 'createdById', type: 'VARCHAR(255)', index: true },
      createdAt, updatedAt,
    ],
    fillable: ['refNumber', 'staffId', 'currentPosition', 'currentRank', 'currentSalary', 'newPosition', 'newRank', 'newSalary', 'newDepartmentId', 'newDesignationId', 'type', 'effectiveDate', 'reason', 'justification', 'status', 'state', 'hodId', 'hodName', 'hodSignatureUrl', 'hodRemarks', 'hodSignedAt', 'dfaId', 'dfaName', 'dfaSignatureUrl', 'dfaRemarks', 'dfaSignedAt', 'cmdId', 'cmdName', 'cmdSignatureUrl', 'cmdRemarks', 'cmdSignedAt', 'rejectedById', 'rejectedAt', 'rejectReason', 'createdById'],
    casts: { effectiveDate: 'datetime', hodSignedAt: 'datetime', dfaSignedAt: 'datetime', cmdSignedAt: 'datetime', rejectedAt: 'datetime', currentSalary: 'decimal', newSalary: 'decimal' },
    belongsTo: [
      { name: 'staff', class: 'Staff', fk: 'staffId' },
      { name: 'createdBy', class: 'User', fk: 'createdById' },
      { name: 'newDepartment', class: 'Department', fk: 'newDepartmentId' },
      { name: 'newDesignation', class: 'Designation', fk: 'newDesignationId' },
      { name: 'hod', class: 'User', fk: 'hodId' },
      { name: 'dfa', class: 'User', fk: 'dfaId' },
      { name: 'cmd', class: 'User', fk: 'cmdId' },
    ],
  },
  {
    prisma: 'termination', table: 'terminations', className: 'Termination',
    columns: [
      idCol,
      { name: 'refNumber', type: 'VARCHAR(50)', unique: true },
      { name: 'staffId', type: 'VARCHAR(255)', index: true },
      { name: 'type', type: 'VARCHAR(50)', default: "'termination'" },
      { name: 'reason', type: 'VARCHAR(255)' },
      { name: 'detailedReason', type: 'TEXT', nullable: true },
      { name: 'noticeDate', type: 'DATETIME', nullable: true },
      { name: 'effectiveDate', type: 'DATETIME' },
      { name: 'lastWorkingDate', type: 'DATETIME', nullable: true },
      { name: 'exitInterviewConducted', type: 'TINYINT(1)', default: '0' },
      { name: 'exitInterviewNotes', type: 'TEXT', nullable: true },
      { name: 'handoverCompleted', type: 'TINYINT(1)', default: '0' },
      { name: 'assetsReturned', type: 'TINYINT(1)', default: '0' },
      { name: 'clearanceFormUrl', type: 'VARCHAR(500)', nullable: true },
      { name: 'finalSalary', type: 'DECIMAL(12,2)', nullable: true },
      { name: 'gratuityAmount', type: 'DECIMAL(12,2)', nullable: true },
      { name: 'pensionBalance', type: 'DECIMAL(12,2)', nullable: true },
      { name: 'leaveEncashment', type: 'DECIMAL(12,2)', nullable: true },
      { name: 'status', type: 'VARCHAR(50)', default: "'Submitted'", index: true },
      { name: 'state', type: 'VARCHAR(50)', default: "'open'" },
      { name: 'hodId', type: 'VARCHAR(255)', nullable: true },
      { name: 'hodName', type: 'VARCHAR(255)', nullable: true },
      { name: 'hodSignatureUrl', type: 'VARCHAR(500)', nullable: true },
      { name: 'hodRemarks', type: 'TEXT', nullable: true },
      { name: 'hodSignedAt', type: 'DATETIME', nullable: true },
      { name: 'dfaId', type: 'VARCHAR(255)', nullable: true },
      { name: 'dfaName', type: 'VARCHAR(255)', nullable: true },
      { name: 'dfaSignatureUrl', type: 'VARCHAR(500)', nullable: true },
      { name: 'dfaRemarks', type: 'TEXT', nullable: true },
      { name: 'dfaSignedAt', type: 'DATETIME', nullable: true },
      { name: 'cmdId', type: 'VARCHAR(255)', nullable: true },
      { name: 'cmdName', type: 'VARCHAR(255)', nullable: true },
      { name: 'cmdSignatureUrl', type: 'VARCHAR(500)', nullable: true },
      { name: 'cmdRemarks', type: 'TEXT', nullable: true },
      { name: 'cmdSignedAt', type: 'DATETIME', nullable: true },
      { name: 'rejectedById', type: 'VARCHAR(255)', nullable: true },
      { name: 'rejectedAt', type: 'DATETIME', nullable: true },
      { name: 'rejectReason', type: 'TEXT', nullable: true },
      { name: 'createdById', type: 'VARCHAR(255)', index: true },
      createdAt, updatedAt,
    ],
    fillable: ['refNumber', 'staffId', 'type', 'reason', 'detailedReason', 'noticeDate', 'effectiveDate', 'lastWorkingDate', 'exitInterviewConducted', 'exitInterviewNotes', 'handoverCompleted', 'assetsReturned', 'clearanceFormUrl', 'finalSalary', 'gratuityAmount', 'pensionBalance', 'leaveEncashment', 'status', 'state', 'hodId', 'hodName', 'hodSignatureUrl', 'hodRemarks', 'hodSignedAt', 'dfaId', 'dfaName', 'dfaSignatureUrl', 'dfaRemarks', 'dfaSignedAt', 'cmdId', 'cmdName', 'cmdSignatureUrl', 'cmdRemarks', 'cmdSignedAt', 'rejectedById', 'rejectedAt', 'rejectReason', 'createdById'],
    casts: { noticeDate: 'datetime', effectiveDate: 'datetime', lastWorkingDate: 'datetime', hodSignedAt: 'datetime', dfaSignedAt: 'datetime', cmdSignedAt: 'datetime', rejectedAt: 'datetime', exitInterviewConducted: 'boolean', handoverCompleted: 'boolean', assetsReturned: 'boolean', finalSalary: 'decimal', gratuityAmount: 'decimal', pensionBalance: 'decimal', leaveEncashment: 'decimal' },
    belongsTo: [
      { name: 'staff', class: 'Staff', fk: 'staffId' },
      { name: 'createdBy', class: 'User', fk: 'createdById' },
    ],
  },
  {
    prisma: 'resignation', table: 'resignations', className: 'Resignation',
    columns: [
      idCol,
      { name: 'refNumber', type: 'VARCHAR(50)', unique: true },
      { name: 'staffId', type: 'VARCHAR(255)', index: true },
      { name: 'reason', type: 'VARCHAR(255)' },
      { name: 'detailedReason', type: 'TEXT', nullable: true },
      { name: 'resignationDate', type: 'DATETIME' },
      { name: 'noticeDate', type: 'DATETIME', nullable: true },
      { name: 'effectiveDate', type: 'DATETIME' },
      { name: 'lastWorkingDate', type: 'DATETIME', nullable: true },
      { name: 'isWithdrawn', type: 'TINYINT(1)', default: '0' },
      { name: 'withdrawnAt', type: 'DATETIME', nullable: true },
      { name: 'withdrawnById', type: 'VARCHAR(255)', nullable: true },
      { name: 'exitInterviewConducted', type: 'TINYINT(1)', default: '0' },
      { name: 'exitInterviewNotes', type: 'TEXT', nullable: true },
      { name: 'handoverCompleted', type: 'TINYINT(1)', default: '0' },
      { name: 'assetsReturned', type: 'TINYINT(1)', default: '0' },
      { name: 'clearanceFormUrl', type: 'VARCHAR(500)', nullable: true },
      { name: 'finalSalary', type: 'DECIMAL(12,2)', nullable: true },
      { name: 'gratuityAmount', type: 'DECIMAL(12,2)', nullable: true },
      { name: 'pensionBalance', type: 'DECIMAL(12,2)', nullable: true },
      { name: 'leaveEncashment', type: 'DECIMAL(12,2)', nullable: true },
      { name: 'status', type: 'VARCHAR(50)', default: "'Submitted'", index: true },
      { name: 'state', type: 'VARCHAR(50)', default: "'open'" },
      { name: 'hodId', type: 'VARCHAR(255)', nullable: true },
      { name: 'hodName', type: 'VARCHAR(255)', nullable: true },
      { name: 'hodSignatureUrl', type: 'VARCHAR(500)', nullable: true },
      { name: 'hodRemarks', type: 'TEXT', nullable: true },
      { name: 'hodSignedAt', type: 'DATETIME', nullable: true },
      { name: 'dfaId', type: 'VARCHAR(255)', nullable: true },
      { name: 'dfaName', type: 'VARCHAR(255)', nullable: true },
      { name: 'dfaSignatureUrl', type: 'VARCHAR(500)', nullable: true },
      { name: 'dfaRemarks', type: 'TEXT', nullable: true },
      { name: 'dfaSignedAt', type: 'DATETIME', nullable: true },
      { name: 'cmdId', type: 'VARCHAR(255)', nullable: true },
      { name: 'cmdName', type: 'VARCHAR(255)', nullable: true },
      { name: 'cmdSignatureUrl', type: 'VARCHAR(500)', nullable: true },
      { name: 'cmdRemarks', type: 'TEXT', nullable: true },
      { name: 'cmdSignedAt', type: 'DATETIME', nullable: true },
      { name: 'rejectedById', type: 'VARCHAR(255)', nullable: true },
      { name: 'rejectedAt', type: 'DATETIME', nullable: true },
      { name: 'rejectReason', type: 'TEXT', nullable: true },
      { name: 'createdById', type: 'VARCHAR(255)', index: true },
      createdAt, updatedAt,
    ],
    fillable: ['refNumber', 'staffId', 'reason', 'detailedReason', 'resignationDate', 'noticeDate', 'effectiveDate', 'lastWorkingDate', 'isWithdrawn', 'withdrawnAt', 'withdrawnById', 'exitInterviewConducted', 'exitInterviewNotes', 'handoverCompleted', 'assetsReturned', 'clearanceFormUrl', 'finalSalary', 'gratuityAmount', 'pensionBalance', 'leaveEncashment', 'status', 'state', 'hodId', 'hodName', 'hodSignatureUrl', 'hodRemarks', 'hodSignedAt', 'dfaId', 'dfaName', 'dfaSignatureUrl', 'dfaRemarks', 'dfaSignedAt', 'cmdId', 'cmdName', 'cmdSignatureUrl', 'cmdRemarks', 'cmdSignedAt', 'rejectedById', 'rejectedAt', 'rejectReason', 'createdById'],
    casts: { resignationDate: 'datetime', noticeDate: 'datetime', effectiveDate: 'datetime', lastWorkingDate: 'datetime', withdrawnAt: 'datetime', hodSignedAt: 'datetime', dfaSignedAt: 'datetime', cmdSignedAt: 'datetime', rejectedAt: 'datetime', isWithdrawn: 'boolean', exitInterviewConducted: 'boolean', handoverCompleted: 'boolean', assetsReturned: 'boolean', finalSalary: 'decimal', gratuityAmount: 'decimal', pensionBalance: 'decimal', leaveEncashment: 'decimal' },
    belongsTo: [
      { name: 'staff', class: 'Staff', fk: 'staffId' },
      { name: 'createdBy', class: 'User', fk: 'createdById' },
    ],
  },
]

// ───────────────────────────────────────────────────────────
// Step 1 — Generate MySQL dump
// ───────────────────────────────────────────────────────────

function genCreateTable(m: ModelDef): string {
  const lines: string[] = []
  for (const c of m.columns) {
    let line = `  \`${c.name}\` ${c.type}`
    if (!c.nullable && !c.primary) line += ' NOT NULL'
    if (c.default !== undefined) line += ` DEFAULT ${c.default}`
    if (c.primary) line += ' PRIMARY KEY'
    if (c.unique && !c.primary) line += ` UNIQUE KEY \`uk_${m.table}_${c.name}\` (\`${c.name}\`)`
    lines.push(line + ',')
  }
  // Add indexes
  for (const c of m.columns) {
    if (c.index && !c.unique && !c.primary) {
      lines.push(`  INDEX \`idx_${m.table}_${c.name}\` (\`${c.name}\`),`)
    }
  }
  // Foreign keys (best-effort, based on naming convention)
  const fkLines: string[] = []
  for (const c of m.columns) {
    if (c.name === 'staffId') fkLines.push(`  CONSTRAINT \`fk_${m.table}_staff\` FOREIGN KEY (\`staffId\`) REFERENCES \`staff\`(\`id\`) ON DELETE CASCADE,`)
    if (c.name === 'leaveTypeId') fkLines.push(`  CONSTRAINT \`fk_${m.table}_leavetype\` FOREIGN KEY (\`leaveTypeId\`) REFERENCES \`leave_types\`(\`id\`),`)
    if (c.name === 'requisitionId') fkLines.push(`  CONSTRAINT \`fk_${m.table}_requisition\` FOREIGN KEY (\`requisitionId\`) REFERENCES \`requisitions\`(\`id\`) ON DELETE CASCADE,`)
    if (c.name === 'fileId' && m.table !== 'requisition_files') fkLines.push(`  CONSTRAINT \`fk_${m.table}_file\` FOREIGN KEY (\`fileId\`) REFERENCES \`registry_files\`(\`id\`) ON DELETE CASCADE,`)
  }
  const all = [...lines, ...fkLines].filter((l) => l)
  // remove trailing comma on last line
  if (all.length) all[all.length - 1] = all[all.length - 1].replace(/,$/, '')
  return `CREATE TABLE IF NOT EXISTS \`${m.table}\` (\n${all.join('\n')}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
}

async function generateMysqlDump(): Promise<string> {
  const chunks: string[] = []
  chunks.push(`-- FUTH Lafia HR/PMS — MySQL dump generated on ${new Date().toISOString()}`)
  chunks.push(`-- Generated by scripts/export-to-mysql.ts`)
  chunks.push('SET FOREIGN_KEY_CHECKS=0;')
  chunks.push('CREATE DATABASE IF NOT EXISTS futh_pms;')
  chunks.push('USE futh_pms;')
  chunks.push('')

  // CREATE TABLEs
  for (const m of models) {
    chunks.push(`-- Table: ${m.table}`)
    chunks.push(`DROP TABLE IF EXISTS \`${m.table}\`;`)
    chunks.push(genCreateTable(m))
    chunks.push('')
  }

  // INSERTs
  for (const m of models) {
    const rows = await (db as any)[m.prisma].findMany()
    if (!rows || rows.length === 0) {
      chunks.push(`-- ${m.table}: no rows`)
      continue
    }
    chunks.push(`-- Data: ${m.table} (${rows.length} rows)`)
    const colNames = m.columns.map((c) => c.name)
    const colList = colNames.map((c) => `\`${c}\``).join(', ')
    for (const row of rows) {
      const values = colNames.map((c) => sqlEscape(row[c])).join(', ')
      chunks.push(`INSERT INTO \`${m.table}\` (${colList}) VALUES (${values});`)
    }
    chunks.push('')
  }

  chunks.push('SET FOREIGN_KEY_CHECKS=1;')
  return chunks.join('\n')
}

// ───────────────────────────────────────────────────────────
// Step 2 — Generate Laravel migration files
// ───────────────────────────────────────────────────────────

const BASE_TS = '2025_01_01_000000'

function genMigration(m: ModelDef): string {
  const cols = m.columns.filter((c) => !c.primary && c.name !== 'created_at' && c.name !== 'updated_at')
  const colLines: string[] = []
  for (const c of cols) {
    if (c.type === 'TINYINT(1)') colLines.push(`            $table->boolean('${c.name}')${c.default ? `->default(${c.default === '1' ? 'true' : 'false'})` : ''}${c.nullable ? '->nullable()' : ''};`)
    else if (c.type === 'INT') colLines.push(`            $table->integer('${c.name}')${c.default ? `->default(${c.default})` : ''}${c.nullable ? '->nullable()' : ''};`)
    else if (c.type === 'DECIMAL(10,2)') colLines.push(`            $table->decimal('${c.name}', 10, 2)${c.default ? `->default(${c.default})` : ''}${c.nullable ? '->nullable()' : ''};`)
    else if (c.type === 'DECIMAL(12,2)') colLines.push(`            $table->decimal('${c.name}', 12, 2)${c.default ? `->default(${c.default})` : ''}${c.nullable ? '->nullable()' : ''};`)
    else if (c.type === 'DATETIME') colLines.push(`            $table->dateTime('${c.name}')${c.nullable ? '->nullable()' : ''};`)
    else if (c.type === 'TEXT') colLines.push(`            $table->text('${c.name}')${c.nullable ? '->nullable()' : ''};`)
    else if (c.type === 'JSON') colLines.push(`            $table->json('${c.name}')->nullable();`)
    else if (c.type.startsWith('VARCHAR')) {
      const len = c.type.match(/\((\d+)\)/)?.[1] || '255'
      colLines.push(`            $table->string('${c.name}', ${len})${c.default ? `->default(${c.default})` : ''}${c.nullable ? '->nullable()' : ''};`)
    }
    if (c.unique) colLines.push(`            $table->unique('${c.name}', 'uk_${m.table}_${c.name}');`)
    if (c.index) colLines.push(`            $table->index('${c.name}', 'idx_${m.table}_${c.name}');`)
  }

  return `<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('${m.table}', function (Blueprint $table) {
            $table->string('id')->primary();
${colLines.join('\n')}
            $table->timestamps();
        });
    }

    public function down(): void {
        Schema::dropIfExists('${m.table}');
    }
};
`
}

// ───────────────────────────────────────────────────────────
// Step 3 — Generate Laravel Model classes
// ───────────────────────────────────────────────────────────

function genModel(m: ModelDef): string {
  const fillable = m.fillable.map((f) => `        '${f}',`).join('\n')
  const casts = Object.entries(m.casts || {}).map(([k, v]) => `        '${k}' => '${v}',`).join('\n')

  const relations: string[] = []
  for (const bt of m.belongsTo || []) {
    relations.push(`    public function ${bt.name}(): \\Illuminate\\Database\\Eloquent\\Relations\\BelongsTo
    {
        return $this->belongsTo(\\App\\Models\\${bt.class}::class, '${bt.fk}');
    }`)
  }
  for (const hm of m.hasMany || []) {
    relations.push(`    public function ${hm.name}(): \\Illuminate\\Database\\Eloquent\\Relations\\HasMany
    {
        return $this->hasMany(\\App\\Models\\${hm.class}::class, '${hm.fk}');
    }`)
  }
  for (const ho of m.hasOne || []) {
    relations.push(`    public function ${ho.name}(): \\Illuminate\\Database\\Eloquent\\Relations\\HasOne
    {
        return $this->hasOne(\\App\\Models\\${ho.class}::class, '${ho.fk}');
    }`)
  }
  const relBlock = relations.length ? '\n\n' + relations.join('\n\n') : ''

  return `<?php

namespace App\\Models;

use Illuminate\\Database\\Eloquent\\Model;

class ${m.className} extends Model
{
    protected $table = '${m.table}';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
${fillable}
    ];

    protected $casts = [
${casts}
    ];
${relBlock}
}
`
}

// ───────────────────────────────────────────────────────────
// Step 4 — Generate Laravel controller stubs
// ───────────────────────────────────────────────────────────

function genController(name: string, model: string): string {
  return `<?php

namespace App\\Http\\Controllers;

use App\\Models\\${model};
use Illuminate\\Http\\Request;

class ${name} extends Controller
{
    public function index(Request $request)
    {
        $q = ${model}::query();
        if ($request->filled('q')) {
            $q->where('name', 'like', '%' . $request->query('q') . '%');
        }
        return response()->json(['data' => $q->paginate(20)]);
    }

    public function show($id)
    {
        $record = ${model}::findOrFail($id);
        return response()->json(['data' => $record]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            // TODO: validation rules
        ]);
        $record = ${model}::create($data);
        return response()->json(['data' => $record], 201);
    }

    public function update(Request $request, $id)
    {
        $record = ${model}::findOrFail($id);
        $record->update($request->all());
        return response()->json(['data' => $record]);
    }

    public function destroy($id)
    {
        ${model}::destroy($id);
        return response()->noContent();
    }
}
`
}

// ───────────────────────────────────────────────────────────
// Step 5 — Generate Laravel notification classes
// ───────────────────────────────────────────────────────────

const notifications = [
  { name: 'FileForwarded', msg: 'A registry file has been forwarded to you' },
  { name: 'FileAcknowledged', msg: 'Your registry file was acknowledged' },
  { name: 'LeaveApplied', msg: 'A new leave application was submitted' },
  { name: 'LeaveApproved', msg: 'Your leave was approved' },
  { name: 'LeaveRejected', msg: 'Your leave was rejected' },
  { name: 'ReviewSigned', msg: 'Your review was signed' },
  { name: 'ReviewSubmitted', msg: 'A review was submitted for your signature' },
]

function genNotification(name: string, msg: string): string {
  return `<?php

namespace App\\Notifications;

use Illuminate\\Bus\\Queueable;
use Illuminate\\Notifications\\Notification;

class ${name} extends Notification
{
    use Queueable;

    public function __construct(public array $context = []) {}

    public function via($notifiable): array
    {
        return ['database'];
    }

    public function toArray($notifiable): array
    {
        return [
            'message' => '${msg}',
            'context' => $this->context,
        ];
    }
}
`
}

// ───────────────────────────────────────────────────────────
// Step 6 — Generate views
// ───────────────────────────────────────────────────────────

const layoutBlade = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FUTH Lafia PMS</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
        :root { --futh-green: #15803d; --futh-dark: #14532d; --futh-light: #dcfce7; }
        body { background: #f4f7f6; }
        .navbar-brand { font-weight: 700; color: var(--futh-dark) !important; }
        .sidebar { background: var(--futh-dark); color: #fff; min-height: 100vh; padding-top: 1rem; }
        .sidebar a { color: rgba(255,255,255,0.85); display: block; padding: 0.5rem 1rem; text-decoration: none; }
        .sidebar a:hover, .sidebar a.active { background: var(--futh-green); color: #fff; }
        .btn-primary { background: var(--futh-green); border-color: var(--futh-green); }
        .btn-primary:hover { background: var(--futh-dark); border-color: var(--futh-dark); }
        .futh-logo { width: 40px; height: 40px; border-radius: 8px; object-fit: cover; }
    </style>
</head>
<body>
<nav class="navbar navbar-light bg-white shadow-sm">
    <div class="container-fluid">
        <a class="navbar-brand d-flex align-items-center gap-2" href="/">
            <img src="{{ asset('img/futh-logo.jpeg') }}" alt="FUTH logo" class="futh-logo">
            FUTH Lafia PMS
        </a>
        <div class="d-flex align-items-center gap-3">
            <span class="badge bg-success">System Active</span>
            <div class="dropdown">
                <button class="btn btn-light dropdown-toggle" data-bs-toggle="dropdown">{{ auth()->user()->fullName ?? 'Guest' }}</button>
                <ul class="dropdown-menu dropdown-menu-end">
                    <li><a class="dropdown-item" href="/profile">Profile</a></li>
                    <li><a class="dropdown-item" href="/2fa-setup">2FA Setup</a></li>
                    <li><a class="dropdown-item" href="/settings">Settings</a></li>
                    <li><hr class="dropdown-divider"></li>
                    <li><a class="dropdown-item" href="/logout">Logout</a></li>
                </ul>
            </div>
        </div>
    </div>
</nav>
<div class="container-fluid">
    <div class="row">
        <nav class="col-md-2 d-none d-md-block sidebar py-3">
            <a href="/dashboard" class="{{ request()->is('dashboard') ? 'active' : '' }}">Dashboard</a>
            <a href="/staff" class="{{ request()->is('staff') ? 'active' : '' }}">Staff</a>
            <a href="/departments" class="{{ request()->is('departments') ? 'active' : '' }}">Departments</a>
            <a href="/designations" class="{{ request()->is('designations') ? 'active' : '' }}">Designations</a>
            <a href="/duties" class="{{ request()->is('duties') ? 'active' : '' }}">Duties</a>
            <a href="/annual-reviews" class="{{ request()->is('annual-reviews') ? 'active' : '' }}">Annual Reviews</a>
            <a href="/monthly-appraisals" class="{{ request()->is('monthly-appraisals') ? 'active' : '' }}">Monthly Appraisals</a>
            <a href="/quarterly-reviews" class="{{ request()->is('quarterly-reviews') ? 'active' : '' }}">Quarterly Reviews</a>
            <a href="/assessments" class="{{ request()->is('assessments') ? 'active' : '' }}">Assessments</a>
            <a href="/appraisals" class="{{ request()->is('appraisals') ? 'active' : '' }}">Appraisals</a>
            <a href="/leaves" class="{{ request()->is('leaves') ? 'active' : '' }}">Leave Management</a>
            <a href="/requisitions" class="{{ request()->is('requisitions') ? 'active' : '' }}">Requisitions</a>
            <a href="/files" class="{{ request()->is('files') ? 'active' : '' }}">Registry Files</a>
            <a href="/reports" class="{{ request()->is('reports') ? 'active' : '' }}">Reports</a>
            <a href="/users" class="{{ request()->is('users') ? 'active' : '' }}">Users</a>
            <a href="/settings" class="{{ request()->is('settings') ? 'active' : '' }}">Settings</a>
        </nav>
        <main class="col-md-10 p-4">
            @yield('content')
        </main>
    </div>
</div>
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
@stack('scripts')
</body>
</html>`

const loginBlade = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>FUTH Lafia — Login</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
        body { background: linear-gradient(135deg, #14532d, #15803d); min-height: 100vh; }
        .login-card { max-width: 420px; margin: 6vh auto; background: #fff; border-radius: 16px; padding: 32px; box-shadow: 0 20px 60px rgba(0,0,0,0.15); }
        .futh-logo { width: 64px; height: 64px; border-radius: 12px; object-fit: cover; display: block; margin: 0 auto 12px; }
    </style>
</head>
<body>
<div class="login-card">
    <img src="{{ asset('img/futh-logo.jpeg') }}" alt="FUTH" class="futh-logo">
    <h3 class="text-center mb-2" style="color:#14532d">FUTH Lafia</h3>
    <p class="text-center text-muted mb-4">HR & Performance Management</p>
    <form method="POST" action="/login">
        @csrf
        <div class="mb-3">
            <label class="form-label">Username</label>
            <input type="text" name="username" class="form-control" value="admin" required>
        </div>
        <div class="mb-3">
            <label class="form-label">Password</label>
            <input type="password" name="password" class="form-control" value="admin123" required>
        </div>
        <button type="submit" class="btn btn-primary w-100">Sign In</button>
    </form>
    <p class="text-center text-muted mt-3" style="font-size: 12px;">Default: <strong>admin / admin123</strong></p>
</div>
</body>
</html>`

const dashboardBlade = `@extends('layouts.app')
@section('content')
<div class="d-flex justify-between align-items-center mb-4">
    <div>
        <h1 class="h3 mb-1">Dashboard</h1>
        <p class="text-muted">Welcome back, {{ auth()->user()->fullName ?? 'User' }}</p>
    </div>
</div>
<div class="row g-3 mb-4">
    <div class="col-md-3"><div class="card text-white" style="background:#15803d"><div class="card-body"><div class="text-uppercase small">Staff</div><div class="display-6">{{ $staffCount ?? 0 }}</div></div></div></div>
    <div class="col-md-3"><div class="card text-white" style="background:#14532d"><div class="card-body"><div class="text-uppercase small">Departments</div><div class="display-6">{{ $deptCount ?? 0 }}</div></div></div></div>
    <div class="col-md-3"><div class="card text-dark" style="background:#dcfce7"><div class="card-body"><div class="text-uppercase small">Open Requisitions</div><div class="display-6">{{ $reqCount ?? 0 }}</div></div></div></div>
    <div class="col-md-3"><div class="card text-dark" style="background:#fef3c7"><div class="card-body"><div class="text-uppercase small">Pending Leaves</div><div class="display-6">{{ $leaveCount ?? 0 }}</div></div></div></div>
</div>
@endsection`

const staffIndexBlade = `@extends('layouts.app')
@section('content')
<div class="d-flex justify-between align-items-center mb-3">
    <h1 class="h3">Staff Directory</h1>
    <a href="/staff/create" class="btn btn-primary">Add Staff</a>
</div>
<div class="card"><div class="card-body">
<table class="table table-hover">
<thead><tr><th>Staff ID</th><th>Name</th><th>Position</th><th>Department</th><th>Status</th></tr></thead>
<tbody>
@foreach($staff as $s)
<tr>
<td>{{ $s->staffId }}</td>
<td>{{ $s->fullName }}</td>
<td>{{ $s->position }}</td>
<td>{{ $s->department?->name }}</td>
<td><span class="badge bg-success">{{ $s->status }}</span></td>
</tr>
@endforeach
</tbody>
</table>
</div></div>
@endsection`

const reqIndexBlade = `@extends('layouts.app')
@section('content')
<div class="d-flex justify-between align-items-center mb-3">
    <h1 class="h3">Requisitions</h1>
    <a href="/requisitions/create" class="btn btn-primary">New Requisition</a>
</div>
<div class="card"><div class="card-body">
<table class="table table-hover">
<thead><tr><th>Ref #</th><th>Type</th><th>Subject</th><th>Priority</th><th>Status</th><th>Created</th></tr></thead>
<tbody>
@foreach($requisitions as $r)
<tr>
<td>{{ $r->refNumber }}</td>
<td>{{ $r->type }}</td>
<td>{{ $r->subject }}</td>
<td><span class="badge bg-warning">{{ $r->priority }}</span></td>
<td><span class="badge bg-info">{{ $r->status }}</span></td>
<td>{{ $r->created_at?->format('Y-m-d') }}</td>
</tr>
@endforeach
</tbody>
</table>
</div></div>
@endsection`

const twoFactorSetupBlade = `@extends('layouts.app')
@section('content')
<div class="row justify-content-center">
<div class="col-md-8 col-lg-6">
<div class="card mt-4">
<div class="card-body">
<h3 class="text-center mb-3" style="color:#14532d">🔐 Two-Factor Authentication Setup</h3>
@if(session('warning'))
<div class="alert alert-warning">{{ session('warning') }}</div>
@endif
<div id="setup-app" data-user-id="{{ auth()->id() }}" data-enforced="{{ $enforced ? 1 : 0 }}">
<p class="text-muted text-center">Loading 2FA setup...</p>
</div>
</div>
</div>
</div>
</div>
<script>
// Minimal inline script for the setup flow.
// In a real Laravel app you would extract this into a Blade component + Alpine.js.
(async function () {
    const app = document.getElementById('setup-app');
    const userId = app.dataset.userId;
    const enforced = app.dataset.enforced === '1';

    async function beginSetup() {
        app.innerHTML = '<div class="text-center"><div class="spinner-border text-primary"></div><p class="mt-2">Generating secret...</p></div>';
        const res = await fetch('/api/auth/2fa/setup', { method: 'POST', headers: {'Content-Type':'application/json','X-CSRF-TOKEN': document.querySelector('meta[name=csrf-token]')?.content || ''}, body: JSON.stringify({ userId }) });
        const data = await res.json();
        if (!res.ok) { app.innerHTML = '<div class="alert alert-danger">' + (data.error || 'Failed') + '</div>'; return; }
        showQR(data);
    }

    function showQR(data) {
        app.innerHTML = \`
            <p class="text-muted text-center">Scan this QR code with Google Authenticator or Authy:</p>
            <div class="text-center mb-3"><img src="\${data.qrDataUrl}" alt="QR" style="width:240px;height:240px;border:1px solid #eee;border-radius:8px"/></div>
            <p class="text-muted text-center small">Or enter this secret manually:</p>
            <div class="input-group mb-3"><input class="form-control text-center font-monospace" id="2fa-secret" value="\${data.secret}" readonly><button class="btn btn-outline-secondary" onclick="navigator.clipboard.writeText(document.getElementById('2fa-secret').value)">Copy</button></div>
            <label class="form-label">Enter the 6-digit code from your app:</label>
            <input class="form-control text-center font-monospace mb-2" id="2fa-code" maxlength="6" inputmode="numeric" placeholder="000000"/>
            <button class="btn btn-primary w-100" id="verify-btn">Verify and enable</button>
        \`;
        document.getElementById('verify-btn').onclick = verifyCode;
    }

    async function verifyCode() {
        const code = document.getElementById('2fa-code').value.trim();
        if (code.length !== 6) { alert('Enter a 6-digit code'); return; }
        const res = await fetch('/api/auth/2fa/enable', { method: 'POST', headers: {'Content-Type':'application/json','X-CSRF-TOKEN': document.querySelector('meta[name=csrf-token]')?.content || ''}, body: JSON.stringify({ code, userId }) });
        const data = await res.json();
        if (!res.ok) { alert(data.error || 'Invalid code'); return; }
        showRecoveryCodes(data.recoveryCodes);
    }

    function showRecoveryCodes(codes) {
        app.innerHTML = \`
            <div class="alert alert-warning"><strong>⚠️ Save these recovery codes!</strong> Each can be used exactly once. They will not be shown again.</div>
            <div class="bg-light p-3 rounded border">
            <pre class="mb-0" style="font-family:monospace;font-size:14px">\${codes.map((c,i)=>(i+1)+'. '+c).join('\\n')}</pre>
            </div>
            <button class="btn btn-outline-secondary w-100 mt-3" onclick="navigator.clipboard.writeText(\`<pre>\${codes.join('\\n')}</pre>\`)">Copy all</button>
            <a href="/dashboard" class="btn btn-primary w-100 mt-2">Continue to dashboard</a>
        \`;
    }

    beginSetup();
})();
</script>
@endsection`

const twoFactorChallengeBlade = `@extends('layouts.app')
@section('content')
<div class="row justify-content-center">
<div class="col-md-6">
<div class="card mt-5">
<div class="card-body">
<h3 class="text-center mb-3" style="color:#14532d">🔐 Two-Factor Verification</h3>
@if(session('info'))
<div class="alert alert-info">{{ session('info') }}</div>
@endif
<form id="2fa-form">
<div class="mb-3">
<label class="form-label">Enter the 6-digit code from your authenticator app:</label>
<input class="form-control text-center font-monospace" id="code" name="code" maxlength="6" inputmode="numeric" placeholder="000000" autofocus required/>
</div>
<button class="btn btn-primary w-100" type="submit">Verify</button>
<a href="#" class="d-block text-center mt-3 small" onclick="document.getElementById('recovery-section').style.display='block';return false;">Use a recovery code instead</a>
<div id="recovery-section" style="display:none" class="mt-3">
<label class="form-label">Recovery code:</label>
<input class="form-control font-monospace" id="recovery" name="recovery" maxlength="10"/>
<button class="btn btn-outline-primary w-100 mt-2" type="button" onclick="submitRecovery()">Use recovery code</button>
</div>
</form>
</div>
</div>
</div>
</div>
<script>
document.getElementById('2fa-form').onsubmit = async function (e) {
    e.preventDefault();
    const code = document.getElementById('code').value;
    const res = await fetch('/api/auth/2fa/verify', { method: 'POST', headers: {'Content-Type':'application/json','X-CSRF-TOKEN': document.querySelector('meta[name=csrf-token]')?.content || ''}, body: JSON.stringify({ code, userId: {{ session('2fa.pending_user_id') ?? 'null' }} }) });
    if (res.ok) { window.location.href = '/dashboard'; } else { alert('Invalid code'); }
};
async function submitRecovery() {
    const recovery = document.getElementById('recovery').value;
    const res = await fetch('/api/auth/2fa/verify', { method: 'POST', headers: {'Content-Type':'application/json','X-CSRF-TOKEN': document.querySelector('meta[name=csrf-token]')?.content || ''}, body: JSON.stringify({ code: recovery, userId: {{ session('2fa.pending_user_id') ?? 'null' }} }) });
    if (res.ok) { window.location.href = '/dashboard'; } else { alert('Invalid recovery code'); }
}
</script>
@endsection`

// ───────────────────────────────────────────────────────────
// Step 7 — Generate middleware & misc
// ───────────────────────────────────────────────────────────

const roleMiddleware = `<?php

namespace App\\Http\\Middleware;

use Closure;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\Auth;

class RoleMiddleware
{
    /**
     * Usage:
     *   Route::middleware(['auth', 'role:CMD'])->...
     *   Route::middleware(['auth', 'role:SUPER_ADMIN,ADMIN'])->...
     *
     * Checks the user's role column against the comma-separated list of allowed
     * role codes. If the user is SUPER_ADMIN, the check always passes (super
     * admins bypass role restrictions).
     */
    public function handle(Request $request, Closure $next, string $roles): mixed
    {
        $user = Auth::user();
        if (!$user) {
            abort(401, 'Please sign in.');
        }
        if ($user->role === 'SUPER_ADMIN') {
            return $next($request);
        }
        $allowed = array_map('trim', explode(',', $roles));
        if (!in_array($user->role, $allowed, true)) {
            abort(403, 'You do not have access to this section.');
        }
        return $next($request);
    }
}`

const permissionMiddleware = `<?php

namespace App\\Http\\Middleware;

use Closure;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\Auth;
use App\\Models\\Role;
use App\\Models\\RolePagePermission;
use App\\Models\\Page;

/**
 * Permission middleware — checks the user's role-permissions for a given page.
 *
 * Usage (action is view|create|edit|delete):
 *   Route::middleware(['auth', 'permission:requisitions,view'])->...
 *   Route::middleware(['auth', 'permission:staff,create'])->...
 *
 * If the user is SUPER_ADMIN, all permission checks pass.
 */
class PermissionMiddleware
{
    public function handle(Request $request, Closure $next, string $pageKey, string $action = 'view'): mixed
    {
        $user = Auth::user();
        if (!$user) {
            abort(401, 'Please sign in.');
        }
        if ($user->role === 'SUPER_ADMIN') {
            return $next($request);
        }

        $role = Role::where('code', $user->role)->first();
        if (!$role) {
            abort(403, 'Your role is not configured in the system.');
        }

        $page = Page::where('key', $pageKey)->first();
        if (!$page) {
            abort(403, "Unknown page: {$pageKey}");
        }

        $perm = RolePagePermission::where('roleId', $role->id)
            ->where('pageId', $page->id)
            ->first();

        if (!$perm) {
            abort(403, "No permission entry for {$pageKey}.");
        }

        $field = 'can' . ucfirst(strtolower($action));
        if (!in_array($field, ['canView', 'canCreate', 'canEdit', 'canDelete'])) {
            abort(500, "Invalid permission action: {$action}");
        }
        if (!$perm->{$field}) {
            abort(403, "You do not have {$action} permission for {$pageKey}.");
        }

        return $next($request);
    }
}`

const twoFactorMiddleware = `<?php

namespace App\\Http\\Middleware;

use Closure;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\Auth;
use Illuminate\\Support\\Facades\\Redirect;

/**
 * Two-Factor Authentication middleware.
 *
 * Enforces 2FA for executive roles (SUPER_ADMIN, ADMIN, CMD, CMA, AD, DFA).
 * If a user has 2FA enabled but has NOT completed verification this session,
 * they are redirected to the 2FA challenge page.
 *
 * If the user's role is enforced AND they haven't set up 2FA yet, they are
 * redirected to the 2FA setup page.
 *
 * Usage:
 *   Route::middleware(['auth', '2fa'])->group(function () { ... });
 *
 * Apply to: dashboard, user-mgmt, settings, and all admin/executive pages.
 */
class TwoFactorMiddleware
{
    /**
     * Roles for which 2FA is mandatory.
     */
    private const ENFORCED_ROLES = ['SUPER_ADMIN', 'ADMIN', 'CMD', 'CMA', 'AD', 'DFA'];

    public function handle(Request $request, Closure $next): mixed
    {
        $user = Auth::user();

        if (!$user) {
            return $next($request);
        }

        // Allow 2FA routes themselves (avoid redirect loop)
        if ($request->is('2fa*', 'logout', 'login', 'api/auth/2fa*')) {
            return $next($request);
        }

        $isEnforced = in_array($user->role, self::ENFORCED_ROLES, true);
        $isEnabled = (bool) $user->twoFactorEnabled;

        // If enforced but not enabled yet, force setup.
        if ($isEnforced && !$isEnabled) {
            return Redirect::route('2fa.setup')
                ->with('warning', 'Two-factor authentication is required for your account. Please set it up to continue.');
        }

        // If enabled, the user must have a verified 2FA session flag.
        // We track this via session('2fa.verified').
        if ($isEnabled && !session('2fa.verified', false)) {
            return Redirect::route('2fa.challenge')
                ->with('info', 'Please verify your two-factor authentication to continue.');
        }

        return $next($request);
    }
}`

const twoFactorController = `<?php

namespace App\\Http\\Controllers;

use App\\Models\\User;
use App\\Models\\AuditLog;
use App\\Services\\TwoFactorService;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\Auth;
use Illuminate\\Support\\Facades\\Hash;
use Illuminate\\Validation\\ValidationException;

/**
 * Two-Factor Authentication (TOTP) Controller.
 *
 * Endpoints:
 *   POST /2fa/setup                  — begin setup (generate secret + QR)
 *   POST /2fa/enable                 — verify code and enable 2FA, return recovery codes
 *   POST /2fa/disable                — verify password, disable 2FA
 *   POST /2fa/verify                 — verify code or recovery code (login second step)
 *   POST /2fa/regenerate-recovery    — verify password, regenerate recovery codes
 *   GET  /2fa/setup                  — show setup view
 *   GET  /2fa/challenge              — show verify view
 */
class TwoFactorController extends Controller
{
    public function __construct(protected TwoFactorService $twoFactor) {}

    /**
     * Show the 2FA setup page.
     */
    public function showSetup(Request $request)
    {
        $user = $request->user();
        return view('auth.2fa-setup', [
            'user' => $user,
            'enforced' => $this->twoFactor->isEnforced($user->role),
        ]);
    }

    /**
     * Show the 2FA challenge page (used during login).
     */
    public function showChallenge(Request $request)
    {
        return view('auth.2fa-challenge', ['userId' => session('2fa.pending_user_id')]);
    }

    /**
     * Begin 2FA setup — generate a new TOTP secret and QR code.
     * Returns the secret + QR data URL. Does NOT enable 2FA yet.
     */
    public function setup(Request $request)
    {
        $user = $request->user() ?? $this->resolvePendingUser($request);
        if (!$user) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }
        if ($user->twoFactorEnabled) {
            return response()->json(['error' => '2FA is already enabled'], 400);
        }

        $data = $this->twoFactor->beginSetup($user);

        return response()->json([
            'secret' => $data['secret'],
            'otpauthUrl' => $data['otpauthUrl'],
            'qrDataUrl' => $data['qrDataUrl'],
            'enforced' => $this->twoFactor->isEnforced($user->role),
        ]);
    }

    /**
     * Enable 2FA — verify the code against the stored secret, then enable.
     * Returns 8 recovery codes (plain text — shown once).
     */
    public function enable(Request $request)
    {
        $request->validate(['code' => 'required|string|size:6']);
        $user = $request->user() ?? $this->resolvePendingUser($request);
        if (!$user) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }
        if ($user->twoFactorEnabled) {
            return response()->json(['error' => '2FA is already enabled'], 400);
        }
        if (!$user->twoFactorSecret) {
            return response()->json(['error' => 'Please call /2fa/setup first'], 400);
        }
        if (!$this->twoFactor->verify($user->twoFactorSecret, $request->input('code'))) {
            throw ValidationException::withMessages(['code' => 'Invalid verification code']);
        }

        $recoveryCodes = $this->twoFactor->enable($user);

        $this->audit($user, '2fa_enable', 'Enabled 2FA (TOTP) and generated 8 recovery codes', $request);

        return response()->json([
            'recoveryCodes' => $recoveryCodes,
            'message' => '2FA enabled. Save your recovery codes — they will not be shown again.',
        ]);
    }

    /**
     * Disable 2FA — requires the user's password.
     */
    public function disable(Request $request)
    {
        $request->validate(['password' => 'required|string']);
        $user = $request->user();
        if (!$user) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }
        if (!Hash::check($request->input('password'), $user->passwordHash)) {
            throw ValidationException::withMessages(['password' => 'Incorrect password']);
        }

        $this->twoFactor->disable($user);
        $this->audit($user, '2fa_disable', 'Disabled 2FA', $request);

        session()->forget('2fa.verified');

        return response()->json(['success' => true, 'message' => '2FA disabled']);
    }

    /**
     * Verify a 2FA code or recovery code (second step of login).
     * Sets the session 2fa.verified flag on success.
     */
    public function verify(Request $request)
    {
        $request->validate([
            'code' => 'required|string',
            'userId' => 'sometimes|string',
        ]);

        $user = $request->user();
        if (!$user) {
            $userId = $request->input('userId') ?? session('2fa.pending_user_id');
            if (!$userId) {
                return response()->json(['error' => 'No pending 2FA session'], 400);
            }
            $user = User::find($userId);
            if (!$user) {
                return response()->json(['error' => 'User not found'], 404);
            }
        }
        if (!$user->twoFactorEnabled) {
            return response()->json(['error' => '2FA not enabled'], 400);
        }

        $code = $request->input('code');
        $usedRecovery = false;
        $remainingRecovery = null;

        if (preg_match('/^\\\\d{6}$/', $code) && $user->twoFactorSecret) {
            if (!$this->twoFactor->verify($user->twoFactorSecret, $code)) {
                throw ValidationException::withMessages(['code' => 'Invalid 2FA code']);
            }
        } else {
            $result = $this->twoFactor->verifyRecovery($user, $code);
            if (!$result['valid']) {
                throw ValidationException::withMessages(['code' => 'Invalid recovery code']);
            }
            $usedRecovery = true;
            $remainingRecovery = $result['remaining'];
        }

        $user->twoFactorLastUsedAt = now();
        $user->save();

        Auth::login($user);
        session(['2fa.verified' => true]);
        session()->forget('2fa.pending_user_id');

        $this->audit($user, '2fa_verify', $usedRecovery ? 'Verified with recovery code' : 'Verified with TOTP code', $request);

        return response()->json([
            'success' => true,
            'user' => $user,
            'usedRecoveryCode' => $usedRecovery,
            'remainingRecoveryCodes' => $remainingRecovery,
        ]);
    }

    /**
     * Regenerate recovery codes — requires the user's password.
     */
    public function regenerateRecoveryCodes(Request $request)
    {
        $request->validate(['password' => 'required|string']);
        $user = $request->user();
        if (!$user) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }
        if (!$user->twoFactorEnabled) {
            return response()->json(['error' => '2FA is not enabled'], 400);
        }
        if (!Hash::check($request->input('password'), $user->passwordHash)) {
            throw ValidationException::withMessages(['password' => 'Incorrect password']);
        }

        $codes = $this->twoFactor->regenerateRecovery($user);
        $this->audit($user, '2fa_enable', 'Regenerated 8 recovery codes', $request);

        return response()->json([
            'recoveryCodes' => $codes,
            'message' => 'New recovery codes generated. The previous codes are no longer valid.',
        ]);
    }

    /**
     * If the request has a pending 2FA user (pre-auth flow), resolve it.
     */
    private function resolvePendingUser(Request $request): ?User
    {
        $userId = $request->input('userId');
        if (!$userId) return null;
        $user = User::find($userId);
        if (!$user || !$user->isActive) return null;
        if ($user->twoFactorEnabled) return null;
        return $user;
    }

    private function audit(User $user, string $action, string $details, Request $request): void
    {
        try {
            AuditLog::create([
                'userId' => $user->id,
                'action' => $action,
                'entity' => 'User',
                'entityId' => $user->id,
                'details' => $details,
                'ipAddress' => $request->ip(),
            ]);
        } catch (\\Throwable $e) {
            // best-effort
        }
    }
}`

const twoFactorService = `<?php

namespace App\\Services;

use App\\Models\\User;
use Bacon\\BaconQrCode\\Renderer\\ImageRenderer;
use Bacon\\BaconQrCode\\Renderer\\Image\\ImagickImageBackEnd;
use Bacon\\BaconQrCode\\Renderer\\RendererStyle\\RendererStyle;
use Bacon\\BaconQrCode\\Writer;
use PragmaRX\\\\Google2FA\\Google2FA;

/**
 * Two-Factor Authentication Service.
 *
 * Wraps TOTP secret generation, code verification, QR-code rendering, and
 * recovery-code generation/verification (bcrypt-hashed).
 *
 * Recovery codes are 10-char alphanumeric, 8 of them generated per enable/regen,
 * stored as a JSON array of bcrypt hashes on the user record.
 */
class TwoFactorService
{
    private const ENFORCED_ROLES = ['SUPER_ADMIN', 'ADMIN', 'CMD', 'CMA', 'AD', 'DFA'];
    private const ISSUER = 'FUTH Lafia HR';

    public function __construct(protected Google2FA $google2fa = new Google2FA()) {}

    /**
     * Begin 2FA setup: generate a new TOTP secret and QR code.
     * Returns ['secret', 'otpauthUrl', 'qrDataUrl'].
     * Does NOT enable 2FA yet — call enable() after the user verifies a code.
     */
    public function beginSetup(User $user): array
    {
        $secret = $this->google2fa->generateSecretKey();
        $otpauthUrl = $this->google2fa->getQRCodeUrl(self::ISSUER, $user->username, $secret);
        $qrDataUrl = $this->generateQrDataUrl($otpauthUrl);

        $user->twoFactorSecret = $secret;
        if ($this->isEnforced($user->role) && !$user->twoFactorEnforcedAt) {
            $user->twoFactorEnforcedAt = now();
        }
        $user->save();

        return [
            'secret' => $secret,
            'otpauthUrl' => $otpauthUrl,
            'qrDataUrl' => $qrDataUrl,
        ];
    }

    /**
     * Verify a 6-digit TOTP code against the stored secret.
     */
    public function verify(?string $secret, string $code): bool
    {
        if (!$secret || !$code) return false;
        return $this->google2fa->verifyKey($secret, $code, window: 1);
    }

    /**
     * Enable 2FA on the user. Generates 8 recovery codes (bcrypt-hashed),
     * stores them as JSON on the user record, returns the plain codes (once).
     */
    public function enable(User $user): array
    {
        $plain = [];
        $hashed = [];
        for ($i = 0; $i < 8; $i++) {
            $code = strtoupper(substr(bin2hex(random_bytes(5)), 0, 10));
            $plain[] = $code;
            $hashed[] = bcrypt($code);
        }
        $user->twoFactorEnabled = true;
        $user->twoFactorRecoveryCodes = json_encode($hashed);
        $user->twoFactorLastUsedAt = now();
        $user->save();
        return $plain;
    }

    /**
     * Disable 2FA: clear the secret, recovery codes, and the enabled flag.
     */
    public function disable(User $user): void
    {
        $user->twoFactorEnabled = false;
        $user->twoFactorSecret = null;
        $user->twoFactorRecoveryCodes = null;
        $user->twoFactorLastUsedAt = null;
        $user->save();
    }

    /**
     * Verify a recovery code against the user's stored hashes. If valid,
     * consume it (remove from the list) and return ['valid' => true, 'remaining' => N].
     */
    public function verifyRecovery(User $user, string $candidate): array
    {
        if (!$user->twoFactorRecoveryCodes) {
            return ['valid' => false, 'remaining' => 0];
        }
        $hashes = json_decode($user->twoFactorRecoveryCodes, true) ?: [];
        foreach ($hashes as $i => $hash) {
            if (Hash::check(strtoupper($candidate), $hash)) {
                array_splice($hashes, $i, 1);
                $user->twoFactorRecoveryCodes = json_encode(array_values($hashes));
                $user->save();
                return ['valid' => true, 'remaining' => count($hashes)];
            }
        }
        return ['valid' => false, 'remaining' => count($hashes)];
    }

    /**
     * Regenerate 8 new recovery codes; invalidate the old ones.
     */
    public function regenerateRecovery(User $user): array
    {
        return $this->enable($user);
    }

    /**
     * Check if 2FA is enforced for the given role.
     */
    public function isEnforced(string $role): bool
    {
        return in_array($role, self::ENFORCED_ROLES, true);
    }

    /**
     * Generate a PNG data URL QR code for the otpauth:// URL.
     */
    private function generateQrDataUrl(string $otpauthUrl): string
    {
        $renderer = new ImageRenderer(
            new RendererStyle(240),
            new ImagickImageBackEnd(),
        );
        $writer = new Writer($renderer);
        $png = $writer->writeString($otpauthUrl);
        return 'data:image/png;base64,' . base64_encode($png);
    }
}`

const composerJson = `{
    "name": "futh/lafia-pms",
    "type": "project",
    "description": "Federal University Teaching Hospital Lafia — Performance Management & Registry System",
    "keywords": ["futh","lafia","hr","pms","laravel"],
    "license": "MIT",
    "require": {
        "php": "^8.2",
        "laravel/framework": "^12.0",
        "laravel/tinker": "^2.9",
        "barryvdh/laravel-dompdf": "^3.0",
        "pragmarx/google2fa-laravel": "^4.0",
        "bacon/bacon-qr-code": "^3.0"
    },
    "require-dev": {
        "fakerphp/faker": "^1.23",
        "laravel/pint": "^1.13",
        "laravel/sail": "^1.36",
        "mockery/mockery": "^1.6",
        "nunomaduro/collision": "^8.0",
        "phpunit/phpunit": "^11.0"
    },
    "autoload": {
        "psr-4": {
            "App\\\\": "app/",
            "Database\\\\Factories\\\\": "database/factories/",
            "Database\\\\Seeders\\\\": "database/seeders/"
        }
    },
    "autoload-dev": {
        "psr-4": {
            "Tests\\\\": "tests/"
        }
    },
    "scripts": {
        "post-autoload-dump": [
            "Illuminate\\\\Foundation\\\\ComposerScripts::postAutoloadDump",
            "@php artisan package:discover --ansi"
        ],
        "post-update-cmd": [
            "@php artisan vendor:publish --tag=laravel-assets --ansi --force"
        ],
        "post-root-package-install": [
            "@php -r \\"file_exists('.env') || copy('.env.example', '.env');\\""
        ],
        "post-create-project-cmd": [
            "@php artisan key:generate --ansi"
        ]
    },
    "extra": {
        "laravel": {
            "dont-discover": []
        }
    },
    "config": {
        "optimize-autoloader": true,
        "preferred-install": "dist",
        "sort-packages": true,
        "allow-plugins": {
            "php-http/discovery": true
        }
    },
    "minimum-stability": "stable",
    "prefer-stable": true
}`

const envExample = `APP_NAME="FUTH Lafia PMS"
APP_ENV=local
APP_KEY=
APP_DEBUG=true
APP_TIMEZONE=Africa/Lagos
APP_URL=http://localhost

LOG_CHANNEL=stack
LOG_STACK=single
LOG_DEPRECATIONS_CHANNEL=null
LOG_EXCEPTIONS_CHANNEL=null
LOG_LEVEL=debug

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=futh_pms
DB_USERNAME=root
DB_PASSWORD=

SESSION_DRIVER=database
SESSION_LIFETIME=120
SESSION_ENCRYPT=false

QUEUE_CONNECTION=database

CACHE_STORE=database

FILESYSTEM_DISK=local

FUTH_INSTITUTION="Federal University Teaching Hospital, Lafia"
FUTH_SHORT_NAME="FUTH Lafia"
FUTH_TIMEZONE=Africa/Lagos

FILE_NUMBER_FORMAT="FUTH/REG/{TYPE}/{YEAR}/{SEQ:04d}"
REF_NUMBER_FORMAT="FUTH/REQ/{TYPE}/{YEAR}/{SEQ:04d}"
LEAVE_REF_FORMAT="LV-{YEAR}-{SEQ:06d}"

DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=admin123
`

const configPms = `<?php

return [
    'institution' => env('FUTH_INSTITUTION', 'Federal University Teaching Hospital, Lafia'),
    'short_name' => env('FUTH_SHORT_NAME', 'FUTH Lafia'),
    'timezone' => env('FUTH_TIMEZONE', 'Africa/Lagos'),

    'file_number_format' => env('FILE_NUMBER_FORMAT', 'FUTH/REG/{TYPE}/{YEAR}/{SEQ:04d}'),
    'ref_number_format' => env('REF_NUMBER_FORMAT', 'FUTH/REQ/{TYPE}/{YEAR}/{SEQ:04d}'),
    'leave_ref_format' => env('LEAVE_REF_FORMAT', 'LV-{YEAR}-{SEQ:06d}'),

    'verdict_thresholds' => [
        'Outstanding' => 90,
        'Excellent' => 80,
        'Very Good' => 70,
        'Good' => 60,
        'Satisfactory' => 50,
        'Poor' => 0,
    ],
];`

const readme = `# FUTH Lafia HR & Performance Management System — Laravel 12 Skeleton

This skeleton is generated automatically from the production **Next.js 16** application at \`/\` (the live, fully-working demo running at the preview URL above).

## Important

The **Next.js 16 + TypeScript** project (in this repo's parent directory) is the **full, working demo** that ships with all features (requisitions routing with multi-signature workflow, files routing with per-hop signatures, CMD mail, dashboard, appraisals, leaves, staff directory, signatures, file uploads, RBAC, committees, audit log, Excel exports, printable cover sheets, **two-factor authentication (TOTP)**, **My Pending Approvals dashboard widget**, **Promotions/Terminations/Resignations lifecycle with HOD→DFA→CMD approval workflow**, role-switching for users with multiple designations, etc.).

This **Laravel 12 + PHP 8.2** project is a **starter skeleton** generated from the same Prisma schema. It provides:

- 35+ Eloquent models matching the Prisma models (User, Role, Page, RolePagePermission, Committee, Staff, Designation, Department, NextOfKin, BankDetail, AcademicBackground, Dependant, Duty, AnnualReview, MonthlyAppraisal, QuarterlyReview, Assessment, Appraisal, Leave, LeaveType, Holiday, Requisition, RequisitionRoute, RequisitionComment, RequisitionAttachment, RegistryFile, FileRoute, FileAttachment, FileComment, MailMessage, Notification, AuditLog, **Promotion**, **Termination**, **Resignation**)
- Database migrations for MySQL 8 (run \`php artisan migrate\`)
- Controllers, middleware, and route stubs
- **RBAC middleware**: \`RoleMiddleware\` (role-gate) and \`PermissionMiddleware\` (page-permission-gate)
- **Two-Factor Authentication**: \`TwoFactorMiddleware\`, \`TwoFactorController\`, \`TwoFactorService\`
- Bootstrap 5 views (login, dashboard, staff, requisitions, 2FA setup, 2FA challenge) with the FUTH green/white theme
- Notification classes for the workflow events
- Composer.json with Laravel 12, PHP 8.2, dompdf, **pragmarx/google2fa-laravel**, **bacon/bacon-qr-code**, sail
- Configured for MySQL + \`Africa/Lagos\` timezone

## Role-Based Access Control (RBAC)

The system implements full RBAC with four tables:

| Table | Purpose |
| --- | --- |
| \`pages\` | The 16 navigable pages/modules (dashboard, requisitions, files, committees, staff, appraisals, leaves, promotions, terminations, resignations, designations, user-mgmt, mail, settings, cmd-dashboard, cmd-mail). |
| \`roles\` | The 11 system roles (SUPER_ADMIN, ADMIN, CMD, CMA, AD, DFA, HOD, HOU, APPRAISAL_OFFICER, REGISTRY_OFFICER, STAFF). |
| \`role_page_permissions\` | Junction table — for each (role, page) pair, holds four booleans: canView, canCreate, canEdit, canDelete. 113+ default entries seeded. |
| \`committees\` | The 8 institutional committees (TENDERS, DISCIPLINARY, PROMOTIONS, ETHICS, RESEARCH, AUDIT, GRIEVANCE, APPOINTMENTS). |

### Three middleware aliases are registered in \`bootstrap/app.php\`:

- \`role:ROLE1,ROLE2\` — Gate by role code. SUPER_ADMIN always bypasses.

        Route::middleware(['auth', 'role:CMD,SUPER_ADMIN'])->get('/cmd-dashboard', ...);

- \`permission:pageKey,action\` — Gate by per-page permission. \`action\` is one of \`view\`, \`create\`, \`edit\`, \`delete\`. SUPER_ADMIN always bypasses.

        Route::middleware(['auth', 'permission:requisitions,create'])->post('/requisitions', ...);

- \`2fa\` — Enforces two-factor authentication. Redirects users with executive roles (SUPER_ADMIN, ADMIN, CMD, CMA, AD, DFA) to \`/2fa-setup\` if they haven't enabled it. After login, all 2FA-enabled users are redirected to \`/2fa-challenge\` to verify their TOTP code before accessing protected routes.

### Usage in routes

See \`routes/web.php\` — the routes use the permission middleware to gate write actions (create/edit/delete) by page key. User management is gated by \`role:SUPER_ADMIN,ADMIN\`. HR lifecycle routes (promotions/terminations/resignations) are gated by their respective page-permission middleware.

### Seeding the RBAC tables

The MySQL dump (\`download/futh_pms_mysql_dump.sql\`) includes seed data for the \`pages\`, \`roles\`, \`role_page_permissions\`, and \`committees\` tables — import it to populate RBAC out of the box.

## Two-Factor Authentication (TOTP)

The system supports time-based one-time passwords (TOTP) for executive accounts.

### Endpoints (mounted under \`/api/auth/2fa/*\`):

| Endpoint | Method | Auth | Purpose |
| --- | --- | --- | --- |
| \`/api/auth/2fa/setup\` | POST | session or pre-auth | Generates a TOTP secret + QR data URL for the user. Stores the secret on the user record but does NOT enable 2FA yet. |
| \`/api/auth/2fa/enable\` | POST | session or pre-auth | Verifies a 6-digit code against the stored secret. On success, enables 2FA and generates 8 recovery codes (bcrypt-hashed, stored as JSON). Returns the plain recovery codes (shown once). |
| \`/api/auth/2fa/disable\` | POST | session | Requires the user's password. Disables 2FA (clears secret, recovery codes). |
| \`/api/auth/2fa/verify\` | POST | pre-auth | Verifies a 6-digit TOTP code OR a 10-char recovery code. Used as the second step of the login flow after password verification. On success, sets the session cookie + \`2fa.verified\` flag. |
| \`/api/auth/2fa/regenerate-recovery-codes\` | POST | session | Requires the user's password. Generates 8 new recovery codes and invalidates the old ones. |

### Enforcement

2FA is enforced for these roles (in \`TwoFactorService::ENFORCED_ROLES\`):
- SUPER_ADMIN, ADMIN, CMD, CMA, AD, DFA

When an enforced user logs in without 2FA enabled, the login endpoint returns \`{ twoFactorSetupRequired: true, userId }\` instead of setting the session cookie. The frontend then prompts them to set up 2FA before continuing.

### Recovery codes

8 single-use recovery codes are generated when 2FA is enabled. Each is a 10-char uppercase alphanumeric string, bcrypt-hashed, stored as a JSON array on \`users.twoFactorRecoveryCodes\`. The plain codes are returned to the user ONCE — they must save them somewhere safe. Each code can be verified once and is then consumed (removed from the array).

## Audit Logging

Every mutation across the system is logged in the \`audit_logs\` table. Audit actions include: \`create\`, \`update\`, \`delete\`, \`sign\`, \`approve\`, \`reject\`, \`forward\`, \`return\`, \`close\`, \`acknowledge\`, \`withdraw\`, \`archive\`, \`complete\`, \`cancel\`, \`login\`, \`logout\`, \`login_failed\`, \`role_switch\`, \`2fa_enable\`, \`2fa_disable\`, \`2fa_verify\`, \`permission_change\`, \`reset_password\`, \`upload\`.

Each log entry captures:
- \`userId\` — the acting user
- \`action\` — the action type
- \`entity\` — the entity type (User, Requisition, File, Leave, Promotion, etc.)
- \`entityId\` — the affected record ID
- \`details\` — human-readable description
- \`ipAddress\` — the request IP (best-effort from \`X-Forwarded-For\` / \`X-Real-IP\`)
- \`createdAt\` — timestamp

The \`AuditLog\` model is included in this skeleton, and the \`TwoFactorController\` demonstrates the pattern for writing audit entries (via \`AuditLog::create([...])\`).

## HR Lifecycle: Promotions, Terminations, Resignations

Three new modules follow a HOD → DFA → CMD approval workflow:

| Module | Table | Ref # format | Status flow |
| --- | --- | --- | --- |
| Promotions | \`promotions\` | PRM-2026-000001 | Submitted → HOD Approved → DFA Approved → CMD Approved (final) → Completed |
| Terminations | \`terminations\` | TRM-2026-000001 | Submitted → HOD Approved → DFA Approved → CMD Approved (final) → Completed |
| Resignations | \`resignations\` | RSG-2026-000001 | Submitted → HOD Acknowledged → DFA Approved → Accepted (CMD) → Completed |

Each module supports:
- Reject (with reason) — sends notification back to the creator
- Cancel — only the creator or admin (Promotion, Termination) / only the staff who submitted (Resignation)
- Withdraw — Resignations only (only the staff who created it, while status is Submitted or HOD Acknowledged)
- Exit interview fields: \`exitInterviewConducted\`, \`exitInterviewNotes\`, \`handoverCompleted\`, \`assetsReturned\`
- Final entitlements: \`finalSalary\`, \`gratuityAmount\`, \`pensionBalance\`, \`leaveEncashment\`
- Per-role signature capture (HOD/DFA/CMD): name, signature URL, remarks, signed-at

## Multi-signature workflow (Requisitions & Files)

The requisition routing system supports multi-signature approval:

- **Expense** requisitions require CMD + DFA signatures
- **Service** requisitions require CMD + DA (Departmental Administrator) signatures
- **HOD** signature is captured during the HOD step (before CMD)
- Each action creates a \`RequisitionRoute\` row with \`signerName\`, \`signerDesignation\`, \`signatureUrl\`, \`signedAt\`

Similarly, file routing captures per-hop signatures on \`FileRoute\` rows, plus closure signatures (CMD/DFA/HOD/Registry) on the \`RegistryFile\` itself when completed or archived.

## My Pending Approvals (Dashboard widget)

The dashboard aggregates pending items awaiting the current user's action across six entity types:
- Requisitions (where the user is the assignee or matches the target designation, not closed)
- Files (where the user is the current holder or matches the target designation, not archived)
- Leaves (Pending → HOD; HOD Approved → DFA; DFA Approved → CMD)
- Promotions (Submitted → HOD; HOD Approved → DFA; DFA Approved → CMD)
- Terminations (same as Promotions)
- Resignations (Submitted → HOD; HOD Acknowledged → DFA; DFA Approved → CMD)

Use \`GET /api/v1/dashboard/pending\` to retrieve the aggregated counts + a flat list of the most recent 10 pending items across all types. Apply scope filtering so users only see items in their role's scope (HOD sees only their dept's, STAFF sees only their own, etc.).

## Requirements

- PHP 8.2+
- Composer 2+
- MySQL 8+
- (Optional) Laravel Sail for Docker

## Setup

\`\`\`bash
composer install
cp .env.example .env
php artisan key:generate
# Create MySQL database: CREATE DATABASE futh_pms;
mysql -u root -p < download/futh_pms_mysql_dump.sql   # imports schema + seed data incl. RBAC tables
php artisan migrate                                   # or use the dump above
php artisan serve
# Open http://localhost:8000 → login: admin / admin123
\`\`\`

## Default credentials

- Username: \`admin\`
- Password: \`admin123\`

## Database dump

A full MySQL dump of the SQLite seed data is at \`download/futh_pms_mysql_dump.sql\`. Import it with:

\`\`\`bash
mysql -u root -p < download/futh_pms_mysql_dump.sql
\`\`\`

The dump includes:

- All 35 tables (users, staff, departments, designations, requisitions, files, leaves, appraisals, committees, **promotions**, **terminations**, **resignations**, audit_logs, pages, roles, role_page_permissions, etc.)
- Seed data for: 14 demo users (with secondary roles + 2FA columns), 8 departments, 9 designations, 10 staff records, 16 pages, 11 roles, 113+ role-page permissions, 8 committees, 1 sample Promotion, Termination, Resignation

## Routes

See \`routes/web.php\` for the full list of routes (web + API v1). All write routes are protected by the permission middleware.

## License

Internal FUTH Lafia use.
`

// ───────────────────────────────────────────────────────────
// Step 8 — Generate Laravel seeders
// ───────────────────────────────────────────────────────────

function genDatabaseSeeder(): string {
  return `<?php

namespace Database\\Seeders;

use Illuminate\\Database\\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            UserSeeder::class,
            DesignationSeeder::class,
            DepartmentSeeder::class,
            StaffSeeder::class,
            LeaveTypeSeeder::class,
            HolidaySeeder::class,
        ]);
    }
}`
}

const userSeeder = `<?php

namespace Database\\Seeders;

use App\\Models\\User;
use Illuminate\\Database\\Seeder;
use Illuminate\\Support\\Facades\\Hash;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        User::create([
            'username' => 'admin',
            'email' => 'admin@futhlafia.gov.ng',
            'passwordHash' => Hash::make('admin123'),
            'fullName' => 'System Admin',
            'role' => 'ADMIN',
            'isActive' => true,
        ]);
    }
}`

// ───────────────────────────────────────────────────────────
// Main
// ───────────────────────────────────────────────────────────

async function main() {
  const outDir = '/home/z/my-project/download'
  mkdirSync(outDir, { recursive: true })

  console.log('[1/3] Generating MySQL dump...')
  const sql = await generateMysqlDump()
  const sqlPath = join(outDir, 'futh_pms_mysql_dump.sql')
  writeFileSync(sqlPath, sql, 'utf8')
  console.log('  ✓', sqlPath, `(${sql.length} bytes)`)

  console.log('[2/3] Generating Laravel migrations zip...')
  const migDir = join(outDir, '_migrations_tmp')
  if (existsSync(migDir)) rmSync(migDir, { recursive: true, force: true })
  mkdirSync(migDir, { recursive: true })
  for (const m of models) {
    const fname = `${BASE_TS}_${m.table.startsWith('leave') ? m.table.replace('_', '') + '_table' : m.table.replace(/_/g, '_') + '_table'}`.replace(/_+/g, '_')
    // Use a clean name: replace all _table duplicates
    const cleanName = `${BASE_TS}_create_${m.table}_table`
    writeFileSync(join(migDir, cleanName + '.php'), genMigration(m), 'utf8')
  }
  // Also write migrations to the skeleton folder for the skeleton zip
  // (will be added below via the writes array)

  // Zip the migrations only
  const migZip = join(outDir, 'futh_laravel_migrations.zip')
  if (existsSync(migZip)) rmSync(migZip)
  execSync(`cd "${migDir}" && zip -r "${migZip}" .`, { stdio: 'inherit' })
  rmSync(migDir, { recursive: true, force: true })
  console.log('  ✓', migZip)

  console.log('[3/3] Generating Laravel 12 skeleton zip...')
  const skelDir = join(outDir, '_skeleton_tmp')
  // Re-create skeleton root
  if (existsSync(skelDir)) rmSync(skelDir, { recursive: true, force: true })
  mkdirSync(skelDir, { recursive: true })

  const writes: [string, string][] = [
    ['composer.json', composerJson],
    ['.env.example', envExample],
    ['README.md', readme],
    ['config/pms.php', configPms],
    ['routes/web.php', genRoutes()],
    ['app/Http/Middleware/RoleMiddleware.php', roleMiddleware],
    ['app/Http/Middleware/PermissionMiddleware.php', permissionMiddleware],
    ['app/Http/Middleware/TwoFactorMiddleware.php', twoFactorMiddleware],
    ['app/Http/Controllers/TwoFactorController.php', twoFactorController],
    ['app/Services/TwoFactorService.php', twoFactorService],
    ['database/seeders/DatabaseSeeder.php', genDatabaseSeeder()],
    ['database/seeders/UserSeeder.php', userSeeder],
    ['resources/views/layouts/app.blade.php', layoutBlade],
    ['resources/views/auth/login.blade.php', loginBlade],
    ['resources/views/dashboard.blade.php', dashboardBlade],
    ['resources/views/staff/index.blade.php', staffIndexBlade],
    ['resources/views/requisitions/index.blade.php', reqIndexBlade],
    ['resources/views/auth/2fa-setup.blade.php', twoFactorSetupBlade],
    ['resources/views/auth/2fa-challenge.blade.php', twoFactorChallengeBlade],
    ['bootstrap/app.php', genBootstrapApp()],
    ['artisan', genArtisan()],
    ['public/img/.gitkeep', ''],
  ]

  // Models
  for (const m of models) {
    writes.push([`app/Models/${m.className}.php`, genModel(m)])
  }

  // Migrations (inside skeleton)
  for (const m of models) {
    writes.push([`database/migrations/${BASE_TS}_create_${m.table}_table.php`, genMigration(m)])
  }

  // Controllers (using subset matching task)
  const controllers: [string, string][] = [
    ['AuthController', 'User'],
    ['DashboardController', 'User'],
    ['StaffController', 'Staff'],
    ['DesignationController', 'Designation'],
    ['DepartmentController', 'Department'],
    ['DutyController', 'Duty'],
    ['AnnualReviewController', 'AnnualReview'],
    ['MonthlyAppraisalController', 'MonthlyAppraisal'],
    ['QuarterlyReviewController', 'QuarterlyReview'],
    ['AssessmentController', 'Assessment'],
    ['AppraisalController', 'Appraisal'],
    ['LeaveController', 'Leave'],
    ['RequisitionController', 'Requisition'],
    ['FileController', 'RegistryFile'],
    ['MailController', 'MailMessage'],
    ['NotificationController', 'Notification'],
    ['UserController', 'User'],
    ['CommitteeController', 'Committee'],
    ['PromotionController', 'Promotion'],
    ['TerminationController', 'Termination'],
    ['ResignationController', 'Resignation'],
    ['SettingController', 'User'],
    ['ReportController', 'User'],
  ]
  for (const [name, model] of controllers) {
    writes.push([`app/Http/Controllers/${name}.php`, genController(name, model)])
  }

  // Notifications
  for (const n of notifications) {
    writes.push([`app/Notifications/${n.name}.php`, genNotification(n.name, n.msg)])
  }

  for (const [rel, content] of writes) {
    const full = join(skelDir, rel)
    mkdirSync(join(full, '..'), { recursive: true })
    writeFileSync(full, content, 'utf8')
  }

  const skelZip = join(outDir, 'futh_laravel_12_skeleton.zip')
  if (existsSync(skelZip)) rmSync(skelZip)
  execSync(`cd "${skelDir}" && zip -r "${skelZip}" .`, { stdio: 'inherit' })
  rmSync(skelDir, { recursive: true, force: true })
  console.log('  ✓', skelZip)

  // Disconnect prisma
  await db.$disconnect()
  console.log('\n✅ Export complete. Files in /home/z/my-project/download/:')
  console.log('  - futh_pms_mysql_dump.sql')
  console.log('  - futh_laravel_migrations.zip')
  console.log('  - futh_laravel_12_skeleton.zip')
}

function genRoutes(): string {
  return `<?php

use Illuminate\\Support\\Facades\\Route;
use App\\Http\\Controllers\\AuthController;
use App\\Http\\Controllers\\DashboardController;
use App\\Http\\Controllers\\StaffController;
use App\\Http\\Controllers\\DesignationController;
use App\\Http\\Controllers\\DepartmentController;
use App\\Http\\Controllers\\DutyController;
use App\\Http\\Controllers\\AnnualReviewController;
use App\\Http\\Controllers\\MonthlyAppraisalController;
use App\\Http\\Controllers\\QuarterlyReviewController;
use App\\Http\\Controllers\\AssessmentController;
use App\\Http\\Controllers\\AppraisalController;
use App\\Http\\Controllers\\LeaveController;
use App\\Http\\Controllers\\RequisitionController;
use App\\Http\\Controllers\\FileController;
use App\\Http\\Controllers\\MailController;
use App\\Http\\Controllers\\NotificationController;
use App\\Http\\Controllers\\UserController;
use App\\Http\\Controllers\\SettingController;
use App\\Http\\Controllers\\ReportController;
use App\\Http\\Controllers\\PromotionController;
use App\\Http\\Controllers\\TerminationController;
use App\\Http\\Controllers\\ResignationController;
use App\\Http\\Controllers\\TwoFactorController;

// Public auth routes
Route::get('/login', fn () => view('auth.login'))->name('login');
Route::post('/login', [AuthController::class, 'login']);
Route::post('/logout', [AuthController::class, 'logout'])->name('logout');

// 2FA setup + verification (some routes accessible pre-auth, some post-auth)
Route::get('/2fa-setup', [TwoFactorController::class, 'showSetup'])->name('2fa.setup');
Route::get('/2fa-challenge', [TwoFactorController::class, 'showChallenge'])->name('2fa.challenge');
Route::post('/api/auth/2fa/setup', [TwoFactorController::class, 'setup']);
Route::post('/api/auth/2fa/enable', [TwoFactorController::class, 'enable']);
Route::post('/api/auth/2fa/verify', [TwoFactorController::class, 'verify']);

// Authenticated + 2FA-protected routes
Route::middleware(['auth', '2fa'])->group(function () {
    Route::get('/', [DashboardController::class, 'index']);
    Route::get('/dashboard', [DashboardController::class, 'index']);

    // Staff directory — viewable by anyone, create/edit/delete restricted by permission
    Route::get('/staff', [StaffController::class, 'index']);
    Route::get('/staff/create', [StaffController::class, 'create'])->middleware('permission:staff,create');
    Route::post('/staff', [StaffController::class, 'store'])->middleware('permission:staff,create');
    Route::get('/staff/{id}', [StaffController::class, 'show']);
    Route::get('/staff/{id}/edit', [StaffController::class, 'edit'])->middleware('permission:staff,edit');
    Route::patch('/staff/{id}', [StaffController::class, 'update'])->middleware('permission:staff,edit');
    Route::delete('/staff/{id}', [StaffController::class, 'destroy'])->middleware('permission:staff,delete');

    Route::get('/departments', [DepartmentController::class, 'index']);
    Route::get('/designations', [DesignationController::class, 'index']);
    Route::get('/duties', [DutyController::class, 'index']);

    // Appraisals & reviews — viewable by all, manage gated
    Route::get('/annual-reviews', [AnnualReviewController::class, 'index']);
    Route::post('/annual-reviews', [AnnualReviewController::class, 'store'])->middleware('permission:appraisals,create');
    Route::get('/monthly-appraisals', [MonthlyAppraisalController::class, 'index']);
    Route::get('/quarterly-reviews', [QuarterlyReviewController::class, 'index']);
    Route::get('/assessments', [AssessmentController::class, 'index']);
    Route::get('/appraisals', [AppraisalController::class, 'index']);

    // Leaves
    Route::get('/leaves', [LeaveController::class, 'index']);
    Route::get('/leaves/create', [LeaveController::class, 'create']);
    Route::post('/leaves', [LeaveController::class, 'store']);
    Route::get('/leaves/{id}', [LeaveController::class, 'show']);
    Route::post('/leaves/{id}/action', [LeaveController::class, 'action']);

    // Requisitions
    Route::get('/requisitions', [RequisitionController::class, 'index']);
    Route::get('/requisitions/create', [RequisitionController::class, 'create']);
    Route::post('/requisitions', [RequisitionController::class, 'store']);
    Route::get('/requisitions/{id}', [RequisitionController::class, 'show']);
    Route::post('/requisitions/{id}/action', [RequisitionController::class, 'action']);

    // Registry files
    Route::get('/files', [FileController::class, 'index']);
    Route::get('/files/create', [FileController::class, 'create'])->middleware('permission:files,create');
    Route::post('/files', [FileController::class, 'store'])->middleware('permission:files,create');
    Route::get('/files/{id}', [FileController::class, 'show']);
    Route::post('/files/{id}/action', [FileController::class, 'action']);

    // Mail + notifications
    Route::get('/mail', [MailController::class, 'index']);
    Route::get('/notifications', [NotificationController::class, 'index']);

    // User management — only SUPER_ADMIN and ADMIN can view; CRUD further restricted
    Route::middleware('role:SUPER_ADMIN,ADMIN')->group(function () {
        Route::get('/users', [UserController::class, 'index']);
        Route::get('/users/create', [UserController::class, 'create']);
        Route::post('/users', [UserController::class, 'store']);
        Route::get('/users/{id}/edit', [UserController::class, 'edit']);
        Route::patch('/users/{id}', [UserController::class, 'update']);
        Route::delete('/users/{id}', [UserController::class, 'destroy']);
    });

    // Committees — visible to anyone with permission:committees,view
    Route::get('/committees', [CommitteeController::class, 'index'])->middleware('permission:committees,view');
    Route::post('/committees', [CommitteeController::class, 'store'])->middleware('permission:committees,create');
    Route::patch('/committees/{id}', [CommitteeController::class, 'update'])->middleware('permission:committees,edit');
    Route::delete('/committees/{id}', [CommitteeController::class, 'destroy'])->middleware('permission:committees,delete');

    // HR lifecycle — Promotions, Terminations, Resignations
    Route::get('/promotions', [PromotionController::class, 'index'])->middleware('permission:promotions,view');
    Route::get('/promotions/{id}', [PromotionController::class, 'show'])->middleware('permission:promotions,view');
    Route::post('/promotions', [PromotionController::class, 'store'])->middleware('permission:promotions,create');
    Route::patch('/promotions/{id}', [PromotionController::class, 'update'])->middleware('permission:promotions,edit');
    Route::post('/promotions/{id}/action', [PromotionController::class, 'action'])->middleware('permission:promotions,edit');

    Route::get('/terminations', [TerminationController::class, 'index'])->middleware('permission:terminations,view');
    Route::get('/terminations/{id}', [TerminationController::class, 'show'])->middleware('permission:terminations,view');
    Route::post('/terminations', [TerminationController::class, 'store'])->middleware('permission:terminations,create');
    Route::patch('/terminations/{id}', [TerminationController::class, 'update'])->middleware('permission:terminations,edit');
    Route::post('/terminations/{id}/action', [TerminationController::class, 'action'])->middleware('permission:terminations,edit');

    Route::get('/resignations', [ResignationController::class, 'index'])->middleware('permission:resignations,view');
    Route::get('/resignations/{id}', [ResignationController::class, 'show'])->middleware('permission:resignations,view');
    Route::post('/resignations', [ResignationController::class, 'store'])->middleware('permission:resignations,create');
    Route::patch('/resignations/{id}', [ResignationController::class, 'update'])->middleware('permission:resignations,edit');
    Route::post('/resignations/{id}/action', [ResignationController::class, 'action'])->middleware('permission:resignations,edit');

    // Profile + Settings
    Route::get('/settings', [SettingController::class, 'index']);
    Route::get('/reports', [ReportController::class, 'index']);
    Route::get('/profile', [UserController::class, 'profile']);

    // 2FA management (post-auth)
    Route::post('/api/auth/2fa/disable', [TwoFactorController::class, 'disable']);
    Route::post('/api/auth/2fa/regenerate-recovery-codes', [TwoFactorController::class, 'regenerateRecoveryCodes']);
});

// API v1 — protected by Sanctum + permission middleware
Route::prefix('api/v1')->middleware(['auth:sanctum'])->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::get('/dashboard_stats', [DashboardController::class, 'stats']);
    Route::get('/dashboard/pending', [DashboardController::class, 'pendingApprovals']);
    Route::apiResource('staff', StaffController::class);
    Route::apiResource('departments', DepartmentController::class);
    Route::apiResource('annual-reviews', AnnualReviewController::class);
    Route::apiResource('leaves', LeaveController::class);
    Route::apiResource('promotions', PromotionController::class);
    Route::apiResource('terminations', TerminationController::class);
    Route::apiResource('resignations', ResignationController::class);
});
`
}

function genBootstrapApp(): string {
  return `<?php

use Illuminate\\Foundation\\Application;
use Illuminate\\Foundation\\Config\\Exceptions;
use Illuminate\\Foundation\\Config\\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->alias([
            'role' => \\App\\Http\\Middleware\\RoleMiddleware::class,
            'permission' => \\App\\Http\\Middleware\\PermissionMiddleware::class,
            '2fa' => \\App\\Http\\Middleware\\TwoFactorMiddleware::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();`
}

function genArtisan(): string {
  return `#!/usr/bin/env php
<?php

use Illuminate\\Foundation\\Application;

define('LARAVEL_START', microtime(true));

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';

$status = $app->handle(Illuminate\\Http\\Request::capture());

$status->send();

$app->terminate();`
}

main().catch((e) => {
  console.error('Export failed:', e)
  process.exit(1)
})
