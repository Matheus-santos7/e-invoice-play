import {
  FiscalStatus,
  NFeTipo,
  Prisma,
  type PrismaClient,
  type Product,
  type Tenant,
} from "../generated/prisma/client.js";
import { mapNfe } from "../lib/fiscal-mappers.js";
import { buildChaveNFe, gerarPedidoMl } from "../lib/nfe-chave.js";
import { proximoNumeroNfe } from "../lib/nfe-sequencia.js";
import {
  REMESSA_CFOP,
  REMESSA_ML_DEST,
  REMESSA_NAT_OP,
} from "../lib/remessa-dest.js";
import { enrichTaxSnapshot, loadEmitterSettings } from "../lib/fiscal-emitter-runtime.js";
import { taxSnapshotFromRule } from "../lib/tax-snapshot.js";
import { enrichFiscalPayloadWithXTexto } from "../lib/nfe-xtexto.js";
import { emitirCteRemessa } from "./cte-remessa-service.js";
import { lineTotal, productUnitPrice } from "../lib/product-pricing.js";
import { resolveTaxRule } from "./tax-rule-service.js";

/** Alíquota ICMS remessa interestadual (modelo PR → SC ML: 4%). */
function inferAliqIcmsRemessa(emitUf: string, destUf: string): number {
  if (emitUf.toUpperCase() === destUf.toUpperCase()) return 18;
  return 4;
}

export async function emitirNFeRemessa(
  prisma: PrismaClient,
  tenant: Tenant,
  product: Product,
  quantidade: number,
) {
  if (quantidade < 1) {
    throw new RemessaError("Quantidade para remessa deve ser pelo menos 1");
  }

  const serie = tenant.serieRemessa;
  const numero = await proximoNumeroNfe(prisma, tenant.id, serie);
  const unitCusto = productUnitPrice(product, "REMESSA");
  if (unitCusto <= 0) {
    throw new RemessaError(
      "Preço de custo não informado ou zero. Informe o custo no cadastro do produto para emitir remessa.",
    );
  }
  const valor = lineTotal(unitCusto, quantidade);
  const pedidoMl = gerarPedidoMl();

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
    destinationUf: REMESSA_ML_DEST.uf,
    transactionType: "inbound",
    customerType: "taxpayer",
    ruleBaseId,
  });
  if (!remessaTaxRule) {
    throw new RemessaError(
      `Regra "${ruleBaseId}" sem linha de remessa (origem ${tenant.uf} → ${REMESSA_ML_DEST.uf}). Importe ou revise a planilha.`,
    );
  }

  const aliqFallback = inferAliqIcmsRemessa(tenant.uf, REMESSA_ML_DEST.uf);
  const aliqIcms = remessaTaxRule.aliquotaIcmsInterna ?? aliqFallback;
  const valorIcms = Math.round(valor * (aliqIcms / 100) * 100) / 100;
  const cfopRemessa = remessaTaxRule.cfop?.trim() || REMESSA_CFOP;

  const { nfeRow, cteRow } = await prisma.$transaction(async (tx) => {
    const emitterSettings = await loadEmitterSettings(tx, tenant.id);
    const fiscalPayload = enrichFiscalPayloadWithXTexto(
      enrichTaxSnapshot(taxSnapshotFromRule(remessaTaxRule, aliqFallback), {
        settings: emitterSettings,
        tipo: NFeTipo.REMESSA,
        valor,
        valorIcms,
        emitUf: tenant.uf,
        destUf: REMESSA_ML_DEST.uf,
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
        destNome: REMESSA_ML_DEST.nome,
        destDoc: REMESSA_ML_DEST.cnpj,
        destUf: REMESSA_ML_DEST.uf,
        destLogradouro: REMESSA_ML_DEST.logradouro,
        destNumero: REMESSA_ML_DEST.numero,
        destComplemento: REMESSA_ML_DEST.complemento,
        destBairro: REMESSA_ML_DEST.bairro,
        destCodigoMunicipio: REMESSA_ML_DEST.codigoMunicipio,
        destMunicipio: REMESSA_ML_DEST.municipio,
        destCep: REMESSA_ML_DEST.cep,
        destCodigoPais: REMESSA_ML_DEST.codigoPais,
        destNomePais: REMESSA_ML_DEST.nomePais,
        destIndIeDest: REMESSA_ML_DEST.indIeDest,
        valor,
        valorIcms,
        aliqIcms,
        status: FiscalStatus.AUTORIZADA,
        emitidaEm,
        pedidoMl,
        quantidade,
        tipo: NFeTipo.REMESSA,
        saldoDisponivel: quantidade,
        fiscalPayload: fiscalPayload as Prisma.InputJsonValue,
      },
    });

    const cteRow = await emitirCteRemessa(tx, tenant, nfeRow, product);
    return { nfeRow, cteRow };
  });

  return { nfe: mapNfe(nfeRow), cte: cteRow };
}

export class RemessaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RemessaError";
  }
}
