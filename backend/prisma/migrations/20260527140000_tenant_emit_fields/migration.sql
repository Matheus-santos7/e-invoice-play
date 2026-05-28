-- Campos do emitente NF-e (<emit> + <enderEmit>)
ALTER TABLE "tenants" ADD COLUMN "iest" TEXT;
ALTER TABLE "tenants" ADD COLUMN "crt" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "tenants" ADD COLUMN "logradouro" TEXT NOT NULL DEFAULT 'Nao informado';
ALTER TABLE "tenants" ADD COLUMN "numero" TEXT NOT NULL DEFAULT 'SN';
ALTER TABLE "tenants" ADD COLUMN "complemento" TEXT;
ALTER TABLE "tenants" ADD COLUMN "bairro" TEXT NOT NULL DEFAULT 'Centro';
ALTER TABLE "tenants" ADD COLUMN "codigo_municipio" VARCHAR(7) NOT NULL DEFAULT '3550308';
ALTER TABLE "tenants" ADD COLUMN "municipio" TEXT NOT NULL DEFAULT 'Sao Paulo';
ALTER TABLE "tenants" ADD COLUMN "cep" VARCHAR(8) NOT NULL DEFAULT '01001000';
ALTER TABLE "tenants" ADD COLUMN "codigo_pais" INTEGER NOT NULL DEFAULT 1058;
ALTER TABLE "tenants" ADD COLUMN "nome_pais" TEXT NOT NULL DEFAULT 'Brasil';
ALTER TABLE "tenants" ADD COLUMN "telefone" TEXT;

-- Remove defaults após backfill (opcional — mantidos para novas colunas em dev)
ALTER TABLE "tenants" ALTER COLUMN "logradouro" DROP DEFAULT;
ALTER TABLE "tenants" ALTER COLUMN "numero" DROP DEFAULT;
ALTER TABLE "tenants" ALTER COLUMN "bairro" DROP DEFAULT;
ALTER TABLE "tenants" ALTER COLUMN "codigo_municipio" DROP DEFAULT;
ALTER TABLE "tenants" ALTER COLUMN "municipio" DROP DEFAULT;
ALTER TABLE "tenants" ALTER COLUMN "cep" DROP DEFAULT;
