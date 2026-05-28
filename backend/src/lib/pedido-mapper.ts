import type { PedidoStatus, Product } from "../generated/prisma/client.js";
import { num } from "./fiscal-mappers.js";

type PedidoRow = {
  id: string;
  tenantId: string;
  productId: string;
  quantidade: number;
  status: PedidoStatus;
  pedidoMl: string | null;
  nfeId: string | null;
  destCpf: string;
  destNome: string;
  destLogradouro: string;
  destNumero: string;
  destComplemento: string | null;
  destBairro: string;
  destCodigoMunicipio: string;
  destMunicipio: string;
  destUf: string;
  destCep: string;
  destCodigoPais: number;
  destNomePais: string;
  destTelefone: string | null;
  destIndIeDest: number;
  createdAt: Date;
  updatedAt: Date;
  product: Product;
  nfe?: {
    chave: string;
    numero: number;
    serie: number;
    status: string;
  } | null;
};

export function mapPedido(row: PedidoRow) {
  const valorUnit = num(row.product.preco);
  return {
    id: row.id,
    tenantId: row.tenantId,
    status: row.status,
    pedidoMl: row.pedidoMl ?? undefined,
    productId: row.productId,
    quantidade: row.quantidade,
    product: {
      id: row.product.id,
      sku: row.product.sku,
      nome: row.product.nome,
      preco: valorUnit,
    },
    comprador: {
      cpf: row.destCpf,
      nome: row.destNome,
      logradouro: row.destLogradouro,
      numero: row.destNumero,
      complemento: row.destComplemento ?? undefined,
      bairro: row.destBairro,
      codigoMunicipio: row.destCodigoMunicipio,
      municipio: row.destMunicipio,
      uf: row.destUf,
      cep: row.destCep,
      telefone: row.destTelefone ?? undefined,
      codigoPais: row.destCodigoPais,
      nomePais: row.destNomePais,
      indIEDest: row.destIndIeDest,
    },
    valorTotal: valorUnit * row.quantidade,
    nfe: row.nfe
      ? {
          chave: row.nfe.chave,
          numero: row.nfe.numero,
          serie: row.nfe.serie,
          status: row.nfe.status,
        }
      : undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    editavel: row.status === "RASCUNHO",
    excluivel: true,
  };
}

export type PedidoDto = ReturnType<typeof mapPedido>;
