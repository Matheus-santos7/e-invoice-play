import {
  CteModal,
  FiscalStatus,
  type NFe,
  type PrismaClient,
  type Product,
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
import { REMESSA_ML_DEST } from "../lib/remessa-dest.js";

type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

export async function emitirCteRemessa(
  prisma: Tx,
  tenant: Tenant,
  nfeRemessa: NFe,
  product: Product,
) {
  const serie = tenant.serieCte;
  const numero = await proximoNumeroCte(prisma as PrismaClient, tenant.id, serie);
  const valorCarga = Number(nfeRemessa.valor);
  const valorFrete = calcularValorFreteRemessa(valorCarga);
  const pesoCarga = calcularPesoCarga(nfeRemessa.quantidade);
  const emitidoEm = new Date();

  const origem = `${tenant.municipio}/${tenant.uf}`;
  const destino = `${REMESSA_ML_DEST.municipio}/${REMESSA_ML_DEST.uf}`;

  const chave = buildChaveCTe({
    uf: CTE_ML_EMIT.uf,
    cnpj: CTE_ML_EMIT.cnpj,
    serie,
    numero,
  });

  const row = await prisma.cTe.create({
    data: {
      tenantId: tenant.id,
      nfeRemessaId: nfeRemessa.id,
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

  return mapCte(row, nfeRemessa.chave);
}
