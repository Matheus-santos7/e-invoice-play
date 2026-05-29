"use server";

import { revalidatePath } from "next/cache";
import { deleteNfe, emitirDevolucao } from "@/lib/fiscal-api";

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

export async function devolverVendaAction(
  chave: string,
): Promise<{ error?: string; numero?: number; serie?: number }> {
  try {
    const { devolucao } = await emitirDevolucao(chave);
    revalidatePath("/nfe");
    revalidatePath("/");
    return { numero: devolucao.numero, serie: devolucao.serie };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao emitir devolução" };
  }
}
