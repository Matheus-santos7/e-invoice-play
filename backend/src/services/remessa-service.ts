import { FiscalStatus, NFeTipo, type PrismaClient, type Product, type Tenant } from "../generated/prisma/client.js";
import { mapNfe } from "../lib/fiscal-mappers.js";
import { buildChaveNFe, gerarPedidoMl } from "../lib/nfe-chave.js";
import { proximoNumeroNfe } from "../lib/nfe-sequencia.js";
import {
  REMESSA_CFOP,
  REMESSA_ML_DEST,
  REMESSA_NAT_OP,
} from "../lib/remessa-dest.js";
import { emitirCteRemessa } from "./cte-remessa-service.js";

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
  const valor = Math.round(Number(product.preco) * quantidade * 100) / 100;
  const aliqIcms = inferAliqIcmsRemessa(tenant.uf, REMESSA_ML_DEST.uf);
  const valorIcms = Math.round(valor * (aliqIcms / 100) * 100) / 100;
  const pedidoMl = gerarPedidoMl();

  const chave = buildChaveNFe({
    uf: tenant.uf,
    cnpj: tenant.cnpj,
    serie,
    numero,
  });

  const emitidaEm = new Date();

  const { nfeRow, cteRow } = await prisma.$transaction(async (tx) => {
    const nfeRow = await tx.nFe.create({
      data: {
        tenantId: tenant.id,
        productId: product.id,
        chave,
        numero,
        serie,
        natOp: REMESSA_NAT_OP,
        cfop: REMESSA_CFOP,
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
