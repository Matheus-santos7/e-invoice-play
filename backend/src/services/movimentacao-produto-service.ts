import {
  OperacaoFiscalTipo,
  type Prisma,
  type PrismaClient,
} from "../generated/prisma/client.js";

type Tx = Pick<PrismaClient, "movimentacaoProduto">;

export async function registrarMovimentacaoProduto(
  tx: Tx,
  data: {
    tenantId: string;
    productId: string;
    tipoOperacao: OperacaoFiscalTipo;
    quantidade: number;
    nfeId: string;
    unidadeOrigemId?: string | null;
    unidadeDestinoId?: string | null;
    nfeSecundariaId?: string | null;
    observacao?: string | null;
  },
) {
  return tx.movimentacaoProduto.create({
    data: {
      tenantId: data.tenantId,
      productId: data.productId,
      tipoOperacao: data.tipoOperacao,
      quantidade: data.quantidade,
      nfeId: data.nfeId,
      unidadeOrigemId: data.unidadeOrigemId ?? undefined,
      unidadeDestinoId: data.unidadeDestinoId ?? undefined,
      nfeSecundariaId: data.nfeSecundariaId ?? undefined,
      observacao: data.observacao ?? undefined,
    },
  });
}

export function mapMovimentacao(row: {
  id: string;
  tipoOperacao: OperacaoFiscalTipo;
  quantidade: number;
  unidadeOrigemId: string | null;
  unidadeDestinoId: string | null;
  nfeId: string;
  nfeSecundariaId: string | null;
  observacao: string | null;
  createdAt: Date;
  unidadeOrigem?: { codigo: string; nome: string } | null;
  unidadeDestino?: { codigo: string; nome: string } | null;
  nfe?: { chave: string; tipo: string; numero: number; serie: number } | null;
  nfeSecundaria?: { chave: string; tipo: string; numero: number; serie: number } | null;
}) {
  return {
    id: row.id,
    tipoOperacao: row.tipoOperacao,
    quantidade: row.quantidade,
    unidadeOrigemId: row.unidadeOrigemId ?? undefined,
    unidadeDestinoId: row.unidadeDestinoId ?? undefined,
    unidadeOrigem: row.unidadeOrigem
      ? { codigo: row.unidadeOrigem.codigo, nome: row.unidadeOrigem.nome }
      : undefined,
    unidadeDestino: row.unidadeDestino
      ? { codigo: row.unidadeDestino.codigo, nome: row.unidadeDestino.nome }
      : undefined,
    nfeId: row.nfeId,
    nfeSecundariaId: row.nfeSecundariaId ?? undefined,
    nfe: row.nfe
      ? { chave: row.nfe.chave, tipo: row.nfe.tipo, numero: row.nfe.numero, serie: row.nfe.serie }
      : undefined,
    nfeSecundaria: row.nfeSecundaria
      ? {
          chave: row.nfeSecundaria.chave,
          tipo: row.nfeSecundaria.tipo,
          numero: row.nfeSecundaria.numero,
          serie: row.nfeSecundaria.serie,
        }
      : undefined,
    observacao: row.observacao ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listarMovimentacoesProduto(
  prisma: PrismaClient,
  tenantId: string,
  opts?: { productId?: string; limit?: number },
) {
  const rows = await prisma.movimentacaoProduto.findMany({
    where: {
      tenantId,
      ...(opts?.productId ? { productId: opts.productId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: opts?.limit ?? 100,
    include: {
      unidadeOrigem: { select: { codigo: true, nome: true } },
      unidadeDestino: { select: { codigo: true, nome: true } },
      nfe: { select: { chave: true, tipo: true, numero: true, serie: true } },
      nfeSecundaria: { select: { chave: true, tipo: true, numero: true, serie: true } },
    },
  });
  return rows.map(mapMovimentacao);
}
