-- CreateEnum
CREATE TYPE "FollowUpContext" AS ENUM ('AFTER_APPLYING', 'AFTER_INTERVIEW', 'NUDGE');

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "context" "FollowUpContext";
