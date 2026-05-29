import { NFeTipo } from "../generated/prisma/client.js";

/** Sufixo fixo do depósito ML nos XMLs de referência (OLSS). */
export const ML_OLSS_WAREHOUSE_SUFFIX = "279642028";

export type XTextoInput = {
  tipo: NFeTipo | string;
  cfop: string;
  natOp: string;
  pedidoMl: string;
  indFinal?: number;
};

/**
 * Gera o conteúdo de `<obsCont><xTexto>` cruzando CFOP × natOp × tipo,
 * padrão extraído dos XMLs reais em XMLs/ (campo xCampo="external_id").
 */
export function buildNfeObsContXTexto(input: XTextoInput): string | null {
  const pedido = input.pedidoMl.trim();
  if (!pedido) return null;

  const nat = input.natOp;
  const cfop = input.cfop.trim();
  const tipo = String(input.tipo);
  const suf = ML_OLSS_WAREHOUSE_SUFFIX;

  if (tipo === NFeTipo.REMESSA || (nat.includes("Remessa para Deposito") && !nat.includes("Simbolica"))) {
    return `INBOUND-inbound-${pedido}-1-1-OLSS-${suf}`;
  }

  if (tipo === NFeTipo.REMESSA_SIMBOLICA || (nat.includes("Remessa Simbolica") && nat.includes("Saidas"))) {
    if (cfop === "6949" || nat.includes("SALE_RETURN")) {
      return `SALE_RETURN-symbolic_inbound-${pedido}-1-OLSS-${suf}`;
    }
    return `DEVOLUTION-symbolic_inbound-${pedido}-1-OLSS-${suf}`;
  }

  if (
    tipo === NFeTipo.RETORNO_SIMBOLICO ||
    nat.includes("Retorno Simbolico") ||
    (nat.includes("Retorno") && cfop.startsWith("1") && cfop !== "1201")
  ) {
    if (cfop === "1949") {
      return `SALE-symbolic_inbound_return-${pedido}-1-OLSS-${suf}`;
    }
    return `SALE-symbolic_inbound_return-${pedido}-1-OLSS-${suf}`;
  }

  if (tipo === NFeTipo.DEVOLUCAO || nat.includes("Devolucao")) {
    return `DEVOLUTION-devolution-${pedido}-1-OLSS-${suf}`;
  }

  if (tipo === NFeTipo.VENDA || nat.toLowerCase().includes("venda")) {
    const consumidorFinal =
      input.indFinal === 1 ||
      nat.includes("consumidor final") ||
      cfop === "5101" ||
      cfop === "6107";
    if (consumidorFinal) {
      return pedido;
    }
    return `SALE-sale-${pedido}-1-OLSS-${suf}`;
  }

  if (nat.includes("Retorno de mercadoria nao entregue")) {
    return `SALE_RETURN-sale_return-${pedido}-1-OLSS-${suf}`;
  }

  return null;
}

export function enrichFiscalPayloadWithXTexto(
  payload: Record<string, unknown>,
  input: XTextoInput,
): Record<string, unknown> {
  const xTexto = buildNfeObsContXTexto(input);
  if (!xTexto) return payload;
  return { ...payload, obsContXTexto: xTexto };
}
