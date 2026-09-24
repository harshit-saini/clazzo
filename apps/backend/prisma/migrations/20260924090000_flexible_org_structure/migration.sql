-- Flexible org structure: Grade and Batch collapse into the OrgUnit tree,
-- and a Batch's subject becomes a Course.
--
-- Clean break (agreed with the product owner): structure-dependent rows
-- cannot be mapped onto the new shape without inventing an org tree, so
-- they are cleared first and re-created through the app. Institutes,
-- staff, student records and student accounts are all preserved.
DELETE FROM "Attendance";
DELETE FROM "FeePayment";
DELETE FROM "FeeInvoice";
DELETE FROM "FeeStructure";
DELETE FROM "ClassSession";
DELETE FROM "ScheduleSlot";
DELETE FROM "Enrollment";

-- CreateEnum
CREATE TYPE "OrgType" AS ENUM ('SCHOOL', 'COLLEGE', 'COACHING', 'TUTOR');

-- CreateEnum
CREATE TYPE "CourseEnrollmentMode" AS ENUM ('ALL_IN_UNIT', 'SELECTED');

-- DropForeignKey
ALTER TABLE "Batch" DROP CONSTRAINT "Batch_gradeId_fkey";

-- DropForeignKey
ALTER TABLE "Batch" DROP CONSTRAINT "Batch_instituteId_fkey";

-- DropForeignKey
ALTER TABLE "Batch" DROP CONSTRAINT "Batch_primaryTeacherId_fkey";

-- DropForeignKey
ALTER TABLE "ClassSession" DROP CONSTRAINT "ClassSession_batchId_fkey";

-- DropForeignKey
ALTER TABLE "Enrollment" DROP CONSTRAINT "Enrollment_batchId_fkey";

-- DropForeignKey
ALTER TABLE "FeeStructure" DROP CONSTRAINT "FeeStructure_batchId_fkey";

-- DropForeignKey
ALTER TABLE "Grade" DROP CONSTRAINT "Grade_instituteId_fkey";

-- DropForeignKey
ALTER TABLE "ScheduleSlot" DROP CONSTRAINT "ScheduleSlot_batchId_fkey";

-- DropForeignKey
ALTER TABLE "Student" DROP CONSTRAINT "Student_gradeId_fkey";

-- DropIndex
DROP INDEX "ClassSession_batchId_date_idx";

-- DropIndex
DROP INDEX "ClassSession_batchId_date_startTime_key";

-- DropIndex
DROP INDEX "Enrollment_batchId_studentId_key";

-- DropIndex
DROP INDEX "FeeStructure_batchId_key";

-- DropIndex
DROP INDEX "ScheduleSlot_batchId_idx";

-- AlterTable
ALTER TABLE "ClassSession" DROP COLUMN "batchId",
ADD COLUMN     "courseId" TEXT,
ADD COLUMN     "orgUnitId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Enrollment" DROP COLUMN "batchId",
ADD COLUMN     "orgUnitId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "FeeInvoice" DROP COLUMN "batchId",
ADD COLUMN     "orgUnitId" TEXT;

-- AlterTable
ALTER TABLE "FeeStructure" DROP COLUMN "batchId",
ADD COLUMN     "orgUnitId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Institute" ADD COLUMN     "type" "OrgType" NOT NULL DEFAULT 'COACHING';

-- AlterTable
ALTER TABLE "ScheduleSlot" DROP COLUMN "batchId",
ADD COLUMN     "courseId" TEXT,
ADD COLUMN     "orgUnitId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Student" DROP COLUMN "gradeId";

-- DropTable
DROP TABLE "Batch";

-- DropTable
DROP TABLE "Grade";

-- CreateTable
CREATE TABLE "OrgLevel" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "depth" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgUnit" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "parentId" TEXT,
    "levelId" TEXT,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "orgUnitId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "teacherId" TEXT,
    "enrollmentMode" "CourseEnrollmentMode" NOT NULL DEFAULT 'ALL_IN_UNIT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseEnrollment" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrgLevel_instituteId_idx" ON "OrgLevel"("instituteId");

-- CreateIndex
CREATE UNIQUE INDEX "OrgLevel_instituteId_depth_key" ON "OrgLevel"("instituteId", "depth");

-- CreateIndex
CREATE INDEX "OrgUnit_instituteId_isActive_idx" ON "OrgUnit"("instituteId", "isActive");

-- CreateIndex
CREATE INDEX "OrgUnit_instituteId_parentId_idx" ON "OrgUnit"("instituteId", "parentId");

-- CreateIndex
CREATE INDEX "OrgUnit_path_idx" ON "OrgUnit"("path");

-- CreateIndex
CREATE INDEX "Course_instituteId_isActive_idx" ON "Course"("instituteId", "isActive");

-- CreateIndex
CREATE INDEX "Course_orgUnitId_idx" ON "Course"("orgUnitId");

-- CreateIndex
CREATE INDEX "CourseEnrollment_studentId_idx" ON "CourseEnrollment"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseEnrollment_courseId_studentId_key" ON "CourseEnrollment"("courseId", "studentId");

-- CreateIndex
CREATE INDEX "ClassSession_orgUnitId_date_idx" ON "ClassSession"("orgUnitId", "date");

-- CreateIndex
CREATE INDEX "ClassSession_courseId_date_idx" ON "ClassSession"("courseId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ClassSession_orgUnitId_courseId_date_startTime_key" ON "ClassSession"("orgUnitId", "courseId", "date", "startTime");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_orgUnitId_studentId_key" ON "Enrollment"("orgUnitId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "FeeStructure_orgUnitId_key" ON "FeeStructure"("orgUnitId");

-- CreateIndex
CREATE INDEX "ScheduleSlot_orgUnitId_idx" ON "ScheduleSlot"("orgUnitId");

-- CreateIndex
CREATE INDEX "ScheduleSlot_courseId_idx" ON "ScheduleSlot"("courseId");

-- AddForeignKey
ALTER TABLE "OrgLevel" ADD CONSTRAINT "OrgLevel_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgUnit" ADD CONSTRAINT "OrgUnit_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgUnit" ADD CONSTRAINT "OrgUnit_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "OrgUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgUnit" ADD CONSTRAINT "OrgUnit_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "OrgLevel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseEnrollment" ADD CONSTRAINT "CourseEnrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseEnrollment" ADD CONSTRAINT "CourseEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleSlot" ADD CONSTRAINT "ScheduleSlot_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleSlot" ADD CONSTRAINT "ScheduleSlot_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeStructure" ADD CONSTRAINT "FeeStructure_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeInvoice" ADD CONSTRAINT "FeeInvoice_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

