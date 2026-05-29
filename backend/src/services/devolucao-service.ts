/**
 * Emissão de NF-e de DEVOLUÇÃO referenciando uma NF-e de VENDA.
 *
 * Cadeia completa do fulfillment:
 *   REMESSA  →  RETORNO SIMBÓLICO  →  VENDA  →  DEVOLUÇÃO
 *
 * A devolução:
 *  - referencia a NF-e de venda original (nfeReferenciaId → venda);
 *  - espelha a matemática da venda (mesmas alíquotas/CST, via engine);
 *  - aplica o mapeamento de CST de devolução das configurações fiscais;
 *  - devolve o saldo consumido de volta às remessas da cadeia (estorno FIFO).
 */

import {
  FiscalStatus,
  NFeTipo,
  Prisma,
  type PrismaClient,
} from "../generated/prisma/client.js";
import { mapNfe, num } from "../lib/fiscal-mappers.js";
import { buildChaveNFe } from "../lib/nfe-chave.js";
import { proximoNumeroNfe } from "../lib/nfe-sequencia.js";
import { productUnitPrice } from "../lib/product-pricing.js";
import { enrichTaxSnapshot, loadEmitterSettings } from "../lib/fiscal-emitter-runtime.js";
import { enrichFiscalPayloadWithXTexto } from "../lib/nfe-xtexto.js";
import { taxSnapshotFromRule } from "../lib/tax-snapshot.js";
import { calcularNotaFiscal } from "../lib/tax-engine.js";
import { montarItemFiscal } from "./tax-calculation-service.js";
import { resolveTaxRule, type CustomerType } from "./tax-rule-service.js";

export class DevolucaoError extends Error {
  constructor(
    message: string,
    public readonly status: number = 400,
  ) {
    super(message);
    this.name = "DevolucaoError";
  }
}

function resolveCustomerType(destIndIeDest: number): CustomerType {
  return destIndIeDest === 9 ? "non_taxpayer" : "taxpayer";
}

/** CFOP de devolução (entrada): interestadual → 2202, interna → 1202. */
function cfopDevolucao(emitUf: string, destUf: string): string {
  return emitUf.toUpperCase() !== destUf.toUpperCase() ? "2202" : "1202";
}

function snapshotCst(payload: unknown): { icms?: string; pis?: string; cofins?: string } {
  const p = (payload ?? {}) as Record<string, unknown>;
  const icms = (p.icms ?? {}) as Record<string, unknown>;
  const pis = (p.pis ?? {}) as Record<string, unknown>;
  const cofins = (p.cofins ?? {}) as Record<string, unknown>;
  const text = (v: unknown): string | undefined =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, 2) : undefined;
  return {
    icms: text(icms.cst),
    pis: text(pis.st),
    cofins: text(cofins.st),
  };
}

/** Emite a devolução de uma venda identificada pela chave de acesso. */
export async function emitirDevolucaoVenda(prisma: PrismaClient, vendaChave: string) {
  const venda = await prisma.nFe.findUnique({
    where: { chave: vendaChave },
    include: { tenant: true, product: true, nfeReferencia: true },
  });

  if (!venda || venda.deletedAt) {
    throw new DevolucaoError("NF-e de venda não encontrada.", 404);
  }
  if (venda.tipo !== NFeTipo.VENDA) {
    throw new DevolucaoError("Só é possível devolver uma NF-e do tipo Venda.", 422);
  }
  if (!venda.product) {
    throw new DevolucaoError("Venda sem produto vinculado; não é possível devolver.", 422);
  }

  const jaDevolvida = await prisma.nFe.findFirst({
    where: { tipo: NFeTipo.DEVOLUCAO, nfeReferenciaId: venda.id, deletedAt: null },
    select: { id: true, numero: true, serie: true },
  });
  if (jaDevolvida) {
    throw new DevolucaoError(
      `Esta venda já possui devolução (NF-e ${jaDevolvida.numero}/${jaDevolvida.serie}).`,
      409,
    );
  }

  const tenant = venda.tenant;
  const product = venda.product;
  const serie = tenant.serieRemessa;
  const customerType = resolveCustomerType(venda.destIndIeDest);
  const quantidade = venda.quantidade;
  const valorTotal = num(venda.valor);
  const valorUnit = quantidade > 0 ? valorTotal / quantidade : valorTotal;
  const cfop = cfopDevolucao(tenant.uf, venda.destUf);

  return prisma.$transaction(async (tx) => {
    const emitterSettings = await loadEmitterSettings(tx, tenant.id);

    // Mesma regra fiscal da venda → devolução espelha as alíquotas/CST originais.
    const saleTaxRule = await resolveTaxRule(tx as unknown as PrismaClient, tenant.id, {
      originUf: tenant.uf,
      destinationUf: venda.destUf,
      transactionType: "sale",
      customerType,
      ruleBaseId: product.taxRuleBaseId?.trim() || undefined,
    });

    const aliqFallback = num(venda.aliqIcms) || 0;

    // Engine de cálculo: mesma árvore matemática da venda.
    const item = montarItemFiscal(
      {
        codigo: product.sku ?? product.id,
        descricao: product.nome,
        ncm: product.ncm,
        cfop,
        unidade: product.unidade ?? "UN",
        cest: product.cest,
        ean: product.ean ?? undefined,
        exTipi: product.exTipi ?? undefined,
        origem: product.origem ?? 0,
        quantidade,
        valorUnitario: valorUnit,
      },
      saleTaxRule,
      { ufOrigem: tenant.uf, ufDestino: venda.destUf, customerType },
      aliqFallback,
    );
    const nota = calcularNotaFiscal([item]);

    const aliqDevol = item.icms.pICMS || aliqFallback;
    const valorIcmsDevol = nota.totais.vICMS;

    const numero = await proximoNumeroNfe(tx as unknown as PrismaClient, tenant.id, serie);
    const chave = buildChaveNFe({ uf: tenant.uf, cnpj: tenant.cnpj, serie, numero });

    // CST de devolução vem mapeado a partir do CST da venda referenciada.
    const cstVendaReferencia = snapshotCst(venda.fiscalPayload);

    const snapshot = enrichTaxSnapshot(taxSnapshotFromRule(saleTaxRule, aliqFallback), {
      settings: emitterSettings,
      tipo: NFeTipo.DEVOLUCAO,
      valor: valorTotal,
      valorIcms: valorIcmsDevol,
      emitUf: tenant.uf,
      destUf: venda.destUf,
      indFinal: customerType === "non_taxpayer" ? 1 : 0,
      cstVendaReferencia,
    });

    const devolucaoRow = await tx.nFe.create({
      data: {
        tenantId: tenant.id,
        productId: product.id,
        chave,
        numero,
        serie,
        natOp: "Devolucao de mercadorias",
        cfop,
        ncm: product.ncm,
        // Devolução é emitida contra o mesmo destinatário da venda original.
        destNome: venda.destNome,
        destDoc: venda.destDoc,
        destUf: venda.destUf,
        destLogradouro: venda.destLogradouro,
        destNumero: venda.destNumero,
        destComplemento: venda.destComplemento,
        destBairro: venda.destBairro,
        destCodigoMunicipio: venda.destCodigoMunicipio,
        destMunicipio: venda.destMunicipio,
        destCep: venda.destCep,
        destCodigoPais: venda.destCodigoPais,
        destNomePais: venda.destNomePais,
        destTelefone: venda.destTelefone,
        destIndIeDest: venda.destIndIeDest,
        valor: valorTotal,
        valorIcms: valorIcmsDevol,
        aliqIcms: aliqDevol,
        status: FiscalStatus.AUTORIZADA,
        emitidaEm: new Date(),
        pedidoMl: venda.pedidoMl,
        quantidade,
        tipo: NFeTipo.DEVOLUCAO,
        saldoDisponivel: null,
        nfeReferenciaId: venda.id,
        fiscalPayload: enrichFiscalPayloadWithXTexto(
          { ...snapshot, engine: nota } as Record<string, unknown>,
          {
            tipo: NFeTipo.DEVOLUCAO,
            cfop,
            natOp: "Devolucao de mercadorias",
            pedidoMl: venda.pedidoMl,
            indFinal: customerType === "non_taxpayer" ? 1 : 0,
          },
        ) as Prisma.InputJsonValue,
      },
    });

    // Estorno FIFO: devolve o saldo consumido de volta às remessas da cadeia.
    // A venda referencia o retorno simbólico, que registrou os consumos por remessa.
    const estornos: { remessaNfeId: string; quantidade: number }[] = [];
    if (venda.nfeReferenciaId) {
      const consumos = await tx.nfeRemessaConsumo.findMany({
        where: { retornoNfeId: venda.nfeReferenciaId },
      });
      for (const consumo of consumos) {
        await tx.nFe.update({
          where: { id: consumo.remessaNfeId },
          data: { saldoDisponivel: { increment: consumo.quantidade } },
        });
        estornos.push({ remessaNfeId: consumo.remessaNfeId, quantidade: consumo.quantidade });
      }
    }

    // Remessa simbólica: registra o retorno do saldo ao full, referenciando a cadeia
    // (refNFe → devolução). O saldo em si já voltou à remessa física no estorno acima;
    // esta nota é o documento fiscal dessa devolução de saldo.
    const remessaPrincipal = venda.nfeReferencia?.nfeReferenciaId
      ? await tx.nFe.findUnique({ where: { id: venda.nfeReferencia.nfeReferenciaId } })
      : null;

    let remessaSimbolicaDto: ReturnType<typeof mapNfe> | undefined;
    if (remessaPrincipal) {
      const numeroSimb = await proximoNumeroNfe(tx as unknown as PrismaClient, tenant.id, serie);
      const chaveSimb = buildChaveNFe({ uf: tenant.uf, cnpj: tenant.cnpj, serie, numero: numeroSimb });

      // Movimentação de estoque usa o preço de custo (igual à remessa), não o de venda.
      const custoUnit = productUnitPrice(product, "REMESSA");
      const valorSimb = Math.round(custoUnit * quantidade * 100) / 100;
      const aliqSimb = num(remessaPrincipal.aliqIcms) || 0;
      const icmsSimb = Math.round(valorSimb * (aliqSimb / 100) * 100) / 100;

      const remessaSimbRow = await tx.nFe.create({
        data: {
          tenantId: tenant.id,
          productId: product.id,
          chave: chaveSimb,
          numero: numeroSimb,
          serie,
          natOp: "Outras Saidas - Remessa Simbolica para Deposito Temporario",
          cfop: "5949",
          ncm: product.ncm,
          // Devolvida ao mesmo destinatário (full) da remessa física original.
          destNome: remessaPrincipal.destNome,
          destDoc: remessaPrincipal.destDoc,
          destUf: remessaPrincipal.destUf,
          destLogradouro: remessaPrincipal.destLogradouro,
          destNumero: remessaPrincipal.destNumero,
          destComplemento: remessaPrincipal.destComplemento,
          destBairro: remessaPrincipal.destBairro,
          destCodigoMunicipio: remessaPrincipal.destCodigoMunicipio,
          destMunicipio: remessaPrincipal.destMunicipio,
          destCep: remessaPrincipal.destCep,
          destCodigoPais: remessaPrincipal.destCodigoPais,
          destNomePais: remessaPrincipal.destNomePais,
          destTelefone: remessaPrincipal.destTelefone,
          destIndIeDest: remessaPrincipal.destIndIeDest,
          valor: valorSimb,
          valorIcms: icmsSimb,
          aliqIcms: aliqSimb,
          status: FiscalStatus.AUTORIZADA,
          emitidaEm: new Date(),
          pedidoMl: venda.pedidoMl,
          quantidade,
          tipo: NFeTipo.REMESSA_SIMBOLICA,
          // Saldo já retornou à remessa física no estorno; esta nota é só o registro fiscal.
          saldoDisponivel: null,
          nfeReferenciaId: devolucaoRow.id,
          fiscalPayload: enrichFiscalPayloadWithXTexto(
            (remessaPrincipal.fiscalPayload as Record<string, unknown> | null) ?? {},
            {
              tipo: NFeTipo.REMESSA_SIMBOLICA,
              cfop: "5949",
              natOp: "Outras Saidas - Remessa Simbolica para Deposito Temporario",
              pedidoMl: venda.pedidoMl,
            },
          ) as Prisma.InputJsonValue,
        },
      });
      remessaSimbolicaDto = mapNfe(remessaSimbRow, devolucaoRow.chave);
    }

    return {
      devolucao: mapNfe(devolucaoRow, venda.chave),
      remessaSimbolica: remessaSimbolicaDto,
      saldoEstornado: estornos,
    };
  });
}
