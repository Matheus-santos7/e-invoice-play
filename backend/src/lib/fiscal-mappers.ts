import type { CteModal, FiscalStatus, NFeTipo, PrismaClient, TimelineStatus } from "../generated/prisma/client.js";

export function num(n: { toString(): string } | number): number {
  return typeof n === "number" ? n : Number(n);
}

type NfeRow = {
  id: string;
  tenantId: string;
  productId?: string | null;
  chave: string;
  numero: number;
  serie: number;
  natOp: string;
  cfop: string;
  ncm: string;
  destNome: string;
  destDoc: string;
  destUf: string;
  destLogradouro: string;
  destNumero: string;
  destComplemento: string | null;
  destBairro: string;
  destCodigoMunicipio: string;
  destMunicipio: string;
  destCep: string;
  destCodigoPais: number;
  destNomePais: string;
  destTelefone: string | null;
  destIndIeDest: number;
  valor: { toString(): string };
  valorIcms: { toString(): string };
  aliqIcms: { toString(): string };
  status: FiscalStatus;
  emitidaEm: Date;
  pedidoMl: string;
  quantidade: number;
  tipo: NFeTipo;
  saldoDisponivel?: number | null;
  nfeReferenciaId?: string | null;
  fiscalPayload?: unknown;
};

export function mapNfe(row: NfeRow, nfeReferenciaChave?: string) {
  const doc = row.destDoc.replace(/\D/g, "");
  return {
    id: row.id,
    tenantId: row.tenantId,
    productId: row.productId ?? undefined,
    chave: row.chave,
    numero: row.numero,
    serie: row.serie,
    natOp: row.natOp,
    cfop: row.cfop,
    ncm: row.ncm,
    destinatario: {
      nome: row.destNome,
      doc: row.destDoc,
      uf: row.destUf,
      indIEDest: row.destIndIeDest,
      endereco: {
        logradouro: row.destLogradouro,
        numero: row.destNumero,
        complemento: row.destComplemento ?? undefined,
        bairro: row.destBairro,
        codigoMunicipio: row.destCodigoMunicipio,
        municipio: row.destMunicipio,
        uf: row.destUf,
        cep: row.destCep,
        codigoPais: row.destCodigoPais,
        nomePais: row.destNomePais,
        telefone: row.destTelefone ?? undefined,
      },
      docTipo: doc.length === 14 ? ("CNPJ" as const) : ("CPF" as const),
    },
    valor: num(row.valor),
    valorICMS: num(row.valorIcms),
    aliqICMS: num(row.aliqIcms),
    status: row.status,
    emitidaEm: row.emitidaEm.toISOString(),
    pedidoML: row.pedidoMl,
    quantidade: row.quantidade,
    tipo: row.tipo,
    saldoDisponivel: row.tipo === "REMESSA" ? (row.saldoDisponivel ?? undefined) : undefined,
    nfeReferenciaChave: nfeReferenciaChave ?? undefined,
    fiscalPayload: (row.fiscalPayload as Record<string, unknown> | undefined) ?? undefined,
  };
}

const NFE_TIPO_LABEL: Record<NFeTipo, string> = {
  VENDA: "Venda",
  REMESSA: "Remessa",
  RETORNO_SIMBOLICO: "Retorno simbólico",
  DEVOLUCAO: "Devolução",
  REMESSA_SIMBOLICA: "Remessa simbólica",
};

export function labelNfeTipo(tipo: NFeTipo): string {
  return NFE_TIPO_LABEL[tipo];
}

const CTE_MODAL_LABEL: Record<CteModal, string> = {
  RODOVIARIO: "Rodoviário",
  AEREO: "Aéreo",
};

export function mapCte(
  row: {
    id: string;
    tenantId: string;
    chave: string;
    numero: number;
    serie: number;
    cfop: string;
    natOp: string;
    modal: CteModal;
    origem: string;
    destino: string;
    valor: { toString(): string };
    valorCarga: { toString(): string };
    pesoCarga: { toString(): string };
    status: FiscalStatus;
    emitidoEm: Date;
    nfeRemessaId?: string | null;
    nfeVendaId?: string | null;
  },
  nfeChaveRef?: string,
) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    chave: row.chave,
    numero: row.numero,
    serie: row.serie,
    cfop: row.cfop,
    natOp: row.natOp,
    modal: CTE_MODAL_LABEL[row.modal],
    origem: row.origem,
    destino: row.destino,
    valor: num(row.valor),
    valorCarga: num(row.valorCarga),
    pesoCarga: num(row.pesoCarga),
    status: row.status,
    emitidoEm: row.emitidoEm.toISOString(),
    nfeChaveRef: nfeChaveRef ?? undefined,
    vinculadoRemessa: Boolean(row.nfeRemessaId ?? row.nfeVendaId ?? nfeChaveRef),
    vinculadoVenda: Boolean(row.nfeVendaId),
  };
}

const TIMELINE_UI: Record<TimelineStatus, "done" | "current" | "pending"> = {
  DONE: "done",
  CURRENT: "current",
  PENDING: "pending",
};

export function mapTimeline(row: {
  label: string;
  status: TimelineStatus;
  at: string | null;
  meta: string | null;
}) {
  return {
    label: row.label,
    status: TIMELINE_UI[row.status],
    at: row.at ?? undefined,
    meta: row.meta ?? undefined,
  };
}

export async function resolveTenantId(
  prisma: PrismaClient,
  tenantId: string | undefined,
): Promise<string> {
  if (tenantId) return tenantId;
  const first = await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" } });
  if (!first) throw new Error("Nenhum tenant cadastrado. Rode pnpm --filter @e-invoice-play/backend exec prisma db seed");
  return first.id;
}
