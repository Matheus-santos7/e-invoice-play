import { FiscalStatus, NFeTipo, type PrismaClient, type Tenant } from "../generated/prisma/client.js";
import { mapNfe } from "../lib/fiscal-mappers.js";
import { buildChaveNFe, gerarPedidoMl } from "../lib/nfe-chave.js";
import { proximoNumeroNfe } from "../lib/nfe-sequencia.js";
import { REMESSA_ML_DEST } from "../lib/remessa-dest.js";
import {
  RETORNO_SIMBOLICO_CFOP,
  RETORNO_SIMBOLICO_NAT_OP,
} from "../lib/retorno-simbolico-dest.js";
import { consumirSaldoRemessaFifo } from "./remessa-fifo.js";
import { resolveTaxRule, type CustomerType } from "./tax-rule-service.js";

function inferAliqIcms(emitUf: string, destUf: string): number {
  return emitUf.toUpperCase() === destUf.toUpperCase() ? 18 : 12;
}

function resolveCustomerType(destIndIeDest: number): CustomerType {
  return destIndIeDest === 9 ? "non_taxpayer" : "taxpayer";
}

export type PedidoForEmit = {
  tenantId: string;
  productId: string;
  quantidade: number;
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
  product: { id: string; cfop: string; ncm: string; preco: { toString(): string } };
  tenant: Tenant;
};

export class VendaChainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VendaChainError";
  }
}

function taxSnapshotFromRule(
  rule: {
    ruleId: string;
    payload?: Record<string, unknown>;
    aliquotaIcmsInterna?: number;
    icms?: Record<string, unknown>;
  } | null,
  fallbackAliqIcms: number,
) {
  const taxes = ((rule?.payload?.taxes as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>;
  const ipi = (taxes.ipi as Record<string, unknown> | undefined) ?? {};
  const pis = (taxes.pis as Record<string, unknown> | undefined) ?? {};
  const cofins = (taxes.cofins as Record<string, unknown> | undefined) ?? {};
  const ibsCbs = (taxes.ibsCbs as Record<string, unknown> | undefined) ?? {};

  const toText = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);
  const toNum = (v: unknown, fallback = 0): number => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  return {
    ruleId: rule?.ruleId,
    icms: {
      cst: typeof rule?.icms?.cst === "string" ? rule.icms.cst : "00",
      aliquota: rule?.aliquotaIcmsInterna ?? fallbackAliqIcms,
      pDif: toNum(rule?.icms?.pDif, 0),
      pIcmsInterstate: toNum(rule?.icms?.pIcmsInterstate, 12),
      pRedBc: toNum(rule?.icms?.pRedBc, 0),
      pRedBcSt: toNum(rule?.icms?.pRedBcSt, 0),
      pMva: toNum(rule?.icms?.pMva, 0),
      pIcmsStRet: toNum(rule?.icms?.pIcmsStRet, 0),
      pFcpStRet: toNum(rule?.icms?.pFcpStRet, 0),
      pIcmsFcp: toNum(rule?.icms?.pIcmsFcp, 0),
      pIcmsEfet: toNum(rule?.icms?.pIcmsEfet, 0),
      pRedBcEfet: toNum(rule?.icms?.pRedBcEfet, 0),
      pRedBcDifal: toNum(rule?.icms?.pRedBcDifal, 0),
      motDesIcms: toNum(rule?.icms?.motDesIcms, 0),
      codBenef: toText(rule?.icms?.codBenef),
      codBenefRbc: toText(rule?.icms?.codBenefRbc),
      codBenefPres: toText(rule?.icms?.codBenefPres),
      pCodBenefPres: toNum(rule?.icms?.pCodBenefPres, 0),
      redAliqIbs: toNum(rule?.icms?.redAliqIbs, 0),
    },
    ipi: {
      st: toText(ipi.st, "50 - Saída Tributada"),
      aliquota: toNum(ipi.aliquota, 0),
      codEnq: toText(ipi.codEnq, "999"),
    },
    pis: {
      st: toText(pis.st, "01 - Operação Tributável com Alíquota Básica"),
      aliquota: toNum(pis.aliquota, 1.65),
    },
    cofins: {
      st: toText(cofins.st, "01 - Operação Tributável com Alíquota Básica"),
      aliquota: toNum(cofins.aliquota, 7.6),
    },
    ibsCbs: {
      st: toText(ibsCbs.st),
      cClassTrib: toText(ibsCbs.cClassTrib),
      reducao: toNum(ibsCbs.reducao, 0),
    },
  };
}

/** Emite retorno simbólico (FIFO remessa) + NF-e de venda referenciada. */
export async function emitirCadeiaVenda(prisma: PrismaClient, pedido: PedidoForEmit) {
  const serie = 1;
  const pedidoMl = gerarPedidoMl();
  const emitidaEm = new Date();
  const tenant = pedido.tenant;

  const valorUnit = Number(pedido.product.preco);
  const valorTotal = Math.round(valorUnit * pedido.quantidade * 100) / 100;

  return prisma.$transaction(async (tx) => {
    const saleTaxRule = await resolveTaxRule(tx as unknown as PrismaClient, tenant.id, {
      originUf: tenant.uf,
      destinationUf: pedido.destUf,
      transactionType: "sale",
      customerType: resolveCustomerType(pedido.destIndIeDest),
    });

    const inboundTaxRule = await resolveTaxRule(tx as unknown as PrismaClient, tenant.id, {
      originUf: tenant.uf,
      destinationUf: tenant.uf,
      transactionType: "inbound",
      customerType: "taxpayer",
    });

    const numeroRetorno = await proximoNumeroNfe(tx as unknown as PrismaClient, tenant.id, serie);
    const chaveRetorno = buildChaveNFe({
      uf: tenant.uf,
      cnpj: tenant.cnpj,
      serie,
      numero: numeroRetorno,
    });

    const aliqRetornoFallback = inferAliqIcms(REMESSA_ML_DEST.uf, tenant.uf);
    const aliqRetorno = inboundTaxRule?.aliquotaIcmsInterna ?? aliqRetornoFallback;
    const valorIcmsRetorno = Math.round(valorTotal * (aliqRetorno / 100) * 100) / 100;

    const retornoRow = await tx.nFe.create({
      data: {
        tenantId: tenant.id,
        productId: pedido.product.id,
        chave: chaveRetorno,
        numero: numeroRetorno,
        serie,
        natOp: RETORNO_SIMBOLICO_NAT_OP,
        cfop: inboundTaxRule?.cfop ?? RETORNO_SIMBOLICO_CFOP,
        ncm: pedido.product.ncm,
        destNome: tenant.razaoSocial,
        destDoc: tenant.cnpj,
        destUf: tenant.uf,
        destLogradouro: tenant.logradouro,
        destNumero: tenant.numero,
        destComplemento: tenant.complemento,
        destBairro: tenant.bairro,
        destCodigoMunicipio: tenant.codigoMunicipio,
        destMunicipio: tenant.municipio,
        destCep: tenant.cep,
        destCodigoPais: tenant.codigoPais,
        destNomePais: tenant.nomePais,
        destTelefone: tenant.telefone?.replace(/\D/g, "") ?? null,
        destIndIeDest: 1,
        valor: valorTotal,
        valorIcms: valorIcmsRetorno,
        aliqIcms: aliqRetorno,
        status: FiscalStatus.AUTORIZADA,
        emitidaEm,
        pedidoMl,
        quantidade: pedido.quantidade,
        tipo: NFeTipo.RETORNO_SIMBOLICO,
        saldoDisponivel: null,
        fiscalPayload: taxSnapshotFromRule(inboundTaxRule, aliqRetornoFallback),
      },
    });

    const alocacoes = await consumirSaldoRemessaFifo(
      tx,
      tenant.id,
      pedido.product.id,
      pedido.quantidade,
      retornoRow.id,
    );

    const remessaPrincipalId = alocacoes[0]!.remessaNfeId;
    await tx.nFe.update({
      where: { id: retornoRow.id },
      data: { nfeReferenciaId: remessaPrincipalId },
    });

    const numeroVenda = await proximoNumeroNfe(tx as unknown as PrismaClient, tenant.id, serie);
    const chaveVenda = buildChaveNFe({
      uf: tenant.uf,
      cnpj: tenant.cnpj,
      serie,
      numero: numeroVenda,
    });

    const aliqVendaFallback = inferAliqIcms(tenant.uf, pedido.destUf);
    const aliqVenda = saleTaxRule?.aliquotaIcmsInterna ?? aliqVendaFallback;
    const valorIcmsVenda = Math.round(valorTotal * (aliqVenda / 100) * 100) / 100;
    const telefone = pedido.destTelefone?.replace(/\D/g, "") || "0000000000";

    const vendaRow = await tx.nFe.create({
      data: {
        tenantId: tenant.id,
        productId: pedido.product.id,
        chave: chaveVenda,
        numero: numeroVenda,
        serie,
        natOp: "Venda de mercadoria adquirida de terceiros",
        cfop: saleTaxRule?.cfop ?? pedido.product.cfop,
        ncm: pedido.product.ncm,
        destNome: pedido.destNome,
        destDoc: pedido.destCpf,
        destUf: pedido.destUf,
        destLogradouro: pedido.destLogradouro,
        destNumero: pedido.destNumero,
        destComplemento: pedido.destComplemento,
        destBairro: pedido.destBairro,
        destCodigoMunicipio: pedido.destCodigoMunicipio,
        destMunicipio: pedido.destMunicipio,
        destCep: pedido.destCep,
        destCodigoPais: pedido.destCodigoPais,
        destNomePais: pedido.destNomePais,
        destTelefone: telefone,
        destIndIeDest: pedido.destIndIeDest,
        valor: valorTotal,
        valorIcms: valorIcmsVenda,
        aliqIcms: aliqVenda,
        status: FiscalStatus.AUTORIZADA,
        emitidaEm,
        pedidoMl,
        quantidade: pedido.quantidade,
        tipo: NFeTipo.VENDA,
        nfeReferenciaId: retornoRow.id,
        fiscalPayload: taxSnapshotFromRule(saleTaxRule, aliqVendaFallback),
      },
    });

    const retornoComRef = await tx.nFe.findUniqueOrThrow({
      where: { id: retornoRow.id },
      include: {
        nfeReferencia: { select: { chave: true, numero: true, serie: true } },
      },
    });

    return {
      venda: mapNfe(vendaRow, retornoRow.chave),
      retorno: mapNfe(retornoComRef, retornoComRef.nfeReferencia?.chave),
      alocacoes,
    };
  });
}
