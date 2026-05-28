"use server";

import { revalidatePath } from "next/cache";
import { deleteCte } from "@/lib/fiscal-api";

export async function excluirCteAction(chave: string): Promise<{ error?: string }> {
  try {
    await deleteCte(chave);
    revalidatePath("/cte");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao remover CT-e" };
  }
}
