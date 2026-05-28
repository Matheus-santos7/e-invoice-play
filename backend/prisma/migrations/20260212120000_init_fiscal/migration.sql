-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "EnvironmentKind" AS ENUM ('HOMOLOGACAO', 'PRODUCAO');

-- CreateEnum
CREATE TYPE "FiscalStatus" AS ENUM ('AUTORIZADA', 'PENDENTE', 'REJEITADA', 'CANCELADA', 'DENEGADA');

-- CreateEnum
CREATE TYPE "CteModal" AS ENUM ('RODOVIARIO', 'AEREO');

-- CreateEnum
CREATE TYPE "TimelineStatus" AS ENUM ('DONE', 'CURRENT', 'PENDING');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "razao_social" TEXT NOT NULL,
    "nome_fantasia" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "ie" TEXT NOT NULL,
    "uf" VARCHAR(2) NOT NULL,
    "ambiente" "EnvironmentKind" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ncm" TEXT NOT NULL,
    "cest" TEXT NOT NULL,
    "origem" INTEGER NOT NULL,
    "unidade" TEXT NOT NULL,
    "preco" DECIMAL(15,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nfes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "chave" VARCHAR(44) NOT NULL,
    "numero" INTEGER NOT NULL,
    "serie" INTEGER NOT NULL,
    "nat_op" TEXT NOT NULL,
    "cfop" VARCHAR(4) NOT NULL,
    "ncm" TEXT NOT NULL,
    "dest_nome" TEXT NOT NULL,
    "dest_doc" TEXT NOT NULL,
    "dest_uf" VARCHAR(2) NOT NULL,
    "valor" DECIMAL(15,2) NOT NULL,
    "valor_icms" DECIMAL(15,2) NOT NULL,
    "aliq_icms" DECIMAL(5,2) NOT NULL,
    "status" "FiscalStatus" NOT NULL,
    "emitida_em" TIMESTAMP(3) NOT NULL,
    "pedido_ml" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nfes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ctes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "chave" VARCHAR(44) NOT NULL,
    "numero" INTEGER NOT NULL,
    "modal" "CteModal" NOT NULL,
    "origem" TEXT NOT NULL,
    "destino" TEXT NOT NULL,
    "valor" DECIMAL(15,2) NOT NULL,
    "status" "FiscalStatus" NOT NULL,
    "emitido_em" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ctes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal_events" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "nfe_id" TEXT NOT NULL,
    "tipo" VARCHAR(6) NOT NULL,
    "descricao" TEXT NOT NULL,
    "ocorrido_em" TIMESTAMP(3) NOT NULL,
    "protocolo" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fiscal_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "ator" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "recurso" TEXT NOT NULL,
    "ocorrido_em" TIMESTAMP(3) NOT NULL,
    "hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timeline_steps" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "status" "TimelineStatus" NOT NULL,
    "at_time" TEXT,
    "meta" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timeline_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_rules" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "uf" TEXT NOT NULL,
    "cfop" TEXT NOT NULL,
    "aliquota" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_product_tenant_id" ON "products"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_product_tenant_sku" ON "products"("tenant_id", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "nfes_chave_key" ON "nfes"("chave");

-- CreateIndex
CREATE INDEX "idx_nfe_tenant_id" ON "nfes"("tenant_id");

-- CreateIndex
CREATE INDEX "idx_nfe_tenant_emitida" ON "nfes"("tenant_id", "emitida_em");

-- CreateIndex
CREATE UNIQUE INDEX "ctes_chave_key" ON "ctes"("chave");

-- CreateIndex
CREATE INDEX "idx_cte_tenant_id" ON "ctes"("tenant_id");

-- CreateIndex
CREATE INDEX "idx_fiscal_event_tenant" ON "fiscal_events"("tenant_id");

-- CreateIndex
CREATE INDEX "idx_fiscal_event_nfe" ON "fiscal_events"("nfe_id");

-- CreateIndex
CREATE INDEX "idx_audit_tenant" ON "audit_logs"("tenant_id");

-- CreateIndex
CREATE INDEX "idx_audit_tenant_time" ON "audit_logs"("tenant_id", "ocorrido_em");

-- CreateIndex
CREATE INDEX "idx_timeline_tenant" ON "timeline_steps"("tenant_id");

-- CreateIndex
CREATE INDEX "idx_tax_rule_tenant" ON "tax_rules"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_tax_rule_tenant_rule" ON "tax_rules"("tenant_id", "rule_id");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nfes" ADD CONSTRAINT "nfes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ctes" ADD CONSTRAINT "ctes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_events" ADD CONSTRAINT "fiscal_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_events" ADD CONSTRAINT "fiscal_events_nfe_id_fkey" FOREIGN KEY ("nfe_id") REFERENCES "nfes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeline_steps" ADD CONSTRAINT "timeline_steps_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_rules" ADD CONSTRAINT "tax_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

