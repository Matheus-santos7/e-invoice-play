-- CreateEnum
CREATE TYPE "PedidoStatus" AS ENUM ('RASCUNHO', 'FATURADO');

-- CreateTable
CREATE TABLE "pedidos" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 1,
    "status" "PedidoStatus" NOT NULL DEFAULT 'RASCUNHO',
    "pedido_ml" TEXT,
    "nfe_id" TEXT,
    "dest_cpf" TEXT NOT NULL,
    "dest_nome" TEXT NOT NULL,
    "dest_logradouro" TEXT NOT NULL,
    "dest_numero" TEXT NOT NULL DEFAULT 'SN',
    "dest_complemento" TEXT,
    "dest_bairro" TEXT NOT NULL,
    "dest_codigo_municipio" VARCHAR(7) NOT NULL,
    "dest_municipio" TEXT NOT NULL,
    "dest_uf" VARCHAR(2) NOT NULL,
    "dest_cep" VARCHAR(8) NOT NULL,
    "dest_codigo_pais" INTEGER NOT NULL DEFAULT 1058,
    "dest_nome_pais" TEXT NOT NULL DEFAULT 'Brasil',
    "dest_telefone" TEXT,
    "dest_ind_ie_dest" INTEGER NOT NULL DEFAULT 9,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pedidos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pedidos_nfe_id_key" ON "pedidos"("nfe_id");
CREATE INDEX "idx_pedido_tenant_id" ON "pedidos"("tenant_id");
CREATE INDEX "idx_pedido_tenant_status" ON "pedidos"("tenant_id", "status");

ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_nfe_id_fkey" FOREIGN KEY ("nfe_id") REFERENCES "nfes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
