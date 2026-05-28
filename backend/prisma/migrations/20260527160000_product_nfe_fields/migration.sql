-- Campos NF-e `<prod>`: EAN, EXTIPI, CFOP; preço com 8 decimais (vUnCom)
ALTER TABLE "products" ADD COLUMN "ean" TEXT;
ALTER TABLE "products" ADD COLUMN "ex_tipi" VARCHAR(3);
ALTER TABLE "products" ADD COLUMN "cfop" VARCHAR(4) NOT NULL DEFAULT '5102';

ALTER TABLE "products" ALTER COLUMN "preco" TYPE DECIMAL(15, 8);
