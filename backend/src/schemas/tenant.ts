import { z } from "zod";

const environmentKind = z.enum(["HOMOLOGACAO", "PRODUCAO"]);

export function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

const cnpjField = z
  .string()
  .min(1, "CNPJ obrigatório")
  .refine((v) => digitsOnly(v).length === 14, "CNPJ deve ter 14 dígitos");

const ufField = z
  .string()
  .length(2, "UF deve ter 2 caracteres")
  .transform((v) => v.toUpperCase());

const cepField = z
  .string()
  .min(1, "CEP obrigatório")
  .transform((v) => digitsOnly(v))
  .refine((v) => v.length === 8, "CEP deve ter 8 dígitos");

const codigoMunicipioField = z
  .string()
  .min(1, "Código IBGE obrigatório")
  .transform((v) => digitsOnly(v))
  .refine((v) => v.length === 7, "Código IBGE deve ter 7 dígitos");

const crtField = z.coerce.number().int().min(1).max(3);

const optionalTrimmed = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.string().trim().optional(),
);

export const tenantCreateBody = z.object({
  razaoSocial: z.string().trim().min(1, "Razão social obrigatória").max(200),
  nomeFantasia: z.string().trim().min(1, "Nome fantasia obrigatório").max(200),
  cnpj: cnpjField,
  ie: z.string().trim().min(1, "IE obrigatória").max(20),
  iest: optionalTrimmed,
  crt: crtField.default(3),
  logradouro: z.string().trim().min(1, "Logradouro obrigatório").max(200),
  numero: z.string().trim().min(1, "Número obrigatório").max(20).default("SN"),
  complemento: optionalTrimmed,
  bairro: z.string().trim().min(1, "Bairro obrigatório").max(100),
  codigoMunicipio: codigoMunicipioField,
  municipio: z.string().trim().min(1, "Município obrigatório").max(100),
  uf: ufField,
  cep: cepField,
  codigoPais: z.coerce.number().int().default(1058),
  nomePais: z.string().trim().default("Brasil"),
  telefone: optionalTrimmed,
  ambiente: environmentKind,
});

export const tenantUpdateBody = tenantCreateBody.partial();

export const tenantIdParam = z.object({
  id: z.string().uuid(),
});

export type TenantCreateInput = z.infer<typeof tenantCreateBody>;
