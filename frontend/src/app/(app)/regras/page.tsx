import type { Metadata } from "next";
import { Fragment } from "react";
import { PageHeader } from "@/components/fiscal-ui";
import { TaxRuleImportForm } from "@/components/tax-rule-import-form";
import { resolveActiveTenantId } from "@/lib/active-tenant";
import { listTaxRules } from "@/lib/fiscal-api";
import type { TaxRuleDto } from "@/lib/fiscal-types";

export const metadata: Metadata = { title: "Regras Tributárias" };

const UFS = [
  "AC",
  "AL",
  "AM",
  "AP",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MG",
  "MS",
  "MT",
  "PA",
  "PB",
  "PE",
  "PI",
  "PR",
  "RJ",
  "RN",
  "RO",
  "RR",
  "RS",
  "SC",
  "SE",
  "SP",
  "TO",
] as const;

/** Larguras das colunas fixas à esquerda (scroll horizontal nas demais) */
const STICKY_W = { nome: 220, origem: 72, destinatario: 200 } as const;
const STICKY_LEFT = {
  nome: 0,
  origem: STICKY_W.nome,
  destinatario: STICKY_W.nome + STICKY_W.origem,
} as const;
const STICKY_TOTAL = STICKY_W.nome + STICKY_W.origem + STICKY_W.destinatario;

/** Ordem da planilha ML; `label` = tooltip, `short` = exibição compacta (1–2 linhas) */
const UF_FIELDS = [
  { suffix: "CST", label: "Situação Tributária CST Regime Normal", short: ["CST", "Regime Normal"] },
  { suffix: "PDIF", label: "Diferimento do ICMS (%)", short: ["Dif. ICMS", "(%)"] },
  { suffix: "PICMS_INTERNAL", label: "Alíquota de ICMS interna (%)", short: ["ICMS", "Interna %"] },
  { suffix: "PICMS_INTERSTATE", label: "Aliquota de ICMS interestadual (%)", short: ["ICMS", "Interest. %"] },
  {
    suffix: "COD_BENEF_RBC",
    label: "Código do Benefício para Redução de base de cálculo",
    short: ["cBenef", "Red. BC"],
  },
  { suffix: "REDUCTION_CALC_BASE", label: "Redução da Base de Cálculo (%)", short: ["Red. BC", "(%)"] },
  { suffix: "REDUCTION_CALC_BASE_ST", label: "Redução da Base de Cálculo ST (%)", short: ["Red. BC", "ST %"] },
  { suffix: "REDUCTION_CALC_DIFAL", label: "Redução da Base de Cálculo do DIFAL (%)", short: ["Red. BC", "DIFAL %"] },
  { suffix: "PICMS_FCP", label: "Alíquota ICMS FCP (%)", short: ["ICMS", "FCP %"] },
  { suffix: "PICMS_EFET", label: "Alíquota do ICMS Efetivo(%)", short: ["ICMS", "Efetivo %"] },
  {
    suffix: "PREDB_CEFET",
    label: "Percentual de redução da base de cálculo do ICMS Efetivo(%)",
    short: ["Red. BC", "ICMS Efet. %"],
  },
  { suffix: "MVA", label: "MVA (Ajustado) (%)", short: ["MVA", "Ajust. %"] },
  {
    suffix: "PICMSST_RET",
    label: "Alíquota suportada de ICMS ST retido anteriormente (para revenda)",
    short: ["ICMS ST Ret.", "Revenda %"],
  },
  {
    suffix: "PFCPST_RET",
    label: "Alíquota de FCP retido anteriormente por ST (para revenda)",
    short: ["FCP ST Ret.", "Revenda %"],
  },
  { suffix: "COD_BENEF", label: "Código de benefício fiscal na UF", short: ["cBenef", "UF"] },
  { suffix: "COD_BENEF_PRES", label: "cBenef do crédito presumido", short: ["cBenef", "Créd. Pres."] },
  { suffix: "PCOD_BENEF_PRES", label: "Percentual de cBenef do crédito presumido", short: ["% cBenef", "Presumido"] },
  { suffix: "MOT_DES_ICMS", label: "Motivo de desoneração", short: ["Mot.", "Desoneração"] },
  { suffix: "RED_ALIQ_IBS", label: "Redução do IBS (%)", short: ["Red.", "IBS %"] },
] as const;

function CompactHeader({
  title,
  lines,
  className = "",
}: {
  title: string;
  lines: readonly [string, string?];
  className?: string;
}) {
  return (
    <span className={`inline-block leading-tight normal-case ${className}`} title={title}>
      <span className="block">{lines[0]}</span>
      {lines[1] ? <span className="block text-muted-foreground">{lines[1]}</span> : null}
    </span>
  );
}

type RuleGroup = {
  groupId: string;
  nome: string;
  origin: string;
  rows: TaxRuleDto[];
};

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function asText(v: unknown, fallback = "—"): string {
  if (v == null) return fallback;
  const t = String(v).trim();
  return t ? t : fallback;
}

function ufCell(icmsByUf: Record<string, unknown>, uf: string, suffix: string): string {
  return asText(icmsByUf[`ICMS_${uf}_${suffix}`]);
}

function contributorLabel(v?: string): string {
  if (v === "taxpayer") return "Contribuinte";
  if (v === "non_taxpayer") return "Não contribuinte";
  return "";
}

function transactionLabel(v?: string): string {
  if (v === "inbound") return "Envio de estoque (Transferência ou Remessa)";
  return "";
}

function baseRuleId(v: string): string {
  return v.replace(/[-_](taxpayer|non_taxpayer|sale|inbound)$/i, "").replace(/[-_](taxpayer|non_taxpayer)$/i, "");
}

function normalizeRuleName(nome: string): string {
  return nome
    .replace(/\s*\((?:contribuinte.*|não contribuinte.*|envio de estoque.*)\)\s*$/i, "")
    .trim();
}

function byRuleThenContributor(a: TaxRuleDto, b: TaxRuleDto): number {
  const ra = baseRuleId(a.id);
  const rb = baseRuleId(b.id);
  if (ra !== rb) return ra.localeCompare(rb);
  const oa = a.customerType === "taxpayer" ? 0 : a.customerType === "non_taxpayer" ? 1 : 2;
  const ob = b.customerType === "taxpayer" ? 0 : b.customerType === "non_taxpayer" ? 1 : 2;
  return oa - ob;
}

function buildGroups(sorted: TaxRuleDto[]): RuleGroup[] {
  const map = new Map<string, RuleGroup>();
  for (const row of sorted) {
    const nomeBase = normalizeRuleName(row.nome);
    const groupId = `${baseRuleId(row.id)}::${row.origin ?? row.uf}::${nomeBase}`;
    const prev = map.get(groupId);
    if (prev) {
      prev.rows.push(row);
    } else {
      map.set(groupId, {
        groupId,
        nome: nomeBase,
        origin: row.origin ?? row.uf,
        rows: [row],
      });
    }
  }
  return [...map.values()];
}

function sortRowsForSheetLayout(rows: TaxRuleDto[]): TaxRuleDto[] {
  const weight = (r: TaxRuleDto) => {
    if (r.transactionType === "inbound") return 2;
    if (r.customerType === "taxpayer") return 0;
    if (r.customerType === "non_taxpayer") return 1;
    return 3;
  };
  return [...rows].sort((a, b) => weight(a) - weight(b));
}

function showContributorCell(r: TaxRuleDto): string {
  if (r.transactionType === "inbound") return transactionLabel(r.transactionType);
  if (r.customerType === "taxpayer" || r.customerType === "non_taxpayer") {
    return contributorLabel(r.customerType);
  }
  return contributorLabel(r.customerType) || "Envio de estoque (Transferência ou Remessa)";
}

function softText(v: unknown): string {
  const text = asText(v, "");
  return text || "—";
}

function toDecimalNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const raw = String(v).trim();
  if (!raw) return null;
  const normalized = raw.replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/** Planilha ML: 325 → 3,25% | 165 → 1,65% | 17 → 17% */
function normalizePercentForDisplay(n: number): number {
  if (n < 10) return n;
  if (n >= 100) return n / 100;
  if (Number.isInteger(n) && String(Math.round(n)).length >= 3) return n / 100;
  return n;
}

function formatDecimal(v: unknown, digits = 2): string {
  const n = toDecimalNumber(v);
  if (n == null) return softText(v);
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatAliquotaPercent(v: unknown, digits = 2): string {
  const n = toDecimalNumber(v);
  if (n == null) return softText(v);
  return formatDecimal(normalizePercentForDisplay(n), digits);
}

const UF_TEXT_SUFFIXES = new Set(["CST", "MOT_DES_ICMS", "COD_BENEF", "COD_BENEF_RBC", "COD_BENEF_PRES"]);

function formatUfValue(suffix: string, value: unknown): string {
  if (UF_TEXT_SUFFIXES.has(suffix)) return softText(value);
  if (suffix === "PDIF" || suffix === "PCOD_BENEF_PRES" || suffix === "RED_ALIQ_IBS") {
    return formatAliquotaPercent(value, 2);
  }
  const n = toDecimalNumber(value);
  if (n == null) return softText(value);
  const isDirectIcmsPercent =
    (suffix.startsWith("PICMS") || suffix.startsWith("PFCP") || suffix === "MVA") &&
    n >= 10 &&
    n < 100 &&
    Number.isInteger(n);
  const scaled = isDirectIcmsPercent ? n : normalizePercentForDisplay(n);
  return formatDecimal(scaled, 2);
}

function shortTaxStatus(v: unknown): string {
  return softText(v);
}

export default async function RegrasPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const nomeFilterRaw = params.nome;
  const nomeFilter = Array.isArray(nomeFilterRaw) ? nomeFilterRaw[0] ?? "" : nomeFilterRaw ?? "";
  const nomeFilterNorm = nomeFilter.trim().toLowerCase();

  const tenantId = await resolveActiveTenantId();
  const rules = await listTaxRules(tenantId);
  const filteredRules = nomeFilterNorm
    ? rules.filter((rule) => rule.nome.toLowerCase().includes(nomeFilterNorm))
    : rules;
  const sorted = [...filteredRules].sort(byRuleThenContributor);
  const groups = buildGroups(sorted).map((g) => ({ ...g, rows: sortRowsForSheetLayout(g.rows) }));
  const allRuleNames = [...new Set(rules.map((rule) => rule.nome))].sort((a, b) => a.localeCompare(b));

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Regras Tributárias"
        subtitle="Visual espelhado da planilha: regra agrupada por tipo de destinatário e colunas por UF"
      />
      <TaxRuleImportForm />
      <form className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-card p-3" method="get">
        <div className="space-y-1">
          <label htmlFor="nome" className="text-xs font-medium text-muted-foreground">
            Filtrar por nome da regra
          </label>
          <input
            id="nome"
            name="nome"
            list="regras-nomes"
            defaultValue={nomeFilter}
            placeholder="Ex.: Nacional-Fogões C/Grill"
            className="h-9 w-[320px] rounded-md border border-input bg-background px-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
          <datalist id="regras-nomes">
            {allRuleNames.map((nome) => (
              <option key={nome} value={nome} />
            ))}
          </datalist>
        </div>
        <button
          type="submit"
          className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Filtrar
        </button>
        <a
          href="/regras"
          className="h-9 rounded-md border border-input px-3 text-sm font-medium text-foreground inline-flex items-center hover:bg-muted/40"
        >
          Limpar
        </a>
      </form>
      <div className="border border-border rounded-lg bg-card overflow-hidden">
        {groups.length === 0 ? (
          <div className="p-6 text-muted-foreground">Nenhuma regra cadastrada para o tenant.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-left border-separate border-spacing-0 min-w-[9800px] w-max">
              <thead>
                <tr className="text-[11px] text-muted-foreground uppercase border-b border-border bg-muted/30">
                  <th
                    className="px-3 py-2 font-semibold border-r border-border sticky left-0 z-30 bg-muted/30 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.12)]"
                    colSpan={3}
                    style={{ minWidth: STICKY_TOTAL, width: STICKY_TOTAL }}
                  >
                    Informações da regra
                  </th>
                  <th className="px-3 py-2 font-semibold border-r border-border" colSpan={3}>
                    IPI
                  </th>
                  <th className="px-3 py-2 font-semibold border-r border-border" colSpan={2}>
                    PIS
                  </th>
                  <th className="px-3 py-2 font-semibold border-r border-border" colSpan={2}>
                    COFINS
                  </th>
                  <th className="px-3 py-2 font-semibold border-r border-border" colSpan={3}>
                    IBS/CBS
                  </th>
                  {UFS.map((uf) => (
                    <th key={uf} className="px-3 py-2 font-semibold border-r border-border" colSpan={UF_FIELDS.length}>
                      {`(${uf}) ${uf === "DF" ? "DISTRITO FEDERAL" : ""}`.trim()}
                    </th>
                  ))}
                </tr>
                <tr className="text-[11px] text-muted-foreground uppercase border-b border-border bg-card">
                  <th
                    className="px-3 py-2 font-semibold border-r border-border sticky left-0 z-30 bg-card min-w-[220px] w-[220px] max-w-[220px]"
                  >
                    Nome da regra
                  </th>
                  <th
                    className="px-3 py-2 font-semibold border-r border-border sticky z-30 bg-card min-w-[72px] w-[72px] max-w-[72px]"
                    style={{ left: STICKY_LEFT.origem }}
                  >
                    Origem Fiscal
                  </th>
                  <th
                    className="px-2 py-1.5 text-[10px] font-semibold border-r border-border sticky z-30 bg-card min-w-[200px] w-[200px] max-w-[200px] shadow-[4px_0_8px_-4px_rgba(0,0,0,0.12)] align-bottom"
                    style={{ left: STICKY_LEFT.destinatario }}
                  >
                    <CompactHeader title="Tipo de destinatário" lines={["Tipo de", "destinatário"]} />
                  </th>
                  <th className="px-2 py-1.5 text-[10px] font-semibold align-bottom max-w-[88px]">
                    <CompactHeader title="Situação Tributária do IPI" lines={["ST", "IPI"]} />
                  </th>
                  <th className="px-2 py-1.5 text-[10px] font-semibold align-bottom max-w-[72px]">
                    <CompactHeader title="Alíquota de IPI (%)" lines={["Alíq.", "IPI %"]} />
                  </th>
                  <th className="px-2 py-1.5 text-[10px] font-semibold border-r border-border align-bottom max-w-[72px]">
                    <CompactHeader title="Código Enquadramento legal IPI" lines={["cEnq", "IPI"]} />
                  </th>
                  <th className="px-2 py-1.5 text-[10px] font-semibold align-bottom max-w-[88px]">
                    <CompactHeader title="Situação Tributária do PIS" lines={["ST", "PIS"]} />
                  </th>
                  <th className="px-2 py-1.5 text-[10px] font-semibold border-r border-border align-bottom max-w-[72px]">
                    <CompactHeader title="Alíquota de PIS (%)" lines={["Alíq.", "PIS %"]} />
                  </th>
                  <th className="px-2 py-1.5 text-[10px] font-semibold align-bottom max-w-[88px]">
                    <CompactHeader title="Situação Tributária do COFINS" lines={["ST", "COFINS"]} />
                  </th>
                  <th className="px-2 py-1.5 text-[10px] font-semibold border-r border-border align-bottom max-w-[72px]">
                    <CompactHeader title="Alíquota de COFINS (%)" lines={["Alíq.", "COFINS %"]} />
                  </th>
                  <th className="px-2 py-1.5 text-[10px] font-semibold align-bottom max-w-[88px]">
                    <CompactHeader title="Situação Tributária IBS/CBS" lines={["ST", "IBS/CBS"]} />
                  </th>
                  <th className="px-2 py-1.5 text-[10px] font-semibold align-bottom max-w-[88px]">
                    <CompactHeader title="cClassTrib IBS/CBS" lines={["cClassTrib", "IBS/CBS"]} />
                  </th>
                  <th className="px-2 py-1.5 text-[10px] font-semibold border-r border-border align-bottom max-w-[72px]">
                    <CompactHeader title="Redução CBS (%)" lines={["Red.", "CBS %"]} />
                  </th>
                  {UFS.map((uf) => (
                    <Fragment key={`h-${uf}`}>
                      {UF_FIELDS.map((f, idx) => (
                        <th
                          key={`${uf}-${f.suffix}`}
                          className={`px-1.5 py-1.5 text-[10px] font-semibold align-bottom max-w-[84px] w-[84px] whitespace-normal ${idx === UF_FIELDS.length - 1 ? "border-r border-border" : ""}`}
                        >
                          <CompactHeader title={f.label} lines={f.short} />
                        </th>
                      ))}
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map((group) =>
                  group.rows.map((r, idx) => {
                    const payload = asRecord(r.payload);
                    const taxes = asRecord(payload.taxes);
                    const ipi = asRecord(taxes.ipi);
                    const pis = asRecord(taxes.pis);
                    const cofins = asRecord(taxes.cofins);
                    const ibsCbs = asRecord(taxes.ibsCbs);
                    const icmsByUf = asRecord(payload.icmsByUf);
                    const isFirst = idx === 0;

                    return (
                      <tr
                        key={`${group.groupId}-${idx}`}
                        className="group border-b border-border hover:bg-muted/20 transition-colors"
                      >
                        {isFirst && (
                          <td
                            className="px-3 py-2 text-[13px] font-semibold border-r border-border sticky left-0 z-10 bg-card align-middle min-w-[220px] w-[220px] max-w-[220px] group-hover:bg-muted/20"
                            rowSpan={group.rows.length}
                          >
                            {group.nome}
                          </td>
                        )}
                        {isFirst && (
                          <td
                            className="px-3 py-2 text-[13px] font-semibold border-r border-border sticky z-10 bg-card align-middle text-center min-w-[72px] w-[72px] max-w-[72px] group-hover:bg-muted/20"
                            rowSpan={group.rows.length}
                            style={{ left: STICKY_LEFT.origem }}
                          >
                            {group.origin}
                          </td>
                        )}
                        <td
                          className="px-2 py-2 text-[12px] border-r border-border sticky z-10 bg-card text-center text-muted-foreground min-w-[200px] w-[200px] max-w-[200px] shadow-[4px_0_8px_-4px_rgba(0,0,0,0.12)] group-hover:bg-muted/20"
                          style={{ left: STICKY_LEFT.destinatario }}
                        >
                          {showContributorCell(r)}
                        </td>

                        <td className="px-3 py-2 text-[12px]">{shortTaxStatus(ipi.st)}</td>
                        <td className="px-3 py-2 text-[12px] font-mono text-right">{formatAliquotaPercent(ipi.aliquota, 2)}</td>
                        <td className="px-3 py-2 text-[12px] font-mono text-center border-r border-border">{softText(ipi.codEnq)}</td>

                        <td className="px-3 py-2 text-[12px]">{shortTaxStatus(pis.st)}</td>
                        <td className="px-3 py-2 text-[12px] font-mono text-right border-r border-border">{formatAliquotaPercent(pis.aliquota, 2)}</td>

                        <td className="px-3 py-2 text-[12px]">{shortTaxStatus(cofins.st)}</td>
                        <td className="px-3 py-2 text-[12px] font-mono text-right border-r border-border">{formatAliquotaPercent(cofins.aliquota, 2)}</td>

                        <td className="px-3 py-2 text-[12px]">{softText(ibsCbs.st)}</td>
                        <td className="px-3 py-2 text-[12px]">{softText(ibsCbs.cClassTrib)}</td>
                        <td className="px-3 py-2 text-[12px] font-mono text-right border-r border-border">{formatAliquotaPercent(ibsCbs.reducao, 2)}</td>

                        {UFS.map((uf) => (
                          <Fragment key={`${group.groupId}-${idx}-${uf}`}>
                            {UF_FIELDS.map((f, fIdx) => (
                              <td
                                key={`${group.groupId}-${idx}-${uf}-${f.suffix}`}
                                className={`px-3 py-2 text-[12px] font-mono ${fIdx === UF_FIELDS.length - 1 ? "border-r border-border" : ""}`}
                              >
                                {formatUfValue(f.suffix, ufCell(icmsByUf, uf, f.suffix))}
                              </td>
                            ))}
                          </Fragment>
                        ))}
                      </tr>
                    );
                  }),
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
