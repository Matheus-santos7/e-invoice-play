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

/** Um cenário = uma cadeia derivada de uma remessa: remessa → retorno → venda [→ devolução]. */
export type TimelineChainDto = {
  id: string;
  pedidoMl?: string;
  emitidaEm: string;
  status: "completa" | "parcial";
  steps: TimelineChainStepDto[];
};

/**
 * Agrupamento por remessa. A mesma remessa (ex.: 4 und) alimenta vários cenários,
 * por isso ela se repete no início de cada cenário do grupo.
 */
export type TimelineRemessaGroupDto = {
  /** Vazio quando a venda não tem remessa na cadeia (venda avulsa / checkout direto). */
  remessaChave: string;
  remessaNumero?: number;
  remessaSerie?: number;
  emitidaEm: string;
  quantidadeRemessa?: number;
  saldoDisponivel?: number;
  cenarios: TimelineChainDto[];
};

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

function mapStep(nfe: ChainNode): TimelineChainStepDto {
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

/** Monta um cenário subindo pela referência: venda → retorno → remessa; anexa devoluções. */
function buildChainFromVenda(venda: ChainNode, byId: Map<string, ChainNode>): TimelineChainDto {
  const steps: TimelineChainStepDto[] = [];
  let cur: ChainNode | undefined = byId.get(venda.id);

  while (cur) {
    steps.unshift(mapStep(cur));
    cur = cur.nfeReferenciaId ? byId.get(cur.nfeReferenciaId) : undefined;
  }

  // Devoluções que referenciam esta venda entram no fim da cadeia, seguidas da
  // remessa simbólica que devolve o saldo ao full (refNFe → devolução).
  const todos = [...byId.values()];
  const devolucoes = todos.filter(
    (n) => n.tipo === NFeTipo.DEVOLUCAO && n.nfeReferenciaId === venda.id,
  );
  for (const dev of devolucoes) {
    steps.push(mapStep(dev));
    const simbolicas = todos.filter(
      (n) => n.tipo === NFeTipo.REMESSA_SIMBOLICA && n.nfeReferenciaId === dev.id,
    );
    for (const simb of simbolicas) steps.push(mapStep(simb));
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

/**
 * Cadeias fiscais agrupadas por remessa. Cada grupo traz a remessa de origem
 * (com saldo atual) e os cenários que dela derivam.
 */
export async function listTimelineChains(
  prisma: PrismaClient,
  tenantId: string,
): Promise<TimelineRemessaGroupDto[]> {
  const nfes = await prisma.nFe.findMany({
    where: { tenantId, ...fiscalNotDeleted },
    include: { nfeReferencia: { select: { chave: true } } },
    orderBy: { emitidaEm: "asc" },
  });

  const byId = new Map<string, ChainNode>(nfes.map((n) => [n.id, n as ChainNode]));
  const byChave = new Map<string, ChainNode>(nfes.map((n) => [n.chave, n as ChainNode]));

  const cenarios = nfes
    .filter((n) => n.tipo === NFeTipo.VENDA)
    .map((v) => buildChainFromVenda(v as ChainNode, byId));

  // Agrupa cenários pela remessa raiz (primeiro passo, quando é REMESSA).
  const grupos = new Map<string, TimelineRemessaGroupDto>();

  const getOrCreateGroup = (remessa?: ChainNode): TimelineRemessaGroupDto => {
    const key = remessa?.chave ?? "__avulsa__";
    let g = grupos.get(key);
    if (!g) {
      g = {
        remessaChave: remessa?.chave ?? "",
        remessaNumero: remessa?.numero,
        remessaSerie: remessa?.serie,
        emitidaEm: (remessa?.emitidaEm ?? new Date()).toISOString(),
        quantidadeRemessa: remessa?.quantidade,
        saldoDisponivel: remessa ? (remessa.saldoDisponivel ?? 0) : undefined,
        cenarios: [],
      };
      grupos.set(key, g);
    }
    return g;
  };

  for (const cenario of cenarios) {
    const primeiro = cenario.steps[0];
    const remessa =
      primeiro && primeiro.tipo === NFeTipo.REMESSA ? byChave.get(primeiro.chave) : undefined;
    getOrCreateGroup(remessa).cenarios.push(cenario);
  }

  // Remessas que ainda não originaram nenhum cenário (saldo livre no full).
  for (const n of nfes) {
    if (n.tipo !== NFeTipo.REMESSA) continue;
    if (grupos.has(n.chave)) continue;
    getOrCreateGroup(n as ChainNode);
  }

  const lista = [...grupos.values()];
  for (const g of lista) {
    g.cenarios.sort((a, b) => new Date(a.emitidaEm).getTime() - new Date(b.emitidaEm).getTime());
  }
  // Avulsas por último; demais por data da remessa.
  lista.sort((a, b) => {
    if (!a.remessaChave) return 1;
    if (!b.remessaChave) return -1;
    return new Date(a.emitidaEm).getTime() - new Date(b.emitidaEm).getTime();
  });

  return lista;
}
