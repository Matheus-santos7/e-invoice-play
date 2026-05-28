"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolveActiveTenantId } from "@/lib/active-tenant";
import {
  formatFieldErrors,
  inputToFormValues,
  parseProductForm,
  type ProdutoFormState,
} from "@/lib/produto-form";
import { ApiValidationError, bulkUpsertProducts, createProduct, deleteProduct, updateProduct } from "@/lib/fiscal-api";
import { parseProdutoPlanilhaCsv } from "@/lib/produto-planilha";

function failureState(e: unknown, values: ReturnType<typeof inputToFormValues>): ProdutoFormState {
  const fieldErrors = e instanceof ApiValidationError ? e.fieldErrors : undefined;
  return {
    error: formatFieldErrors(fieldErrors) ?? (e instanceof Error ? e.message : "Erro ao salvar produto"),
    fieldErrors,
    values,
  };
}

export async function createProdutoAction(
  _prev: ProdutoFormState,
  formData: FormData,
): Promise<ProdutoFormState> {
  const tenantId = await resolveActiveTenantId();
  if (!tenantId) return { error: "Selecione uma empresa no header antes de cadastrar produtos" };

  const parsed = parseProductForm(formData);
  const values = inputToFormValues(parsed);
  try {
    await createProduct(tenantId, parsed);
  } catch (e) {
    return failureState(e, values);
  }
  revalidatePath("/produtos");
  revalidatePath("/nfe");
  revalidatePath("/cte");
  revalidatePath("/");
  redirect("/produtos");
}

export async function updateProdutoModalAction(
  id: string,
  _prev: ProdutoFormState,
  formData: FormData,
): Promise<ProdutoFormState> {
  const parsed = parseProductForm(formData);
  const values = inputToFormValues(parsed);
  try {
    await updateProduct(id, parsed);
  } catch (e) {
    return failureState(e, values);
  }
  revalidatePath("/produtos");
  revalidatePath("/nfe");
  revalidatePath("/cte");
  revalidatePath("/");
  return { success: true };
}

export async function deleteProdutoAction(id: string): Promise<ProdutoFormState> {
  try {
    await deleteProduct(id);
    revalidatePath("/produtos");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao excluir produto" };
  }
}

export type ProdutoPlanilhaImportResult = {
  error?: string;
  parseErrors?: { line: number; message: string }[];
  created?: number;
  updated?: number;
  failed?: { line: number; sku: string; error: string }[];
  total?: number;
};

export async function importProdutosPlanilhaAction(formData: FormData): Promise<ProdutoPlanilhaImportResult> {
  const tenantId = await resolveActiveTenantId();
  if (!tenantId) {
    return { error: "Selecione uma empresa no header antes de importar a planilha" };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecione um arquivo CSV (.csv)" };
  }

  const text = await file.text();
  const { rows, errors: parseErrors } = parseProdutoPlanilhaCsv(text);

  if (rows.length === 0) {
    return {
      error: parseErrors[0]?.message ?? "Nenhum produto válido na planilha",
      parseErrors,
    };
  }

  try {
    const result = await bulkUpsertProducts(tenantId, rows);
    revalidatePath("/produtos");
    revalidatePath("/nfe");
    revalidatePath("/cte");
    revalidatePath("/");
    return {
      ...result,
      parseErrors: parseErrors.length > 0 ? parseErrors : undefined,
    };
  } catch (e) {
    if (e instanceof ApiValidationError) {
      return { error: e.message, parseErrors };
    }
    return { error: e instanceof Error ? e.message : "Erro ao importar planilha", parseErrors };
  }
}
