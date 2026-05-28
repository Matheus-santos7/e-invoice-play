"use server";

import { revalidatePath } from "next/cache";
import { deleteNfe } from "@/lib/fiscal-api";

export async function excluirNfeAction(chave: string): Promise<{ error?: string }> {
  try {
    await deleteNfe(chave);
    revalidatePath("/nfe");
    revalidatePath("/");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao remover NF-e" };
  }
}
