/** Destinatário padrão ML — depósito temporário (modelo NF-e remessa 6949). */
export const REMESSA_ML_DEST = {
  cnpj: "03007331012077",
  nome: "EBAZAR.COM.BR LTDA",
  ie: "261755994",
  logradouro: "Av. Papenborg",
  numero: "S/N",
  complemento: "Nao consta",
  bairro: "Guaporanga",
  codigoMunicipio: "4206009",
  municipio: "Governador Celso Ramos",
  uf: "SC",
  cep: "88190000",
  codigoPais: 1058,
  nomePais: "Brasil",
  indIeDest: 1,
} as const;

export const REMESSA_ML_INTERMED = {
  cnpj: "03007331000141",
  idCadIntTran: "279642028",
} as const;

export const REMESSA_NAT_OP = "Outras Saidas - Remessa para Deposito Temporario";
export const REMESSA_CFOP = "6949";
export const REMESSA_INF_CPL = "Remessa para Deposito Temporario.";
