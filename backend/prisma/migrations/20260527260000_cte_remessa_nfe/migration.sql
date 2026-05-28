-- AlterTable
ALTER TABLE "tenants" ADD COLUMN "serie_cte" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "ctes" ADD COLUMN "serie" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ctes" ADD COLUMN "cfop" VARCHAR(4) NOT NULL DEFAULT '6353';
ALTER TABLE "ctes" ADD COLUMN "nat_op" TEXT NOT NULL DEFAULT 'PRESTAÇÕES DE SERVIÇOS DE TRANSPORTE';
ALTER TABLE "ctes" ADD COLUMN "valor_carga" DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE "ctes" ADD COLUMN "peso_carga" DECIMAL(15,4) NOT NULL DEFAULT 0;
ALTER TABLE "ctes" ADD COLUMN "nfe_remessa_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ctes_nfe_remessa_id_key" ON "ctes"("nfe_remessa_id");

-- AddForeignKey
ALTER TABLE "ctes" ADD CONSTRAINT "ctes_nfe_remessa_id_fkey" FOREIGN KEY ("nfe_remessa_id") REFERENCES "nfes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
