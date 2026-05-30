-- CreateEnum
CREATE TYPE "OperacaoFiscalTipo" AS ENUM ('REMESSA', 'AVANCO_CD', 'RETORNO_SIMBOLICO', 'VENDA', 'DEVOLUCAO', 'REMESSA_SIMBOLICA');

-- CreateTable
CREATE TABLE "meli_unidades_logisticas" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "codigo" VARCHAR(32) NOT NULL,
    "nome" TEXT NOT NULL,
    "dest_nome_fiscal" TEXT NOT NULL DEFAULT 'EBAZAR.COM.BR LTDA',
    "cnpj" VARCHAR(14) NOT NULL,
    "ie" TEXT,
    "logradouro" TEXT NOT NULL,
    "numero" TEXT NOT NULL DEFAULT 'SN',
    "complemento" TEXT,
    "bairro" TEXT NOT NULL DEFAULT '',
    "municipio" TEXT NOT NULL,
    "uf" VARCHAR(2) NOT NULL,
    "cep" VARCHAR(8) NOT NULL,
    "codigo_municipio" VARCHAR(7) NOT NULL DEFAULT '',
    "codigo_pais" INTEGER NOT NULL DEFAULT 1058,
    "nome_pais" TEXT NOT NULL DEFAULT 'Brasil',
    "ind_ie_dest" INTEGER NOT NULL DEFAULT 1,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meli_unidades_logisticas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimentacoes_produto" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "tipo_operacao" "OperacaoFiscalTipo" NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "unidade_origem_id" TEXT,
    "unidade_destino_id" TEXT,
    "nfe_id" TEXT NOT NULL,
    "nfe_secundaria_id" TEXT,
    "observacao" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimentacoes_produto_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN "unidade_logistica_padrao_id" TEXT;

-- AlterTable
ALTER TABLE "nfes" ADD COLUMN "unidade_destino_id" TEXT,
ADD COLUMN "unidade_origem_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "meli_unidades_logisticas_tenant_id_cnpj_key" ON "meli_unidades_logisticas"("tenant_id", "cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "meli_unidades_logisticas_tenant_id_codigo_key" ON "meli_unidades_logisticas"("tenant_id", "codigo");

-- CreateIndex
CREATE INDEX "meli_unidades_logisticas_tenant_id_ativa_idx" ON "meli_unidades_logisticas"("tenant_id", "ativa");

-- CreateIndex
CREATE INDEX "movimentacoes_produto_tenant_id_product_id_created_at_idx" ON "movimentacoes_produto"("tenant_id", "product_id", "created_at");

-- CreateIndex
CREATE INDEX "movimentacoes_produto_nfe_id_idx" ON "movimentacoes_produto"("nfe_id");

-- CreateIndex
CREATE INDEX "idx_nfe_unidade_destino" ON "nfes"("unidade_destino_id");

-- AddForeignKey
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_unidade_logistica_padrao_id_fkey" FOREIGN KEY ("unidade_logistica_padrao_id") REFERENCES "meli_unidades_logisticas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meli_unidades_logisticas" ADD CONSTRAINT "meli_unidades_logisticas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_produto" ADD CONSTRAINT "movimentacoes_produto_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_produto" ADD CONSTRAINT "movimentacoes_produto_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_produto" ADD CONSTRAINT "movimentacoes_produto_unidade_origem_id_fkey" FOREIGN KEY ("unidade_origem_id") REFERENCES "meli_unidades_logisticas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_produto" ADD CONSTRAINT "movimentacoes_produto_unidade_destino_id_fkey" FOREIGN KEY ("unidade_destino_id") REFERENCES "meli_unidades_logisticas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_produto" ADD CONSTRAINT "movimentacoes_produto_nfe_id_fkey" FOREIGN KEY ("nfe_id") REFERENCES "nfes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_produto" ADD CONSTRAINT "movimentacoes_produto_nfe_secundaria_id_fkey" FOREIGN KEY ("nfe_secundaria_id") REFERENCES "nfes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nfes" ADD CONSTRAINT "nfes_unidade_destino_id_fkey" FOREIGN KEY ("unidade_destino_id") REFERENCES "meli_unidades_logisticas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nfes" ADD CONSTRAINT "nfes_unidade_origem_id_fkey" FOREIGN KEY ("unidade_origem_id") REFERENCES "meli_unidades_logisticas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
