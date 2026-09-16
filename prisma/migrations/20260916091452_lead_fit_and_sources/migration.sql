-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LeadSource" ADD VALUE 'WORKABLE';
ALTER TYPE "LeadSource" ADD VALUE 'BOOKMARKLET';

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "fitScore" INTEGER,
ADD COLUMN     "matchedTerms" TEXT[];

-- CreateIndex
CREATE INDEX "Lead_userId_status_fitScore_idx" ON "Lead"("userId", "status", "fitScore");
