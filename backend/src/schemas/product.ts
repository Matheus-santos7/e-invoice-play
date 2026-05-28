import { z } from "zod";

export function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

const optionalTrimmed = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.string().trim().optional(),
);

const eanField = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z
    .string()
    .trim()
    .optional()
    .refine(
      (v) => !v || [8, 12, 13, 14].includes(digitsOnly(v).length),
      "EAN/GTIN deve ter 8, 12, 13 ou 14 dígitos",
    )
    .transform((v) => (v ? digitsOnly(v) : undefined)),
);

const cfopField = z
  .string()
  .trim()
  .transform((v) => digitsOnly(v))
  .refine((v) => v.length === 4, "CFOP deve ter 4 dígitos");

const ncmField = z
  .string()
  .trim()
  .transform((v) => digitsOnly(v))
  .refine((v) => v.length === 8, "NCM deve ter 8 dígitos");

const cestField = z
  .string()
  .trim()
  .transform((v) => digitsOnly(v))
  .refine((v) => v.length === 7, "CEST deve ter 7 dígitos");

const exTipiField = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^\d{2,3}$/.test(v), "EXTIPI deve ter 2 ou 3 dígitos"),
);

export const productCreateBody = z.object({
  sku: z.string().trim().min(1, "SKU obrigatório").max(60),
  ean: eanField,
  nome: z.string().trim().min(1, "Descrição obrigatória").max(120),
  ncm: ncmField,
  cest: cestField,
  exTipi: exTipiField,
  cfop: cfopField.default("5102"),
  origem: z.coerce.number().int().min(0).max(8),
  unidade: z.string().trim().min(1, "Unidade obrigatória").max(6),
  preco: z.coerce.number().positive("Preço deve ser maior que zero"),
  estoque: z.coerce.number().int().min(0, "Estoque não pode ser negativo").default(0),
});

export const productUpdateBody = productCreateBody.partial();

export const productIdParam = z.object({
  id: z.string().uuid(),
});

export const productTenantQuery = z.object({
  tenantId: z.string().uuid().optional(),
});

export type ProductCreateInput = z.infer<typeof productCreateBody>;
export type ProductUpdateInput = z.infer<typeof productUpdateBody>;

export const productBulkUpsertBody = z.object({
  rows: z.array(productCreateBody).min(1, "Planilha vazia").max(500, "Máximo de 500 linhas por importação"),
});

export type ProductBulkUpsertInput = z.infer<typeof productBulkUpsertBody>;
