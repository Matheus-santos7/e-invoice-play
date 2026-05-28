-- AlterTable
ALTER TABLE "nfes" ADD COLUMN "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ctes" ADD COLUMN "deleted_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "idx_nfe_tenant_deleted" ON "nfes"("tenant_id", "deleted_at");

-- CreateIndex
CREATE INDEX "idx_cte_tenant_deleted" ON "ctes"("tenant_id", "deleted_at");
