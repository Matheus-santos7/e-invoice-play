/** Sufixo fixo do depósito ML nos XMLs de referência (OLSS). */
export const ML_OLSS_WAREHOUSE_SUFFIX = "279642028";

export type XTextoInput = {
  tipo: string;
  cfop: string;
  natOp: string;
  pedidoML: string;
  indFinal?: number;
};

/**
 * Gera `<obsCont><xTexto>` (xCampo=external_id) — padrão CFOP × natOp dos XMLs ML.
 */
export function buildNfeObsContXTexto(input: XTextoInput): string | null {
  const pedido = input.pedidoML.trim();
  if (!pedido) return null;

  const nat = input.natOp;
  const cfop = input.cfop.trim();
  const tipo = input.tipo;
  const suf = ML_OLSS_WAREHOUSE_SUFFIX;

  if (tipo === "REMESSA" || (nat.includes("Remessa para Deposito") && !nat.includes("Simbolica"))) {
    return `INBOUND-inbound-${pedido}-1-1-OLSS-${suf}`;
  }

  if (tipo === "REMESSA_SIMBOLICA" || (nat.includes("Remessa Simbolica") && nat.includes("Saidas"))) {
    if (cfop === "6949") {
      return `SALE_RETURN-symbolic_inbound-${pedido}-1-OLSS-${suf}`;
    }
    return `DEVOLUTION-symbolic_inbound-${pedido}-1-OLSS-${suf}`;
  }

  if (tipo === "RETORNO_SIMBOLICO" || nat.includes("Retorno Simbolico")) {
    return `SALE-symbolic_inbound_return-${pedido}-1-OLSS-${suf}`;
  }

  if (tipo === "DEVOLUCAO" || nat.includes("Devolucao")) {
    return `DEVOLUTION-devolution-${pedido}-1-OLSS-${suf}`;
  }

  if (tipo === "VENDA" || nat.toLowerCase().includes("venda")) {
    const consumidorFinal =
      input.indFinal === 1 ||
      nat.includes("consumidor final") ||
      cfop === "5101" ||
      cfop === "6107";
    if (consumidorFinal) return pedido;
    return `SALE-sale-${pedido}-1-OLSS-${suf}`;
  }

  if (nat.includes("Retorno de mercadoria nao entregue")) {
    return `SALE_RETURN-sale_return-${pedido}-1-OLSS-${suf}`;
  }

  return null;
}

export function xTextoFromNfe(nfe: {
  tipo: string;
  cfop: string;
  natOp: string;
  pedidoML: string;
  fiscalPayload?: Record<string, unknown>;
  destinatario?: { indIEDest?: number };
}): string | null {
  const fromPayload = nfe.fiscalPayload?.obsContXTexto;
  if (typeof fromPayload === "string" && fromPayload.trim()) return fromPayload.trim();
  return buildNfeObsContXTexto({
    tipo: nfe.tipo,
    cfop: nfe.cfop,
    natOp: nfe.natOp,
    pedidoML: nfe.pedidoML,
    indFinal:
      nfe.natOp.includes("consumidor final") || nfe.destinatario?.indIEDest === 9 ? 1 : 0,
  });
}
