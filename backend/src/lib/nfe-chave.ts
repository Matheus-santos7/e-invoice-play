/**
 * Chave de acesso da NF-e (modelo 55) — 44 dígitos numéricos.
 *
 * ## Layout (43 posições + DV)
 *
 * | Campo   | Tam | Origem neste projeto                          |
 * |---------|-----|-----------------------------------------------|
 * | cUF     |  2  | `ufToCodigo(emitente.uf)` — tabela IBGE       |
 * | AAMM    |  4  | Ano/mês da emissão (`new Date()` na geração) |
 * | CNPJ    | 14  | Emitente, só dígitos                          |
 * | mod     |  2  | Fixo `55` (NF-e)                              |
 * | série   |  3  | `tenant.serieRemessa`                         |
 * | nNF     |  9  | `proximoNumeroNfe` (`nfe-sequencia.ts`)       |
 * | tpEmis  |  1  | Padrão `1` (emissão normal)                   |
 * | cNF     |  8  | Aleatório se omitido (simulador)              |
 * | cDV     |  1  | Módulo 11, pesos 2–9 da direita para esquerda |
 *
 * ## Simulação
 *
 * Não há integração com SEFAZ: a chave é estruturalmente válida para XML/DTO,
 * mas `cNF` e `AAMM` não vêm do protocolo de autorização real.
 *
 * @see nfe-sequencia.ts — numeração por tenant/série
 * @see cte-chave.ts — reutiliza `ufToCodigo`
 */

/** Modelo do documento na posição 20–21 da chave (NF-e = 55). */
const MODELO_NFE = "55";

/** Emissão normal (posição 35 da chave). Outros valores existem na spec (contingência). */
const TP_EMISSAO_NORMAL = 1;

/** Tamanhos fixos dos campos após normalização (zeros à esquerda). */
const LEN = {
  cUF: 2,
  cnpj: 14,
  serie: 3,
  numero: 9,
  tpEmis: 1,
  cNF: 8,
} as const;

/** Código IBGE da UF (sigla → número). Fallback SP (35) se sigla desconhecida. */
const UF_IBGE: Record<string, number> = {
  AC: 12,
  AL: 27,
  AM: 13,
  AP: 16,
  BA: 29,
  CE: 23,
  DF: 53,
  ES: 32,
  GO: 52,
  MA: 21,
  MG: 31,
  MS: 50,
  MT: 51,
  PA: 15,
  PB: 25,
  PE: 26,
  PI: 22,
  PR: 41,
  RJ: 33,
  RN: 24,
  RO: 11,
  RR: 14,
  RS: 43,
  SC: 42,
  SE: 28,
  SP: 35,
  TO: 17,
};

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type BuildChaveNFeParams = {
  /** UF do emitente (sigla, ex.: `"PR"`). */
  uf: string;
  /** CNPJ do emitente (com ou sem máscara). */
  cnpj: string;
  serie: number;
  numero: number;
  /** Tipo de emissão; default emissão normal (`1`). */
  tpEmis?: number;
  /**
   * Código numérico aleatório da NF-e (8 dígitos).
   * Se omitido, gera valor pseudoaleatório — adequado só ao simulador.
   */
  cNF?: number;
};

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Ano e mês de emissão no formato AAMM (UTC do servidor no momento da chamada). */
function anoMesEmissaoAamm(reference = new Date()): string {
  const ano = String(reference.getFullYear()).slice(-2);
  const mes = String(reference.getMonth() + 1).padStart(2, "0");
  return ano + mes;
}

/**
 * Dígito verificador (módulo 11) sobre os 43 primeiros dígitos da chave.
 * Pesos 2,3,…,9 da direita para a esquerda, reiniciando em 2 após 9.
 */
function calcularDigitoVerificador(chave43: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = chave43.length - 1; i >= 0; i--) {
    soma += parseInt(chave43[i]!, 10) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

function montarCorpoChave43(params: BuildChaveNFeParams, aamm: string, cNF: number): string {
  return (
    String(ufToCodigo(params.uf)).padStart(LEN.cUF, "0") +
    aamm +
    onlyDigits(params.cnpj).padStart(LEN.cnpj, "0") +
    MODELO_NFE +
    String(params.serie).padStart(LEN.serie, "0") +
    String(params.numero).padStart(LEN.numero, "0") +
    String(params.tpEmis ?? TP_EMISSAO_NORMAL).padStart(LEN.tpEmis, "0") +
    String(cNF).padStart(LEN.cNF, "0")
  );
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Converte sigla da UF para código IBGE (2 dígitos na chave).
 * Usado também por `cte-chave.ts`.
 */
export function ufToCodigo(uf: string): number {
  return UF_IBGE[uf.toUpperCase()] ?? UF_IBGE.SP!;
}

/**
 * Monta chave de acesso completa (44 caracteres numéricos).
 *
 * @example
 * buildChaveNFe({ uf: "PR", cnpj: "78242849000169", serie: 5, numero: 42 })
 */
export function buildChaveNFe(params: BuildChaveNFeParams): string {
  const aamm = anoMesEmissaoAamm();
  const cNF = params.cNF ?? Math.floor(Math.random() * 99_999_999);
  const corpo43 = montarCorpoChave43(params, aamm, cNF);
  const dv = calcularDigitoVerificador(corpo43);
  return corpo43 + String(dv);
}

/**
 * Identificador externo estilo Mercado Livre (`obsCont` / `xPed` nos XMLs).
 * Compartilhado entre notas da mesma cadeia (retorno + venda) na mesma emissão.
 */
export function gerarPedidoMl(): string {
  const sufixo = Date.now().toString().slice(-12);
  return `ML-${sufixo}`;
}
