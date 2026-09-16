-- AlterEnum: leads nobody looked at for 30 days are retired by the daily cron (T05).
ALTER TYPE "LeadStatus" ADD VALUE 'EXPIRED';
