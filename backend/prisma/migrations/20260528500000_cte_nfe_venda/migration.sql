-- CT-e de transporte vinculado à NF-e de venda
ALTER TABLE "ctes" ADD COLUMN "nfe_venda_id" TEXT;

CREATE UNIQUE INDEX "ctes_nfe_venda_id_key" ON "ctes"("nfe_venda_id");

ALTER TABLE "ctes" ADD CONSTRAINT "ctes_nfe_venda_id_fkey" FOREIGN KEY ("nfe_venda_id") REFERENCES "nfes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
