import { NFeTipo, type PrismaClient } from "../generated/prisma/client.js";
import { fiscalNotDeleted } from "./fiscal-service.js";

type Tx = Pick<PrismaClient, "nFe" | "nfeRemessaConsumo">;

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

export async function saldoRemessaDisponivel(
  prisma: PrismaClient,
  tenantId: string,
  productId: string,
): Promise<number> {
  const rows = await prisma.nFe.findMany({
    where: {
      tenantId,
      productId,
      tipo: NFeTipo.REMESSA,
      saldoDisponivel: { gt: 0 },
      ...fiscalNotDeleted,
    },
    select: { saldoDisponivel: true },
  });
  return rows.reduce((acc, r) => acc + (r.saldoDisponivel ?? 0), 0);
}

/** Aloca e debita saldo FIFO (remessa mais antiga primeiro). */
export async function consumirSaldoRemessaFifo(
  tx: Tx,
  tenantId: string,
  productId: string,
  quantidade: number,
  retornoNfeId: string,
): Promise<{ remessaNfeId: string; quantidade: number }[]> {
  const remessas = await tx.nFe.findMany({
    where: {
      tenantId,
      productId,
      tipo: NFeTipo.REMESSA,
      saldoDisponivel: { gt: 0 },
      ...fiscalNotDeleted,
    },
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
