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
import { taxSnapshotFromRule } from "../lib/tax-snapshot.js";
import { consumirSaldoRemessaFifo } from "./remessa-fifo.js";
import { resolveTaxRule, type CustomerType, type ResolvedTaxRule } from "./tax-rule-service.js";
import { montarItemFiscal } from "./tax-calculation-service.js";
import { calcularNotaFiscal } from "../lib/tax-engine.js";
import { enrichFiscalPayloadWithXTexto } from "../lib/nfe-xtexto.js";
import { emitirCteVenda } from "./cte-venda-service.js";

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

/** Emite retorno simbólico (FIFO remessa) + NF-e de venda referenciada. */
export async function emitirCadeiaVenda(prisma: PrismaClient, pedido: PedidoForEmit) {
  const tenant = pedido.tenant;
  const serie = tenant.serieRemessa;
  const pedidoMl = gerarPedidoMl();
  const emitidaEm = new Date();

  const valorUnit = Number(pedido.product.preco);
  const valorTotal = Math.round(valorUnit * pedido.quantidade * 100) / 100;

  const ruleBaseId = pedido.product.taxRuleBaseId?.trim();
  if (!ruleBaseId) {
    throw new VendaChainError(
      "Produto sem regra fiscal associada. Edite o cadastro do produto e selecione a regra da planilha.",
    );
  }

  return prisma.$transaction(async (tx) => {
    const emitterSettings = await loadEmitterSettings(tx, tenant.id);
    const customerType = resolveCustomerType(pedido.destIndIeDest);

    const saleTaxRule = requireTaxRule(
      await resolveTaxRule(tx as unknown as PrismaClient, tenant.id, {
        originUf: tenant.uf,
        destinationUf: pedido.destUf,
        transactionType: "sale",
        customerType,
        ruleBaseId,
      }),
      {
        label: "venda",
        ruleBaseId,
        originUf: tenant.uf,
        destinationUf: pedido.destUf,
      },
    );

    const inboundTaxRule = requireTaxRule(
      await resolveTaxRule(tx as unknown as PrismaClient, tenant.id, {
        originUf: tenant.uf,
        destinationUf: tenant.uf,
        transactionType: "inbound",
        customerType: "taxpayer",
        ruleBaseId,
      }),
      {
        label: "retorno simbólico",
        ruleBaseId,
        originUf: tenant.uf,
        destinationUf: tenant.uf,
      },
    );

    const numeroRetorno = await proximoNumeroNfe(tx as unknown as PrismaClient, tenant.id, serie);
    const chaveRetorno = buildChaveNFe({
      uf: tenant.uf,
      cnpj: tenant.cnpj,
      serie,
      numero: numeroRetorno,
    });

    const aliqRetornoFallback = inferAliqIcms(REMESSA_ML_DEST.uf, tenant.uf);
    const aliqRetorno = inboundTaxRule?.aliquotaIcmsInterna ?? aliqRetornoFallback;
    const valorIcmsRetorno = Math.round(valorTotal * (aliqRetorno / 100) * 100) / 100;

    const retornoRow = await tx.nFe.create({
      data: {
        tenantId: tenant.id,
        productId: pedido.product.id,
        chave: chaveRetorno,
        numero: numeroRetorno,
        serie,
        natOp: RETORNO_SIMBOLICO_NAT_OP,
        cfop: inboundTaxRule?.cfop ?? RETORNO_SIMBOLICO_CFOP,
        ncm: pedido.product.ncm,
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
        valor: valorTotal,
        valorIcms: valorIcmsRetorno,
        aliqIcms: aliqRetorno,
        status: FiscalStatus.AUTORIZADA,
        emitidaEm,
        pedidoMl,
        quantidade: pedido.quantidade,
        tipo: NFeTipo.RETORNO_SIMBOLICO,
        saldoDisponivel: null,
        fiscalPayload: enrichFiscalPayloadWithXTexto(
          enrichTaxSnapshot(taxSnapshotFromRule(inboundTaxRule, aliqRetornoFallback), {
            settings: emitterSettings,
            tipo: NFeTipo.RETORNO_SIMBOLICO,
            valor: valorTotal,
            valorIcms: valorIcmsRetorno,
            emitUf: tenant.uf,
            destUf: tenant.uf,
            indFinal: 0,
          }) as Record<string, unknown>,
          {
            tipo: NFeTipo.RETORNO_SIMBOLICO,
            cfop: inboundTaxRule?.cfop ?? RETORNO_SIMBOLICO_CFOP,
            natOp: RETORNO_SIMBOLICO_NAT_OP,
            pedidoMl,
          },
        ) as Prisma.InputJsonValue,
      },
    });

    const alocacoes = await consumirSaldoRemessaFifo(
      tx,
      tenant.id,
      pedido.product.id,
      pedido.quantidade,
      retornoRow.id,
    );

    const remessaPrincipalId = alocacoes[0]!.remessaNfeId;
    await tx.nFe.update({
      where: { id: retornoRow.id },
      data: { nfeReferenciaId: remessaPrincipalId },
    });

    const numeroVenda = await proximoNumeroNfe(tx as unknown as PrismaClient, tenant.id, serie);
    const chaveVenda = buildChaveNFe({
      uf: tenant.uf,
      cnpj: tenant.cnpj,
      serie,
      numero: numeroVenda,
    });

    const aliqVendaFallback = inferAliqIcms(tenant.uf, pedido.destUf);

    // Engine de cálculo: monta o item com as alíquotas da regra (origem × destino)
    // e devolve a árvore matemática (ICMS por dentro, DIFAL, totais = soma dos itens).
    const itemVenda = montarItemFiscal(
      {
        codigo: pedido.product.sku ?? pedido.product.id,
        descricao: pedido.product.nome ?? "Mercadoria",
        ncm: pedido.product.ncm,
        cfop: saleTaxRule?.cfop ?? pedido.product.cfop,
        unidade: pedido.product.unidade ?? "UN",
        cest: pedido.product.cest,
        ean: pedido.product.ean ?? undefined,
        exTipi: pedido.product.exTipi ?? undefined,
        origem: pedido.product.origem ?? 0,
        quantidade: pedido.quantidade,
        valorUnitario: valorUnit,
      },
      saleTaxRule,
      { ufOrigem: tenant.uf, ufDestino: pedido.destUf, customerType },
      aliqVendaFallback,
    );
    const notaVenda = calcularNotaFiscal([itemVenda]);

    const aliqVenda = itemVenda.icms.pICMS || aliqVendaFallback;
    const valorIcmsVenda = notaVenda.totais.vICMS;
    const telefone = pedido.destTelefone?.replace(/\D/g, "") || "0000000000";

    const natOpVenda =
      customerType === "non_taxpayer"
        ? "Venda de mercadoria para consumidor final"
        : "Venda de mercadorias";
    const cfopVenda = saleTaxRule?.cfop ?? pedido.product.cfop;

    const vendaRow = await tx.nFe.create({
      data: {
        tenantId: tenant.id,
        productId: pedido.product.id,
        chave: chaveVenda,
        numero: numeroVenda,
        serie,
        natOp: natOpVenda,
        cfop: cfopVenda,
        ncm: pedido.product.ncm,
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
        destTelefone: telefone,
        destIndIeDest: pedido.destIndIeDest,
        valor: valorTotal,
        valorIcms: valorIcmsVenda,
        aliqIcms: aliqVenda,
        status: FiscalStatus.AUTORIZADA,
        emitidaEm,
        pedidoMl,
        quantidade: pedido.quantidade,
        tipo: NFeTipo.VENDA,
        nfeReferenciaId: retornoRow.id,
        fiscalPayload: enrichFiscalPayloadWithXTexto(
          {
            ...enrichTaxSnapshot(taxSnapshotFromRule(saleTaxRule, aliqVendaFallback), {
              settings: emitterSettings,
              tipo: NFeTipo.VENDA,
              valor: valorTotal,
              valorIcms: valorIcmsVenda,
              emitUf: tenant.uf,
              destUf: pedido.destUf,
              indFinal: 1,
            }),
            engine: notaVenda,
          } as Record<string, unknown>,
          {
            tipo: NFeTipo.VENDA,
            cfop: cfopVenda,
            natOp: natOpVenda,
            pedidoMl,
            indFinal: 1,
          },
        ) as Prisma.InputJsonValue,
      },
    });

    const cteVenda = await emitirCteVenda(tx, tenant, vendaRow);

    const retornoComRef = await tx.nFe.findUniqueOrThrow({
      where: { id: retornoRow.id },
      include: {
        nfeReferencia: { select: { chave: true, numero: true, serie: true } },
      },
    });

    return {
      venda: mapNfe(vendaRow, retornoRow.chave),
      retorno: mapNfe(retornoComRef, retornoComRef.nfeReferencia?.chave),
      cteVenda,
      alocacoes,
    };
  });
}
