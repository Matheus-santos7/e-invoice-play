import type { EnvironmentKind, Tenant } from "../generated/prisma/client.js";

export function mapTenant(row: Tenant) {
  return {
    id: row.id,
    razaoSocial: row.razaoSocial,
    nomeFantasia: row.nomeFantasia,
    cnpj: row.cnpj,
    ie: row.ie,
    iest: row.iest ?? undefined,
    crt: row.crt,
    logradouro: row.logradouro,
    numero: row.numero,
    complemento: row.complemento ?? undefined,
    bairro: row.bairro,
    codigoMunicipio: row.codigoMunicipio,
    municipio: row.municipio,
    uf: row.uf,
    cep: row.cep,
    codigoPais: row.codigoPais,
    nomePais: row.nomePais,
    telefone: row.telefone ?? undefined,
    ambiente: row.ambiente as EnvironmentKind,
  };
}

/** Formato para geração de XML NF-e (`<emit>`) */
export function mapEmitente(row: Tenant) {
  return {
    cnpj: row.cnpj,
    xNome: row.razaoSocial,
    xFant: row.nomeFantasia,
    ie: row.ie,
    iest: row.iest ?? undefined,
    crt: row.crt,
    uf: row.uf,
    endereco: {
      xLgr: row.logradouro,
      nro: row.numero,
      xCpl: row.complemento ?? undefined,
      xBairro: row.bairro,
      cMun: row.codigoMunicipio,
      xMun: row.municipio,
      uf: row.uf,
      cep: row.cep,
      cPais: row.codigoPais,
      xPais: row.nomePais,
      fone: row.telefone ?? undefined,
    },
  };
}
