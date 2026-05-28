import type { PrismaClient } from "../generated/prisma/client.js";
import { mapPedido } from "../lib/pedido-mapper.js";
import type { PedidoCheckoutInput } from "../schemas/pedido-checkout.js";
import { CheckoutError, SaldoRemessaInsuficienteError, VendaChainError } from "./checkout-service.js";
import { emitirCadeiaVenda } from "./venda-chain-service.js";

export { SaldoRemessaInsuficienteError, VendaChainError };

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

function compradorData(c: PedidoCheckoutInput["comprador"]) {
  return {
    destCpf: c.cpf,
    destNome: c.nome,
    destLogradouro: c.logradouro,
    destNumero: c.numero,
    destComplemento: c.complemento,
    destBairro: c.bairro,
    destCodigoMunicipio: c.codigoMunicipio,
    destMunicipio: c.municipio,
    destUf: c.uf,
    destCep: c.cep,
    destCodigoPais: c.codigoPais,
    destNomePais: c.nomePais,
    destTelefone: c.telefone?.replace(/\D/g, "") || undefined,
    destIndIeDest: c.indIEDest,
  };
}

export class PedidoService {
  constructor(private readonly prisma: PrismaClient) {}

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

  async createDraft(tenantId: string, input: PedidoCheckoutInput) {
    const product = await this.prisma.product.findFirst({
      where: { id: input.productId, tenantId },
    });
    if (!product) throw new CheckoutError("Produto não encontrado nesta empresa");

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

  async updateDraft(id: string, input: PedidoCheckoutInput) {
    const existing = await this.prisma.pedido.findUnique({ where: { id } });
    if (!existing) return null;
    if (existing.status === "FATURADO") throw new PedidoLockedError();

    const product = await this.prisma.product.findFirst({
      where: { id: input.productId, tenantId: existing.tenantId },
    });
    if (!product) throw new CheckoutError("Produto não encontrado nesta empresa");

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

  async faturar(id: string) {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id },
      include: { product: true, tenant: true },
    });
    if (!pedido) return null;
    if (pedido.status === "FATURADO") throw new PedidoLockedError();

    const { venda: nfe } = await emitirCadeiaVenda(this.prisma, pedido);

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

  /** Remove o pedido. Rascunho: exclusão total. Faturado: remove só o registro do pedido (NF-e permanece). */
  async remove(id: string) {
    const existing = await this.prisma.pedido.findUnique({ where: { id } });
    if (!existing) return false;
    await this.prisma.pedido.delete({ where: { id } });
    return true;
  }
}
