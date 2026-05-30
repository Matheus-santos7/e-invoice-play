"use server";

import { revalidatePath } from "next/cache";
import { resolveActiveTenantId } from "@/lib/active-tenant";
import {
  bulkImportUnidadesLogisticas,
  emitirAvancoCd,
  setUnidadeLogisticaPadrao,
} from "@/lib/fiscal-api";
import { parseMeliUnidadesXlsx } from "@/lib/meli-unidade-planilha";

export type UnidadeImportState = {
  error?: string;
  success?: boolean;
  created?: number;
  updated?: number;
  unicos?: number;
  parseErrors?: { line: number; message: string }[];
};

export async function importarUnidadesLogisticasAction(
  _prev: UnidadeImportState,
  formData: FormData,
): Promise<UnidadeImportState> {
  const tenantId = await resolveActiveTenantId();
  if (!tenantId) return { error: "Selecione uma empresa no header antes de importar" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Selecione um arquivo .xlsx" };
  if (!file.name.toLowerCase().endsWith(".xlsx")) return { error: "Formato inválido. Envie um arquivo .xlsx" };

  const parsed = parseMeliUnidadesXlsx(await file.arrayBuffer());
  if (parsed.rows.length === 0) {
    return {
      error: parsed.errors[0]?.message ?? "Nenhuma unidade válida na planilha",
      parseErrors: parsed.errors,
    };
  }

  try {
    const result = await bulkImportUnidadesLogisticas(tenantId, parsed.rows);
    revalidatePath("/unidades-logisticas");
    return {
      success: true,
      created: result.created,
      updated: result.updated,
      unicos: result.unicos,
      parseErrors:
        [...parsed.errors, ...result.errors].length > 0
          ? [...parsed.errors, ...result.errors]
          : undefined,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao importar unidades" };
  }
}

export type AvancoCdState = {
  error?: string;
  success?: boolean;
  chaveRemessa?: string;
  chaveSimbolica?: string;
};

export async function emitirAvancoCdAction(
  _prev: AvancoCdState,
  formData: FormData,
): Promise<AvancoCdState> {
  const tenantId = await resolveActiveTenantId();
  if (!tenantId) return { error: "Selecione uma empresa" };

  const productId = String(formData.get("productId") ?? "");
  const unidadeOrigemId = String(formData.get("unidadeOrigemId") ?? "");
  const unidadeDestinoId = String(formData.get("unidadeDestinoId") ?? "");
  const quantidade = Number(formData.get("quantidade") ?? 0);

  if (!productId || !unidadeOrigemId || !unidadeDestinoId) {
    return { error: "Preencha produto, CD origem e CD destino" };
  }
  if (!Number.isFinite(quantidade) || quantidade < 1) {
    return { error: "Quantidade inválida" };
  }

  try {
    const result = await emitirAvancoCd(tenantId, {
      productId,
      quantidade,
      unidadeOrigemId,
      unidadeDestinoId,
    });
    revalidatePath("/unidades-logisticas");
    revalidatePath("/nfe");
    return {
      success: true,
      chaveRemessa: result.remessaDestino.chave,
      chaveSimbolica: result.remessaSimbolica.chave,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao emitir avanço" };
  }
}

export async function definirUnidadePadraoAction(unidadeId: string): Promise<{ error?: string }> {
  const tenantId = await resolveActiveTenantId();
  if (!tenantId) return { error: "Selecione uma empresa" };
  try {
    await setUnidadeLogisticaPadrao(tenantId, unidadeId);
    revalidatePath("/unidades-logisticas");
    revalidatePath("/produtos");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao definir padrão" };
  }
}
