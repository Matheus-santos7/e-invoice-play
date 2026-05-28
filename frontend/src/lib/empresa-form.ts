import type { EnvironmentType, TenantInput } from "@/lib/fiscal-types";

export type EmpresaFormValues = {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  ie: string;
  iest: string;
  crt: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  codigoMunicipio: string;
  municipio: string;
  uf: string;
  cep: string;
  telefone: string;
  ambiente: EnvironmentType;
};

export type EmpresaFormState = {
  error?: string;
  success?: boolean;
  fieldErrors?: Record<string, string[]>;
  values?: EmpresaFormValues;
};

export function inputToFormValues(input: TenantInput): EmpresaFormValues {
  return {
    razaoSocial: input.razaoSocial,
    nomeFantasia: input.nomeFantasia,
    cnpj: input.cnpj,
    ie: input.ie,
    iest: input.iest ?? "",
    crt: String(input.crt ?? 3),
    logradouro: input.logradouro,
    numero: input.numero,
    complemento: input.complemento ?? "",
    bairro: input.bairro,
    codigoMunicipio: input.codigoMunicipio,
    municipio: input.municipio,
    uf: input.uf,
    cep: input.cep,
    telefone: input.telefone ?? "",
    ambiente: input.ambiente,
  };
}

export function formatFieldErrors(fieldErrors?: Record<string, string[]>): string | undefined {
  if (!fieldErrors) return undefined;
  const msgs = Object.entries(fieldErrors).flatMap(([, v]) => v);
  return msgs.length > 0 ? msgs.join(" • ") : undefined;
}
