import { z } from "zod";

export function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

const cpfField = z
  .string()
  .trim()
  .transform((v) => digitsOnly(v))
  .refine((v) => v.length === 11, "CPF deve ter 11 dígitos");

const cepField = z
  .string()
  .trim()
  .transform((v) => digitsOnly(v))
  .refine((v) => v.length === 8, "CEP deve ter 8 dígitos");

const ufField = z
  .string()
  .length(2, "UF deve ter 2 caracteres")
  .transform((v) => v.toUpperCase());

const codigoMunicipioField = z
  .string()
  .transform((v) => digitsOnly(v))
  .refine((v) => v.length === 7, "Código IBGE deve ter 7 dígitos");

const optionalTrimmed = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.string().trim().optional(),
);

export const compradorCheckoutBody = z.object({
  cpf: cpfField,
  nome: z.string().trim().min(1, "Nome obrigatório").max(120),
  logradouro: z.string().trim().min(1, "Logradouro obrigatório").max(200),
  numero: z.string().trim().min(1, "Número obrigatório").max(20).default("SN"),
  complemento: optionalTrimmed,
  bairro: z.string().trim().min(1, "Bairro obrigatório").max(100),
  codigoMunicipio: codigoMunicipioField,
  municipio: z.string().trim().min(1, "Município obrigatório").max(100),
  uf: ufField,
  cep: cepField,
  telefone: optionalTrimmed,
  codigoPais: z.coerce.number().int().default(1058),
  nomePais: z.string().trim().default("Brasil"),
  indIEDest: z.coerce.number().int().refine((v) => [1, 2, 9].includes(v), "indIEDest deve ser 1, 2 ou 9").default(9),
});

export const pedidoCheckoutBody = z.object({
  productId: z.string().uuid(),
  quantidade: z.coerce.number().positive().max(9999).default(1),
  comprador: compradorCheckoutBody,
});

export type PedidoCheckoutInput = z.infer<typeof pedidoCheckoutBody>;
