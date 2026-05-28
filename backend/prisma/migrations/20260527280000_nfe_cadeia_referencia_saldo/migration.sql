-- AlterEnum
ALTER TYPE "NFeTipo" ADD VALUE 'RETORNO_SIMBOLICO';
ALTER TYPE "NFeTipo" ADD VALUE 'DEVOLUCAO';

-- AlterTable
ALTER TABLE "nfes" ADD COLUMN "saldo_disponivel" INTEGER;
ALTER TABLE "nfes" ADD COLUMN "nfe_referencia_id" TEXT;

-- Backfill saldo remessas existentes
UPDATE "nfes" SET "saldo_disponivel" = "quantidade" WHERE "tipo" = 'REMESSA' AND "saldo_disponivel" IS NULL;

-- CreateTable
CREATE TABLE "nfe_remessa_consumos" (
    "id" TEXT NOT NULL,
    "retorno_nfe_id" TEXT NOT NULL,
    "remessa_nfe_id" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nfe_remessa_consumos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_nfe_remessa_consumo_retorno" ON "nfe_remessa_consumos"("retorno_nfe_id");
CREATE INDEX "idx_nfe_remessa_consumo_remessa" ON "nfe_remessa_consumos"("remessa_nfe_id");
CREATE UNIQUE INDEX "nfe_remessa_consumos_retorno_remessa_key" ON "nfe_remessa_consumos"("retorno_nfe_id", "remessa_nfe_id");

-- CreateIndex
CREATE INDEX "idx_nfe_referencia_id" ON "nfes"("nfe_referencia_id");

-- AddForeignKey
ALTER TABLE "nfes" ADD CONSTRAINT "nfes_nfe_referencia_id_fkey" FOREIGN KEY ("nfe_referencia_id") REFERENCES "nfes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "nfe_remessa_consumos" ADD CONSTRAINT "nfe_remessa_consumos_retorno_nfe_id_fkey" FOREIGN KEY ("retorno_nfe_id") REFERENCES "nfes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "nfe_remessa_consumos" ADD CONSTRAINT "nfe_remessa_consumos_remessa_nfe_id_fkey" FOREIGN KEY ("remessa_nfe_id") REFERENCES "nfes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
