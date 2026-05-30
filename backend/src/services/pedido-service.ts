/**
 * Ciclo de vida de **pedidos** com emissão fiscal em duas etapas.
 *
 * ## Fluxos
 *
 * ```
 * RASCUNHO  ──PATCH──►  RASCUNHO  (edita comprador/produto/qtd)
 *     │
 *     └── POST faturar ──► FATURADO + NF-e venda (via emitirCadeiaVenda)
 *
 * POST /pedidos/checkout  ──► emissão direta sem rascunho (CheckoutService)
 * ```
 *
 * ## Faturamento
 *
 * `faturar` chama `emitirCadeiaVenda` (retorno simbólico + venda + CT-e) e persiste:
 * - `status = FATURADO`
 * - `pedidoMl` e `nfeId` da NF-e de **venda** gerada
 *
 * Pedidos faturados não podem ser editados (`PedidoLockedError`) para não divergir
 * da numeração/documentos já emitidos.
 *
 * ## Exclusão
 *
 * `remove` apaga o registro do pedido. Se já faturado, a NF-e permanece no banco
 * (soft delete da NF-e é outro fluxo, em `fiscal-service`).
 *
 * @see routes/pedidos.ts — HTTP
 * @see checkout-service.ts — checkout one-shot sem rascunho
 * @see venda-chain-service.ts — emissão retorno + venda
 */
import type { Prisma, PrismaClient } from "../generated/prisma/client.js";
import { mapPedido } from "../lib/pedido-mapper.js";
import type { PedidoCheckoutInput } from "../schemas/pedido-checkout.js";
import { CheckoutError, SaldoRemessaInsuficienteError, VendaChainError } from "./checkout-service.js";
import { emitirCadeiaVenda, type PedidoForEmit } from "./venda-chain-service.js";

export { SaldoRemessaInsuficienteError, VendaChainError };

// ---------------------------------------------------------------------------
// Tipos e erros
// ---------------------------------------------------------------------------

/** Pedido bloqueado após faturamento — alteração geraria inconsistência fiscal. */
export class PedidoLockedError extends Error {
  constructor() {
    super("Pedido já faturado — não pode ser alterado para preservar a numeração da NF-e");
    this.name = "PedidoLockedError";
  }
}

const pedidoInclude = {
  product: true,
  nfe: { select: { chave: true, numero: true, serie: true, status: true } },
} as const;

type PedidoParaFaturar = Prisma.PedidoGetPayload<{
  include: { product: true; tenant: true };
}>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Campos de destinatário espelhados do body de checkout → colunas `dest_*` do pedido. */
function compradorData(comprador: PedidoCheckoutInput["comprador"]) {
  return {
    destCpf: comprador.cpf,
    destNome: comprador.nome,
    destLogradouro: comprador.logradouro,
    destNumero: comprador.numero,
    destComplemento: comprador.complemento,
    destBairro: comprador.bairro,
    destCodigoMunicipio: comprador.codigoMunicipio,
    destMunicipio: comprador.municipio,
    destUf: comprador.uf,
    destCep: comprador.cep,
    destCodigoPais: comprador.codigoPais,
    destNomePais: comprador.nomePais,
    destTelefone: comprador.telefone?.replace(/\D/g, "") || undefined,
    destIndIeDest: comprador.indIEDest,
  };
}

async function assertProdutoDoTenant(
  prisma: PrismaClient,
  productId: string,
  tenantId: string,
) {
  const product = await prisma.product.findFirst({
    where: { id: productId, tenantId },
  });
  if (!product) throw new CheckoutError("Produto não encontrado nesta empresa");
  return product;
}

function assertPedidoEditavel(status: string) {
  if (status === "FATURADO") throw new PedidoLockedError();
}

/** Converte linha Prisma (dest_* + relations) no formato esperado por `emitirCadeiaVenda`. */
function toPedidoForEmit(pedido: PedidoParaFaturar): PedidoForEmit {
  return {
    tenantId: pedido.tenantId,
    productId: pedido.productId,
    quantidade: pedido.quantidade,
    destCpf: pedido.destCpf,
    destNome: pedido.destNome,
    destLogradouro: pedido.destLogradouro,
    destNumero: pedido.destNumero,
    destComplemento: pedido.destComplemento,
    destBairro: pedido.destBairro,
    destCodigoMunicipio: pedido.destCodigoMunicipio,
    destMunicipio: pedido.destMunicipio,
    destUf: pedido.destUf,
    destCep: pedido.destCep,
    destCodigoPais: pedido.destCodigoPais,
    destNomePais: pedido.destNomePais,
    destTelefone: pedido.destTelefone,
    destIndIeDest: pedido.destIndIeDest,
    product: pedido.product,
    tenant: pedido.tenant,
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class PedidoService {
  constructor(private readonly prisma: PrismaClient) {}

  /** Lista pedidos do tenant (rascunhos primeiro, depois por `updatedAt`). */
  async list(tenantId: string) {
    const rows = await this.prisma.pedido.findMany({
      where: { tenantId },
      include: pedidoInclude,
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    });
    return rows.map(mapPedido);
  }

  async getById(id: string) {
    const row = await this.prisma.pedido.findUnique({
      where: { id },
      include: pedidoInclude,
    });
    return row ? mapPedido(row) : null;
  }

  /** Cria pedido em `RASCUNHO` sem emitir NF-e. */
  async createDraft(tenantId: string, input: PedidoCheckoutInput) {
    const product = await assertProdutoDoTenant(this.prisma, input.productId, tenantId);

    const row = await this.prisma.pedido.create({
      data: {
        tenantId,
        productId: product.id,
        quantidade: input.quantidade,
        status: "RASCUNHO",
        ...compradorData(input.comprador),
      },
      include: pedidoInclude,
    });
    return mapPedido(row);
  }

  /** Atualiza rascunho. Retorna `null` se o id não existir. */
  async updateDraft(id: string, input: PedidoCheckoutInput) {
    const existing = await this.prisma.pedido.findUnique({ where: { id } });
    if (!existing) return null;

    assertPedidoEditavel(existing.status);

    const product = await assertProdutoDoTenant(
      this.prisma,
      input.productId,
      existing.tenantId,
    );

    const row = await this.prisma.pedido.update({
      where: { id },
      data: {
        productId: product.id,
        quantidade: input.quantidade,
        ...compradorData(input.comprador),
      },
      include: pedidoInclude,
    });
    return mapPedido(row);
  }

  /**
   * Emite a cadeia fiscal e marca o pedido como faturado.
   *
   * @returns `{ pedido, nfe }` onde `nfe` é a **venda** (DTO); `null` se id inexistente.
   */
  async faturar(id: string) {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id },
      include: { product: true, tenant: true },
    });
    if (!pedido) return null;

    assertPedidoEditavel(pedido.status);

    const { venda: nfe } = await emitirCadeiaVenda(this.prisma, toPedidoForEmit(pedido));

    const row = await this.prisma.pedido.update({
      where: { id },
      data: {
        status: "FATURADO",
        pedidoMl: nfe.pedidoML,
        nfeId: nfe.id,
      },
      include: pedidoInclude,
    });

    return { pedido: mapPedido(row), nfe };
  }

  /**
   * Remove o pedido do banco.
   * Faturado: só o pedido some; NF-e/CT-e da cadeia permanecem para auditoria.
   */
  async remove(id: string) {
    const existing = await this.prisma.pedido.findUnique({ where: { id } });
    if (!existing) return false;
    await this.prisma.pedido.delete({ where: { id } });
    return true;
  }
}
