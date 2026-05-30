/**
 * Emissão da cadeia de venda no fulfillment — venda simples).
 *
 * ```
 * REMESSA (já existente, saldo FIFO)
 *    ↑ nfeReferenciaId
 * RETORNO_SIMBOLICO  ← debita saldo via remessa-fifo.ts
 *    ↑ nfeReferenciaId
 * VENDA              ← refNFe no XML aponta para o retorno
 * CT-e (venda)       ← vinculado à NF-e de venda
 * ```
 * ## Entrada
 *
 * `PedidoForEmit` é montado por `checkout-service` / `pedido-service` após validar
 * produto, tenant e endereço do comprador.
 *
 * ## Pré-requisitos
 *
 * - Produto com `taxRuleBaseId` (planilha de regras).
 * - Saldo de remessa física ≥ quantidade (`SaldoRemessaInsuficienteError` se não).
 * - Linhas de regra para `sale` (tenant.uf → dest.uf) e `inbound` (tenant.uf → tenant.uf).
 *
 * ## Referências XML (`refNFe`)
 *
 * - Retorno → remessa mais antiga consumida no FIFO (`alocacoes[0]`).
 * - Venda → retorno (nunca aponta direto para a remessa).
 *
 * @see remessa-fifo.ts — consumo e tabela `nfe_remessa_consumos`
 * @see devolucao-service.ts — fluxo inverso (devolução + estorno)
 * @see cancelamento-service.ts — cancela venda + retorno e estorna FIFO
 */
import { FiscalStatus, NFeTipo, Prisma, type PrismaClient, type Tenant } from "../generated/prisma/client.js";
import { mapNfe } from "../lib/fiscal-mappers.js";
import { buildChaveNFe, gerarPedidoMl } from "../lib/nfe-chave.js";
import { proximoNumeroNfe } from "../lib/nfe-sequencia.js";
import { REMESSA_ML_DEST } from "../lib/remessa-dest.js";
import {
  RETORNO_SIMBOLICO_CFOP,
  RETORNO_SIMBOLICO_NAT_OP,
} from "../lib/retorno-simbolico-dest.js";
import { enrichTaxSnapshot, loadEmitterSettings } from "../lib/fiscal-emitter-runtime.js";
import type { FiscalEmitterSettingsData } from "../lib/fiscal-emitter-settings-defaults.js";
import { taxSnapshotFromRule } from "../lib/tax-snapshot.js";
import { calcularNotaFiscal } from "../lib/tax-engine.js";
import { enrichFiscalPayloadWithXTexto } from "../lib/nfe-xtexto.js";
import { consumirSaldoRemessaFifo } from "./remessa-fifo.js";
import { resolveTaxRule, type CustomerType, type ResolvedTaxRule } from "./tax-rule-service.js";
import { montarItemFiscal } from "./tax-calculation-service.js";
import { emitirCteVenda } from "./cte-venda-service.js";

// ---------------------------------------------------------------------------
// Tipos e erros
// ---------------------------------------------------------------------------

/** Dados mínimos para emitir retorno + venda (checkout ou pedido faturado). */
export type PedidoForEmit = {
  tenantId: string;
  productId: string;
  quantidade: number;
  destCpf: string;
  destNome: string;
  destLogradouro: string;
  destNumero: string;
  destComplemento: string | null;
  destBairro: string;
  destCodigoMunicipio: string;
  destMunicipio: string;
  destUf: string;
  destCep: string;
  destCodigoPais: number;
  destNomePais: string;
  destTelefone: string | null;
  destIndIeDest: number;
  product: {
    id: string;
    cfop: string;
    ncm: string;
    preco: { toString(): string };
    taxRuleBaseId: string | null;
    nome?: string;
    sku?: string;
    ean?: string | null;
    cest?: string;
    exTipi?: string | null;
    unidade?: string;
    origem?: number;
  };
  tenant: Tenant;
};

export class VendaChainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VendaChainError";
  }
}

type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

/** Contexto compartilhado entre retorno e venda na mesma emissão. */
type ContextoEmissao = {
  serie: number;
  pedidoMl: string;
  emitidaEm: Date;
  valorUnit: number;
  valorTotal: number;
  ruleBaseId: string;
};

type RegrasCadeiaVenda = {
  saleTaxRule: ResolvedTaxRule;
  inboundTaxRule: ResolvedTaxRule;
  customerType: CustomerType;
  emitterSettings: FiscalEmitterSettingsData;
};

type NotaRetornoCriada = {
  id: string;
  chave: string;
};

// ---------------------------------------------------------------------------
// Helpers (validação, tributos, endereços)
// ---------------------------------------------------------------------------

function prismaTx(tx: Tx): PrismaClient {
  return tx as unknown as PrismaClient;
}

function inferAliqIcms(emitUf: string, destUf: string): number {
  return emitUf.toUpperCase() === destUf.toUpperCase() ? 18 : 12;
}

function resolveCustomerType(destIndIeDest: number): CustomerType {
  return destIndIeDest === 9 ? "non_taxpayer" : "taxpayer";
}

function requireTaxRule(
  rule: ResolvedTaxRule | null,
  ctx: { label: string; ruleBaseId: string; originUf: string; destinationUf: string },
): ResolvedTaxRule {
  if (rule) return rule;
  throw new VendaChainError(
    `Regra fiscal "${ctx.ruleBaseId}" sem linha de ${ctx.label} para origem ${ctx.originUf} → destino ${ctx.destinationUf}. Confira a planilha importada.`,
  );
}

function assertProdutoComRegra(pedido: PedidoForEmit): string {
  const ruleBaseId = pedido.product.taxRuleBaseId?.trim();
  if (!ruleBaseId) {
    throw new VendaChainError(
      "Produto sem regra fiscal associada. Edite o cadastro do produto e selecione a regra da planilha.",
    );
  }
  return ruleBaseId;
}

function buildContextoEmissao(pedido: PedidoForEmit, ruleBaseId: string): ContextoEmissao {
  const valorUnit = Number(pedido.product.preco);
  const valorTotal = Math.round(valorUnit * pedido.quantidade * 100) / 100;
  return {
    serie: pedido.tenant.serieRemessa,
    pedidoMl: gerarPedidoMl(),
    emitidaEm: new Date(),
    valorUnit,
    valorTotal,
    ruleBaseId,
  };
}

/** Destinatário do retorno = próprio emitente (entrada simbólica no full). */
function enderecoDestRetorno(tenant: Tenant) {
  return {
    destNome: tenant.razaoSocial,
    destDoc: tenant.cnpj,
    destUf: tenant.uf,
    destLogradouro: tenant.logradouro,
    destNumero: tenant.numero,
    destComplemento: tenant.complemento,
    destBairro: tenant.bairro,
    destCodigoMunicipio: tenant.codigoMunicipio,
    destMunicipio: tenant.municipio,
    destCep: tenant.cep,
    destCodigoPais: tenant.codigoPais,
    destNomePais: tenant.nomePais,
    destTelefone: tenant.telefone?.replace(/\D/g, "") ?? null,
    destIndIeDest: 1,
  };
}

/** Destinatário da venda = comprador do pedido. */
function enderecoDestVenda(pedido: PedidoForEmit) {
  return {
    destNome: pedido.destNome,
    destDoc: pedido.destCpf,
    destUf: pedido.destUf,
    destLogradouro: pedido.destLogradouro,
    destNumero: pedido.destNumero,
    destComplemento: pedido.destComplemento,
    destBairro: pedido.destBairro,
    destCodigoMunicipio: pedido.destCodigoMunicipio,
    destMunicipio: pedido.destMunicipio,
    destCep: pedido.destCep,
    destCodigoPais: pedido.destCodigoPais,
    destNomePais: pedido.destNomePais,
    destTelefone: pedido.destTelefone?.replace(/\D/g, "") || "0000000000",
    destIndIeDest: pedido.destIndIeDest,
  };
}

// ---------------------------------------------------------------------------
// Passos da transação
// ---------------------------------------------------------------------------

async function resolverRegrasFiscais(
  tx: Tx,
  pedido: PedidoForEmit,
  ctx: ContextoEmissao,
): Promise<RegrasCadeiaVenda> {
  const { tenant } = pedido;
  const emitterSettings = await loadEmitterSettings(tx, tenant.id);
  const customerType = resolveCustomerType(pedido.destIndIeDest);
  const prisma = prismaTx(tx);

  const saleTaxRule = requireTaxRule(
    await resolveTaxRule(prisma, tenant.id, {
      originUf: tenant.uf,
      destinationUf: pedido.destUf,
      transactionType: "sale",
      customerType,
      ruleBaseId: ctx.ruleBaseId,
    }),
    {
      label: "venda",
      ruleBaseId: ctx.ruleBaseId,
      originUf: tenant.uf,
      destinationUf: pedido.destUf,
    },
  );

  const inboundTaxRule = requireTaxRule(
    await resolveTaxRule(prisma, tenant.id, {
      originUf: tenant.uf,
      destinationUf: tenant.uf,
      transactionType: "inbound",
      customerType: "taxpayer",
      ruleBaseId: ctx.ruleBaseId,
    }),
    {
      label: "retorno simbólico",
      ruleBaseId: ctx.ruleBaseId,
      originUf: tenant.uf,
      destinationUf: tenant.uf,
    },
  );

  return { saleTaxRule, inboundTaxRule, customerType, emitterSettings };
}

async function emitirNotaRetorno(
  tx: Tx,
  pedido: PedidoForEmit,
  ctx: ContextoEmissao,
  regras: RegrasCadeiaVenda,
): Promise<NotaRetornoCriada> {
  const { tenant } = pedido;
  const { inboundTaxRule, emitterSettings } = regras;
  const prisma = prismaTx(tx);

  const numero = await proximoNumeroNfe(prisma, tenant.id, ctx.serie);
  const chave = buildChaveNFe({ uf: tenant.uf, cnpj: tenant.cnpj, serie: ctx.serie, numero });

  const aliqFallback = inferAliqIcms(REMESSA_ML_DEST.uf, tenant.uf);
  const aliqIcms = inboundTaxRule.aliquotaIcmsInterna ?? aliqFallback;
  const valorIcms = Math.round(ctx.valorTotal * (aliqIcms / 100) * 100) / 100;
  const cfop = inboundTaxRule.cfop ?? RETORNO_SIMBOLICO_CFOP;

  const row = await tx.nFe.create({
    data: {
      tenantId: tenant.id,
      productId: pedido.product.id,
      chave,
      numero,
      serie: ctx.serie,
      natOp: RETORNO_SIMBOLICO_NAT_OP,
      cfop,
      ncm: pedido.product.ncm,
      ...enderecoDestRetorno(tenant),
      valor: ctx.valorTotal,
      valorIcms,
      aliqIcms,
      status: FiscalStatus.AUTORIZADA,
      emitidaEm: ctx.emitidaEm,
      pedidoMl: ctx.pedidoMl,
      quantidade: pedido.quantidade,
      tipo: NFeTipo.RETORNO_SIMBOLICO,
      saldoDisponivel: null,
      fiscalPayload: enrichFiscalPayloadWithXTexto(
        enrichTaxSnapshot(taxSnapshotFromRule(inboundTaxRule, aliqFallback), {
          settings: emitterSettings,
          tipo: NFeTipo.RETORNO_SIMBOLICO,
          valor: ctx.valorTotal,
          valorIcms,
          emitUf: tenant.uf,
          destUf: tenant.uf,
          indFinal: 0,
        }) as Record<string, unknown>,
        {
          tipo: NFeTipo.RETORNO_SIMBOLICO,
          cfop,
          natOp: RETORNO_SIMBOLICO_NAT_OP,
          pedidoMl: ctx.pedidoMl,
        },
      ) as Prisma.InputJsonValue,
    },
  });

  return { id: row.id, chave: row.chave };
}

/**
 * Debita remessas (FIFO) e grava `nfeReferenciaId` do retorno → remessa principal.
 * Deve rodar logo após criar o retorno, antes da venda.
 */
async function consumirRemessaEVincularRetorno(
  tx: Tx,
  pedido: PedidoForEmit,
  retorno: NotaRetornoCriada,
) {
  const alocacoes = await consumirSaldoRemessaFifo(
    tx,
    pedido.tenant.id,
    pedido.product.id,
    pedido.quantidade,
    retorno.id,
  );

  await tx.nFe.update({
    where: { id: retorno.id },
    data: { nfeReferenciaId: alocacoes[0]!.remessaNfeId },
  });

  return alocacoes;
}

async function emitirNotaVenda(
  tx: Tx,
  pedido: PedidoForEmit,
  ctx: ContextoEmissao,
  regras: RegrasCadeiaVenda,
  retornoId: string,
) {
  const { tenant } = pedido;
  const { saleTaxRule, customerType, emitterSettings } = regras;
  const prisma = prismaTx(tx);

  const numero = await proximoNumeroNfe(prisma, tenant.id, ctx.serie);
  const chave = buildChaveNFe({ uf: tenant.uf, cnpj: tenant.cnpj, serie: ctx.serie, numero });
  const aliqFallback = inferAliqIcms(tenant.uf, pedido.destUf);

  const itemVenda = montarItemFiscal(
    {
      codigo: pedido.product.sku ?? pedido.product.id,
      descricao: pedido.product.nome ?? "Mercadoria",
      ncm: pedido.product.ncm,
      cfop: saleTaxRule.cfop ?? pedido.product.cfop,
      unidade: pedido.product.unidade ?? "UN",
      cest: pedido.product.cest,
      ean: pedido.product.ean ?? undefined,
      exTipi: pedido.product.exTipi ?? undefined,
      origem: pedido.product.origem ?? 0,
      quantidade: pedido.quantidade,
      valorUnitario: ctx.valorUnit,
    },
    saleTaxRule,
    { ufOrigem: tenant.uf, ufDestino: pedido.destUf, customerType },
    aliqFallback,
  );
  const notaVenda = calcularNotaFiscal([itemVenda]);

  const aliqIcms = itemVenda.icms.pICMS || aliqFallback;
  const valorIcms = notaVenda.totais.vICMS;
  const natOp =
    customerType === "non_taxpayer"
      ? "Venda de mercadoria para consumidor final"
      : "Venda de mercadorias";
  const cfop = saleTaxRule.cfop ?? pedido.product.cfop;

  return tx.nFe.create({
    data: {
      tenantId: tenant.id,
      productId: pedido.product.id,
      chave,
      numero,
      serie: ctx.serie,
      natOp,
      cfop,
      ncm: pedido.product.ncm,
      ...enderecoDestVenda(pedido),
      valor: ctx.valorTotal,
      valorIcms,
      aliqIcms,
      status: FiscalStatus.AUTORIZADA,
      emitidaEm: ctx.emitidaEm,
      pedidoMl: ctx.pedidoMl,
      quantidade: pedido.quantidade,
      tipo: NFeTipo.VENDA,
      nfeReferenciaId: retornoId,
      fiscalPayload: enrichFiscalPayloadWithXTexto(
        {
          ...enrichTaxSnapshot(taxSnapshotFromRule(saleTaxRule, aliqFallback), {
            settings: emitterSettings,
            tipo: NFeTipo.VENDA,
            valor: ctx.valorTotal,
            valorIcms,
            emitUf: tenant.uf,
            destUf: pedido.destUf,
            indFinal: 1,
          }),
          engine: notaVenda,
        } as Record<string, unknown>,
        {
          tipo: NFeTipo.VENDA,
          cfop,
          natOp,
          pedidoMl: ctx.pedidoMl,
          indFinal: 1,
        },
      ) as Prisma.InputJsonValue,
    },
  });
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Emite retorno simbólico + venda + CT-e de venda em uma única transação.
 *
 * @returns DTOs mapeados para a API; `alocacoes` descreve o FIFO consumido.
 */
export async function emitirCadeiaVenda(prisma: PrismaClient, pedido: PedidoForEmit) {
  const ruleBaseId = assertProdutoComRegra(pedido);
  const ctx = buildContextoEmissao(pedido, ruleBaseId);

  return prisma.$transaction(async (tx) => {
    const regras = await resolverRegrasFiscais(tx, pedido, ctx);

    const retorno = await emitirNotaRetorno(tx, pedido, ctx, regras);
    const alocacoes = await consumirRemessaEVincularRetorno(tx, pedido, retorno);

    const vendaRow = await emitirNotaVenda(tx, pedido, ctx, regras, retorno.id);
    const cteVenda = await emitirCteVenda(tx, pedido.tenant, vendaRow);

    const retornoComRef = await tx.nFe.findUniqueOrThrow({
      where: { id: retorno.id },
      include: { nfeReferencia: { select: { chave: true, numero: true, serie: true } } },
    });

    return {
      venda: mapNfe(vendaRow, retorno.chave),
      retorno: mapNfe(retornoComRef, retornoComRef.nfeReferencia?.chave),
      cteVenda,
      alocacoes,
    };
  });
}
