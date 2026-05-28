"use server";

import { revalidatePath } from "next/cache";
import { resolveActiveTenantId } from "@/lib/active-tenant";
import { bulkUpsertTaxRules } from "@/lib/fiscal-api";
import { parseTaxRuleXlsx } from "@/lib/tax-rule-planilha";

export type TaxRuleImportState = {
  error?: string;
  success?: boolean;
  created?: number;
  updated?: number;
  total?: number;
  parseErrors?: { line: number; message: string }[];
};

export async function importarRegrasTributariasAction(
  _prev: TaxRuleImportState,
  formData: FormData,
): Promise<TaxRuleImportState> {
  const tenantId = await resolveActiveTenantId();
  if (!tenantId) return { error: "Selecione uma empresa no header antes de importar" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Selecione um arquivo .xlsx" };
  if (!file.name.toLowerCase().endsWith(".xlsx")) return { error: "Formato inválido. Envie um arquivo .xlsx" };

  const parsed = parseTaxRuleXlsx(await file.arrayBuffer());
  if (parsed.rows.length === 0) {
    return { error: parsed.errors[0]?.message ?? "Nenhuma regra válida na planilha", parseErrors: parsed.errors };
  }

  try {
    const result = await bulkUpsertTaxRules(tenantId, parsed.rows);
    revalidatePath("/regras");
    return {
      success: true,
      created: result.created,
      updated: result.updated,
      total: result.total,
      parseErrors: parsed.errors.length > 0 ? parsed.errors : undefined,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao importar regras" };
  }
}
