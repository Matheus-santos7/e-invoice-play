import type { PrismaClient } from "../generated/prisma/client.js";
import type { PedidoCheckoutInput } from "../schemas/pedido-checkout.js";
import { emitirCadeiaVenda, type PedidoForEmit, VendaChainError } from "./venda-chain-service.js";
import { SaldoRemessaInsuficienteError } from "./remessa-fifo.js";

export class CheckoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckoutError";
  }
}

export { SaldoRemessaInsuficienteError, VendaChainError };

/** @deprecated Use emitirCadeiaVenda — mantido como alias para compatibilidade. */
export async function emitirNFeFromPedido(prisma: PrismaClient, pedido: PedidoForEmit) {
  const { venda } = await emitirCadeiaVenda(prisma, pedido);
  return venda;
}

export class CheckoutService {
  constructor(private readonly prisma: PrismaClient) {}

  async checkout(tenantId: string, input: PedidoCheckoutInput) {
    const product = await this.prisma.product.findFirst({
      where: { id: input.productId, tenantId },
    });
    if (!product) throw new CheckoutError("Produto não encontrado nesta empresa");

    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    const c = input.comprador;

    const result = await emitirCadeiaVenda(this.prisma, {
      tenantId,
      productId: product.id,
      quantidade: input.quantidade,
      destCpf: c.cpf,
      destNome: c.nome,
      destLogradouro: c.logradouro,
      destNumero: c.numero,
      destComplemento: c.complemento ?? null,
      destBairro: c.bairro,
      destCodigoMunicipio: c.codigoMunicipio,
      destMunicipio: c.municipio,
      destUf: c.uf,
      destCep: c.cep,
      destCodigoPais: c.codigoPais,
      destNomePais: c.nomePais,
      destTelefone: c.telefone?.replace(/\D/g, "") ?? null,
      destIndIeDest: c.indIEDest,
      product,
      tenant,
    });

    return result.venda;
  }
}
