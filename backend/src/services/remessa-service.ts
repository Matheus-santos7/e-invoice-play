/**
 * Emissão de NF-e de remessa física para depósito temporário (full).
 *
 * - Destinatário = unidade logística ML selecionada (planilha) ou fallback legado.
 * - `saldoDisponivel` = quantidade enviada (base do FIFO por CD).
 * - Emite CT-e de remessa na mesma transação quando aplicável.
 */
import {
  FiscalStatus,
  NFeTipo,
  OperacaoFiscalTipo,
  Prisma,
  type PrismaClient,
  type Product,
  type Tenant,
} from "../generated/prisma/client.js";
import { mapNfe } from "../lib/fiscal-mappers.js";
import { buildChaveNFe, gerarPedidoMl } from "../lib/nfe-chave.js";
import { proximoNumeroNfe } from "../lib/nfe-sequencia.js";
import { REMESSA_CFOP, REMESSA_NAT_OP } from "../lib/remessa-dest.js";
import type { UnidadeDestinoFiscal } from "../lib/meli-unidade.js";
import { enrichTaxSnapshot, loadEmitterSettings } from "../lib/fiscal-emitter-runtime.js";
import { taxSnapshotFromRule } from "../lib/tax-snapshot.js";
import { enrichFiscalPayloadWithXTexto } from "../lib/nfe-xtexto.js";
import { emitirCteRemessa } from "./cte-remessa-service.js";
import { lineTotal, productUnitPrice } from "../lib/product-pricing.js";
import { resolveTaxRule } from "./tax-rule-service.js";
import { UnidadeLogisticaService } from "./unidade-logistica-service.js";
import { registrarMovimentacaoProduto } from "./movimentacao-produto-service.js";

/** Alíquota ICMS remessa interestadual (modelo PR → SC ML: 4%). */
function inferAliqIcmsRemessa(emitUf: string, destUf: string): number {
  if (emitUf.toUpperCase() === destUf.toUpperCase()) return 18;
  return 4;
}

export type EmitirRemessaOptions = {
  unidadeDestinoId?: string;
  pedidoMl?: string;
  observacaoAvanco?: string;
};

export async function emitirNFeRemessa(
  prisma: PrismaClient,
  tenant: Tenant,
  product: Product,
  quantidade: number,
  options?: EmitirRemessaOptions,
) {
  if (quantidade < 1) {
    throw new RemessaError("Quantidade para remessa deve ser pelo menos 1");
  }

  const unidadeService = new UnidadeLogisticaService(prisma);
  const { unidade, destino } = await unidadeService.resolveDestinoRemessa(
    tenant.id,
    options?.unidadeDestinoId,
  );

  const serie = tenant.serieRemessa;
  const numero = await proximoNumeroNfe(prisma, tenant.id, serie);
  const unitCusto = productUnitPrice(product, "REMESSA");
  if (unitCusto <= 0) {
    throw new RemessaError(
      "Preço de custo não informado ou zero. Informe o custo no cadastro do produto para emitir remessa.",
    );
  }
  const valor = lineTotal(unitCusto, quantidade);
  const pedidoMl = options?.pedidoMl ?? gerarPedidoMl();

  const chave = buildChaveNFe({
    uf: tenant.uf,
    cnpj: tenant.cnpj,
    serie,
    numero,
  });

  const emitidaEm = new Date();

  const ruleBaseId = product.taxRuleBaseId?.trim();
  if (!ruleBaseId) {
    throw new RemessaError(
      "Produto sem regra fiscal associada. Edite o cadastro e selecione a regra da planilha.",
    );
  }

  const remessaTaxRule = await resolveTaxRule(prisma, tenant.id, {
    originUf: tenant.uf,
    destinationUf: destino.uf,
    transactionType: "inbound",
    customerType: "taxpayer",
    ruleBaseId,
  });
  if (!remessaTaxRule) {
    throw new RemessaError(
      `Regra "${ruleBaseId}" sem linha de remessa (origem ${tenant.uf} → ${destino.uf}). Importe ou revise a planilha.`,
    );
  }

  const aliqFallback = inferAliqIcmsRemessa(tenant.uf, destino.uf);
  const aliqIcms = remessaTaxRule.aliquotaIcmsInterna ?? aliqFallback;
  const valorIcms = Math.round(valor * (aliqIcms / 100) * 100) / 100;
  const cfopRemessa = remessaTaxRule.cfop?.trim() || REMESSA_CFOP;

  const destData = destinoToNfeFields(destino);

  const { nfeRow, cteRow } = await prisma.$transaction(async (tx) => {
    const emitterSettings = await loadEmitterSettings(tx, tenant.id);
    const fiscalPayload = enrichFiscalPayloadWithXTexto(
      enrichTaxSnapshot(taxSnapshotFromRule(remessaTaxRule, aliqFallback), {
        settings: emitterSettings,
        tipo: NFeTipo.REMESSA,
        valor,
        valorIcms,
        emitUf: tenant.uf,
        destUf: destino.uf,
        indFinal: 0,
      }) as Record<string, unknown>,
      {
        tipo: NFeTipo.REMESSA,
        cfop: cfopRemessa,
        natOp: REMESSA_NAT_OP,
        pedidoMl,
      },
    );

    const nfeRow = await tx.nFe.create({
      data: {
        tenantId: tenant.id,
        productId: product.id,
        chave,
        numero,
        serie,
        natOp: REMESSA_NAT_OP,
        cfop: cfopRemessa,
        ncm: product.ncm,
        ...destData,
        valor,
        valorIcms,
        aliqIcms,
        status: FiscalStatus.AUTORIZADA,
        emitidaEm,
        pedidoMl,
        quantidade,
        tipo: NFeTipo.REMESSA,
        saldoDisponivel: quantidade,
        unidadeDestinoId: unidade?.id ?? undefined,
        fiscalPayload: fiscalPayload as Prisma.InputJsonValue,
      },
    });

    await registrarMovimentacaoProduto(tx, {
      tenantId: tenant.id,
      productId: product.id,
      tipoOperacao: OperacaoFiscalTipo.REMESSA,
      quantidade,
      unidadeDestinoId: unidade?.id ?? undefined,
      nfeId: nfeRow.id,
      observacao: options?.observacaoAvanco ?? (unidade ? `Remessa para ${unidade.codigo}` : undefined),
    });

    const cteRow = await emitirCteRemessa(tx, tenant, nfeRow);
    return { nfeRow, cteRow };
  });

  return { nfe: mapNfe(nfeRow), cte: cteRow };
}

function destinoToNfeFields(destino: UnidadeDestinoFiscal) {
  return {
    destNome: destino.nome,
    destDoc: destino.cnpj,
    destUf: destino.uf,
    destLogradouro: destino.logradouro,
    destNumero: destino.numero,
    destComplemento: destino.complemento,
    destBairro: destino.bairro,
    destCodigoMunicipio: destino.codigoMunicipio,
    destMunicipio: destino.municipio,
    destCep: destino.cep,
    destCodigoPais: destino.codigoPais,
    destNomePais: destino.nomePais,
    destIndIeDest: destino.indIeDest,
  };
}

export class RemessaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RemessaError";
  }
}
