/**
 * CT-e de transporte da remessa física (seller → depósito Mercado Livre).
 *
 * ## Quando é emitido
 *
 * Dentro da mesma transação de `remessa-service.ts`, logo após criar a NF-e de
 * remessa (CFOP 6949). Não é chamado isoladamente pela API.
 *
 * ## Vínculos
 *
 * - `ctes.nfe_remessa_id` → NF-e de remessa (relação 1:1, `@unique`).
 * - No XML, o CT-e referencia a chave da NF-e (`mapCte` expõe `nfeChaveRef`).
 *
 * ## Dados do documento (simulação)
 *
 * | Campo      | Origem |
 * |------------|--------|
 * | Emitente   | `CTE_ML_EMIT` (transportador ML no XML de referência) |
 * | Origem     | Município/UF do tenant (seller) |
 * | Destino    | `REMESSA_ML_DEST` (depósito temporário) |
 * | valorCarga | Valor da NF-e de remessa |
 * | valor      | Frete estimado (`calcularValorFreteRemessa`) |
 * | pesoCarga  | Estimado por quantidade (`calcularPesoCarga`) |
 *
 * Chave CT-e: modelo 57 via `cte-chave.ts`; numeração em `cte-sequencia.ts`.
 *
 * @see cte-venda-service.ts — CT-e full → consumidor na venda
 * @see cte-remessa-template.ts — CFOP 6353, constantes ML
 */
import {
  CteModal,
  FiscalStatus,
  type NFe,
  type Prisma,
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
import { REMESSA_ML_DEST } from "../lib/remessa-dest.js";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

type TotaisCteRemessa = {
  valorCarga: number;
  valorFrete: number;
  pesoCarga: number;
};

type RotasCte = {
  origem: string;
  destino: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function prismaTx(tx: Tx): PrismaClient {
  return tx as unknown as PrismaClient;
}

/** Rota textual exibida na UI e persistida em `ctes.origem` / `destino`. */
function rotasRemessa(tenant: Tenant): RotasCte {
  return {
    origem: `${tenant.municipio}/${tenant.uf}`,
    destino: `${REMESSA_ML_DEST.municipio}/${REMESSA_ML_DEST.uf}`,
  };
}

function totaisDaRemessa(nfeRemessa: NFe): TotaisCteRemessa {
  const valorCarga = Number(nfeRemessa.valor);
  return {
    valorCarga,
    valorFrete: calcularValorFreteRemessa(valorCarga),
    pesoCarga: calcularPesoCarga(nfeRemessa.quantidade),
  };
}

function buildChaveCteRemessa(tenant: Tenant, serie: number, numero: number): string {
  return buildChaveCTe({
    uf: CTE_ML_EMIT.uf,
    cnpj: CTE_ML_EMIT.cnpj,
    serie,
    numero,
  });
}

function dadosCreateCteRemessa(params: {
  tenant: Tenant;
  nfeRemessa: NFe;
  serie: number;
  numero: number;
  chave: string;
  rotas: RotasCte;
  totais: TotaisCteRemessa;
  emitidoEm: Date;
}): Prisma.CTeUncheckedCreateInput {
  const { tenant, nfeRemessa, serie, numero, chave, rotas, totais, emitidoEm } = params;
  return {
    tenantId: tenant.id,
    nfeRemessaId: nfeRemessa.id,
    chave,
    numero,
    serie,
    cfop: CTE_REMESSA_CFOP,
    natOp: CTE_REMESSA_NAT_OP,
    modal: CteModal.RODOVIARIO,
    origem: rotas.origem,
    destino: rotas.destino,
    valor: totais.valorFrete,
    valorCarga: totais.valorCarga,
    pesoCarga: totais.pesoCarga,
    status: FiscalStatus.AUTORIZADA,
    emitidoEm,
  };
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Cria CT-e de remessa vinculado à NF-e recém-emitida.
 *
 * @param prisma — client da transação Prisma (mesma de `emitirNFeRemessa`).
 * @param nfeRemessa — linha `nfes` com `tipo === REMESSA` já persistida.
 * @returns DTO do CT-e com `nfeChaveRef` = chave da remessa.
 */
export async function emitirCteRemessa(prisma: Tx, tenant: Tenant, nfeRemessa: NFe) {
  const serie = tenant.serieCte;
  const numero = await proximoNumeroCte(prismaTx(prisma), tenant.id, serie);
  const emitidoEm = new Date();

  const rotas = rotasRemessa(tenant);
  const totais = totaisDaRemessa(nfeRemessa);
  const chave = buildChaveCteRemessa(tenant, serie, numero);

  const row = await prisma.cTe.create({
    data: dadosCreateCteRemessa({
      tenant,
      nfeRemessa,
      serie,
      numero,
      chave,
      rotas,
      totais,
      emitidoEm,
    }),
  });

  return mapCte(row, nfeRemessa.chave);
}
