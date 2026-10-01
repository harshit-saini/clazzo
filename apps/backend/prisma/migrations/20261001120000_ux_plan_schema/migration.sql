-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('LOGIN', 'CONSENT');

-- AlterEnum
ALTER TYPE "ConsentStatus" ADD VALUE 'REVOKED';

-- AlterEnum
ALTER TYPE "InvoiceStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "OtpCode" ADD COLUMN "purpose" "OtpPurpose" NOT NULL DEFAULT 'LOGIN';

-- AlterTable
ALTER TABLE "Student" ADD COLUMN "consentRevokedAt" TIMESTAMP(3),
ADD COLUMN "isMinor" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "FeeInvoice" ADD COLUMN "period" TEXT;

-- CreateIndex
CREATE INDEX "OtpCode_email_purpose_idx" ON "OtpCode"("email", "purpose");

-- CreateIndex
CREATE INDEX "FeeInvoice_orgUnitId_period_idx" ON "FeeInvoice"("orgUnitId", "period");
