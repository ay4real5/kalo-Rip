-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "email_opt_in" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sms_opt_in" BOOLEAN NOT NULL DEFAULT true;
