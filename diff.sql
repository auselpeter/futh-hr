-- DropForeignKey
ALTER TABLE `academic_background` DROP FOREIGN KEY `fk_ab_staff`;

-- DropForeignKey
ALTER TABLE `bank_details` DROP FOREIGN KEY `fk_bd_staff`;

-- DropForeignKey
ALTER TABLE `committee_members` DROP FOREIGN KEY `fk_cm_added_by`;

-- DropForeignKey
ALTER TABLE `committee_members` DROP FOREIGN KEY `fk_cm_comm`;

-- DropForeignKey
ALTER TABLE `committee_members` DROP FOREIGN KEY `fk_cm_staff`;

-- DropForeignKey
ALTER TABLE `committees` DROP FOREIGN KEY `fk_comm_chair`;

-- DropForeignKey
ALTER TABLE `committees` DROP FOREIGN KEY `fk_comm_sec`;

-- DropForeignKey
ALTER TABLE `departments` DROP FOREIGN KEY `fk_dept_hod`;

-- DropForeignKey
ALTER TABLE `dependants` DROP FOREIGN KEY `fk_dep_staff`;

-- DropForeignKey
ALTER TABLE `designations` DROP FOREIGN KEY `fk_dsg_dept`;

-- DropForeignKey
ALTER TABLE `documents` DROP FOREIGN KEY `fk_doc_comm`;

-- DropForeignKey
ALTER TABLE `documents` DROP FOREIGN KEY `fk_doc_staff`;

-- DropForeignKey
ALTER TABLE `documents` DROP FOREIGN KEY `fk_doc_uploader`;

-- DropForeignKey
ALTER TABLE `file_routes` DROP FOREIGN KEY `fk_fr_file`;

-- DropForeignKey
ALTER TABLE `file_routes` DROP FOREIGN KEY `fk_fr_from`;

-- DropForeignKey
ALTER TABLE `next_of_kin` DROP FOREIGN KEY `fk_nok_staff`;

-- DropForeignKey
ALTER TABLE `password_reset_tokens` DROP FOREIGN KEY `fk_prt_user`;

-- DropForeignKey
ALTER TABLE `registry_files` DROP FOREIGN KEY `fk_rf_created`;

-- DropForeignKey
ALTER TABLE `registry_files` DROP FOREIGN KEY `fk_rf_holder`;

-- DropForeignKey
ALTER TABLE `registry_files` DROP FOREIGN KEY `fk_rf_staff`;

-- DropForeignKey
ALTER TABLE `registry_files` DROP FOREIGN KEY `fk_rf_target_user`;

-- DropForeignKey
ALTER TABLE `staff` DROP FOREIGN KEY `fk_staff_dept`;

-- DropForeignKey
ALTER TABLE `staff` DROP FOREIGN KEY `fk_staff_dsg`;

-- DropForeignKey
ALTER TABLE `staff` DROP FOREIGN KEY `fk_staff_unit`;

-- DropForeignKey
ALTER TABLE `staff` DROP FOREIGN KEY `fk_staff_user`;

-- DropForeignKey
ALTER TABLE `units` DROP FOREIGN KEY `fk_unit_dept`;

-- DropForeignKey
ALTER TABLE `units` DROP FOREIGN KEY `fk_unit_hou`;

-- DropForeignKey
ALTER TABLE `users` DROP FOREIGN KEY `fk_user_dept`;

-- DropForeignKey
ALTER TABLE `users` DROP FOREIGN KEY `fk_user_dsg`;

-- DropForeignKey
ALTER TABLE `users` DROP FOREIGN KEY `fk_user_staff`;

-- DropForeignKey
ALTER TABLE `users` DROP FOREIGN KEY `fk_user_unit`;

-- DropIndex
DROP INDEX `idx_audit_action` ON `audit_logs`;

-- DropIndex
DROP INDEX `fk_cm_added_by` ON `committee_members`;

-- DropIndex
DROP INDEX `fk_comm_chair` ON `committees`;

-- DropIndex
DROP INDEX `fk_comm_sec` ON `committees`;

-- DropIndex
DROP INDEX `fk_dsg_dept` ON `designations`;

-- DropIndex
DROP INDEX `fk_fr_from` ON `file_routes`;

-- DropIndex
DROP INDEX `idx_notif_userId` ON `notifications`;

-- DropIndex
DROP INDEX `fk_rf_created` ON `registry_files`;

-- DropIndex
DROP INDEX `fk_rf_staff` ON `registry_files`;

-- DropIndex
DROP INDEX `fk_rf_target_user` ON `registry_files`;

-- DropIndex
DROP INDEX `idx_rf_fileNumber` ON `registry_files`;

-- DropIndex
DROP INDEX `idx_rf_type` ON `registry_files`;

-- DropIndex
DROP INDEX `fk_staff_dsg` ON `staff`;

-- DropIndex
DROP INDEX `fk_staff_unit` ON `staff`;

-- DropIndex
DROP INDEX `idx_staff_ippisNumber` ON `staff`;

-- DropIndex
DROP INDEX `fk_user_dept` ON `users`;

-- DropIndex
DROP INDEX `fk_user_dsg` ON `users`;

-- DropIndex
DROP INDEX `fk_user_unit` ON `users`;

-- AlterTable
ALTER TABLE `academic_background` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    MODIFY `staffId` VARCHAR(191) NOT NULL,
    MODIFY `institution` VARCHAR(191) NOT NULL,
    MODIFY `qualification` VARCHAR(191) NULL,
    MODIFY `field` VARCHAR(191) NULL,
    MODIFY `startDate` DATETIME(3) NULL,
    MODIFY `endDate` DATETIME(3) NULL,
    MODIFY `grade` VARCHAR(191) NULL,
    MODIFY `certificateUrl` VARCHAR(191) NULL,
    MODIFY `certificateNumber` VARCHAR(191) NULL,
    MODIFY `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `updatedAt` DATETIME(3) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `audit_logs` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    MODIFY `userId` VARCHAR(191) NOT NULL,
    MODIFY `action` VARCHAR(191) NOT NULL,
    MODIFY `entity` VARCHAR(191) NULL,
    MODIFY `entityId` VARCHAR(191) NULL,
    MODIFY `details` VARCHAR(191) NULL,
    MODIFY `ipAddress` VARCHAR(191) NULL,
    MODIFY `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `bank_details` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    MODIFY `staffId` VARCHAR(191) NOT NULL,
    MODIFY `bankName` VARCHAR(191) NOT NULL,
    MODIFY `accountName` VARCHAR(191) NOT NULL,
    MODIFY `accountNumber` VARCHAR(191) NOT NULL,
    MODIFY `accountType` VARCHAR(191) NULL DEFAULT 'Savings',
    MODIFY `branch` VARCHAR(191) NULL,
    MODIFY `sortCode` VARCHAR(191) NULL,
    MODIFY `bvnNumber` VARCHAR(191) NULL,
    MODIFY `isPrimary` BOOLEAN NOT NULL DEFAULT false,
    MODIFY `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `updatedAt` DATETIME(3) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `committee_members` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    MODIFY `committeeId` VARCHAR(191) NOT NULL,
    MODIFY `staffId` VARCHAR(191) NOT NULL,
    MODIFY `role` VARCHAR(191) NOT NULL DEFAULT 'member',
    MODIFY `addedById` VARCHAR(191) NULL,
    MODIFY `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `updatedAt` DATETIME(3) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `committees` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    MODIFY `code` VARCHAR(191) NOT NULL,
    MODIFY `name` VARCHAR(191) NOT NULL,
    MODIFY `description` VARCHAR(191) NULL,
    MODIFY `chairpersonId` VARCHAR(191) NULL,
    MODIFY `secretaryId` VARCHAR(191) NULL,
    MODIFY `members` VARCHAR(191) NULL,
    MODIFY `termOfReference` VARCHAR(191) NULL,
    MODIFY `startDate` DATETIME(3) NULL,
    MODIFY `endDate` DATETIME(3) NULL,
    MODIFY `budget` DOUBLE NULL,
    MODIFY `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `updatedAt` DATETIME(3) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `departments` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    MODIFY `code` VARCHAR(191) NOT NULL,
    MODIFY `name` VARCHAR(191) NOT NULL,
    MODIFY `faculty` VARCHAR(191) NULL,
    MODIFY `hodUserId` VARCHAR(191) NULL,
    MODIFY `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `updatedAt` DATETIME(3) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `dependants` DROP PRIMARY KEY,
    DROP COLUMN `updatedAt`,
    MODIFY `id` VARCHAR(191) NOT NULL,
    MODIFY `staffId` VARCHAR(191) NOT NULL,
    MODIFY `fullName` VARCHAR(191) NOT NULL,
    MODIFY `relationship` VARCHAR(191) NULL,
    MODIFY `dateOfBirth` DATETIME(3) NULL,
    MODIFY `gender` VARCHAR(191) NULL,
    MODIFY `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `designations` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    MODIFY `code` VARCHAR(191) NOT NULL,
    MODIFY `name` VARCHAR(191) NOT NULL,
    MODIFY `description` VARCHAR(191) NULL,
    MODIFY `level` VARCHAR(191) NOT NULL DEFAULT 'staff',
    MODIFY `departmentId` VARCHAR(191) NULL,
    MODIFY `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `updatedAt` DATETIME(3) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `documents` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    MODIFY `fileNumber` VARCHAR(191) NOT NULL,
    MODIFY `title` VARCHAR(191) NOT NULL,
    MODIFY `description` VARCHAR(191) NULL,
    MODIFY `category` VARCHAR(191) NOT NULL,
    MODIFY `fileUrl` VARCHAR(191) NOT NULL,
    MODIFY `fileName` VARCHAR(191) NOT NULL,
    MODIFY `mimeType` VARCHAR(191) NULL,
    MODIFY `staffId` VARCHAR(191) NULL,
    MODIFY `committeeId` VARCHAR(191) NULL,
    MODIFY `uploadedById` VARCHAR(191) NOT NULL,
    MODIFY `documentDate` DATETIME(3) NULL,
    MODIFY `tags` VARCHAR(191) NULL,
    MODIFY `isPublic` BOOLEAN NOT NULL DEFAULT true,
    MODIFY `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `updatedAt` DATETIME(3) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `file_attachments` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    MODIFY `fileId` VARCHAR(191) NOT NULL,
    MODIFY `fileName` VARCHAR(191) NOT NULL,
    MODIFY `fileUrl` VARCHAR(191) NOT NULL,
    MODIFY `mimeType` VARCHAR(191) NULL,
    MODIFY `uploadedById` VARCHAR(191) NULL,
    MODIFY `isPrimary` BOOLEAN NOT NULL DEFAULT false,
    MODIFY `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `file_comments` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    MODIFY `fileId` VARCHAR(191) NOT NULL,
    MODIFY `userId` VARCHAR(191) NOT NULL,
    MODIFY `body` VARCHAR(191) NOT NULL,
    MODIFY `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `file_routes` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    MODIFY `fileId` VARCHAR(191) NOT NULL,
    MODIFY `fromUserId` VARCHAR(191) NOT NULL,
    MODIFY `toUserId` VARCHAR(191) NULL,
    MODIFY `toDesignationId` VARCHAR(191) NULL,
    MODIFY `toDepartmentId` VARCHAR(191) NULL,
    MODIFY `action` VARCHAR(191) NOT NULL,
    MODIFY `remarks` VARCHAR(191) NULL,
    MODIFY `acknowledgedAt` DATETIME(3) NULL,
    MODIFY `signerName` VARCHAR(191) NULL,
    MODIFY `signerDesignation` VARCHAR(191) NULL,
    MODIFY `signatureUrl` VARCHAR(191) NULL,
    MODIFY `signedAt` DATETIME(3) NULL,
    MODIFY `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `next_of_kin` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    MODIFY `staffId` VARCHAR(191) NOT NULL,
    MODIFY `fullName` VARCHAR(191) NOT NULL,
    MODIFY `relationship` VARCHAR(191) NULL,
    MODIFY `gender` VARCHAR(191) NULL,
    MODIFY `phone` VARCHAR(191) NULL,
    MODIFY `email` VARCHAR(191) NULL,
    MODIFY `address` VARCHAR(191) NULL,
    MODIFY `city` VARCHAR(191) NULL,
    MODIFY `state` VARCHAR(191) NULL,
    MODIFY `occupation` VARCHAR(191) NULL,
    MODIFY `employerName` VARCHAR(191) NULL,
    MODIFY `isPrimary` BOOLEAN NOT NULL DEFAULT false,
    MODIFY `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `updatedAt` DATETIME(3) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `notifications` DROP PRIMARY KEY,
    ADD COLUMN `readAt` DATETIME(3) NULL,
    MODIFY `id` VARCHAR(191) NOT NULL,
    MODIFY `userId` VARCHAR(191) NOT NULL,
    MODIFY `title` VARCHAR(191) NOT NULL,
    MODIFY `body` VARCHAR(191) NOT NULL,
    MODIFY `type` VARCHAR(191) NOT NULL DEFAULT 'info',
    MODIFY `link` VARCHAR(191) NULL,
    MODIFY `isRead` BOOLEAN NOT NULL DEFAULT false,
    MODIFY `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `pages` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    MODIFY `key` VARCHAR(191) NOT NULL,
    MODIFY `name` VARCHAR(191) NOT NULL,
    MODIFY `description` VARCHAR(191) NULL,
    MODIFY `icon` VARCHAR(191) NULL,
    MODIFY `category` VARCHAR(191) NOT NULL DEFAULT 'Main',
    MODIFY `sortOrder` INTEGER NOT NULL DEFAULT 100,
    MODIFY `isActive` BOOLEAN NOT NULL DEFAULT true,
    MODIFY `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `updatedAt` DATETIME(3) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `registry_files` DROP PRIMARY KEY,
    ADD COLUMN `closedAt` DATETIME(3) NULL,
    ADD COLUMN `closedById` VARCHAR(191) NULL,
    ADD COLUMN `cmdSignatureUrl` VARCHAR(191) NULL,
    ADD COLUMN `cmdSignedAt` DATETIME(3) NULL,
    ADD COLUMN `dfaSignatureUrl` VARCHAR(191) NULL,
    ADD COLUMN `dfaSignedAt` DATETIME(3) NULL,
    ADD COLUMN `hodSignatureUrl` VARCHAR(191) NULL,
    ADD COLUMN `hodSignedAt` DATETIME(3) NULL,
    ADD COLUMN `registrySignatureUrl` VARCHAR(191) NULL,
    ADD COLUMN `registrySignedAt` DATETIME(3) NULL,
    MODIFY `id` VARCHAR(191) NOT NULL,
    MODIFY `fileNumber` VARCHAR(191) NOT NULL,
    MODIFY `type` VARCHAR(191) NOT NULL,
    MODIFY `subject` VARCHAR(191) NOT NULL,
    MODIFY `description` VARCHAR(191) NOT NULL,
    MODIFY `priority` VARCHAR(191) NOT NULL DEFAULT 'Normal',
    MODIFY `volume` VARCHAR(191) NULL,
    MODIFY `status` VARCHAR(191) NOT NULL DEFAULT 'Draft',
    MODIFY `state` VARCHAR(191) NOT NULL DEFAULT 'open',
    MODIFY `createdById` VARCHAR(191) NOT NULL,
    MODIFY `currentHolderId` VARCHAR(191) NULL,
    MODIFY `targetUserId` VARCHAR(191) NULL,
    MODIFY `targetDesignationId` VARCHAR(191) NULL,
    MODIFY `targetDepartmentId` VARCHAR(191) NULL,
    MODIFY `staffId` VARCHAR(191) NULL,
    MODIFY `departmentId` VARCHAR(191) NULL,
    MODIFY `committeeId` VARCHAR(191) NULL,
    MODIFY `externalName` VARCHAR(191) NULL,
    MODIFY `externalOrg` VARCHAR(191) NULL,
    MODIFY `externalEmail` VARCHAR(191) NULL,
    MODIFY `externalPhone` VARCHAR(191) NULL,
    MODIFY `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `updatedAt` DATETIME(3) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `role_page_permissions` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    MODIFY `roleId` VARCHAR(191) NOT NULL,
    MODIFY `pageId` VARCHAR(191) NOT NULL,
    MODIFY `canView` BOOLEAN NOT NULL DEFAULT true,
    MODIFY `canCreate` BOOLEAN NOT NULL DEFAULT false,
    MODIFY `canEdit` BOOLEAN NOT NULL DEFAULT false,
    MODIFY `canDelete` BOOLEAN NOT NULL DEFAULT false,
    MODIFY `createdById` VARCHAR(191) NULL,
    MODIFY `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `updatedAt` DATETIME(3) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `roles` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    MODIFY `code` VARCHAR(191) NOT NULL,
    MODIFY `name` VARCHAR(191) NOT NULL,
    MODIFY `description` VARCHAR(191) NULL,
    MODIFY `level` VARCHAR(191) NOT NULL DEFAULT 'staff',
    MODIFY `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `updatedAt` DATETIME(3) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `staff` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    MODIFY `staffId` VARCHAR(191) NOT NULL,
    MODIFY `ippisNumber` VARCHAR(191) NULL,
    MODIFY `surname` VARCHAR(191) NOT NULL,
    MODIFY `firstName` VARCHAR(191) NOT NULL,
    MODIFY `otherNames` VARCHAR(191) NULL,
    MODIFY `fullName` VARCHAR(191) NOT NULL,
    MODIFY `gender` VARCHAR(191) NULL,
    MODIFY `dateOfBirth` DATETIME(3) NULL,
    MODIFY `maritalStatus` VARCHAR(191) NULL,
    MODIFY `nationality` VARCHAR(191) NULL DEFAULT 'Nigerian',
    MODIFY `stateOfOrigin` VARCHAR(191) NULL,
    MODIFY `lga` VARCHAR(191) NULL,
    MODIFY `religion` VARCHAR(191) NULL,
    MODIFY `ninNumber` VARCHAR(191) NULL,
    MODIFY `tinNumber` VARCHAR(191) NULL,
    MODIFY `pensionNumber` VARCHAR(191) NULL,
    MODIFY `nhfNumber` VARCHAR(191) NULL,
    MODIFY `nhisNumber` VARCHAR(191) NULL,
    MODIFY `email` VARCHAR(191) NULL,
    MODIFY `phone` VARCHAR(191) NULL,
    MODIFY `altPhone` VARCHAR(191) NULL,
    MODIFY `position` VARCHAR(191) NULL,
    MODIFY `rank` VARCHAR(191) NULL,
    MODIFY `employmentType` VARCHAR(191) NULL DEFAULT 'permanent',
    MODIFY `dateHired` DATETIME(3) NULL,
    MODIFY `confirmationDate` DATETIME(3) NULL,
    MODIFY `retirementDate` DATETIME(3) NULL,
    MODIFY `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    MODIFY `avatarUrl` VARCHAR(191) NULL,
    MODIFY `signatureUrl` VARCHAR(191) NULL,
    MODIFY `thumbprintUrl` VARCHAR(191) NULL,
    MODIFY `pictureUrl` VARCHAR(191) NULL,
    MODIFY `residentialAddress` VARCHAR(191) NULL,
    MODIFY `permanentAddress` VARCHAR(191) NULL,
    MODIFY `cityOfResidence` VARCHAR(191) NULL,
    MODIFY `stateOfResidence` VARCHAR(191) NULL,
    MODIFY `departmentId` VARCHAR(191) NULL,
    MODIFY `unitId` VARCHAR(191) NULL,
    MODIFY `designationId` VARCHAR(191) NULL,
    MODIFY `userId` VARCHAR(191) NULL,
    MODIFY `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `updatedAt` DATETIME(3) NOT NULL,
    MODIFY `fileNumber` VARCHAR(191) NULL,
    MODIFY `gradeLevel` VARCHAR(191) NULL,
    MODIFY `step` VARCHAR(191) NULL,
    MODIFY `cadre` VARCHAR(191) NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `units` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    MODIFY `code` VARCHAR(191) NOT NULL,
    MODIFY `name` VARCHAR(191) NOT NULL,
    MODIFY `description` VARCHAR(191) NULL,
    MODIFY `departmentId` VARCHAR(191) NOT NULL,
    MODIFY `houUserId` VARCHAR(191) NULL,
    MODIFY `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `updatedAt` DATETIME(3) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `users` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    MODIFY `email` VARCHAR(191) NOT NULL,
    MODIFY `username` VARCHAR(191) NOT NULL,
    MODIFY `passwordHash` VARCHAR(191) NOT NULL,
    MODIFY `fullName` VARCHAR(191) NOT NULL,
    MODIFY `phone` VARCHAR(191) NULL,
    MODIFY `avatarUrl` VARCHAR(191) NULL,
    MODIFY `role` VARCHAR(191) NOT NULL DEFAULT 'STAFF',
    MODIFY `secondaryRoles` VARCHAR(191) NULL,
    MODIFY `activeRoleOverride` VARCHAR(191) NULL,
    MODIFY `twoFactorSecret` VARCHAR(191) NULL,
    MODIFY `twoFactorRecoveryCodes` VARCHAR(191) NULL,
    MODIFY `twoFactorEnforcedAt` DATETIME(3) NULL,
    MODIFY `twoFactorLastUsedAt` DATETIME(3) NULL,
    MODIFY `staffId` VARCHAR(191) NULL,
    MODIFY `designationId` VARCHAR(191) NULL,
    MODIFY `departmentId` VARCHAR(191) NULL,
    MODIFY `unitId` VARCHAR(191) NULL,
    MODIFY `lastLoginAt` DATETIME(3) NULL,
    MODIFY `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `updatedAt` DATETIME(3) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- DropTable
DROP TABLE `password_reset_tokens`;

-- CreateTable
CREATE TABLE `Duty` (
    `id` VARCHAR(191) NOT NULL,
    `staffId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'Primary',
    `order` INTEGER NOT NULL DEFAULT 1,
    `startDate` DATETIME(3) NULL,
    `dueDate` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `durationDays` INTEGER NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Assigned',
    `evidenceUrl` VARCHAR(191) NULL,
    `evidenceFileName` VARCHAR(191) NULL,
    `evidenceNotes` VARCHAR(191) NULL,
    `evidenceUploadedAt` DATETIME(3) NULL,
    `targetScore` DOUBLE NOT NULL DEFAULT 100,
    `achievedScore` DOUBLE NULL,
    `grade` VARCHAR(191) NULL,
    `rating` VARCHAR(191) NULL,
    `scoreNotes` VARCHAR(191) NULL,
    `reviewedById` VARCHAR(191) NULL,
    `reviewedByName` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `reviewRemarks` VARCHAR(191) NULL,
    `weight` DOUBLE NOT NULL DEFAULT 1,
    `period` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Duty_staffId_idx`(`staffId`),
    INDEX `Duty_status_idx`(`status`),
    INDEX `Duty_reviewedById_idx`(`reviewedById`),
    INDEX `Duty_period_idx`(`period`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AnnualReview` (
    `id` VARCHAR(191) NOT NULL,
    `staffId` VARCHAR(191) NOT NULL,
    `period` VARCHAR(191) NOT NULL,
    `overallScore` DOUBLE NOT NULL DEFAULT 0,
    `assessmentScore` DOUBLE NOT NULL DEFAULT 0,
    `monthlyScore` DOUBLE NOT NULL DEFAULT 0,
    `quarterlyScore` DOUBLE NOT NULL DEFAULT 0,
    `appraisalScore` DOUBLE NOT NULL DEFAULT 0,
    `dutyScore` DOUBLE NOT NULL DEFAULT 0,
    `verdict` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Draft',
    `comments` VARCHAR(191) NULL,
    `hodName` VARCHAR(191) NULL,
    `hodSignatureUrl` VARCHAR(191) NULL,
    `hodSignedAt` DATETIME(3) NULL,
    `daName` VARCHAR(191) NULL,
    `daSignatureUrl` VARCHAR(191) NULL,
    `daSignedAt` DATETIME(3) NULL,
    `annualReviewDuties` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AnnualReview_staffId_idx`(`staffId`),
    INDEX `AnnualReview_period_idx`(`period`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MonthlyAppraisal` (
    `id` VARCHAR(191) NOT NULL,
    `staffId` VARCHAR(191) NOT NULL,
    `period` VARCHAR(191) NOT NULL,
    `month` INTEGER NOT NULL,
    `year` INTEGER NOT NULL,
    `score` DOUBLE NOT NULL DEFAULT 0,
    `grade` VARCHAR(191) NULL,
    `achievements` VARCHAR(191) NULL,
    `challenges` VARCHAR(191) NULL,
    `recommendations` VARCHAR(191) NULL,
    `comments` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Draft',
    `hodRemarks` VARCHAR(191) NULL,
    `houRemarks` VARCHAR(191) NULL,
    `hodName` VARCHAR(191) NULL,
    `hodSignedAt` DATETIME(3) NULL,
    `houName` VARCHAR(191) NULL,
    `houSignedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MonthlyAppraisal_staffId_idx`(`staffId`),
    UNIQUE INDEX `MonthlyAppraisal_staffId_year_month_key`(`staffId`, `year`, `month`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuarterlyReview` (
    `id` VARCHAR(191) NOT NULL,
    `staffId` VARCHAR(191) NOT NULL,
    `period` VARCHAR(191) NOT NULL,
    `quarter` INTEGER NOT NULL,
    `year` INTEGER NOT NULL,
    `averageScore` DOUBLE NOT NULL DEFAULT 0,
    `grade` VARCHAR(191) NULL,
    `summary` VARCHAR(191) NULL,
    `comments` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Draft',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `QuarterlyReview_staffId_idx`(`staffId`),
    UNIQUE INDEX `QuarterlyReview_staffId_year_quarter_key`(`staffId`, `year`, `quarter`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Assessment` (
    `id` VARCHAR(191) NOT NULL,
    `staffId` VARCHAR(191) NOT NULL,
    `period` VARCHAR(191) NOT NULL,
    `knowledgeScore` DOUBLE NOT NULL DEFAULT 0,
    `skillsScore` DOUBLE NOT NULL DEFAULT 0,
    `attitudeScore` DOUBLE NOT NULL DEFAULT 0,
    `communicationScore` DOUBLE NOT NULL DEFAULT 0,
    `totalScore` DOUBLE NOT NULL DEFAULT 0,
    `grade` VARCHAR(191) NULL,
    `assessedById` VARCHAR(191) NULL,
    `remarks` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Draft',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Assessment_staffId_idx`(`staffId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Appraisal` (
    `id` VARCHAR(191) NOT NULL,
    `staffId` VARCHAR(191) NOT NULL,
    `period` VARCHAR(191) NOT NULL,
    `performanceScore` DOUBLE NOT NULL DEFAULT 0,
    `achievementScore` DOUBLE NOT NULL DEFAULT 0,
    `competencyScore` DOUBLE NOT NULL DEFAULT 0,
    `totalScore` DOUBLE NOT NULL DEFAULT 0,
    `grade` VARCHAR(191) NULL,
    `appraisedById` VARCHAR(191) NULL,
    `remarks` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Draft',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Appraisal_staffId_idx`(`staffId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeaveType` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `defaultDays` INTEGER NOT NULL DEFAULT 0,
    `isPaid` BOOLEAN NOT NULL DEFAULT true,
    `requiresCertificate` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `LeaveType_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Leave` (
    `id` VARCHAR(191) NOT NULL,
    `refNumber` VARCHAR(191) NOT NULL,
    `staffId` VARCHAR(191) NOT NULL,
    `leaveTypeId` VARCHAR(191) NOT NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NOT NULL,
    `daysRequested` INTEGER NOT NULL,
    `daysApproved` INTEGER NULL,
    `reason` VARCHAR(191) NOT NULL,
    `address` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `certificateUrl` VARCHAR(191) NULL,
    `currentStage` VARCHAR(191) NOT NULL DEFAULT 'Submitted',
    `currentHolderId` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Pending',
    `state` VARCHAR(191) NOT NULL DEFAULT 'open',
    `hodId` VARCHAR(191) NULL,
    `hodName` VARCHAR(191) NULL,
    `hodRemarks` VARCHAR(191) NULL,
    `hodSignedAt` DATETIME(3) NULL,
    `houId` VARCHAR(191) NULL,
    `houName` VARCHAR(191) NULL,
    `houRemarks` VARCHAR(191) NULL,
    `houSignedAt` DATETIME(3) NULL,
    `registryId` VARCHAR(191) NULL,
    `registryName` VARCHAR(191) NULL,
    `registryRemarks` VARCHAR(191) NULL,
    `registryReceivedAt` DATETIME(3) NULL,
    `dfaId` VARCHAR(191) NULL,
    `dfaName` VARCHAR(191) NULL,
    `dfaRemarks` VARCHAR(191) NULL,
    `dfaSignedAt` DATETIME(3) NULL,
    `cmdId` VARCHAR(191) NULL,
    `cmdName` VARCHAR(191) NULL,
    `cmdRemarks` VARCHAR(191) NULL,
    `cmdSignedAt` DATETIME(3) NULL,
    `rejectedById` VARCHAR(191) NULL,
    `rejectedAt` DATETIME(3) NULL,
    `rejectReason` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Leave_refNumber_key`(`refNumber`),
    INDEX `Leave_staffId_idx`(`staffId`),
    INDEX `Leave_status_idx`(`status`),
    INDEX `Leave_currentStage_idx`(`currentStage`),
    INDEX `Leave_currentHolderId_idx`(`currentHolderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeaveRoute` (
    `id` VARCHAR(191) NOT NULL,
    `leaveId` VARCHAR(191) NOT NULL,
    `fromUserId` VARCHAR(191) NOT NULL,
    `toUserId` VARCHAR(191) NULL,
    `stage` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `remarks` VARCHAR(191) NULL,
    `signerName` VARCHAR(191) NULL,
    `signerDesignation` VARCHAR(191) NULL,
    `signatureUrl` VARCHAR(191) NULL,
    `signedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LeaveRoute_leaveId_idx`(`leaveId`),
    INDEX `LeaveRoute_toUserId_idx`(`toUserId`),
    INDEX `LeaveRoute_fromUserId_idx`(`fromUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Holiday` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `date` DATETIME(3) NOT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'public',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Promotion` (
    `id` VARCHAR(191) NOT NULL,
    `refNumber` VARCHAR(191) NOT NULL,
    `staffId` VARCHAR(191) NOT NULL,
    `currentPosition` VARCHAR(191) NULL,
    `currentRank` VARCHAR(191) NULL,
    `currentSalary` DOUBLE NULL,
    `newPosition` VARCHAR(191) NULL,
    `newRank` VARCHAR(191) NULL,
    `newSalary` DOUBLE NULL,
    `newDepartmentId` VARCHAR(191) NULL,
    `newDesignationId` VARCHAR(191) NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'promotion',
    `effectiveDate` DATETIME(3) NOT NULL,
    `reason` VARCHAR(191) NULL,
    `justification` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Submitted',
    `state` VARCHAR(191) NOT NULL DEFAULT 'open',
    `hodId` VARCHAR(191) NULL,
    `hodName` VARCHAR(191) NULL,
    `hodSignatureUrl` VARCHAR(191) NULL,
    `hodRemarks` VARCHAR(191) NULL,
    `hodSignedAt` DATETIME(3) NULL,
    `dfaId` VARCHAR(191) NULL,
    `dfaName` VARCHAR(191) NULL,
    `dfaSignatureUrl` VARCHAR(191) NULL,
    `dfaRemarks` VARCHAR(191) NULL,
    `dfaSignedAt` DATETIME(3) NULL,
    `cmdId` VARCHAR(191) NULL,
    `cmdName` VARCHAR(191) NULL,
    `cmdSignatureUrl` VARCHAR(191) NULL,
    `cmdRemarks` VARCHAR(191) NULL,
    `cmdSignedAt` DATETIME(3) NULL,
    `rejectedById` VARCHAR(191) NULL,
    `rejectedAt` DATETIME(3) NULL,
    `rejectReason` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Promotion_refNumber_key`(`refNumber`),
    INDEX `Promotion_staffId_idx`(`staffId`),
    INDEX `Promotion_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Termination` (
    `id` VARCHAR(191) NOT NULL,
    `refNumber` VARCHAR(191) NOT NULL,
    `staffId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'termination',
    `reason` VARCHAR(191) NOT NULL,
    `detailedReason` VARCHAR(191) NULL,
    `noticeDate` DATETIME(3) NULL,
    `effectiveDate` DATETIME(3) NOT NULL,
    `lastWorkingDate` DATETIME(3) NULL,
    `exitInterviewConducted` BOOLEAN NOT NULL DEFAULT false,
    `exitInterviewNotes` VARCHAR(191) NULL,
    `handoverCompleted` BOOLEAN NOT NULL DEFAULT false,
    `assetsReturned` BOOLEAN NOT NULL DEFAULT false,
    `clearanceFormUrl` VARCHAR(191) NULL,
    `finalSalary` DOUBLE NULL,
    `gratuityAmount` DOUBLE NULL,
    `pensionBalance` DOUBLE NULL,
    `leaveEncashment` DOUBLE NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Submitted',
    `state` VARCHAR(191) NOT NULL DEFAULT 'open',
    `hodId` VARCHAR(191) NULL,
    `hodName` VARCHAR(191) NULL,
    `hodSignatureUrl` VARCHAR(191) NULL,
    `hodRemarks` VARCHAR(191) NULL,
    `hodSignedAt` DATETIME(3) NULL,
    `dfaId` VARCHAR(191) NULL,
    `dfaName` VARCHAR(191) NULL,
    `dfaSignatureUrl` VARCHAR(191) NULL,
    `dfaRemarks` VARCHAR(191) NULL,
    `dfaSignedAt` DATETIME(3) NULL,
    `cmdId` VARCHAR(191) NULL,
    `cmdName` VARCHAR(191) NULL,
    `cmdSignatureUrl` VARCHAR(191) NULL,
    `cmdRemarks` VARCHAR(191) NULL,
    `cmdSignedAt` DATETIME(3) NULL,
    `rejectedById` VARCHAR(191) NULL,
    `rejectedAt` DATETIME(3) NULL,
    `rejectReason` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Termination_refNumber_key`(`refNumber`),
    INDEX `Termination_staffId_idx`(`staffId`),
    INDEX `Termination_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Resignation` (
    `id` VARCHAR(191) NOT NULL,
    `refNumber` VARCHAR(191) NOT NULL,
    `staffId` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `detailedReason` VARCHAR(191) NULL,
    `resignationDate` DATETIME(3) NOT NULL,
    `noticeDate` DATETIME(3) NULL,
    `effectiveDate` DATETIME(3) NOT NULL,
    `lastWorkingDate` DATETIME(3) NULL,
    `isWithdrawn` BOOLEAN NOT NULL DEFAULT false,
    `withdrawnAt` DATETIME(3) NULL,
    `withdrawnById` VARCHAR(191) NULL,
    `exitInterviewConducted` BOOLEAN NOT NULL DEFAULT false,
    `exitInterviewNotes` VARCHAR(191) NULL,
    `handoverCompleted` BOOLEAN NOT NULL DEFAULT false,
    `assetsReturned` BOOLEAN NOT NULL DEFAULT false,
    `clearanceFormUrl` VARCHAR(191) NULL,
    `finalSalary` DOUBLE NULL,
    `gratuityAmount` DOUBLE NULL,
    `pensionBalance` DOUBLE NULL,
    `leaveEncashment` DOUBLE NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Submitted',
    `state` VARCHAR(191) NOT NULL DEFAULT 'open',
    `hodId` VARCHAR(191) NULL,
    `hodName` VARCHAR(191) NULL,
    `hodSignatureUrl` VARCHAR(191) NULL,
    `hodRemarks` VARCHAR(191) NULL,
    `hodSignedAt` DATETIME(3) NULL,
    `dfaId` VARCHAR(191) NULL,
    `dfaName` VARCHAR(191) NULL,
    `dfaSignatureUrl` VARCHAR(191) NULL,
    `dfaRemarks` VARCHAR(191) NULL,
    `dfaSignedAt` DATETIME(3) NULL,
    `cmdId` VARCHAR(191) NULL,
    `cmdName` VARCHAR(191) NULL,
    `cmdSignatureUrl` VARCHAR(191) NULL,
    `cmdRemarks` VARCHAR(191) NULL,
    `cmdSignedAt` DATETIME(3) NULL,
    `rejectedById` VARCHAR(191) NULL,
    `rejectedAt` DATETIME(3) NULL,
    `rejectReason` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Resignation_refNumber_key`(`refNumber`),
    INDEX `Resignation_staffId_idx`(`staffId`),
    INDEX `Resignation_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Retirement` (
    `id` VARCHAR(191) NOT NULL,
    `refNumber` VARCHAR(191) NOT NULL,
    `staffId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'compulsory',
    `reason` VARCHAR(191) NULL,
    `detailedReason` VARCHAR(191) NULL,
    `dateOfBirth` DATETIME(3) NULL,
    `retirementDate` DATETIME(3) NOT NULL,
    `lastWorkingDate` DATETIME(3) NULL,
    `yearsOfService` INTEGER NULL,
    `dateOfFirstAppointment` DATETIME(3) NULL,
    `currentSalaryAtRetirement` DOUBLE NULL,
    `gradeLevelAtRetirement` VARCHAR(191) NULL,
    `gratuityAmount` DOUBLE NULL,
    `pensionBalance` DOUBLE NULL,
    `leaveEncashment` DOUBLE NULL,
    `pensionAdministrator` VARCHAR(191) NULL,
    `pensionPin` VARCHAR(191) NULL,
    `nhfRefundAmount` DOUBLE NULL,
    `nhisRefundAmount` DOUBLE NULL,
    `exitInterviewConducted` BOOLEAN NOT NULL DEFAULT false,
    `exitInterviewNotes` VARCHAR(191) NULL,
    `handoverCompleted` BOOLEAN NOT NULL DEFAULT false,
    `assetsReturned` BOOLEAN NOT NULL DEFAULT false,
    `clearanceFormUrl` VARCHAR(191) NULL,
    `certificateOfService` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Submitted',
    `state` VARCHAR(191) NOT NULL DEFAULT 'open',
    `hodId` VARCHAR(191) NULL,
    `hodName` VARCHAR(191) NULL,
    `hodSignatureUrl` VARCHAR(191) NULL,
    `hodRemarks` VARCHAR(191) NULL,
    `hodSignedAt` DATETIME(3) NULL,
    `dfaId` VARCHAR(191) NULL,
    `dfaName` VARCHAR(191) NULL,
    `dfaSignatureUrl` VARCHAR(191) NULL,
    `dfaRemarks` VARCHAR(191) NULL,
    `dfaSignedAt` DATETIME(3) NULL,
    `cmdId` VARCHAR(191) NULL,
    `cmdName` VARCHAR(191) NULL,
    `cmdSignatureUrl` VARCHAR(191) NULL,
    `cmdRemarks` VARCHAR(191) NULL,
    `cmdSignedAt` DATETIME(3) NULL,
    `rejectedById` VARCHAR(191) NULL,
    `rejectedAt` DATETIME(3) NULL,
    `rejectReason` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Retirement_refNumber_key`(`refNumber`),
    INDEX `Retirement_staffId_idx`(`staffId`),
    INDEX `Retirement_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Training` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'workshop',
    `category` VARCHAR(191) NULL,
    `provider` VARCHAR(191) NULL,
    `facilitator` VARCHAR(191) NULL,
    `location` VARCHAR(191) NULL,
    `mode` VARCHAR(191) NOT NULL DEFAULT 'physical',
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NOT NULL,
    `durationHours` INTEGER NULL,
    `cost` DOUBLE NULL,
    `fundingSource` VARCHAR(191) NULL,
    `targetDesignationId` VARCHAR(191) NULL,
    `targetDepartmentId` VARCHAR(191) NULL,
    `departmentId` VARCHAR(191) NULL,
    `maxParticipants` INTEGER NULL,
    `certificateTemplateUrl` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Open',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Training_code_key`(`code`),
    INDEX `Training_departmentId_idx`(`departmentId`),
    INDEX `Training_status_idx`(`status`),
    INDEX `Training_startDate_idx`(`startDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TrainingEnrollment` (
    `id` VARCHAR(191) NOT NULL,
    `trainingId` VARCHAR(191) NOT NULL,
    `staffId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Enrolled',
    `enrolledAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `attendedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `attendanceRate` DOUBLE NULL,
    `score` DOUBLE NULL,
    `grade` VARCHAR(191) NULL,
    `certificateUrl` VARCHAR(191) NULL,
    `feedbackNotes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TrainingEnrollment_trainingId_idx`(`trainingId`),
    INDEX `TrainingEnrollment_staffId_idx`(`staffId`),
    INDEX `TrainingEnrollment_status_idx`(`status`),
    UNIQUE INDEX `TrainingEnrollment_trainingId_staffId_key`(`trainingId`, `staffId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Project` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'institutional',
    `category` VARCHAR(191) NULL,
    `priority` VARCHAR(191) NOT NULL DEFAULT 'Normal',
    `sponsorId` VARCHAR(191) NULL,
    `departmentId` VARCHAR(191) NULL,
    `unitId` VARCHAR(191) NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NULL,
    `actualEndDate` DATETIME(3) NULL,
    `durationDays` INTEGER NULL,
    `budget` DOUBLE NULL,
    `spent` DOUBLE NOT NULL DEFAULT 0,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'NGN',
    `fundingSource` VARCHAR(191) NULL,
    `progress` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Planned',
    `state` VARCHAR(191) NOT NULL DEFAULT 'open',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Project_code_key`(`code`),
    INDEX `Project_departmentId_idx`(`departmentId`),
    INDEX `Project_status_idx`(`status`),
    INDEX `Project_sponsorId_idx`(`sponsorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProjectMember` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `staffId` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL DEFAULT 'Member',
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `leftAt` DATETIME(3) NULL,
    `contribution` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ProjectMember_projectId_idx`(`projectId`),
    INDEX `ProjectMember_staffId_idx`(`staffId`),
    UNIQUE INDEX `ProjectMember_projectId_staffId_key`(`projectId`, `staffId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProjectMilestone` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `dueDate` DATETIME(3) NOT NULL,
    `completedAt` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Pending',
    `weight` INTEGER NOT NULL DEFAULT 1,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ProjectMilestone_projectId_idx`(`projectId`),
    INDEX `ProjectMilestone_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaymentVoucher` (
    `id` VARCHAR(191) NOT NULL,
    `refNumber` VARCHAR(191) NOT NULL,
    `requisitionId` VARCHAR(191) NULL,
    `pvType` VARCHAR(191) NOT NULL DEFAULT 'treasury_f1',
    `voteNumber` VARCHAR(191) NULL,
    `subHead` VARCHAR(191) NULL,
    `voucherNumber` VARCHAR(191) NULL,
    `classificationCode` VARCHAR(191) NULL,
    `departmentalNumber` VARCHAR(191) NULL,
    `payeeName` VARCHAR(191) NOT NULL,
    `payeeAddress` VARCHAR(191) NULL,
    `payeePhone` VARCHAR(191) NULL,
    `payeeAccountNumber` VARCHAR(191) NULL,
    `payeeBankName` VARCHAR(191) NULL,
    `chequeNumber` VARCHAR(191) NULL,
    `amountNaira` INTEGER NOT NULL DEFAULT 0,
    `amountKobo` INTEGER NOT NULL DEFAULT 0,
    `amountInWords` VARCHAR(191) NULL,
    `lineItems` VARCHAR(191) NULL,
    `payableAt` VARCHAR(191) NULL,
    `paymentStation` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Draft',
    `state` VARCHAR(191) NOT NULL DEFAULT 'open',
    `deskOfficerId` VARCHAR(191) NULL,
    `deskOfficerName` VARCHAR(191) NULL,
    `deskOfficerSignatureUrl` VARCHAR(191) NULL,
    `deskOfficerRemarks` VARCHAR(191) NULL,
    `raisedAt` DATETIME(3) NULL,
    `auditOfficerId` VARCHAR(191) NULL,
    `auditOfficerName` VARCHAR(191) NULL,
    `auditComments` VARCHAR(191) NULL,
    `auditSignatureUrl` VARCHAR(191) NULL,
    `auditReviewedAt` DATETIME(3) NULL,
    `auditApprovedAt` DATETIME(3) NULL,
    `queryText` VARCHAR(191) NULL,
    `queryRaisedAt` DATETIME(3) NULL,
    `queryRaisedById` VARCHAR(191) NULL,
    `initiatorResponse` VARCHAR(191) NULL,
    `initiatorRespondedAt` DATETIME(3) NULL,
    `initiatorRespondedById` VARCHAR(191) NULL,
    `oceName` VARCHAR(191) NULL,
    `oceSignatureUrl` VARCHAR(191) NULL,
    `oceSignedAt` DATETIME(3) NULL,
    `oceRemarks` VARCHAR(191) NULL,
    `payingOfficerId` VARCHAR(191) NULL,
    `payingOfficerName` VARCHAR(191) NULL,
    `payingOfficerSignatureUrl` VARCHAR(191) NULL,
    `paymentAuthorizedAt` DATETIME(3) NULL,
    `paidAt` DATETIME(3) NULL,
    `paidBy` VARCHAR(191) NULL,
    `dfaApprovedPV` BOOLEAN NOT NULL DEFAULT false,
    `dfaApprovedAt` DATETIME(3) NULL,
    `dfaRemarks` VARCHAR(191) NULL,
    `cmdApprovedPV` BOOLEAN NOT NULL DEFAULT false,
    `cmdApprovedAt` DATETIME(3) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PaymentVoucher_refNumber_key`(`refNumber`),
    INDEX `PaymentVoucher_requisitionId_idx`(`requisitionId`),
    INDEX `PaymentVoucher_status_idx`(`status`),
    INDEX `PaymentVoucher_deskOfficerId_idx`(`deskOfficerId`),
    INDEX `PaymentVoucher_auditOfficerId_idx`(`auditOfficerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PVComment` (
    `id` VARCHAR(191) NOT NULL,
    `pvId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'comment',
    `body` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PVComment_pvId_idx`(`pvId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PVAttachment` (
    `id` VARCHAR(191) NOT NULL,
    `pvId` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `fileUrl` VARCHAR(191) NOT NULL,
    `fileSize` INTEGER NULL,
    `mimeType` VARCHAR(191) NULL,
    `uploadedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PVAttachment_pvId_idx`(`pvId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReportTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `category` VARCHAR(191) NOT NULL,
    `accessLevel` VARCHAR(191) NOT NULL DEFAULT 'management',
    `module` VARCHAR(191) NOT NULL DEFAULT 'staff',
    `format` VARCHAR(191) NOT NULL DEFAULT 'both',
    `icon` VARCHAR(191) NULL,
    `hasDateRange` BOOLEAN NOT NULL DEFAULT true,
    `hasDeptFilter` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 100,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ReportTemplate_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GeneratedReport` (
    `id` VARCHAR(191) NOT NULL,
    `templateId` VARCHAR(191) NOT NULL,
    `startDate` DATETIME(3) NULL,
    `endDate` DATETIME(3) NULL,
    `departmentId` VARCHAR(191) NULL,
    `filters` VARCHAR(191) NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `fileUrl` VARCHAR(191) NULL,
    `data` VARCHAR(191) NULL,
    `generatedById` VARCHAR(191) NOT NULL,
    `generatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `GeneratedReport_templateId_idx`(`templateId`),
    INDEX `GeneratedReport_generatedById_idx`(`generatedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PostingTransfer` (
    `id` VARCHAR(191) NOT NULL,
    `refNumber` VARCHAR(191) NOT NULL,
    `staffId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'posting',
    `fromDepartmentId` VARCHAR(191) NULL,
    `fromUnitId` VARCHAR(191) NULL,
    `fromPosition` VARCHAR(191) NULL,
    `fromDesignationId` VARCHAR(191) NULL,
    `toDepartmentId` VARCHAR(191) NULL,
    `toUnitId` VARCHAR(191) NULL,
    `toPosition` VARCHAR(191) NULL,
    `toDesignationId` VARCHAR(191) NULL,
    `reason` VARCHAR(191) NOT NULL,
    `detailedReason` VARCHAR(191) NULL,
    `effectiveDate` DATETIME(3) NOT NULL,
    `reportDeadline` DATETIME(3) NULL,
    `handoverDate` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Submitted',
    `state` VARCHAR(191) NOT NULL DEFAULT 'open',
    `planningReviewedById` VARCHAR(191) NULL,
    `planningReviewedAt` DATETIME(3) NULL,
    `planningRemarks` VARCHAR(191) NULL,
    `hodId` VARCHAR(191) NULL,
    `hodName` VARCHAR(191) NULL,
    `hodSignatureUrl` VARCHAR(191) NULL,
    `hodRemarks` VARCHAR(191) NULL,
    `hodSignedAt` DATETIME(3) NULL,
    `dfaId` VARCHAR(191) NULL,
    `dfaName` VARCHAR(191) NULL,
    `dfaSignatureUrl` VARCHAR(191) NULL,
    `dfaRemarks` VARCHAR(191) NULL,
    `dfaSignedAt` DATETIME(3) NULL,
    `cmdId` VARCHAR(191) NULL,
    `cmdName` VARCHAR(191) NULL,
    `cmdSignatureUrl` VARCHAR(191) NULL,
    `cmdRemarks` VARCHAR(191) NULL,
    `cmdSignedAt` DATETIME(3) NULL,
    `rejectedById` VARCHAR(191) NULL,
    `rejectedAt` DATETIME(3) NULL,
    `rejectReason` VARCHAR(191) NULL,
    `postingLetterUrl` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PostingTransfer_refNumber_key`(`refNumber`),
    INDEX `PostingTransfer_staffId_idx`(`staffId`),
    INDEX `PostingTransfer_status_idx`(`status`),
    INDEX `PostingTransfer_toDepartmentId_idx`(`toDepartmentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Requisition` (
    `id` VARCHAR(191) NOT NULL,
    `refNumber` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `comment` VARCHAR(191) NULL,
    `amount` DOUBLE NULL,
    `priority` VARCHAR(191) NOT NULL DEFAULT 'Normal',
    `status` VARCHAR(191) NOT NULL DEFAULT 'Submitted',
    `state` VARCHAR(191) NOT NULL DEFAULT 'open',
    `createdById` VARCHAR(191) NOT NULL,
    `assigneeId` VARCHAR(191) NULL,
    `targetUserId` VARCHAR(191) NULL,
    `targetDesignationId` VARCHAR(191) NULL,
    `targetDepartmentId` VARCHAR(191) NULL,
    `departmentId` VARCHAR(191) NULL,
    `closedAt` DATETIME(3) NULL,
    `closedById` VARCHAR(191) NULL,
    `closureNote` VARCHAR(191) NULL,
    `cmdId` VARCHAR(191) NULL,
    `cmdName` VARCHAR(191) NULL,
    `cmdSignatureUrl` VARCHAR(191) NULL,
    `cmdRemarks` VARCHAR(191) NULL,
    `cmdSignedAt` DATETIME(3) NULL,
    `dfaId` VARCHAR(191) NULL,
    `dfaName` VARCHAR(191) NULL,
    `dfaSignatureUrl` VARCHAR(191) NULL,
    `dfaRemarks` VARCHAR(191) NULL,
    `dfaSignedAt` DATETIME(3) NULL,
    `daId` VARCHAR(191) NULL,
    `daName` VARCHAR(191) NULL,
    `daSignatureUrl` VARCHAR(191) NULL,
    `daRemarks` VARCHAR(191) NULL,
    `daSignedAt` DATETIME(3) NULL,
    `hodId` VARCHAR(191) NULL,
    `hodName` VARCHAR(191) NULL,
    `hodSignatureUrl` VARCHAR(191) NULL,
    `hodRemarks` VARCHAR(191) NULL,
    `hodSignedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Requisition_refNumber_key`(`refNumber`),
    INDEX `Requisition_status_idx`(`status`),
    INDEX `Requisition_type_idx`(`type`),
    INDEX `Requisition_assigneeId_idx`(`assigneeId`),
    INDEX `Requisition_targetDesignationId_idx`(`targetDesignationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RequisitionRoute` (
    `id` VARCHAR(191) NOT NULL,
    `requisitionId` VARCHAR(191) NOT NULL,
    `fromUserId` VARCHAR(191) NOT NULL,
    `toUserId` VARCHAR(191) NULL,
    `toDesignationId` VARCHAR(191) NULL,
    `toDepartmentId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `remarks` VARCHAR(191) NULL,
    `acknowledgedAt` DATETIME(3) NULL,
    `signerName` VARCHAR(191) NULL,
    `signerDesignation` VARCHAR(191) NULL,
    `signatureUrl` VARCHAR(191) NULL,
    `signedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RequisitionRoute_requisitionId_idx`(`requisitionId`),
    INDEX `RequisitionRoute_toUserId_idx`(`toUserId`),
    INDEX `RequisitionRoute_toDesignationId_idx`(`toDesignationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RequisitionComment` (
    `id` VARCHAR(191) NOT NULL,
    `requisitionId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `body` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RequisitionComment_requisitionId_idx`(`requisitionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RequisitionAttachment` (
    `id` VARCHAR(191) NOT NULL,
    `requisitionId` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `fileUrl` VARCHAR(191) NOT NULL,
    `fileSize` INTEGER NULL,
    `mimeType` VARCHAR(191) NULL,
    `uploadedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RequisitionAttachment_requisitionId_idx`(`requisitionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PasswordResetRequest` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `usernameQuery` VARCHAR(191) NOT NULL,
    `contactEmail` VARCHAR(191) NULL,
    `contactPhone` VARCHAR(191) NULL,
    `note` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `resolvedById` VARCHAR(191) NULL,
    `resolvedAt` DATETIME(3) NULL,
    `resolvedNote` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PasswordResetRequest_status_idx`(`status`),
    INDEX `PasswordResetRequest_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MailMessage` (
    `id` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `body` VARCHAR(191) NOT NULL,
    `fromId` VARCHAR(191) NOT NULL,
    `toId` VARCHAR(191) NOT NULL,
    `requisitionId` VARCHAR(191) NULL,
    `fileId` VARCHAR(191) NULL,
    `priority` VARCHAR(191) NOT NULL DEFAULT 'Normal',
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `isArchived` BOOLEAN NOT NULL DEFAULT false,
    `isStarred` BOOLEAN NOT NULL DEFAULT false,
    `readAt` DATETIME(3) NULL,
    `archivedAt` DATETIME(3) NULL,
    `parentId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MailMessage_toId_isRead_idx`(`toId`, `isRead`),
    INDEX `MailMessage_fromId_idx`(`fromId`),
    INDEX `MailMessage_isArchived_idx`(`isArchived`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `audit_logs_entity_entityId_idx` ON `audit_logs`(`entity`, `entityId`);

-- CreateIndex
CREATE INDEX `documents_category_idx` ON `documents`(`category`);

-- CreateIndex
CREATE INDEX `documents_isPublic_idx` ON `documents`(`isPublic`);

-- CreateIndex
CREATE INDEX `file_routes_toDesignationId_idx` ON `file_routes`(`toDesignationId`);

-- CreateIndex
CREATE INDEX `notifications_userId_isRead_idx` ON `notifications`(`userId`, `isRead`);

-- CreateIndex
CREATE INDEX `registry_files_status_idx` ON `registry_files`(`status`);

-- CreateIndex
CREATE INDEX `registry_files_targetDesignationId_idx` ON `registry_files`(`targetDesignationId`);

-- CreateIndex
CREATE INDEX `registry_files_committeeId_idx` ON `registry_files`(`committeeId`);

-- CreateIndex
CREATE INDEX `staff_ninNumber_idx` ON `staff`(`ninNumber`);

-- CreateIndex
CREATE INDEX `staff_pensionNumber_idx` ON `staff`(`pensionNumber`);

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `staff`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_designationId_fkey` FOREIGN KEY (`designationId`) REFERENCES `designations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `units`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_page_permissions` ADD CONSTRAINT `role_page_permissions_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_page_permissions` ADD CONSTRAINT `role_page_permissions_pageId_fkey` FOREIGN KEY (`pageId`) REFERENCES `pages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_page_permissions` ADD CONSTRAINT `role_page_permissions_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `departments` ADD CONSTRAINT `departments_hodUserId_fkey` FOREIGN KEY (`hodUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `units` ADD CONSTRAINT `units_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `units` ADD CONSTRAINT `units_houUserId_fkey` FOREIGN KEY (`houUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `designations` ADD CONSTRAINT `designations_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `staff` ADD CONSTRAINT `staff_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `staff` ADD CONSTRAINT `staff_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `units`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `staff` ADD CONSTRAINT `staff_designationId_fkey` FOREIGN KEY (`designationId`) REFERENCES `designations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `next_of_kin` ADD CONSTRAINT `next_of_kin_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `staff`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bank_details` ADD CONSTRAINT `bank_details_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `staff`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `academic_background` ADD CONSTRAINT `academic_background_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `staff`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dependants` ADD CONSTRAINT `dependants_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `staff`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Duty` ADD CONSTRAINT `Duty_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `staff`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AnnualReview` ADD CONSTRAINT `AnnualReview_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `staff`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MonthlyAppraisal` ADD CONSTRAINT `MonthlyAppraisal_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `staff`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuarterlyReview` ADD CONSTRAINT `QuarterlyReview_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `staff`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Assessment` ADD CONSTRAINT `Assessment_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `staff`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Appraisal` ADD CONSTRAINT `Appraisal_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `staff`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Leave` ADD CONSTRAINT `Leave_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `staff`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Leave` ADD CONSTRAINT `Leave_leaveTypeId_fkey` FOREIGN KEY (`leaveTypeId`) REFERENCES `LeaveType`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Leave` ADD CONSTRAINT `Leave_currentHolderId_fkey` FOREIGN KEY (`currentHolderId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeaveRoute` ADD CONSTRAINT `LeaveRoute_leaveId_fkey` FOREIGN KEY (`leaveId`) REFERENCES `Leave`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeaveRoute` ADD CONSTRAINT `LeaveRoute_fromUserId_fkey` FOREIGN KEY (`fromUserId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeaveRoute` ADD CONSTRAINT `LeaveRoute_toUserId_fkey` FOREIGN KEY (`toUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Promotion` ADD CONSTRAINT `Promotion_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `staff`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Termination` ADD CONSTRAINT `Termination_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `staff`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Resignation` ADD CONSTRAINT `Resignation_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `staff`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Retirement` ADD CONSTRAINT `Retirement_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `staff`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Training` ADD CONSTRAINT `Training_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TrainingEnrollment` ADD CONSTRAINT `TrainingEnrollment_trainingId_fkey` FOREIGN KEY (`trainingId`) REFERENCES `Training`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TrainingEnrollment` ADD CONSTRAINT `TrainingEnrollment_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `staff`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Project` ADD CONSTRAINT `Project_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Project` ADD CONSTRAINT `Project_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `units`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectMember` ADD CONSTRAINT `ProjectMember_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectMember` ADD CONSTRAINT `ProjectMember_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `staff`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectMilestone` ADD CONSTRAINT `ProjectMilestone_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentVoucher` ADD CONSTRAINT `PaymentVoucher_requisitionId_fkey` FOREIGN KEY (`requisitionId`) REFERENCES `Requisition`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PVComment` ADD CONSTRAINT `PVComment_pvId_fkey` FOREIGN KEY (`pvId`) REFERENCES `PaymentVoucher`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PVComment` ADD CONSTRAINT `PVComment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PVAttachment` ADD CONSTRAINT `PVAttachment_pvId_fkey` FOREIGN KEY (`pvId`) REFERENCES `PaymentVoucher`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GeneratedReport` ADD CONSTRAINT `GeneratedReport_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `ReportTemplate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PostingTransfer` ADD CONSTRAINT `PostingTransfer_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `staff`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PostingTransfer` ADD CONSTRAINT `PostingTransfer_toDepartmentId_fkey` FOREIGN KEY (`toDepartmentId`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PostingTransfer` ADD CONSTRAINT `PostingTransfer_toUnitId_fkey` FOREIGN KEY (`toUnitId`) REFERENCES `units`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PostingTransfer` ADD CONSTRAINT `PostingTransfer_toDesignationId_fkey` FOREIGN KEY (`toDesignationId`) REFERENCES `designations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Requisition` ADD CONSTRAINT `Requisition_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Requisition` ADD CONSTRAINT `Requisition_assigneeId_fkey` FOREIGN KEY (`assigneeId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Requisition` ADD CONSTRAINT `Requisition_targetUserId_fkey` FOREIGN KEY (`targetUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Requisition` ADD CONSTRAINT `Requisition_targetDesignationId_fkey` FOREIGN KEY (`targetDesignationId`) REFERENCES `designations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Requisition` ADD CONSTRAINT `Requisition_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Requisition` ADD CONSTRAINT `Requisition_closedById_fkey` FOREIGN KEY (`closedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RequisitionRoute` ADD CONSTRAINT `RequisitionRoute_requisitionId_fkey` FOREIGN KEY (`requisitionId`) REFERENCES `Requisition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RequisitionRoute` ADD CONSTRAINT `RequisitionRoute_fromUserId_fkey` FOREIGN KEY (`fromUserId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RequisitionRoute` ADD CONSTRAINT `RequisitionRoute_toUserId_fkey` FOREIGN KEY (`toUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RequisitionRoute` ADD CONSTRAINT `RequisitionRoute_toDesignationId_fkey` FOREIGN KEY (`toDesignationId`) REFERENCES `designations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RequisitionComment` ADD CONSTRAINT `RequisitionComment_requisitionId_fkey` FOREIGN KEY (`requisitionId`) REFERENCES `Requisition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RequisitionComment` ADD CONSTRAINT `RequisitionComment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RequisitionAttachment` ADD CONSTRAINT `RequisitionAttachment_requisitionId_fkey` FOREIGN KEY (`requisitionId`) REFERENCES `Requisition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `registry_files` ADD CONSTRAINT `registry_files_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `registry_files` ADD CONSTRAINT `registry_files_currentHolderId_fkey` FOREIGN KEY (`currentHolderId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `registry_files` ADD CONSTRAINT `registry_files_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `registry_files` ADD CONSTRAINT `registry_files_committeeId_fkey` FOREIGN KEY (`committeeId`) REFERENCES `committees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `registry_files` ADD CONSTRAINT `registry_files_targetUserId_fkey` FOREIGN KEY (`targetUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `registry_files` ADD CONSTRAINT `registry_files_targetDesignationId_fkey` FOREIGN KEY (`targetDesignationId`) REFERENCES `designations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `committees` ADD CONSTRAINT `committees_chairpersonId_fkey` FOREIGN KEY (`chairpersonId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `committees` ADD CONSTRAINT `committees_secretaryId_fkey` FOREIGN KEY (`secretaryId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `committee_members` ADD CONSTRAINT `committee_members_committeeId_fkey` FOREIGN KEY (`committeeId`) REFERENCES `committees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `committee_members` ADD CONSTRAINT `committee_members_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `staff`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `committee_members` ADD CONSTRAINT `committee_members_addedById_fkey` FOREIGN KEY (`addedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PasswordResetRequest` ADD CONSTRAINT `PasswordResetRequest_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PasswordResetRequest` ADD CONSTRAINT `PasswordResetRequest_resolvedById_fkey` FOREIGN KEY (`resolvedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `file_routes` ADD CONSTRAINT `file_routes_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `registry_files`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `file_routes` ADD CONSTRAINT `file_routes_fromUserId_fkey` FOREIGN KEY (`fromUserId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `file_routes` ADD CONSTRAINT `file_routes_toUserId_fkey` FOREIGN KEY (`toUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `file_routes` ADD CONSTRAINT `file_routes_toDesignationId_fkey` FOREIGN KEY (`toDesignationId`) REFERENCES `designations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `file_attachments` ADD CONSTRAINT `file_attachments_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `registry_files`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `file_comments` ADD CONSTRAINT `file_comments_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `registry_files`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `file_comments` ADD CONSTRAINT `file_comments_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MailMessage` ADD CONSTRAINT `MailMessage_fromId_fkey` FOREIGN KEY (`fromId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MailMessage` ADD CONSTRAINT `MailMessage_toId_fkey` FOREIGN KEY (`toId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MailMessage` ADD CONSTRAINT `MailMessage_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `MailMessage`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `staff`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_committeeId_fkey` FOREIGN KEY (`committeeId`) REFERENCES `committees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- RedefineIndex
CREATE INDEX `academic_background_staffId_idx` ON `academic_background`(`staffId`);
DROP INDEX `idx_ab_staffId` ON `academic_background`;

-- RedefineIndex
CREATE INDEX `audit_logs_userId_idx` ON `audit_logs`(`userId`);
DROP INDEX `idx_audit_userId` ON `audit_logs`;

-- RedefineIndex
CREATE INDEX `bank_details_staffId_idx` ON `bank_details`(`staffId`);
DROP INDEX `idx_bd_staffId` ON `bank_details`;

-- RedefineIndex
CREATE INDEX `committee_members_committeeId_idx` ON `committee_members`(`committeeId`);
DROP INDEX `idx_cm_committeeId` ON `committee_members`;

-- RedefineIndex
CREATE INDEX `committee_members_staffId_idx` ON `committee_members`(`staffId`);
DROP INDEX `idx_cm_staffId` ON `committee_members`;

-- RedefineIndex
CREATE UNIQUE INDEX `committee_members_committeeId_staffId_key` ON `committee_members`(`committeeId`, `staffId`);
DROP INDEX `uk_committee_staff` ON `committee_members`;

-- RedefineIndex
CREATE UNIQUE INDEX `committees_code_key` ON `committees`(`code`);
DROP INDEX `code` ON `committees`;

-- RedefineIndex
CREATE INDEX `committees_isActive_idx` ON `committees`(`isActive`);
DROP INDEX `idx_committees_isActive` ON `committees`;

-- RedefineIndex
CREATE UNIQUE INDEX `departments_code_key` ON `departments`(`code`);
DROP INDEX `code` ON `departments`;

-- RedefineIndex
CREATE UNIQUE INDEX `departments_hodUserId_key` ON `departments`(`hodUserId`);
DROP INDEX `hodUserId` ON `departments`;

-- RedefineIndex
CREATE INDEX `dependants_staffId_idx` ON `dependants`(`staffId`);
DROP INDEX `idx_dep_staffId` ON `dependants`;

-- RedefineIndex
CREATE UNIQUE INDEX `designations_code_key` ON `designations`(`code`);
DROP INDEX `code` ON `designations`;

-- RedefineIndex
CREATE UNIQUE INDEX `documents_fileNumber_key` ON `documents`(`fileNumber`);
DROP INDEX `fileNumber` ON `documents`;

-- RedefineIndex
CREATE INDEX `documents_uploadedById_idx` ON `documents`(`uploadedById`);
DROP INDEX `fk_doc_uploader` ON `documents`;

-- RedefineIndex
CREATE INDEX `documents_committeeId_idx` ON `documents`(`committeeId`);
DROP INDEX `idx_documents_committeeId` ON `documents`;

-- RedefineIndex
CREATE INDEX `documents_fileNumber_idx` ON `documents`(`fileNumber`);
DROP INDEX `idx_documents_fileNumber` ON `documents`;

-- RedefineIndex
CREATE INDEX `documents_staffId_idx` ON `documents`(`staffId`);
DROP INDEX `idx_documents_staffId` ON `documents`;

-- RedefineIndex
CREATE INDEX `file_attachments_fileId_idx` ON `file_attachments`(`fileId`);
DROP INDEX `idx_fa_fileId` ON `file_attachments`;

-- RedefineIndex
CREATE INDEX `file_comments_fileId_idx` ON `file_comments`(`fileId`);
DROP INDEX `idx_fc_fileId` ON `file_comments`;

-- RedefineIndex
CREATE INDEX `file_routes_fileId_idx` ON `file_routes`(`fileId`);
DROP INDEX `idx_fr_fileId` ON `file_routes`;

-- RedefineIndex
CREATE INDEX `file_routes_toUserId_idx` ON `file_routes`(`toUserId`);
DROP INDEX `idx_fr_toUserId` ON `file_routes`;

-- RedefineIndex
CREATE INDEX `next_of_kin_staffId_idx` ON `next_of_kin`(`staffId`);
DROP INDEX `idx_nok_staffId` ON `next_of_kin`;

-- RedefineIndex
CREATE UNIQUE INDEX `pages_key_key` ON `pages`(`key`);
DROP INDEX `key` ON `pages`;

-- RedefineIndex
CREATE UNIQUE INDEX `registry_files_fileNumber_key` ON `registry_files`(`fileNumber`);
DROP INDEX `fileNumber` ON `registry_files`;

-- RedefineIndex
CREATE INDEX `registry_files_currentHolderId_idx` ON `registry_files`(`currentHolderId`);
DROP INDEX `fk_rf_holder` ON `registry_files`;

-- RedefineIndex
CREATE INDEX `role_page_permissions_pageId_idx` ON `role_page_permissions`(`pageId`);
DROP INDEX `idx_rpp_pageId` ON `role_page_permissions`;

-- RedefineIndex
CREATE INDEX `role_page_permissions_roleId_idx` ON `role_page_permissions`(`roleId`);
DROP INDEX `idx_rpp_roleId` ON `role_page_permissions`;

-- RedefineIndex
CREATE UNIQUE INDEX `role_page_permissions_roleId_pageId_key` ON `role_page_permissions`(`roleId`, `pageId`);
DROP INDEX `uk_role_page` ON `role_page_permissions`;

-- RedefineIndex
CREATE UNIQUE INDEX `roles_code_key` ON `roles`(`code`);
DROP INDEX `code` ON `roles`;

-- RedefineIndex
CREATE INDEX `staff_departmentId_idx` ON `staff`(`departmentId`);
DROP INDEX `idx_staff_departmentId` ON `staff`;

-- RedefineIndex
CREATE INDEX `staff_status_idx` ON `staff`(`status`);
DROP INDEX `idx_staff_status` ON `staff`;

-- RedefineIndex
CREATE UNIQUE INDEX `staff_staffId_key` ON `staff`(`staffId`);
DROP INDEX `staffId` ON `staff`;

-- RedefineIndex
CREATE UNIQUE INDEX `staff_userId_key` ON `staff`(`userId`);
DROP INDEX `userId` ON `staff`;

-- RedefineIndex
CREATE UNIQUE INDEX `units_code_key` ON `units`(`code`);
DROP INDEX `code` ON `units`;

-- RedefineIndex
CREATE UNIQUE INDEX `units_houUserId_key` ON `units`(`houUserId`);
DROP INDEX `houUserId` ON `units`;

-- RedefineIndex
CREATE INDEX `units_departmentId_idx` ON `units`(`departmentId`);
DROP INDEX `idx_units_departmentId` ON `units`;

-- RedefineIndex
CREATE UNIQUE INDEX `users_email_key` ON `users`(`email`);
DROP INDEX `email` ON `users`;

-- RedefineIndex
CREATE INDEX `users_role_idx` ON `users`(`role`);
DROP INDEX `idx_users_role` ON `users`;

-- RedefineIndex
CREATE UNIQUE INDEX `users_staffId_key` ON `users`(`staffId`);
DROP INDEX `staffId` ON `users`;

-- RedefineIndex
CREATE UNIQUE INDEX `users_username_key` ON `users`(`username`);
DROP INDEX `username` ON `users`;

