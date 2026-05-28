import type { PrismaClient } from "../generated/prisma/client.js";

type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

export type CustomerType = "taxpayer" | "non_taxpayer";
export type TransactionType = "sale" | "inbound";

export type ResolvedTaxRule = {
  ruleId: string;
  aliquotaIcmsInterna?: number;
  cfop?: string;
  payload?: Record<string, unknown>;
  icms?: {
    cst?: string;
    pDif?: number;
    pIcmsInternal?: number;
    pIcmsInterstate?: number;
    pRedBc?: number;
    pRedBcSt?: number;
    pRedBcDifal?: number;
    pIcmsFcp?: number;
    pIcmsEfet?: number;
    pRedBcEfet?: number;
    pMva?: number;
    pIcmsStRet?: number;
    pFcpStRet?: number;
    codBenef?: string;
    codBenefRbc?: string;
    codBenefPres?: string;
    pCodBenefPres?: number;
    motDesIcms?: number;
    redAliqIbs?: number;
  };
};

function toNum(value: unknown): number | undefined {
  if (value == null) return undefined;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const t = String(value).trim().replace(/\./g, "").replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

/** Resolve regra fiscal importada da planilha para uma operação específica. */
export async function resolveTaxRule(
  prisma: Tx,
  tenantId: string,
  params: {
    originUf: string;
    destinationUf: string;
    transactionType: TransactionType;
    customerType: CustomerType;
  },
): Promise<ResolvedTaxRule | null> {
  const originUf = params.originUf.toUpperCase().trim();
  const destinationUf = params.destinationUf.toUpperCase().trim();

  const rule = await prisma.taxRule.findFirst({
    where: {
      tenantId,
      source: "xlsx",
      origin: originUf,
      transactionType: params.transactionType,
      customerType: params.customerType,
    },
    orderBy: { updatedAt: "desc" },
  });
  if (!rule) return null;

  const payload = (rule.payload ?? {}) as Record<string, unknown>;
  const icmsByUf = (payload.icmsByUf ?? {}) as Record<string, unknown>;
  const aliq = toNum(icmsByUf[`ICMS_${destinationUf}_PICMS_INTERNAL`]);
  const cstRaw = icmsByUf[`ICMS_${destinationUf}_CST`];
  const cst = typeof cstRaw === "string" ? cstRaw.slice(0, 2) : undefined;

  return {
    ruleId: rule.ruleId,
    aliquotaIcmsInterna: aliq,
    cfop: rule.cfop || undefined,
    payload,
    icms: {
      cst,
      pDif: toNum(icmsByUf[`ICMS_${destinationUf}_PDIF`]),
      pIcmsInternal: toNum(icmsByUf[`ICMS_${destinationUf}_PICMS_INTERNAL`]),
      pIcmsInterstate: toNum(icmsByUf[`ICMS_${destinationUf}_PICMS_INTERSTATE`]),
      pRedBc: toNum(icmsByUf[`ICMS_${destinationUf}_REDUCTION_CALC_BASE`]),
      pRedBcSt: toNum(icmsByUf[`ICMS_${destinationUf}_REDUCTION_CALC_BASE_ST`]),
      pRedBcDifal: toNum(icmsByUf[`ICMS_${destinationUf}_REDUCTION_CALC_DIFAL`]),
      pIcmsFcp: toNum(icmsByUf[`ICMS_${destinationUf}_PICMS_FCP`]),
      pIcmsEfet: toNum(icmsByUf[`ICMS_${destinationUf}_PICMS_EFET`]),
      pRedBcEfet: toNum(icmsByUf[`ICMS_${destinationUf}_PREDB_CEFET`]),
      pMva: toNum(icmsByUf[`ICMS_${destinationUf}_MVA`]),
      pIcmsStRet: toNum(icmsByUf[`ICMS_${destinationUf}_PICMSST_RET`]),
      pFcpStRet: toNum(icmsByUf[`ICMS_${destinationUf}_PFCPST_RET`]),
      codBenef: typeof icmsByUf[`ICMS_${destinationUf}_COD_BENEF`] === "string" ? String(icmsByUf[`ICMS_${destinationUf}_COD_BENEF`]) : undefined,
      codBenefRbc:
        typeof icmsByUf[`ICMS_${destinationUf}_COD_BENEF_RBC`] === "string"
          ? String(icmsByUf[`ICMS_${destinationUf}_COD_BENEF_RBC`])
          : undefined,
      codBenefPres:
        typeof icmsByUf[`ICMS_${destinationUf}_COD_BENEF_PRES`] === "string"
          ? String(icmsByUf[`ICMS_${destinationUf}_COD_BENEF_PRES`])
          : undefined,
      pCodBenefPres: toNum(icmsByUf[`ICMS_${destinationUf}_PCOD_BENEF_PRES`]),
      motDesIcms: toNum(icmsByUf[`ICMS_${destinationUf}_MOT_DES_ICMS`]),
      redAliqIbs: toNum(icmsByUf[`ICMS_${destinationUf}_RED_ALIQ_IBS`]),
    },
  };
}
