-- AlterTable
ALTER TABLE "StudentAccount" ADD COLUMN "isMinor" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "guardianEmail" TEXT;
