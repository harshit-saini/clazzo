/*
  Warnings:

  - You are about to drop the column `portalEmail` on the `Student` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Student_portalEmail_key";

-- AlterTable
ALTER TABLE "Batch" ADD COLUMN     "gradeId" TEXT;

-- AlterTable
ALTER TABLE "Student" DROP COLUMN "portalEmail",
ADD COLUMN     "gradeId" TEXT,
ADD COLUMN     "studentAccountId" TEXT;

-- CreateTable
CREATE TABLE "StudentAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grade" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Grade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudentAccount_email_key" ON "StudentAccount"("email");

-- CreateIndex
CREATE INDEX "Grade_instituteId_idx" ON "Grade"("instituteId");

-- CreateIndex
CREATE UNIQUE INDEX "Grade_instituteId_name_key" ON "Grade"("instituteId", "name");

-- CreateIndex
CREATE INDEX "Student_studentAccountId_idx" ON "Student"("studentAccountId");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_studentAccountId_fkey" FOREIGN KEY ("studentAccountId") REFERENCES "StudentAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE SET NULL ON UPDATE CASCADE;
