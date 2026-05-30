import type { MeliUnidadeLogistica } from "../generated/prisma/client.js";
import { REMESSA_ML_DEST } from "./remessa-dest.js";

/** Normaliza CNPJ da planilha (float, pontuação) para 14 dígitos. */
export function normalizeCnpjMeli(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  let digits = String(raw).replace(/\D/g, "");
  if (digits.includes("e") || digits.includes("E")) {
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    digits = String(Math.trunc(n));
  }
  if (digits.length > 14) digits = digits.slice(-14);
  while (digits.length < 14) digits = `0${digits}`;
  if (digits.length !== 14 || /^0+$/.test(digits)) return null;
  return digits;
}

/** Extrai código da unidade (ex.: SP02, RC01) do nome da planilha. */
export function extractCodigoUnidade(nome: string): string {
  const t = nome.trim();
  const m = t.match(/^([A-Z]{2}\d{2}|RC\d{2})/i);
  if (m) return m[1]!.toUpperCase();
  const slug = t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 32);
  return slug.toUpperCase() || "UNIDADE";
}

export function normalizeCepMeli(raw: unknown): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length >= 8) return digits.slice(0, 8);
  return digits.padStart(8, "0");
}

export function normalizeIeMeli(raw: unknown): string | null {
  if (raw == null) return null;
  const t = String(raw).trim();
  if (!t || t.toLowerCase() === "none" || t === "—") return null;
  return t.replace(/\D/g, "").length > 0 ? t.replace(/\s/g, "") : t;
}

export type UnidadeDestinoFiscal = {
  nome: string;
  cnpj: string;
  ie: string | null;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  codigoMunicipio: string;
  municipio: string;
  uf: string;
  cep: string;
  codigoPais: number;
  nomePais: string;
  indIeDest: number;
};

export function unidadeParaDestinoFiscal(
  u: Pick<
    MeliUnidadeLogistica,
    | "destNomeFiscal"
    | "cnpj"
    | "ie"
    | "logradouro"
    | "numero"
    | "complemento"
    | "bairro"
    | "codigoMunicipio"
    | "municipio"
    | "uf"
    | "cep"
    | "codigoPais"
    | "nomePais"
    | "indIeDest"
  >,
): UnidadeDestinoFiscal {
  return {
    nome: u.destNomeFiscal,
    cnpj: u.cnpj,
    ie: u.ie,
    logradouro: u.logradouro,
    numero: u.numero,
    complemento: u.complemento ?? undefined,
    bairro: u.bairro,
    codigoMunicipio: u.codigoMunicipio,
    municipio: u.municipio,
    uf: u.uf,
    cep: u.cep,
    codigoPais: u.codigoPais,
    nomePais: u.nomePais,
    indIeDest: u.indIeDest,
  };
}

/** Fallback legado quando tenant não tem CD cadastrado. */
export function remessaDestinoLegado(): UnidadeDestinoFiscal {
  return {
    nome: REMESSA_ML_DEST.nome,
    cnpj: REMESSA_ML_DEST.cnpj,
    ie: REMESSA_ML_DEST.ie,
    logradouro: REMESSA_ML_DEST.logradouro,
    numero: REMESSA_ML_DEST.numero,
    complemento: REMESSA_ML_DEST.complemento,
    bairro: REMESSA_ML_DEST.bairro,
    codigoMunicipio: REMESSA_ML_DEST.codigoMunicipio,
    municipio: REMESSA_ML_DEST.municipio,
    uf: REMESSA_ML_DEST.uf,
    cep: REMESSA_ML_DEST.cep,
    codigoPais: REMESSA_ML_DEST.codigoPais,
    nomePais: REMESSA_ML_DEST.nomePais,
    indIeDest: REMESSA_ML_DEST.indIeDest,
  };
}
