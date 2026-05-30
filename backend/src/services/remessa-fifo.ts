/**
 * Controle de saldo de remessas físicas (FIFO).
 *
 * Modelo operacional (full / ML):
 * - A **remessa física** entra com `saldoDisponivel` = quantidade enviada ao depósito.
 * - O **retorno simbólico** (na venda) representa a saída simbólica desse estoque; aqui só
 *   debitamos o saldo e registramos qual remessa foi consumida.
 * - A **venda** não debita remessa diretamente: ela referencia o retorno; o débito já ocorreu
 *   quando o retorno foi emitido junto com a venda (`venda-chain-service`).
 *
 * Tabela `nfe_remessa_consumos`: uma linha por par (retorno, remessa) + quantidade.
 * Serve para estornar o saldo exato em devolução ou cancelamento sem “adivinhar” o FIFO de novo.
 *
 * @see remessa-service.ts — cria remessa com saldo inicial
 * @see venda-chain-service.ts — chama `consumirSaldoRemessaFifo` após criar o retorno
 * @see devolucao-service.ts — `estornarConsumosRemessa` via retorno da venda
 * @see cancelamento-service.ts — estorno ao cancelar venda + retorno
 */
import { NFeTipo, type Prisma, type PrismaClient } from "../generated/prisma/client.js";
import { fiscalNotDeleted } from "./fiscal-service.js";

/** Subconjunto do client usado dentro de `$transaction` (só tabelas que este módulo altera). */
type Tx = Pick<PrismaClient, "nFe" | "nfeRemessaConsumo">;

/**
 * Lançada quando a quantidade pedida na venda/retorno excede o saldo somado das remessas
 * do mesmo `productId` no tenant. A UI deve orientar: nova remessa ou menos unidades.
 */
export class SaldoRemessaInsuficienteError extends Error {
  constructor(
    public readonly productId: string,
    public readonly solicitado: number,
    public readonly disponivel: number,
  ) {
    super(
      `Saldo de remessa insuficiente para o produto. Solicitado: ${solicitado}, disponível: ${disponivel}. Emita nova remessa ou reduza a quantidade.`,
    );
    this.name = "SaldoRemessaInsuficienteError";
  }
}

/**
 * Soma o saldo ainda disponível em todas as remessas físicas do produto.
 * Usado para validação prévia (ex.: antes de checkout); a venda em si debita no FIFO.
 */
function remessaSaldoWhere(
  tenantId: string,
  productId: string,
  unidadeDestinoId?: string,
): Prisma.NFeWhereInput {
  return {
    tenantId,
    productId,
    tipo: NFeTipo.REMESSA,
    saldoDisponivel: { gt: 0 },
    ...fiscalNotDeleted,
    ...(unidadeDestinoId
      ? { unidadeDestinoId }
      : {}),
  };
}

export async function saldoRemessaDisponivel(
  prisma: PrismaClient,
  tenantId: string,
  productId: string,
  unidadeDestinoId?: string,
): Promise<number> {
  const rows = await prisma.nFe.findMany({
    where: remessaSaldoWhere(tenantId, productId, unidadeDestinoId),
    select: { saldoDisponivel: true },
  });
  return rows.reduce((acc, r) => acc + (r.saldoDisponivel ?? 0), 0);
}

/**
 * Debita saldo das remessas na ordem FIFO e persiste o rastreio por retorno.
 *
 * @param retornoNfeId — ID da NF-e de retorno simbólico já criada na mesma transação;
 *   todos os consumos desta operação ficam ligados a ela (estorno usa esse ID).
 * @returns alocações na ordem de consumo; `[0]` é a remessa principal (mais antiga) usada
 *   em `venda-chain-service` para setar `nfeReferenciaId` do retorno → remessa no XML.
 *
 * Regras:
 * - Apenas `tipo === REMESSA` com `saldoDisponivel > 0` (remessa simbólica não tem saldo).
 * - Ordem: `emitidaEm` asc, depois `numero` asc (desempate estável).
 * - Uma venda pode consumir várias remessas se a quantidade ultrapassar o saldo da mais antiga.
 */
export async function consumirSaldoRemessaFifo(
  tx: Tx,
  tenantId: string,
  productId: string,
  quantidade: number,
  retornoNfeId: string,
  unidadeDestinoId?: string,
): Promise<{ remessaNfeId: string; quantidade: number }[]> {
  const remessas = await tx.nFe.findMany({
    where: remessaSaldoWhere(tenantId, productId, unidadeDestinoId),
    orderBy: [{ emitidaEm: "asc" }, { numero: "asc" }],
  });

  let restante = quantidade;
  const alocacoes: { remessaNfeId: string; quantidade: number }[] = [];

  for (const remessa of remessas) {
    if (restante <= 0) break;
    const saldo = remessa.saldoDisponivel ?? 0;
    if (saldo <= 0) continue;

    const consumir = Math.min(restante, saldo);

    await tx.nFe.update({
      where: { id: remessa.id },
      data: { saldoDisponivel: saldo - consumir },
    });

    // Auditoria: não apagar em estorno — só incrementar saldo de volta nas mesmas remessas.
    await tx.nfeRemessaConsumo.create({
      data: {
        retornoNfeId,
        remessaNfeId: remessa.id,
        quantidade: consumir,
      },
    });
    alocacoes.push({ remessaNfeId: remessa.id, quantidade: consumir });
    restante -= consumir;
  }

  if (restante > 0) {
    const disponivel = quantidade - restante;
    throw new SaldoRemessaInsuficienteError(productId, quantidade, disponivel);
  }

  return alocacoes;
}

/**
 * Debita saldo FIFO em remessas de um CD específico, sem vínculo a retorno (avanço entre CDs).
 */
export async function debitarSaldoRemessaPorCd(
  tx: Tx,
  tenantId: string,
  productId: string,
  quantidade: number,
  unidadeDestinoId: string,
): Promise<{ remessaNfeId: string; quantidade: number }[]> {
  const remessas = await tx.nFe.findMany({
    where: remessaSaldoWhere(tenantId, productId, unidadeDestinoId),
    orderBy: [{ emitidaEm: "asc" }, { numero: "asc" }],
  });

  let restante = quantidade;
  const alocacoes: { remessaNfeId: string; quantidade: number }[] = [];

  for (const remessa of remessas) {
    if (restante <= 0) break;
    const saldo = remessa.saldoDisponivel ?? 0;
    if (saldo <= 0) continue;

    const consumir = Math.min(restante, saldo);
    await tx.nFe.update({
      where: { id: remessa.id },
      data: { saldoDisponivel: saldo - consumir },
    });
    alocacoes.push({ remessaNfeId: remessa.id, quantidade: consumir });
    restante -= consumir;
  }

  if (restante > 0) {
    const disponivel = quantidade - restante;
    throw new SaldoRemessaInsuficienteError(productId, quantidade, disponivel);
  }

  return alocacoes;
}

/**
 * Estorna o saldo consumido por um retorno simbólico (devolução ou cancelamento).
 *
 * @param retornoNfeId — normalmente `venda.nfeReferenciaId` (a venda aponta para o retorno).
 * Lê `nfe_remessa_consumos` daquele retorno e devolve `saldoDisponivel` em cada remessa.
 * Os registros de consumo permanecem no banco (histórico); não há delete aqui.
 */
export async function estornarConsumosRemessa(
  tx: Tx,
  retornoNfeId: string,
): Promise<{ remessaNfeId: string; quantidade: number }[]> {
  const consumos = await tx.nfeRemessaConsumo.findMany({
    where: { retornoNfeId },
  });
  const estornos: { remessaNfeId: string; quantidade: number }[] = [];
  for (const consumo of consumos) {
    await tx.nFe.update({
      where: { id: consumo.remessaNfeId },
      data: { saldoDisponivel: { increment: consumo.quantidade } },
    });
    estornos.push({ remessaNfeId: consumo.remessaNfeId, quantidade: consumo.quantidade });
  }
  return estornos;
}
