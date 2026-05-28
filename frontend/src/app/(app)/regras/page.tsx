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

const UF_FIELDS = [
  { suffix: "CST", label: "CST" },
  { suffix: "PICMS_INTERNAL", label: "ICMS Int." },
  { suffix: "PICMS_INTERSTATE", label: "ICMS Inter." },
  { suffix: "PICMS_FCP", label: "FCP" },
  { suffix: "MVA", label: "MVA" },
  { suffix: "REDUCTION_CALC_BASE", label: "Red. BC" },
  { suffix: "REDUCTION_CALC_BASE_ST", label: "Red. BC ST" },
  { suffix: "REDUCTION_CALC_DIFAL", label: "Red. DIFAL" },
  { suffix: "PICMS_EFET", label: "ICMS Efet." },
  { suffix: "PREDB_CEFET", label: "Red. BC Efet." },
  { suffix: "PICMSST_RET", label: "ICMS ST Ret." },
  { suffix: "PFCPST_RET", label: "FCP ST Ret." },
  { suffix: "MOT_DES_ICMS", label: "Mot. Des." },
  { suffix: "COD_BENEF", label: "cBenef" },
] as const;

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

function shortTaxStatus(v: unknown): string {
  return softText(v);
}

function safeSlice2(v: unknown): string {
  const text = asText(v, "");
  return text ? text.slice(0, 2) : "—";
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
            <table className="text-left border-collapse min-w-[9200px] w-max">
              <thead>
                <tr className="text-[11px] text-muted-foreground uppercase border-b border-border bg-muted/30">
                  <th className="px-3 py-2 font-semibold border-r border-border" colSpan={3}>
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
                  <th className="px-3 py-2 font-semibold border-r border-border">Nome da regra</th>
                  <th className="px-3 py-2 font-semibold border-r border-border">Origem Fiscal</th>
                  <th className="px-3 py-2 font-semibold border-r border-border">Tipo de destinatário</th>
                  <th className="px-3 py-2 font-semibold">Situação Tributária do IPI</th>
                  <th className="px-3 py-2 font-semibold">Alíquota de IPI (%)</th>
                  <th className="px-3 py-2 font-semibold border-r border-border">Código Enquadramento legal IPI</th>
                  <th className="px-3 py-2 font-semibold">Situação Tributária do PIS</th>
                  <th className="px-3 py-2 font-semibold border-r border-border">Alíquota de PIS (%)</th>
                  <th className="px-3 py-2 font-semibold">Situação Tributária do COFINS</th>
                  <th className="px-3 py-2 font-semibold border-r border-border">Alíquota de COFINS (%)</th>
                  <th className="px-3 py-2 font-semibold">Situação Tributária IBS/CBS</th>
                  <th className="px-3 py-2 font-semibold">cClassTrib IBS/CBS</th>
                  <th className="px-3 py-2 font-semibold border-r border-border">Redução CBS (%)</th>
                  {UFS.map((uf) => (
                    <Fragment key={`h-${uf}`}>
                      {UF_FIELDS.map((f, idx) => (
                        <th
                          key={`${uf}-${f.suffix}`}
                          className={`px-3 py-2 font-semibold ${idx === UF_FIELDS.length - 1 ? "border-r border-border" : ""}`}
                        >
                          {f.label}
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
                      <tr key={`${group.groupId}-${idx}`} className="border-b border-border hover:bg-muted/20 transition-colors">
                        {isFirst && (
                          <td className="px-3 py-2 text-[13px] font-semibold border-r border-border align-middle" rowSpan={group.rows.length}>
                            {group.nome}
                          </td>
                        )}
                        {isFirst && (
                          <td
                            className="px-3 py-2 text-[13px] font-semibold border-r border-border align-middle text-center"
                            rowSpan={group.rows.length}
                          >
                            {group.origin}
                          </td>
                        )}
                        <td className="px-3 py-2 text-[13px] border-r border-border text-center text-muted-foreground">
                          {showContributorCell(r)}
                        </td>

                        <td className="px-3 py-2 text-[12px]">{shortTaxStatus(ipi.st)}</td>
                        <td className="px-3 py-2 text-[12px] font-mono text-right">{softText(ipi.aliquota)}</td>
                        <td className="px-3 py-2 text-[12px] font-mono text-center border-r border-border">{softText(ipi.codEnq)}</td>

                        <td className="px-3 py-2 text-[12px]">{shortTaxStatus(pis.st)}</td>
                        <td className="px-3 py-2 text-[12px] font-mono text-right border-r border-border">{softText(pis.aliquota)}</td>

                        <td className="px-3 py-2 text-[12px]">{shortTaxStatus(cofins.st)}</td>
                        <td className="px-3 py-2 text-[12px] font-mono text-right border-r border-border">{softText(cofins.aliquota)}</td>

                        <td className="px-3 py-2 text-[12px]">{softText(ibsCbs.st)}</td>
                        <td className="px-3 py-2 text-[12px]">{softText(ibsCbs.cClassTrib)}</td>
                        <td className="px-3 py-2 text-[12px] font-mono text-right border-r border-border">{softText(ibsCbs.reducao)}</td>

                        {UFS.map((uf) => (
                          <Fragment key={`${group.groupId}-${idx}-${uf}`}>
                            {UF_FIELDS.map((f, fIdx) => (
                              <td
                                key={`${group.groupId}-${idx}-${uf}-${f.suffix}`}
                                className={`px-3 py-2 text-[12px] font-mono ${fIdx === UF_FIELDS.length - 1 ? "border-r border-border" : ""}`}
                              >
                                {f.suffix === "CST" ? safeSlice2(ufCell(icmsByUf, uf, f.suffix)) : softText(ufCell(icmsByUf, uf, f.suffix))}
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
