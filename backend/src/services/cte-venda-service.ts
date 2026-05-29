import {
  CteModal,
  FiscalStatus,
  type NFe,
  type PrismaClient,
  type Tenant,
} from "../generated/prisma/client.js";
import { buildChaveCTe } from "../lib/cte-chave.js";
import {
  calcularPesoCarga,
  calcularValorFreteRemessa,
  CTE_ML_EMIT,
  CTE_REMESSA_CFOP,
  CTE_REMESSA_NAT_OP,
} from "../lib/cte-remessa-template.js";
import { proximoNumeroCte } from "../lib/cte-sequencia.js";
import { mapCte } from "../lib/fiscal-mappers.js";

type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

/** CT-e de transporte da venda (full → consumidor), referenciando a NF-e de venda. */
export async function emitirCteVenda(
  prisma: Tx,
  tenant: Tenant,
  nfeVenda: NFe,
) {
  const serie = tenant.serieCte;
  const numero = await proximoNumeroCte(prisma as PrismaClient, tenant.id, serie);
  const valorCarga = Number(nfeVenda.valor);
  const valorFrete = calcularValorFreteRemessa(valorCarga);
  const pesoCarga = calcularPesoCarga(nfeVenda.quantidade);
  const emitidoEm = new Date();

  const origem = `${tenant.municipio}/${tenant.uf}`;
  const destino = `${nfeVenda.destMunicipio}/${nfeVenda.destUf}`;

  const chave = buildChaveCTe({
    uf: CTE_ML_EMIT.uf,
    cnpj: CTE_ML_EMIT.cnpj,
    serie,
    numero,
  });

  const row = await prisma.cTe.create({
    data: {
      tenantId: tenant.id,
      nfeVendaId: nfeVenda.id,
      chave,
      numero,
      serie,
      cfop: CTE_REMESSA_CFOP,
      natOp: CTE_REMESSA_NAT_OP,
      modal: CteModal.RODOVIARIO,
      origem,
      destino,
      valor: valorFrete,
      valorCarga,
      pesoCarga,
      status: FiscalStatus.AUTORIZADA,
      emitidoEm,
    },
  });

  return mapCte(row, nfeVenda.chave);
}
