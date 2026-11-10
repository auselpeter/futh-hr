-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "avatarUrl" TEXT,
    "role" TEXT NOT NULL DEFAULT 'STAFF',
    "secondaryRoles" TEXT,
    "activeRoleOverride" TEXT,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "twoFactorRecoveryCodes" TEXT,
    "twoFactorEnforcedAt" DATETIME,
    "twoFactorLastUsedAt" DATETIME,
    "staffId" TEXT,
    "designationId" TEXT,
    "departmentId" TEXT,
    "unitId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "Designation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Page" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "category" TEXT NOT NULL DEFAULT 'Main',
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rank" INTEGER NOT NULL DEFAULT 100,
    "level" TEXT NOT NULL DEFAULT 'staff',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RolePagePermission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roleId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "canView" BOOLEAN NOT NULL DEFAULT true,
    "canCreate" BOOLEAN NOT NULL DEFAULT false,
    "canEdit" BOOLEAN NOT NULL DEFAULT false,
    "canDelete" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RolePagePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RolePagePermission_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RolePagePermission_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "faculty" TEXT,
    "hodUserId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Department_hodUserId_fkey" FOREIGN KEY ("hodUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "departmentId" TEXT NOT NULL,
    "houUserId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Unit_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Unit_houUserId_fkey" FOREIGN KEY ("houUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Designation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rank" INTEGER NOT NULL DEFAULT 100,
    "level" TEXT NOT NULL DEFAULT 'staff',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "departmentId" TEXT,
    CONSTRAINT "Designation_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "ippisNumber" TEXT,
    "surname" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "otherNames" TEXT,
    "fullName" TEXT NOT NULL,
    "gender" TEXT,
    "dateOfBirth" DATETIME,
    "maritalStatus" TEXT,
    "nationality" TEXT DEFAULT 'Nigerian',
    "stateOfOrigin" TEXT,
    "lga" TEXT,
    "religion" TEXT,
    "ninNumber" TEXT,
    "tinNumber" TEXT,
    "pensionNumber" TEXT,
    "nhfNumber" TEXT,
    "nhisNumber" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "altPhone" TEXT,
    "position" TEXT,
    "rank" TEXT,
    "employmentType" TEXT DEFAULT 'permanent',
    "fileNumber" TEXT,
    "gradeLevel" TEXT,
    "step" TEXT,
    "cadre" TEXT,
    "dateHired" DATETIME,
    "confirmationDate" DATETIME,
    "retirementDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'active',
    "avatarUrl" TEXT,
    "signatureUrl" TEXT,
    "thumbprintUrl" TEXT,
    "pictureUrl" TEXT,
    "residentialAddress" TEXT,
    "permanentAddress" TEXT,
    "cityOfResidence" TEXT,
    "stateOfResidence" TEXT,
    "departmentId" TEXT,
    "unitId" TEXT,
    "designationId" TEXT,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Staff_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Staff_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Staff_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "Designation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NextOfKin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "relationship" TEXT,
    "gender" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "occupation" TEXT,
    "employerName" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NextOfKin_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BankDetail" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountType" TEXT DEFAULT 'Savings',
    "branch" TEXT,
    "sortCode" TEXT,
    "bvnNumber" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BankDetail_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AcademicBackground" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "qualification" TEXT,
    "field" TEXT,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "grade" TEXT,
    "certificateUrl" TEXT,
    "certificateNumber" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AcademicBackground_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Dependant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "relationship" TEXT,
    "dateOfBirth" DATETIME,
    "gender" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Dependant_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Duty" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'Primary',
    "order" INTEGER NOT NULL DEFAULT 1,
    "startDate" DATETIME,
    "dueDate" DATETIME,
    "completedAt" DATETIME,
    "durationDays" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'Assigned',
    "evidenceUrl" TEXT,
    "evidenceFileName" TEXT,
    "evidenceNotes" TEXT,
    "evidenceUploadedAt" DATETIME,
    "targetScore" REAL NOT NULL DEFAULT 100,
    "achievedScore" REAL,
    "grade" TEXT,
    "rating" TEXT,
    "scoreNotes" TEXT,
    "reviewedById" TEXT,
    "reviewedByName" TEXT,
    "reviewedAt" DATETIME,
    "reviewRemarks" TEXT,
    "weight" REAL NOT NULL DEFAULT 1,
    "period" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Duty_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AnnualReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "overallScore" REAL NOT NULL DEFAULT 0,
    "assessmentScore" REAL NOT NULL DEFAULT 0,
    "monthlyScore" REAL NOT NULL DEFAULT 0,
    "quarterlyScore" REAL NOT NULL DEFAULT 0,
    "appraisalScore" REAL NOT NULL DEFAULT 0,
    "dutyScore" REAL NOT NULL DEFAULT 0,
    "verdict" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "comments" TEXT,
    "hodName" TEXT,
    "hodSignatureUrl" TEXT,
    "hodSignedAt" DATETIME,
    "daName" TEXT,
    "daSignatureUrl" TEXT,
    "daSignedAt" DATETIME,
    "annualReviewDuties" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AnnualReview_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MonthlyAppraisal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "score" REAL NOT NULL DEFAULT 0,
    "grade" TEXT,
    "achievements" TEXT,
    "challenges" TEXT,
    "recommendations" TEXT,
    "comments" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "hodRemarks" TEXT,
    "houRemarks" TEXT,
    "hodName" TEXT,
    "hodSignedAt" DATETIME,
    "houName" TEXT,
    "houSignedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MonthlyAppraisal_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuarterlyReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "quarter" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "averageScore" REAL NOT NULL DEFAULT 0,
    "grade" TEXT,
    "summary" TEXT,
    "comments" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QuarterlyReview_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "knowledgeScore" REAL NOT NULL DEFAULT 0,
    "skillsScore" REAL NOT NULL DEFAULT 0,
    "attitudeScore" REAL NOT NULL DEFAULT 0,
    "communicationScore" REAL NOT NULL DEFAULT 0,
    "totalScore" REAL NOT NULL DEFAULT 0,
    "grade" TEXT,
    "assessedById" TEXT,
    "remarks" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Assessment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Appraisal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "performanceScore" REAL NOT NULL DEFAULT 0,
    "achievementScore" REAL NOT NULL DEFAULT 0,
    "competencyScore" REAL NOT NULL DEFAULT 0,
    "totalScore" REAL NOT NULL DEFAULT 0,
    "grade" TEXT,
    "appraisedById" TEXT,
    "remarks" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Appraisal_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LeaveType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "defaultDays" INTEGER NOT NULL DEFAULT 0,
    "isPaid" BOOLEAN NOT NULL DEFAULT true,
    "requiresCertificate" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Leave" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "refNumber" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "daysRequested" INTEGER NOT NULL,
    "daysApproved" INTEGER,
    "reason" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "certificateUrl" TEXT,
    "currentStage" TEXT NOT NULL DEFAULT 'Submitted',
    "currentHolderId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "state" TEXT NOT NULL DEFAULT 'open',
    "hodId" TEXT,
    "hodName" TEXT,
    "hodRemarks" TEXT,
    "hodSignedAt" DATETIME,
    "houId" TEXT,
    "houName" TEXT,
    "houRemarks" TEXT,
    "houSignedAt" DATETIME,
    "registryId" TEXT,
    "registryName" TEXT,
    "registryRemarks" TEXT,
    "registryReceivedAt" DATETIME,
    "dfaId" TEXT,
    "dfaName" TEXT,
    "dfaRemarks" TEXT,
    "dfaSignedAt" DATETIME,
    "cmdId" TEXT,
    "cmdName" TEXT,
    "cmdRemarks" TEXT,
    "cmdSignedAt" DATETIME,
    "rejectedById" TEXT,
    "rejectedAt" DATETIME,
    "rejectReason" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Leave_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Leave_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Leave_currentHolderId_fkey" FOREIGN KEY ("currentHolderId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LeaveRoute" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leaveId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT,
    "stage" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "remarks" TEXT,
    "signerName" TEXT,
    "signerDesignation" TEXT,
    "signatureUrl" TEXT,
    "signedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeaveRoute_leaveId_fkey" FOREIGN KEY ("leaveId") REFERENCES "Leave" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LeaveRoute_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LeaveRoute_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "date" DATETIME NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'public',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "refNumber" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "currentPosition" TEXT,
    "currentRank" TEXT,
    "currentSalary" REAL,
    "newPosition" TEXT,
    "newRank" TEXT,
    "newSalary" REAL,
    "newDepartmentId" TEXT,
    "newDesignationId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'promotion',
    "effectiveDate" DATETIME NOT NULL,
    "reason" TEXT,
    "justification" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Submitted',
    "state" TEXT NOT NULL DEFAULT 'open',
    "hodId" TEXT,
    "hodName" TEXT,
    "hodSignatureUrl" TEXT,
    "hodRemarks" TEXT,
    "hodSignedAt" DATETIME,
    "dfaId" TEXT,
    "dfaName" TEXT,
    "dfaSignatureUrl" TEXT,
    "dfaRemarks" TEXT,
    "dfaSignedAt" DATETIME,
    "cmdId" TEXT,
    "cmdName" TEXT,
    "cmdSignatureUrl" TEXT,
    "cmdRemarks" TEXT,
    "cmdSignedAt" DATETIME,
    "rejectedById" TEXT,
    "rejectedAt" DATETIME,
    "rejectReason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Promotion_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Termination" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "refNumber" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'termination',
    "reason" TEXT NOT NULL,
    "detailedReason" TEXT,
    "noticeDate" DATETIME,
    "effectiveDate" DATETIME NOT NULL,
    "lastWorkingDate" DATETIME,
    "exitInterviewConducted" BOOLEAN NOT NULL DEFAULT false,
    "exitInterviewNotes" TEXT,
    "handoverCompleted" BOOLEAN NOT NULL DEFAULT false,
    "assetsReturned" BOOLEAN NOT NULL DEFAULT false,
    "clearanceFormUrl" TEXT,
    "finalSalary" REAL,
    "gratuityAmount" REAL,
    "pensionBalance" REAL,
    "leaveEncashment" REAL,
    "status" TEXT NOT NULL DEFAULT 'Submitted',
    "state" TEXT NOT NULL DEFAULT 'open',
    "hodId" TEXT,
    "hodName" TEXT,
    "hodSignatureUrl" TEXT,
    "hodRemarks" TEXT,
    "hodSignedAt" DATETIME,
    "dfaId" TEXT,
    "dfaName" TEXT,
    "dfaSignatureUrl" TEXT,
    "dfaRemarks" TEXT,
    "dfaSignedAt" DATETIME,
    "cmdId" TEXT,
    "cmdName" TEXT,
    "cmdSignatureUrl" TEXT,
    "cmdRemarks" TEXT,
    "cmdSignedAt" DATETIME,
    "rejectedById" TEXT,
    "rejectedAt" DATETIME,
    "rejectReason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Termination_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Resignation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "refNumber" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "detailedReason" TEXT,
    "resignationDate" DATETIME NOT NULL,
    "noticeDate" DATETIME,
    "effectiveDate" DATETIME NOT NULL,
    "lastWorkingDate" DATETIME,
    "isWithdrawn" BOOLEAN NOT NULL DEFAULT false,
    "withdrawnAt" DATETIME,
    "withdrawnById" TEXT,
    "exitInterviewConducted" BOOLEAN NOT NULL DEFAULT false,
    "exitInterviewNotes" TEXT,
    "handoverCompleted" BOOLEAN NOT NULL DEFAULT false,
    "assetsReturned" BOOLEAN NOT NULL DEFAULT false,
    "clearanceFormUrl" TEXT,
    "finalSalary" REAL,
    "gratuityAmount" REAL,
    "pensionBalance" REAL,
    "leaveEncashment" REAL,
    "status" TEXT NOT NULL DEFAULT 'Submitted',
    "state" TEXT NOT NULL DEFAULT 'open',
    "hodId" TEXT,
    "hodName" TEXT,
    "hodSignatureUrl" TEXT,
    "hodRemarks" TEXT,
    "hodSignedAt" DATETIME,
    "dfaId" TEXT,
    "dfaName" TEXT,
    "dfaSignatureUrl" TEXT,
    "dfaRemarks" TEXT,
    "dfaSignedAt" DATETIME,
    "cmdId" TEXT,
    "cmdName" TEXT,
    "cmdSignatureUrl" TEXT,
    "cmdRemarks" TEXT,
    "cmdSignedAt" DATETIME,
    "rejectedById" TEXT,
    "rejectedAt" DATETIME,
    "rejectReason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Resignation_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Retirement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "refNumber" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'compulsory',
    "reason" TEXT,
    "detailedReason" TEXT,
    "dateOfBirth" DATETIME,
    "retirementDate" DATETIME NOT NULL,
    "lastWorkingDate" DATETIME,
    "yearsOfService" INTEGER,
    "dateOfFirstAppointment" DATETIME,
    "currentSalaryAtRetirement" REAL,
    "gradeLevelAtRetirement" TEXT,
    "gratuityAmount" REAL,
    "pensionBalance" REAL,
    "leaveEncashment" REAL,
    "pensionAdministrator" TEXT,
    "pensionPin" TEXT,
    "nhfRefundAmount" REAL,
    "nhisRefundAmount" REAL,
    "exitInterviewConducted" BOOLEAN NOT NULL DEFAULT false,
    "exitInterviewNotes" TEXT,
    "handoverCompleted" BOOLEAN NOT NULL DEFAULT false,
    "assetsReturned" BOOLEAN NOT NULL DEFAULT false,
    "clearanceFormUrl" TEXT,
    "certificateOfService" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Submitted',
    "state" TEXT NOT NULL DEFAULT 'open',
    "hodId" TEXT,
    "hodName" TEXT,
    "hodSignatureUrl" TEXT,
    "hodRemarks" TEXT,
    "hodSignedAt" DATETIME,
    "dfaId" TEXT,
    "dfaName" TEXT,
    "dfaSignatureUrl" TEXT,
    "dfaRemarks" TEXT,
    "dfaSignedAt" DATETIME,
    "cmdId" TEXT,
    "cmdName" TEXT,
    "cmdSignatureUrl" TEXT,
    "cmdRemarks" TEXT,
    "cmdSignedAt" DATETIME,
    "rejectedById" TEXT,
    "rejectedAt" DATETIME,
    "rejectReason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Retirement_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Training" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'workshop',
    "category" TEXT,
    "provider" TEXT,
    "facilitator" TEXT,
    "location" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'physical',
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "durationHours" INTEGER,
    "cost" REAL,
    "fundingSource" TEXT,
    "targetDesignationId" TEXT,
    "targetDepartmentId" TEXT,
    "departmentId" TEXT,
    "maxParticipants" INTEGER,
    "certificateTemplateUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Training_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrainingEnrollment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trainingId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Enrolled',
    "enrolledAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attendedAt" DATETIME,
    "completedAt" DATETIME,
    "attendanceRate" REAL,
    "score" REAL,
    "grade" TEXT,
    "certificateUrl" TEXT,
    "feedbackNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TrainingEnrollment_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "Training" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TrainingEnrollment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'institutional',
    "category" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'Normal',
    "sponsorId" TEXT,
    "departmentId" TEXT,
    "unitId" TEXT,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "actualEndDate" DATETIME,
    "durationDays" INTEGER,
    "budget" REAL,
    "spent" REAL NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "fundingSource" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Planned',
    "state" TEXT NOT NULL DEFAULT 'open',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Project_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'Member',
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" DATETIME,
    "contribution" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectMember_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectMilestone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "weight" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectMilestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PaymentVoucher" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "refNumber" TEXT NOT NULL,
    "requisitionId" TEXT,
    "pvType" TEXT NOT NULL DEFAULT 'treasury_f1',
    "voteNumber" TEXT,
    "subHead" TEXT,
    "voucherNumber" TEXT,
    "classificationCode" TEXT,
    "departmentalNumber" TEXT,
    "payeeName" TEXT NOT NULL,
    "payeeAddress" TEXT,
    "payeePhone" TEXT,
    "payeeAccountNumber" TEXT,
    "payeeBankName" TEXT,
    "chequeNumber" TEXT,
    "amountNaira" INTEGER NOT NULL DEFAULT 0,
    "amountKobo" INTEGER NOT NULL DEFAULT 0,
    "amountInWords" TEXT,
    "lineItems" TEXT,
    "payableAt" TEXT,
    "paymentStation" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "state" TEXT NOT NULL DEFAULT 'open',
    "deskOfficerId" TEXT,
    "deskOfficerName" TEXT,
    "deskOfficerSignatureUrl" TEXT,
    "deskOfficerRemarks" TEXT,
    "raisedAt" DATETIME,
    "auditOfficerId" TEXT,
    "auditOfficerName" TEXT,
    "auditComments" TEXT,
    "auditSignatureUrl" TEXT,
    "auditReviewedAt" DATETIME,
    "auditApprovedAt" DATETIME,
    "queryText" TEXT,
    "queryRaisedAt" DATETIME,
    "queryRaisedById" TEXT,
    "initiatorResponse" TEXT,
    "initiatorRespondedAt" DATETIME,
    "initiatorRespondedById" TEXT,
    "oceName" TEXT,
    "oceSignatureUrl" TEXT,
    "oceSignedAt" DATETIME,
    "oceRemarks" TEXT,
    "payingOfficerId" TEXT,
    "payingOfficerName" TEXT,
    "payingOfficerSignatureUrl" TEXT,
    "paymentAuthorizedAt" DATETIME,
    "paidAt" DATETIME,
    "paidBy" TEXT,
    "dfaApprovedPV" BOOLEAN NOT NULL DEFAULT false,
    "dfaApprovedAt" DATETIME,
    "dfaRemarks" TEXT,
    "cmdApprovedPV" BOOLEAN NOT NULL DEFAULT false,
    "cmdApprovedAt" DATETIME,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PaymentVoucher_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "Requisition" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PVComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pvId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'comment',
    "body" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PVComment_pvId_fkey" FOREIGN KEY ("pvId") REFERENCES "PaymentVoucher" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PVComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PVAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pvId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "uploadedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PVAttachment_pvId_fkey" FOREIGN KEY ("pvId") REFERENCES "PaymentVoucher" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReportTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "accessLevel" TEXT NOT NULL DEFAULT 'management',
    "module" TEXT NOT NULL DEFAULT 'staff',
    "format" TEXT NOT NULL DEFAULT 'both',
    "icon" TEXT,
    "hasDateRange" BOOLEAN NOT NULL DEFAULT true,
    "hasDeptFilter" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "GeneratedReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "departmentId" TEXT,
    "filters" TEXT,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT,
    "data" TEXT,
    "generatedById" TEXT NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GeneratedReport_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ReportTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PostingTransfer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "refNumber" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'posting',
    "fromDepartmentId" TEXT,
    "fromUnitId" TEXT,
    "fromPosition" TEXT,
    "fromDesignationId" TEXT,
    "toDepartmentId" TEXT,
    "toUnitId" TEXT,
    "toPosition" TEXT,
    "toDesignationId" TEXT,
    "reason" TEXT NOT NULL,
    "detailedReason" TEXT,
    "effectiveDate" DATETIME NOT NULL,
    "reportDeadline" DATETIME,
    "handoverDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'Submitted',
    "state" TEXT NOT NULL DEFAULT 'open',
    "planningReviewedById" TEXT,
    "planningReviewedAt" DATETIME,
    "planningRemarks" TEXT,
    "hodId" TEXT,
    "hodName" TEXT,
    "hodSignatureUrl" TEXT,
    "hodRemarks" TEXT,
    "hodSignedAt" DATETIME,
    "dfaId" TEXT,
    "dfaName" TEXT,
    "dfaSignatureUrl" TEXT,
    "dfaRemarks" TEXT,
    "dfaSignedAt" DATETIME,
    "cmdId" TEXT,
    "cmdName" TEXT,
    "cmdSignatureUrl" TEXT,
    "cmdRemarks" TEXT,
    "cmdSignedAt" DATETIME,
    "rejectedById" TEXT,
    "rejectedAt" DATETIME,
    "rejectReason" TEXT,
    "postingLetterUrl" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PostingTransfer_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PostingTransfer_toDepartmentId_fkey" FOREIGN KEY ("toDepartmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PostingTransfer_toUnitId_fkey" FOREIGN KEY ("toUnitId") REFERENCES "Unit" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PostingTransfer_toDesignationId_fkey" FOREIGN KEY ("toDesignationId") REFERENCES "Designation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Requisition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "refNumber" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "comment" TEXT,
    "amount" REAL,
    "priority" TEXT NOT NULL DEFAULT 'Normal',
    "status" TEXT NOT NULL DEFAULT 'Submitted',
    "state" TEXT NOT NULL DEFAULT 'open',
    "createdById" TEXT NOT NULL,
    "assigneeId" TEXT,
    "targetUserId" TEXT,
    "targetDesignationId" TEXT,
    "targetDepartmentId" TEXT,
    "departmentId" TEXT,
    "closedAt" DATETIME,
    "closedById" TEXT,
    "closureNote" TEXT,
    "cmdId" TEXT,
    "cmdName" TEXT,
    "cmdSignatureUrl" TEXT,
    "cmdRemarks" TEXT,
    "cmdSignedAt" DATETIME,
    "dfaId" TEXT,
    "dfaName" TEXT,
    "dfaSignatureUrl" TEXT,
    "dfaRemarks" TEXT,
    "dfaSignedAt" DATETIME,
    "daId" TEXT,
    "daName" TEXT,
    "daSignatureUrl" TEXT,
    "daRemarks" TEXT,
    "daSignedAt" DATETIME,
    "hodId" TEXT,
    "hodName" TEXT,
    "hodSignatureUrl" TEXT,
    "hodRemarks" TEXT,
    "hodSignedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Requisition_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Requisition_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Requisition_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Requisition_targetDesignationId_fkey" FOREIGN KEY ("targetDesignationId") REFERENCES "Designation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Requisition_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Requisition_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RequisitionRoute" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requisitionId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT,
    "toDesignationId" TEXT,
    "toDepartmentId" TEXT,
    "action" TEXT NOT NULL,
    "remarks" TEXT,
    "acknowledgedAt" DATETIME,
    "signerName" TEXT,
    "signerDesignation" TEXT,
    "signatureUrl" TEXT,
    "signedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RequisitionRoute_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "Requisition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RequisitionRoute_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RequisitionRoute_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RequisitionRoute_toDesignationId_fkey" FOREIGN KEY ("toDesignationId") REFERENCES "Designation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RequisitionComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requisitionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RequisitionComment_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "Requisition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RequisitionComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RequisitionAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requisitionId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "uploadedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RequisitionAttachment_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "Requisition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RegistryFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileNumber" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'Normal',
    "volume" TEXT,
    "createdById" TEXT NOT NULL,
    "currentHolderId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "state" TEXT NOT NULL DEFAULT 'open',
    "staffId" TEXT,
    "departmentId" TEXT,
    "externalName" TEXT,
    "externalOrg" TEXT,
    "externalEmail" TEXT,
    "externalPhone" TEXT,
    "committeeId" TEXT,
    "targetUserId" TEXT,
    "targetDesignationId" TEXT,
    "targetDepartmentId" TEXT,
    "cmdSignatureUrl" TEXT,
    "cmdSignedAt" DATETIME,
    "dfaSignatureUrl" TEXT,
    "dfaSignedAt" DATETIME,
    "hodSignatureUrl" TEXT,
    "hodSignedAt" DATETIME,
    "registrySignatureUrl" TEXT,
    "registrySignedAt" DATETIME,
    "closedAt" DATETIME,
    "closedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RegistryFile_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RegistryFile_currentHolderId_fkey" FOREIGN KEY ("currentHolderId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RegistryFile_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RegistryFile_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "Committee" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RegistryFile_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RegistryFile_targetDesignationId_fkey" FOREIGN KEY ("targetDesignationId") REFERENCES "Designation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Committee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "chairpersonId" TEXT,
    "secretaryId" TEXT,
    "members" TEXT,
    "termOfReference" TEXT,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "budget" REAL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Committee_chairpersonId_fkey" FOREIGN KEY ("chairpersonId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Committee_secretaryId_fkey" FOREIGN KEY ("secretaryId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CommitteeMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "committeeId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "addedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CommitteeMember_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "Committee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommitteeMember_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommitteeMember_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PasswordResetRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "usernameQuery" TEXT NOT NULL,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "resolvedById" TEXT,
    "resolvedAt" DATETIME,
    "resolvedNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PasswordResetRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PasswordResetRequest_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FileRoute" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT,
    "toDesignationId" TEXT,
    "toDepartmentId" TEXT,
    "action" TEXT NOT NULL,
    "remarks" TEXT,
    "acknowledgedAt" DATETIME,
    "signerName" TEXT,
    "signerDesignation" TEXT,
    "signatureUrl" TEXT,
    "signedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FileRoute_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "RegistryFile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FileRoute_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FileRoute_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FileRoute_toDesignationId_fkey" FOREIGN KEY ("toDesignationId") REFERENCES "Designation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FileAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "uploadedById" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FileAttachment_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "RegistryFile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FileComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FileComment_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "RegistryFile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FileComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MailMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "requisitionId" TEXT,
    "fileId" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'Normal',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "isStarred" BOOLEAN NOT NULL DEFAULT false,
    "readAt" DATETIME,
    "archivedAt" DATETIME,
    "parentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MailMessage_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MailMessage_toId_fkey" FOREIGN KEY ("toId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MailMessage_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "MailMessage" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'info',
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entityId" TEXT,
    "details" TEXT,
    "ipAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "staffId" TEXT,
    "committeeId" TEXT,
    "uploadedById" TEXT NOT NULL,
    "documentDate" DATETIME,
    "tags" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Document_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Document_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "Committee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_staffId_key" ON "User"("staffId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Page_key_key" ON "Page"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

-- CreateIndex
CREATE INDEX "RolePagePermission_roleId_idx" ON "RolePagePermission"("roleId");

-- CreateIndex
CREATE INDEX "RolePagePermission_pageId_idx" ON "RolePagePermission"("pageId");

-- CreateIndex
CREATE UNIQUE INDEX "RolePagePermission_roleId_pageId_key" ON "RolePagePermission"("roleId", "pageId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Department_hodUserId_key" ON "Department"("hodUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_code_key" ON "Unit"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_houUserId_key" ON "Unit"("houUserId");

-- CreateIndex
CREATE INDEX "Unit_departmentId_idx" ON "Unit"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Designation_code_key" ON "Designation"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_staffId_key" ON "Staff"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_userId_key" ON "Staff"("userId");

-- CreateIndex
CREATE INDEX "Staff_departmentId_idx" ON "Staff"("departmentId");

-- CreateIndex
CREATE INDEX "Staff_status_idx" ON "Staff"("status");

-- CreateIndex
CREATE INDEX "Staff_ninNumber_idx" ON "Staff"("ninNumber");

-- CreateIndex
CREATE INDEX "Staff_pensionNumber_idx" ON "Staff"("pensionNumber");

-- CreateIndex
CREATE INDEX "NextOfKin_staffId_idx" ON "NextOfKin"("staffId");

-- CreateIndex
CREATE INDEX "BankDetail_staffId_idx" ON "BankDetail"("staffId");

-- CreateIndex
CREATE INDEX "AcademicBackground_staffId_idx" ON "AcademicBackground"("staffId");

-- CreateIndex
CREATE INDEX "Dependant_staffId_idx" ON "Dependant"("staffId");

-- CreateIndex
CREATE INDEX "Duty_staffId_idx" ON "Duty"("staffId");

-- CreateIndex
CREATE INDEX "Duty_status_idx" ON "Duty"("status");

-- CreateIndex
CREATE INDEX "Duty_reviewedById_idx" ON "Duty"("reviewedById");

-- CreateIndex
CREATE INDEX "Duty_period_idx" ON "Duty"("period");

-- CreateIndex
CREATE INDEX "AnnualReview_staffId_idx" ON "AnnualReview"("staffId");

-- CreateIndex
CREATE INDEX "AnnualReview_period_idx" ON "AnnualReview"("period");

-- CreateIndex
CREATE INDEX "MonthlyAppraisal_staffId_idx" ON "MonthlyAppraisal"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyAppraisal_staffId_year_month_key" ON "MonthlyAppraisal"("staffId", "year", "month");

-- CreateIndex
CREATE INDEX "QuarterlyReview_staffId_idx" ON "QuarterlyReview"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "QuarterlyReview_staffId_year_quarter_key" ON "QuarterlyReview"("staffId", "year", "quarter");

-- CreateIndex
CREATE INDEX "Assessment_staffId_idx" ON "Assessment"("staffId");

-- CreateIndex
CREATE INDEX "Appraisal_staffId_idx" ON "Appraisal"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveType_code_key" ON "LeaveType"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Leave_refNumber_key" ON "Leave"("refNumber");

-- CreateIndex
CREATE INDEX "Leave_staffId_idx" ON "Leave"("staffId");

-- CreateIndex
CREATE INDEX "Leave_status_idx" ON "Leave"("status");

-- CreateIndex
CREATE INDEX "Leave_currentStage_idx" ON "Leave"("currentStage");

-- CreateIndex
CREATE INDEX "Leave_currentHolderId_idx" ON "Leave"("currentHolderId");

-- CreateIndex
CREATE INDEX "LeaveRoute_leaveId_idx" ON "LeaveRoute"("leaveId");

-- CreateIndex
CREATE INDEX "LeaveRoute_toUserId_idx" ON "LeaveRoute"("toUserId");

-- CreateIndex
CREATE INDEX "LeaveRoute_fromUserId_idx" ON "LeaveRoute"("fromUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Promotion_refNumber_key" ON "Promotion"("refNumber");

-- CreateIndex
CREATE INDEX "Promotion_staffId_idx" ON "Promotion"("staffId");

-- CreateIndex
CREATE INDEX "Promotion_status_idx" ON "Promotion"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Termination_refNumber_key" ON "Termination"("refNumber");

-- CreateIndex
CREATE INDEX "Termination_staffId_idx" ON "Termination"("staffId");

-- CreateIndex
CREATE INDEX "Termination_status_idx" ON "Termination"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Resignation_refNumber_key" ON "Resignation"("refNumber");

-- CreateIndex
CREATE INDEX "Resignation_staffId_idx" ON "Resignation"("staffId");

-- CreateIndex
CREATE INDEX "Resignation_status_idx" ON "Resignation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Retirement_refNumber_key" ON "Retirement"("refNumber");

-- CreateIndex
CREATE INDEX "Retirement_staffId_idx" ON "Retirement"("staffId");

-- CreateIndex
CREATE INDEX "Retirement_status_idx" ON "Retirement"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Training_code_key" ON "Training"("code");

-- CreateIndex
CREATE INDEX "Training_departmentId_idx" ON "Training"("departmentId");

-- CreateIndex
CREATE INDEX "Training_status_idx" ON "Training"("status");

-- CreateIndex
CREATE INDEX "Training_startDate_idx" ON "Training"("startDate");

-- CreateIndex
CREATE INDEX "TrainingEnrollment_trainingId_idx" ON "TrainingEnrollment"("trainingId");

-- CreateIndex
CREATE INDEX "TrainingEnrollment_staffId_idx" ON "TrainingEnrollment"("staffId");

-- CreateIndex
CREATE INDEX "TrainingEnrollment_status_idx" ON "TrainingEnrollment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingEnrollment_trainingId_staffId_key" ON "TrainingEnrollment"("trainingId", "staffId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_code_key" ON "Project"("code");

-- CreateIndex
CREATE INDEX "Project_departmentId_idx" ON "Project"("departmentId");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE INDEX "Project_sponsorId_idx" ON "Project"("sponsorId");

-- CreateIndex
CREATE INDEX "ProjectMember_projectId_idx" ON "ProjectMember"("projectId");

-- CreateIndex
CREATE INDEX "ProjectMember_staffId_idx" ON "ProjectMember"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_projectId_staffId_key" ON "ProjectMember"("projectId", "staffId");

-- CreateIndex
CREATE INDEX "ProjectMilestone_projectId_idx" ON "ProjectMilestone"("projectId");

-- CreateIndex
CREATE INDEX "ProjectMilestone_status_idx" ON "ProjectMilestone"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentVoucher_refNumber_key" ON "PaymentVoucher"("refNumber");

-- CreateIndex
CREATE INDEX "PaymentVoucher_requisitionId_idx" ON "PaymentVoucher"("requisitionId");

-- CreateIndex
CREATE INDEX "PaymentVoucher_status_idx" ON "PaymentVoucher"("status");

-- CreateIndex
CREATE INDEX "PaymentVoucher_deskOfficerId_idx" ON "PaymentVoucher"("deskOfficerId");

-- CreateIndex
CREATE INDEX "PaymentVoucher_auditOfficerId_idx" ON "PaymentVoucher"("auditOfficerId");

-- CreateIndex
CREATE INDEX "PVComment_pvId_idx" ON "PVComment"("pvId");

-- CreateIndex
CREATE INDEX "PVAttachment_pvId_idx" ON "PVAttachment"("pvId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportTemplate_code_key" ON "ReportTemplate"("code");

-- CreateIndex
CREATE INDEX "GeneratedReport_templateId_idx" ON "GeneratedReport"("templateId");

-- CreateIndex
CREATE INDEX "GeneratedReport_generatedById_idx" ON "GeneratedReport"("generatedById");

-- CreateIndex
CREATE UNIQUE INDEX "PostingTransfer_refNumber_key" ON "PostingTransfer"("refNumber");

-- CreateIndex
CREATE INDEX "PostingTransfer_staffId_idx" ON "PostingTransfer"("staffId");

-- CreateIndex
CREATE INDEX "PostingTransfer_status_idx" ON "PostingTransfer"("status");

-- CreateIndex
CREATE INDEX "PostingTransfer_toDepartmentId_idx" ON "PostingTransfer"("toDepartmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Requisition_refNumber_key" ON "Requisition"("refNumber");

-- CreateIndex
CREATE INDEX "Requisition_status_idx" ON "Requisition"("status");

-- CreateIndex
CREATE INDEX "Requisition_type_idx" ON "Requisition"("type");

-- CreateIndex
CREATE INDEX "Requisition_assigneeId_idx" ON "Requisition"("assigneeId");

-- CreateIndex
CREATE INDEX "Requisition_targetDesignationId_idx" ON "Requisition"("targetDesignationId");

-- CreateIndex
CREATE INDEX "RequisitionRoute_requisitionId_idx" ON "RequisitionRoute"("requisitionId");

-- CreateIndex
CREATE INDEX "RequisitionRoute_toUserId_idx" ON "RequisitionRoute"("toUserId");

-- CreateIndex
CREATE INDEX "RequisitionRoute_toDesignationId_idx" ON "RequisitionRoute"("toDesignationId");

-- CreateIndex
CREATE INDEX "RequisitionComment_requisitionId_idx" ON "RequisitionComment"("requisitionId");

-- CreateIndex
CREATE INDEX "RequisitionAttachment_requisitionId_idx" ON "RequisitionAttachment"("requisitionId");

-- CreateIndex
CREATE UNIQUE INDEX "RegistryFile_fileNumber_key" ON "RegistryFile"("fileNumber");

-- CreateIndex
CREATE INDEX "RegistryFile_status_idx" ON "RegistryFile"("status");

-- CreateIndex
CREATE INDEX "RegistryFile_currentHolderId_idx" ON "RegistryFile"("currentHolderId");

-- CreateIndex
CREATE INDEX "RegistryFile_targetDesignationId_idx" ON "RegistryFile"("targetDesignationId");

-- CreateIndex
CREATE INDEX "RegistryFile_committeeId_idx" ON "RegistryFile"("committeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Committee_code_key" ON "Committee"("code");

-- CreateIndex
CREATE INDEX "Committee_isActive_idx" ON "Committee"("isActive");

-- CreateIndex
CREATE INDEX "CommitteeMember_committeeId_idx" ON "CommitteeMember"("committeeId");

-- CreateIndex
CREATE INDEX "CommitteeMember_staffId_idx" ON "CommitteeMember"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "CommitteeMember_committeeId_staffId_key" ON "CommitteeMember"("committeeId", "staffId");

-- CreateIndex
CREATE INDEX "PasswordResetRequest_status_idx" ON "PasswordResetRequest"("status");

-- CreateIndex
CREATE INDEX "PasswordResetRequest_userId_idx" ON "PasswordResetRequest"("userId");

-- CreateIndex
CREATE INDEX "FileRoute_fileId_idx" ON "FileRoute"("fileId");

-- CreateIndex
CREATE INDEX "FileRoute_toUserId_idx" ON "FileRoute"("toUserId");

-- CreateIndex
CREATE INDEX "FileRoute_toDesignationId_idx" ON "FileRoute"("toDesignationId");

-- CreateIndex
CREATE INDEX "FileAttachment_fileId_idx" ON "FileAttachment"("fileId");

-- CreateIndex
CREATE INDEX "FileComment_fileId_idx" ON "FileComment"("fileId");

-- CreateIndex
CREATE INDEX "MailMessage_toId_isRead_idx" ON "MailMessage"("toId", "isRead");

-- CreateIndex
CREATE INDEX "MailMessage_fromId_idx" ON "MailMessage"("fromId");

-- CreateIndex
CREATE INDEX "MailMessage_isArchived_idx" ON "MailMessage"("isArchived");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "Document_fileNumber_key" ON "Document"("fileNumber");

-- CreateIndex
CREATE INDEX "Document_staffId_idx" ON "Document"("staffId");

-- CreateIndex
CREATE INDEX "Document_committeeId_idx" ON "Document"("committeeId");

-- CreateIndex
CREATE INDEX "Document_category_idx" ON "Document"("category");

-- CreateIndex
CREATE INDEX "Document_uploadedById_idx" ON "Document"("uploadedById");

-- CreateIndex
CREATE INDEX "Document_isPublic_idx" ON "Document"("isPublic");

-- CreateIndex
CREATE INDEX "Document_fileNumber_idx" ON "Document"("fileNumber");
