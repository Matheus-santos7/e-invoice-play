import type {
  BaseCalcAction,
  ComposicaoLinha,
  ComposicaoTributo,
  CstDevolucaoMap,
  DifalCalculo,
  FiscalEmitterSettingsData,
} from "./fiscal-emitter-settings-types";

export type NFeTipoUi = "VENDA" | "REMESSA" | "RETORNO_SIMBOLICO" | "DEVOLUCAO" | "REMESSA_SIMBOLICA";

export type EmitterSnapshot = {
  modFrete: string;
  freteNoCalculo: boolean;
  acrescimoNoProduto: boolean;
  mensagemInfCpl: string;
  bases: {
    vProd: number;
    vFrete: number;
    vDesc: number;
    vIpi: number;
    vIcms: number;
    vBcIcms: number;
    vBcPisCofins: number;
    vBcIpi: number;
  };
  difal: {
    mode: DifalCalculo;
    aplica: boolean;
    vDifal: number;
  };
};

function asNum(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function mapCstDevolucao(vendaCst: string, maps: CstDevolucaoMap[]): string {
  const key = vendaCst.slice(0, 2);
  return maps.find((m) => m.venda === key)?.devolucao ?? key;
}

export function resolveModFrete(settings: FiscalEmitterSettingsData, tipo: NFeTipoUi): string {
  const m = settings.taxes.modalidadeFrete;
  if (m.mode === "DEFAULT") return "0";
  switch (tipo) {
    case "REMESSA":
    case "REMESSA_SIMBOLICA":
      return m.coleta;
    case "RETORNO_SIMBOLICO":
      return m.fullfilmentEntrada;
    default:
      return m.fullfilmentVendas;
  }
}

function composicaoChannel(tipo: NFeTipoUi): keyof ComposicaoLinha {
  return tipo === "REMESSA" || tipo === "REMESSA_SIMBOLICA" || tipo === "RETORNO_SIMBOLICO"
    ? "remessa"
    : "venda";
}

function actionDelta(action: BaseCalcAction, amount: number): number {
  switch (action) {
    case "INCLUIR_NA_BASE":
      return amount;
    case "SUBTRAIR_DA_BASE":
      return -amount;
    default:
      return 0;
  }
}

function lineAction(
  composicao: ComposicaoTributo,
  key: keyof ComposicaoTributo,
  channel: keyof ComposicaoLinha,
): BaseCalcAction | null {
  const line = composicao[key];
  if (!line || typeof line !== "object" || !("venda" in line)) return null;
  return line[channel];
}

export function calcTributoBase(
  vProd: number,
  parts: { frete: number; desconto: number; icms: number; difal: number; fcpIcms: number; fcpDifal: number; ipi: number; acrescimo: number },
  composicao: ComposicaoTributo,
  channel: keyof ComposicaoLinha,
): number {
  let base = vProd;
  const entries: [keyof ComposicaoTributo, number][] = [
    ["frete", parts.frete],
    ["desconto", parts.desconto],
    ["icms", parts.icms],
    ["difal", parts.difal],
    ["fcpIcms", parts.fcpIcms],
    ["fcpDifal", parts.fcpDifal],
    ["ipi", parts.ipi],
    ["acrescimoPreco", parts.acrescimo],
  ];
  for (const [key, amount] of entries) {
    const action = lineAction(composicao, key, channel);
    if (action) base += actionDelta(action, amount);
  }
  return Math.max(0, Math.round(base * 100) / 100);
}

/** Reaplica configurações do emissor no XML quando `fiscalPayload.emitter` não existir (NF-e antigas). */
export function buildEmitterSnapshotForXml(
  settings: FiscalEmitterSettingsData,
  tipo: NFeTipoUi,
  valor: number,
  valorIcms: number,
): EmitterSnapshot {
  const channel = composicaoChannel(tipo);
  const comp = settings.taxes.composicaoBaseCalculo;
  const parts = {
    frete: 0,
    desconto: 0,
    icms: valorIcms,
    difal: 0,
    fcpIcms: 0,
    fcpDifal: 0,
    ipi: 0,
    acrescimo: 0,
  };
  return {
    modFrete: resolveModFrete(settings, tipo),
    freteNoCalculo: settings.nfe.freteNoCalculo,
    acrescimoNoProduto: settings.nfe.acrescimoPrecoProduto,
    mensagemInfCpl: settings.nfe.mensagemPadrao?.trim() ?? "",
    bases: {
      vProd: valor,
      vFrete: 0,
      vDesc: 0,
      vIpi: 0,
      vIcms: valorIcms,
      vBcIcms: calcTributoBase(valor, parts, comp.icms, channel),
      vBcPisCofins: calcTributoBase(valor, parts, comp.pisCofins, channel),
      vBcIpi: calcTributoBase(valor, parts, comp.ipi, channel),
    },
    difal: { mode: "PADRAO", aplica: false, vDifal: 0 },
  };
}

export function resolveEmitterFromPayload(
  fiscalPayload: Record<string, unknown> | undefined,
  settings: FiscalEmitterSettingsData | null,
  tipo: NFeTipoUi,
  valor: number,
  valorIcms: number,
): EmitterSnapshot {
  const fromPayload = fiscalPayload?.emitter as EmitterSnapshot | undefined;
  if (fromPayload?.modFrete) return fromPayload;
  if (settings) return buildEmitterSnapshotForXml(settings, tipo, valor, valorIcms);
  return {
    modFrete: "0",
    freteNoCalculo: true,
    acrescimoNoProduto: false,
    mensagemInfCpl: "",
    bases: {
      vProd: valor,
      vFrete: 0,
      vDesc: 0,
      vIpi: 0,
      vIcms: valorIcms,
      vBcIcms: valor,
      vBcPisCofins: valor,
      vBcIpi: valor,
    },
    difal: { mode: "PADRAO", aplica: false, vDifal: 0 },
  };
}
