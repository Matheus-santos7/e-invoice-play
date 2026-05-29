/**
 * Serviço de Cálculo Tributário — ponte entre as regras fiscais armazenadas
 * (tabela `tax_rules`, resolvidas por `resolveTaxRule`) e a engine matemática
 * pura (`tax-engine`).
 *
 * Responsabilidade desta camada (alta coesão):
 *  - Decidir QUAL alíquota entra em cada bloco do XML conforme a operação:
 *      • intraestadual            → ICMS próprio pela alíquota interna;
 *      • interestadual + consumidor final (não contribuinte) → ICMS próprio
 *        pela alíquota interestadual + partilha DIFAL (ICMSUFDest);
 *      • interestadual + contribuinte → ICMS próprio interestadual, sem DIFAL.
 *  - Definir se o IPI integra a base do ICMS (consumidor final).
 *  - Montar os itens de entrada e delegar TODA a aritmética para a engine.
 *
 * A engine não conhece Prisma; este serviço não faz aritmética de imposto.
 */

import type { ResolvedTaxRule } from "./tax-rule-service.js";
import type { CustomerType } from "../lib/tax-rule-ids.js";
import { taxSnapshotFromRule } from "../lib/tax-snapshot.js";
import {
  calcularNotaFiscal,
  type ItemFiscalInput,
  type NotaFiscalResult,
} from "../lib/tax-engine.js";

export type LinhaPedido = {
  numeroItem?: number;
  codigo: string;
  descricao: string;
  ncm: string;
  cfop: string;
  unidade: string;
  cest?: string;
  ean?: string;
  exTipi?: string;
  origem: number;
  quantidade: number;
  valorUnitario: number;
  frete?: number;
  seguro?: number;
  despesasAcessorias?: number;
  desconto?: number;
};

export type ContextoFiscal = {
  ufOrigem: string;
  ufDestino: string;
  customerType: CustomerType;
};

/** Alíquota interestadual padrão por UF de origem (Sul/Sudeste exceto ES = 12; demais = 7). */
function aliquotaInterestadualPadrao(ufOrigem: string, ufDestino: string): number {
  const o = ufOrigem.toUpperCase();
  const d = ufDestino.toUpperCase();
  if (o === d) return 0;
  const sulSudeste = new Set(["SP", "RJ", "MG", "PR", "SC", "RS"]);
  // Origem Sul/Sudeste → destino Norte/Nordeste/CO/ES usa 7%; caso geral 12%.
  const norteNordesteCoEs = new Set([
    "AC", "AL", "AP", "AM", "BA", "CE", "ES", "GO", "MA", "MT", "MS",
    "PA", "PB", "PE", "PI", "RN", "RO", "RR", "SE", "TO", "DF",
  ]);
  if (sulSudeste.has(o) && norteNordesteCoEs.has(d)) return 7;
  return 12;
}

/**
 * Monta a entrada de um item da engine a partir de uma linha do pedido + a
 * regra fiscal resolvida (origem × destino já considerados em `resolveTaxRule`).
 */
export function montarItemFiscal(
  linha: LinhaPedido,
  rule: ResolvedTaxRule | null,
  ctx: ContextoFiscal,
  fallbackAliqIcms: number,
): ItemFiscalInput {
  const snapshot = taxSnapshotFromRule(rule, fallbackAliqIcms);

  const interestadual = ctx.ufOrigem.toUpperCase() !== ctx.ufDestino.toUpperCase();
  const consumidorFinal = ctx.customerType === "non_taxpayer";
  const aplicaDifal = interestadual && consumidorFinal;

  // Alíquota interna da UF de destino (vinda da planilha) e a interestadual.
  const pInterna = snapshot.icms.aliquota;
  const pInter =
    snapshot.icms.pIcmsInterstate ||
    aliquotaInterestadualPadrao(ctx.ufOrigem, ctx.ufDestino) ||
    pInterna;

  // ICMS próprio: interestadual usa a alíquota interestadual; intraestadual usa a interna.
  const pICMS = interestadual ? pInter : pInterna;

  return {
    numeroItem: linha.numeroItem ?? 1,
    codigo: linha.codigo,
    descricao: linha.descricao,
    ncm: linha.ncm,
    cfop: linha.cfop,
    unidade: linha.unidade,
    cest: linha.cest,
    ean: linha.ean,
    exTipi: linha.exTipi,
    quantidade: linha.quantidade,
    valorUnitario: linha.valorUnitario,
    frete: linha.frete,
    seguro: linha.seguro,
    despesasAcessorias: linha.despesasAcessorias,
    desconto: linha.desconto,
    icms: {
      cst: snapshot.icms.cst,
      orig: linha.origem,
      pICMS,
      modBC: 3,
      pRedBC: snapshot.icms.pRedBc,
      pFCP: snapshot.icms.pIcmsFcp,
    },
    ipi: snapshot.ipi.aliquota > 0
      ? {
          cst: String(snapshot.ipi.st).slice(0, 2),
          pIPI: snapshot.ipi.aliquota,
          cEnq: snapshot.ipi.codEnq,
        }
      : undefined,
    pis: {
      cst: String(snapshot.pis.st).slice(0, 2),
      aliquota: snapshot.pis.aliquota,
    },
    cofins: {
      cst: String(snapshot.cofins.st).slice(0, 2),
      aliquota: snapshot.cofins.aliquota,
    },
    difal: aplicaDifal
      ? {
          pICMSInter: pInter,
          pICMSUFDest: pInterna,
          pFCPUFDest: snapshot.icms.pIcmsFcp,
          pRedBC: snapshot.icms.pRedBcDifal,
        }
      : undefined,
    // IPI integra a base do ICMS na venda a consumidor final (espelha XML real ML).
    incluirIpiNaBaseIcms: consumidorFinal,
  };
}

/** Calcula a nota inteira (itens + totais) a partir das linhas e regras resolvidas. */
export function calcularImpostosNota(
  linhas: { linha: LinhaPedido; rule: ResolvedTaxRule | null }[],
  ctx: ContextoFiscal,
  fallbackAliqIcms: number,
): NotaFiscalResult {
  const itens = linhas.map(({ linha, rule }, i) =>
    montarItemFiscal({ ...linha, numeroItem: linha.numeroItem ?? i + 1 }, rule, ctx, fallbackAliqIcms),
  );
  return calcularNotaFiscal(itens);
}
