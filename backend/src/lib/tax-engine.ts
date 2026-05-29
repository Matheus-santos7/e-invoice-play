/**
 * Engine de Cálculo Tributário — NF-e Modelo 55, versão 4.00 (Regime Normal).
 *
 * Este módulo é PURO: não importa Prisma nem faz I/O. Recebe os valores e as
 * alíquotas já resolvidas (o serviço `tax-calculation-service` é quem busca no
 * banco) e devolve a árvore matemática pronta para virar XML.
 *
 * Princípios (para não tomar rejeição da SEFAZ — ex.: 532/533 e totais divergentes):
 *
 *  1. ICMS é "imposto por dentro" (embutido no preço). Quando o IPI integra a
 *     base (venda a consumidor final / não contribuinte), ele é somado à base
 *     do ICMS — exatamente como os XMLs reais do fulfillment ML demonstram.
 *
 *  2. Todo valor calculado a NÍVEL DE ITEM é arredondado comercialmente para 2
 *     casas decimais via `round2` (Number(x.toFixed(2))). O FCP NUNCA é somado
 *     ao pICMS: ele tem tags próprias (pFCP/vFCP).
 *
 *  3. O bloco <total> (ICMSTot) é EXCLUSIVAMENTE a soma (reduce) dos valores já
 *     arredondados de cada item. Nunca recalculamos imposto sobre o total da
 *     nota. Assim o vNF "bate na vírgula" com a soma dos itens.
 */

/** Arredondamento comercial para 2 casas (meio-para-cima), nível de item. */
export function round2(value: number): number {
  // toFixed faz o arredondamento meio-para-cima na 2ª casa; Number remove o padding.
  return Number((value + Number.EPSILON).toFixed(2));
}

/** Percentual seguro: trata null/undefined/NaN como 0. */
function pct(value: number | undefined | null): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export type IcmsInput = {
  /** CST (Regime Normal: 00, 20, 40, 41, 51, 60…). */
  cst: string;
  /** Origem da mercadoria (orig 0–8). */
  orig: number;
  /** Alíquota efetivamente aplicada no <ICMS00>/<ICMSxx> (%). */
  pICMS: number;
  /** Modalidade da base (modBC). Padrão 3 = valor da operação. */
  modBC?: number;
  /** % de redução da base de cálculo (pRedBC). */
  pRedBC?: number;
  /** Alíquota do FCP (Fundo de Combate à Pobreza) — tags próprias. */
  pFCP?: number;
};

export type IpiInput = {
  cst: string;
  pIPI: number;
  cEnq?: string;
};

export type PisCofinsInput = {
  cst: string;
  /** Alíquota (pPIS/pCOFINS) em %. */
  aliquota: number;
  /** % de redução da base (alguns benefícios reduzem a base do PIS/COFINS). */
  pRedBC?: number;
};

/** Partilha do ICMS interestadual para consumidor final (ICMSUFDest / DIFAL). */
export type DifalInput = {
  /** Alíquota interestadual (pICMSInter) — a mesma do ICMS próprio. */
  pICMSInter: number;
  /** Alíquota interna da UF de destino (pICMSUFDest). */
  pICMSUFDest: number;
  /** % do FCP da UF de destino (pFCPUFDest). */
  pFCPUFDest?: number;
  /** % de redução da base do DIFAL (pRedBCDifal). */
  pRedBC?: number;
};

export type ItemFiscalInput = {
  numeroItem: number;
  codigo: string;
  descricao: string;
  ncm: string;
  cfop: string;
  unidade: string;
  cest?: string;
  ean?: string;
  exTipi?: string;

  quantidade: number;
  valorUnitario: number;

  /** Frete rateado para o item. */
  frete?: number;
  /** Seguro rateado para o item. */
  seguro?: number;
  /** Outras despesas acessórias rateadas para o item. */
  despesasAcessorias?: number;
  /** Desconto do item. */
  desconto?: number;

  icms: IcmsInput;
  ipi?: IpiInput;
  pis: PisCofinsInput;
  cofins: PisCofinsInput;
  difal?: DifalInput;

  /**
   * Se o IPI integra a base do ICMS. Verdadeiro nas vendas a consumidor final /
   * não contribuinte (reproduz os XMLs reais do ML). O serviço decide com base
   * em origem × destino × tipo de cliente.
   */
  incluirIpiNaBaseIcms?: boolean;
};

export type ItemFiscalResult = {
  numeroItem: number;
  codigo: string;
  descricao: string;
  ncm: string;
  cfop: string;
  unidade: string;
  cest?: string;
  ean?: string;
  exTipi?: string;

  quantidade: number;
  valorUnitario: number;
  vProd: number;
  vFrete: number;
  vSeg: number;
  vDesc: number;
  vOutro: number;

  icms: {
    cst: string;
    orig: number;
    modBC: number;
    vBC: number;
    pICMS: number;
    vICMS: number;
    pFCP: number;
    vFCP: number;
  };
  ipi?: {
    cst: string;
    cEnq: string;
    vBC: number;
    pIPI: number;
    vIPI: number;
  };
  pis: { cst: string; vBC: number; pPIS: number; vPIS: number };
  cofins: { cst: string; vBC: number; pCOFINS: number; vCOFINS: number };
  difal?: {
    vBCUFDest: number;
    pICMSUFDest: number;
    pICMSInter: number;
    vICMSUFDest: number;
    vBCFCPUFDest: number;
    pFCPUFDest: number;
    vFCPUFDest: number;
  };
};

export type NotaFiscalTotais = {
  vBC: number;
  vICMS: number;
  vFCP: number;
  vBCST: number;
  vST: number;
  vProd: number;
  vFrete: number;
  vSeg: number;
  vDesc: number;
  vIPI: number;
  vPIS: number;
  vCOFINS: number;
  vOutro: number;
  vFCPUFDest: number;
  vICMSUFDest: number;
  vICMSUFRemet: number;
  /** Valor total da nota. */
  vNF: number;
};

export type NotaFiscalResult = {
  itens: ItemFiscalResult[];
  totais: NotaFiscalTotais;
};

/**
 * Calcula um único item (<det>).
 *
 * Fluxo da Base de Cálculo (cascata):
 *   vProd                       = qtd × valorUnitário
 *   baseBruta                   = vProd + frete + seguro + outras − desconto
 *   IPI                         = baseBruta × pIPI            (base própria)
 *   baseICMS (antes da redução)  = baseBruta (+ vIPI se consumidor final)
 *   vBC ICMS                    = baseICMS × (1 − pRedBC/100)
 *   vICMS                       = vBC × pICMS
 *   vFCP                        = vBC × pFCP                  (tag separada)
 *   PIS/COFINS                  = (baseBruta × (1 − pRedBC)) × alíquota
 *   DIFAL (consumidor final UF) = vBC × (pInterna − pInter)
 */
export function calcularItem(input: ItemFiscalInput): ItemFiscalResult {
  const frete = round2(pct(input.frete));
  const seguro = round2(pct(input.seguro));
  const outras = round2(pct(input.despesasAcessorias));
  const desconto = round2(pct(input.desconto));

  // 1) Valor do produto.
  const vProd = round2(input.quantidade * input.valorUnitario);

  // 2) Base "bruta" da operação (compartilhada pelos tributos antes de reduções).
  const baseBruta = round2(vProd + frete + seguro + outras - desconto);

  // 3) IPI — incide sobre a base bruta; tem base própria e independe do ICMS.
  let ipiResult: ItemFiscalResult["ipi"];
  let vIPI = 0;
  if (input.ipi) {
    const vBCIpi = baseBruta;
    vIPI = round2(vBCIpi * (pct(input.ipi.pIPI) / 100));
    ipiResult = {
      cst: input.ipi.cst,
      cEnq: input.ipi.cEnq ?? "999",
      vBC: vBCIpi,
      pIPI: pct(input.ipi.pIPI),
      vIPI,
    };
  }

  // 4) Base do ICMS — "por dentro". Em venda a consumidor final, o IPI integra
  //    a base (espelha os XMLs reais do fulfillment ML).
  const baseAntesReducao = round2(baseBruta + (input.incluirIpiNaBaseIcms ? vIPI : 0));
  const pRedBcIcms = pct(input.icms.pRedBC);
  const vBCIcms = round2(baseAntesReducao * (1 - pRedBcIcms / 100));
  const pICMS = pct(input.icms.pICMS);
  const vICMS = round2(vBCIcms * (pICMS / 100));

  // FCP: alíquota própria; NUNCA somada ao pICMS.
  const pFCP = pct(input.icms.pFCP);
  const vFCP = round2(vBCIcms * (pFCP / 100));

  // 5) PIS e COFINS — base pode ter redução própria.
  const vBCPis = round2(baseBruta * (1 - pct(input.pis.pRedBC) / 100));
  const vPIS = round2(vBCPis * (pct(input.pis.aliquota) / 100));
  const vBCCofins = round2(baseBruta * (1 - pct(input.cofins.pRedBC) / 100));
  const vCOFINS = round2(vBCCofins * (pct(input.cofins.aliquota) / 100));

  // 6) DIFAL (ICMSUFDest) — partilha para consumidor final em operação interestadual.
  let difalResult: ItemFiscalResult["difal"];
  if (input.difal) {
    const pRedDifal = pct(input.difal.pRedBC);
    const vBCUFDest = round2(baseAntesReducao * (1 - pRedDifal / 100));
    const pICMSUFDest = pct(input.difal.pICMSUFDest);
    const pICMSInter = pct(input.difal.pICMSInter);
    // DIFAL = base × (alíquota interna destino − alíquota interestadual).
    const vICMSUFDest = round2(
      round2(vBCUFDest * (pICMSUFDest / 100)) - round2(vBCUFDest * (pICMSInter / 100)),
    );
    const pFCPUFDest = pct(input.difal.pFCPUFDest);
    const vBCFCPUFDest = pFCPUFDest > 0 ? vBCUFDest : 0;
    const vFCPUFDest = round2(vBCFCPUFDest * (pFCPUFDest / 100));
    difalResult = {
      vBCUFDest,
      pICMSUFDest,
      pICMSInter,
      vICMSUFDest: Math.max(0, vICMSUFDest),
      vBCFCPUFDest,
      pFCPUFDest,
      vFCPUFDest,
    };
  }

  return {
    numeroItem: input.numeroItem,
    codigo: input.codigo,
    descricao: input.descricao,
    ncm: input.ncm,
    cfop: input.cfop,
    unidade: input.unidade,
    cest: input.cest,
    ean: input.ean,
    exTipi: input.exTipi,
    quantidade: input.quantidade,
    valorUnitario: input.valorUnitario,
    vProd,
    vFrete: frete,
    vSeg: seguro,
    vDesc: desconto,
    vOutro: outras,
    icms: {
      cst: input.icms.cst,
      orig: input.icms.orig,
      modBC: input.icms.modBC ?? 3,
      vBC: vBCIcms,
      pICMS,
      vICMS,
      pFCP,
      vFCP,
    },
    ipi: ipiResult,
    pis: { cst: input.pis.cst, vBC: vBCPis, pPIS: pct(input.pis.aliquota), vPIS },
    cofins: { cst: input.cofins.cst, vBC: vBCCofins, pCOFINS: pct(input.cofins.aliquota), vCOFINS },
    difal: difalResult,
  };
}

/**
 * Soma (reduce) dos valores JÁ ARREDONDADOS de cada item.
 * Nunca recalcula imposto sobre agregados.
 */
export function calcularTotais(itens: ItemFiscalResult[]): NotaFiscalTotais {
  const acc: NotaFiscalTotais = {
    vBC: 0, vICMS: 0, vFCP: 0, vBCST: 0, vST: 0, vProd: 0, vFrete: 0, vSeg: 0,
    vDesc: 0, vIPI: 0, vPIS: 0, vCOFINS: 0, vOutro: 0, vFCPUFDest: 0,
    vICMSUFDest: 0, vICMSUFRemet: 0, vNF: 0,
  };

  for (const item of itens) {
    acc.vBC = round2(acc.vBC + item.icms.vBC);
    acc.vICMS = round2(acc.vICMS + item.icms.vICMS);
    acc.vFCP = round2(acc.vFCP + item.icms.vFCP);
    acc.vProd = round2(acc.vProd + item.vProd);
    acc.vFrete = round2(acc.vFrete + item.vFrete);
    acc.vSeg = round2(acc.vSeg + item.vSeg);
    acc.vDesc = round2(acc.vDesc + item.vDesc);
    acc.vOutro = round2(acc.vOutro + item.vOutro);
    acc.vIPI = round2(acc.vIPI + (item.ipi?.vIPI ?? 0));
    acc.vPIS = round2(acc.vPIS + item.pis.vPIS);
    acc.vCOFINS = round2(acc.vCOFINS + item.cofins.vCOFINS);
    if (item.difal) {
      acc.vICMSUFDest = round2(acc.vICMSUFDest + item.difal.vICMSUFDest);
      acc.vFCPUFDest = round2(acc.vFCPUFDest + item.difal.vFCPUFDest);
    }
  }

  // vNF (regra oficial da SEFAZ): produtos + ST + frete + seguro + outras + IPI
  //                              − desconto − ICMS desonerado.
  // Quando IPI = 0, recai na fórmula simplificada: vProd + vFrete − vDesc.
  acc.vNF = round2(
    acc.vProd + acc.vST + acc.vFrete + acc.vSeg + acc.vOutro + acc.vIPI - acc.vDesc,
  );

  return acc;
}

/** Orquestra o cálculo completo da nota: itens + totais. */
export function calcularNotaFiscal(itens: ItemFiscalInput[]): NotaFiscalResult {
  const itensCalculados = itens.map(calcularItem);
  return {
    itens: itensCalculados,
    totais: calcularTotais(itensCalculados),
  };
}
