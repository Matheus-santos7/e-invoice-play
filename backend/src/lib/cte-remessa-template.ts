/** Emitente do CT-e de transporte ML (modelo XML). */
export const CTE_ML_EMIT = {
  cnpj: "03007331010295",
  ie: "12500181",
  nome: "EBAZARCOMBR LTDA",
  logradouro: "Rua Francisco de Souza e Mello",
  numero: "1590",
  bairro: "Cordovil",
  codigoMunicipio: "3304557",
  municipio: "Rio de Janeiro",
  uf: "RJ",
  cep: "21010410",
} as const;

export const CTE_REMESSA_CFOP = "6353";
export const CTE_REMESSA_NAT_OP = "PRESTAÇÕES DE SERVIÇOS DE TRANSPORTE";
export const CTE_RNTRC = "47923462";

/** Frete estimado (~0,686% do valor da carga, como no modelo ML). */
export function calcularValorFreteRemessa(valorCarga: number): number {
  return Math.max(12.9, Math.round(valorCarga * 0.00686 * 100) / 100);
}

/** Peso bruto estimado (kg) por unidade. */
export function calcularPesoCarga(quantidade: number): number {
  return Math.round(quantidade * 0.965 * 10000) / 10000;
}
