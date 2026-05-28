import { NFeTipo, type PrismaClient } from "../generated/prisma/client.js";
import { labelNfeTipo } from "../lib/fiscal-mappers.js";
import { fiscalNotDeleted } from "./fiscal-service.js";

export type TimelineChainStepDto = {
  tipo: NFeTipo;
  tipoLabel: string;
  chave: string;
  numero: number;
  serie: number;
  emitidaEm: string;
  quantidade: number;
  saldoDisponivel?: number;
  nfeReferenciaChave?: string;
};

export type TimelineChainDto = {
  id: string;
  pedidoMl?: string;
  emitidaEm: string;
  status: "completa" | "parcial";
  steps: TimelineChainStepDto[];
};

function mapStep(nfe: {
  tipo: NFeTipo;
  chave: string;
  numero: number;
  serie: number;
  emitidaEm: Date;
  quantidade: number;
  saldoDisponivel: number | null;
  pedidoMl: string;
  nfeReferencia?: { chave: string } | null;
}): TimelineChainStepDto {
  return {
    tipo: nfe.tipo,
    tipoLabel: labelNfeTipo(nfe.tipo),
    chave: nfe.chave,
    numero: nfe.numero,
    serie: nfe.serie,
    emitidaEm: nfe.emitidaEm.toISOString(),
    quantidade: nfe.quantidade,
    saldoDisponivel: nfe.tipo === NFeTipo.REMESSA ? (nfe.saldoDisponivel ?? 0) : undefined,
    nfeReferenciaChave: nfe.nfeReferencia?.chave,
  };
}

function buildChainFromVenda(
  venda: { id: string; pedidoMl: string; emitidaEm: Date },
  byId: Map<string, ChainNode>,
): TimelineChainDto | null {
  const steps: TimelineChainStepDto[] = [];
  let cur: ChainNode | undefined = byId.get(venda.id);

  while (cur) {
    steps.unshift(mapStep(cur));
    cur = cur.nfeReferenciaId ? byId.get(cur.nfeReferenciaId) : undefined;
  }

  if (steps.length === 0 || steps[0]!.tipo !== NFeTipo.REMESSA) return null;

  const devolucoes = [...byId.values()].filter(
    (n) => n.tipo === NFeTipo.DEVOLUCAO && n.nfeReferenciaId === venda.id,
  );
  for (const dev of devolucoes) {
    steps.push(mapStep(dev));
  }

  const hasVenda = steps.some((s) => s.tipo === NFeTipo.VENDA);
  const hasRetorno = steps.some((s) => s.tipo === NFeTipo.RETORNO_SIMBOLICO);

  return {
    id: venda.id,
    pedidoMl: venda.pedidoMl,
    emitidaEm: venda.emitidaEm.toISOString(),
    status: hasVenda && hasRetorno ? "completa" : "parcial",
    steps,
  };
}

type ChainNode = {
  id: string;
  tipo: NFeTipo;
  chave: string;
  numero: number;
  serie: number;
  emitidaEm: Date;
  quantidade: number;
  saldoDisponivel: number | null;
  pedidoMl: string;
  nfeReferenciaId: string | null;
  nfeReferencia?: { chave: string } | null;
};

export async function listTimelineChains(prisma: PrismaClient, tenantId: string): Promise<TimelineChainDto[]> {
  const nfes = await prisma.nFe.findMany({
    where: { tenantId, ...fiscalNotDeleted },
    include: { nfeReferencia: { select: { chave: true } } },
    orderBy: { emitidaEm: "asc" },
  });

  const byId = new Map<string, ChainNode>(nfes.map((n) => [n.id, n as ChainNode]));

  const vendas = nfes.filter((n) => n.tipo === NFeTipo.VENDA);
  const chains = vendas
    .map((v) => buildChainFromVenda(v, byId))
    .filter((c): c is TimelineChainDto => c !== null);

  const remessasOrfas = nfes.filter(
    (n) =>
      n.tipo === NFeTipo.REMESSA &&
      (n.saldoDisponivel ?? 0) > 0 &&
      !chains.some((c) => c.steps.some((s) => s.chave === n.chave)),
  );

  for (const remessa of remessasOrfas) {
    chains.push({
      id: remessa.id,
      pedidoMl: remessa.pedidoMl,
      emitidaEm: remessa.emitidaEm.toISOString(),
      status: "parcial",
      steps: [mapStep(remessa as ChainNode)],
    });
  }

  chains.sort((a, b) => new Date(a.emitidaEm).getTime() - new Date(b.emitidaEm).getTime());
  return chains;
}
