-- AlterTable
ALTER TABLE "tax_rules"
ADD COLUMN "transaction_type" TEXT,
ADD COLUMN "customer_type" TEXT,
ADD COLUMN "origin" TEXT,
ADD COLUMN "source" TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN "payload" JSONB;
