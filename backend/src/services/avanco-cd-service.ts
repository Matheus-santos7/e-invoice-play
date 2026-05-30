/**
 * Avanço de mercadoria entre CDs Mercado Livre (cenário 3).
 *
 * 1. Debita saldo FIFO nas remessas com estoque no CD de origem.
 * 2. Emite REMESSA_SIMBOLICA (saída simbólica do CD origem).
 * 3. Emite nova REMESSA física para o CD destino (novo saldo no destino).
 * 4. Registra MovimentacaoProduto tipo AVANCO_CD ligando as duas NF-es.
 */
import {
  FiscalStatus,
  NFeTipo,
  OperacaoFiscalTipo,
  Prisma,
  type PrismaClient,
} from "../generated/prisma/client.js";
import { mapNfe, num } from "../lib/fiscal-mappers.js";
import { buildChaveNFe, gerarPedidoMl } from "../lib/nfe-chave.js";
import { proximoNumeroNfe } from "../lib/nfe-sequencia.js";
import { unidadeParaDestinoFiscal } from "../lib/meli-unidade.js";
import { enrichFiscalPayloadWithXTexto } from "../lib/nfe-xtexto.js";
import { productUnitPrice } from "../lib/product-pricing.js";
import {
  SaldoRemessaInsuficienteError,
  debitarSaldoRemessaPorCd,
} from "./remessa-fifo.js";
import { registrarMovimentacaoProduto } from "./movimentacao-produto-service.js";
import { UnidadeLogisticaError } from "./unidade-logistica-service.js";
import { emitirNFeRemessa } from "./remessa-service.js";

export class AvancoCdError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AvancoCdError";
  }
}

export async function emitirAvancoEntreCds(
  prisma: PrismaClient,
  input: {
    tenantId: string;
    productId: string;
    quantidade: number;
    unidadeOrigemId: string;
    unidadeDestinoId: string;
  },
) {
  if (input.quantidade < 1) {
    throw new AvancoCdError("Quantidade deve ser pelo menos 1");
  }
  if (input.unidadeOrigemId === input.unidadeDestinoId) {
    throw new AvancoCdError("CD de origem e destino devem ser diferentes");
  }

  const [tenant, product, origem, destino] = await Promise.all([
    prisma.tenant.findUniqueOrThrow({ where: { id: input.tenantId } }),
    prisma.product.findFirst({ where: { id: input.productId, tenantId: input.tenantId } }),
    prisma.meliUnidadeLogistica.findFirst({
      where: { id: input.unidadeOrigemId, tenantId: input.tenantId, ativa: true },
    }),
    prisma.meliUnidadeLogistica.findFirst({
      where: { id: input.unidadeDestinoId, tenantId: input.tenantId, ativa: true },
    }),
  ]);

  if (!product) throw new AvancoCdError("Produto não encontrado");
  if (!origem) throw new UnidadeLogisticaError("CD de origem não encontrado ou inativo");
  if (!destino) throw new UnidadeLogisticaError("CD de destino não encontrado ou inativo");

  const destOrigem = unidadeParaDestinoFiscal(origem);
  const serie = tenant.serieRemessa;
  const pedidoMl = gerarPedidoMl();

  const result = await prisma.$transaction(async (tx) => {
    let alocacoes: { remessaNfeId: string; quantidade: number }[];
    try {
      alocacoes = await debitarSaldoRemessaPorCd(
        tx,
        input.tenantId,
        input.productId,
        input.quantidade,
        input.unidadeOrigemId,
      );
    } catch (e) {
      if (e instanceof SaldoRemessaInsuficienteError) {
        throw new AvancoCdError(
          `Saldo insuficiente no CD ${origem.codigo}. Disponível: ${e.disponivel}, solicitado: ${e.solicitado}.`,
        );
      }
      throw e;
    }

    const remessaPrincipal = await tx.nFe.findUniqueOrThrow({
      where: { id: alocacoes[0]!.remessaNfeId },
    });

    const numeroSimb = await proximoNumeroNfe(tx as unknown as PrismaClient, tenant.id, serie);
    const chaveSimb = buildChaveNFe({ uf: tenant.uf, cnpj: tenant.cnpj, serie, numero: numeroSimb });
    const custoUnit = productUnitPrice(product, "REMESSA");
    const valorSimb = Math.round(custoUnit * input.quantidade * 100) / 100;
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
        destNome: destOrigem.nome,
        destDoc: destOrigem.cnpj,
        destUf: destOrigem.uf,
        destLogradouro: destOrigem.logradouro,
        destNumero: destOrigem.numero,
        destComplemento: destOrigem.complemento,
        destBairro: destOrigem.bairro,
        destCodigoMunicipio: destOrigem.codigoMunicipio,
        destMunicipio: destOrigem.municipio,
        destCep: destOrigem.cep,
        destCodigoPais: destOrigem.codigoPais,
        destNomePais: destOrigem.nomePais,
        destIndIeDest: destOrigem.indIeDest,
        valor: valorSimb,
        valorIcms: icmsSimb,
        aliqIcms: aliqSimb,
        status: FiscalStatus.AUTORIZADA,
        emitidaEm: new Date(),
        pedidoMl,
        quantidade: input.quantidade,
        tipo: NFeTipo.REMESSA_SIMBOLICA,
        saldoDisponivel: null,
        nfeReferenciaId: remessaPrincipal.id,
        unidadeOrigemId: origem.id,
        unidadeDestinoId: destino.id,
        fiscalPayload: enrichFiscalPayloadWithXTexto(
          (remessaPrincipal.fiscalPayload as Record<string, unknown> | null) ?? {},
          {
            tipo: NFeTipo.REMESSA_SIMBOLICA,
            cfop: "5949",
            natOp: "Outras Saidas - Remessa Simbolica para Deposito Temporario",
            pedidoMl,
          },
        ) as Prisma.InputJsonValue,
      },
    });

    return { remessaSimbRow, pedidoMl, alocacoes };
  });

  const remessaDestino = await emitirNFeRemessa(prisma, tenant, product, input.quantidade, {
    unidadeDestinoId: destino.id,
    pedidoMl: result.pedidoMl,
    observacaoAvanco: `Avanço ${origem.codigo} → ${destino.codigo}`,
  });

  await prisma.$transaction(async (tx) => {
    await registrarMovimentacaoProduto(tx, {
      tenantId: tenant.id,
      productId: product.id,
      tipoOperacao: OperacaoFiscalTipo.AVANCO_CD,
      quantidade: input.quantidade,
      unidadeOrigemId: origem.id,
      unidadeDestinoId: destino.id,
      nfeId: result.remessaSimbRow.id,
      nfeSecundariaId: remessaDestino.nfe.id as string,
      observacao: `Avanço entre CDs ${origem.codigo} → ${destino.codigo}`,
    });
  });

  return {
    remessaSimbolica: mapNfe(result.remessaSimbRow, remessaDestino.nfe.chave),
    remessaDestino: remessaDestino.nfe,
    cte: remessaDestino.cte,
    alocacoesOrigem: result.alocacoes,
  };
}
