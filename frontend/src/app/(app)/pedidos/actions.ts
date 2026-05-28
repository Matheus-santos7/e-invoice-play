"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolveActiveTenantId } from "@/lib/active-tenant";
import {
  ApiValidationError,
  createPedido,
  deletePedido,
  faturarPedido,
  updatePedido,
} from "@/lib/fiscal-api";
import { parsePedidoForm, type PedidoFormState } from "@/lib/pedido-form";

function mapError(e: unknown): PedidoFormState {
  if (e instanceof ApiValidationError) {
    const msgs = Object.values(e.fieldErrors ?? {}).flat();
    return { error: msgs[0] ?? e.message, fieldErrors: e.fieldErrors };
  }
  return { error: e instanceof Error ? e.message : "Erro na operação" };
}

export async function salvarPedidoRascunhoAction(
  _prev: PedidoFormState,
  formData: FormData,
): Promise<PedidoFormState> {
  const tenantId = await resolveActiveTenantId();
  if (!tenantId) return { error: "Selecione uma empresa no header" };

  const pedidoId = String(formData.get("pedidoId") ?? "").trim() || null;

  try {
    const input = parsePedidoForm(formData);
    if (pedidoId) {
      await updatePedido(pedidoId, input);
    } else {
      await createPedido(tenantId, input);
    }
    revalidatePath("/pedidos");
    return { success: true };
  } catch (e) {
    return mapError(e);
  }
}

export async function faturarPedidoAction(
  _prev: PedidoFormState,
  formData: FormData,
): Promise<PedidoFormState> {
  const tenantId = await resolveActiveTenantId();
  if (!tenantId) return { error: "Selecione uma empresa no header" };

  const pedidoId = String(formData.get("pedidoId") ?? "").trim() || null;

  try {
    let id = pedidoId;
    if (!id) {
      const input = parsePedidoForm(formData);
      const created = await createPedido(tenantId, input);
      id = created.id;
    } else {
      await updatePedido(id, parsePedidoForm(formData));
    }

    const { nfe } = await faturarPedido(id);
    revalidatePath("/pedidos");
    revalidatePath("/nfe");
    revalidatePath("/");
    redirect(`/nfe/${nfe.chave}`);
  } catch (e) {
    if (e instanceof Error && e.message === "NEXT_REDIRECT") throw e;
    return mapError(e);
  }
}

export async function excluirPedidoAction(id: string): Promise<{ error?: string }> {
  try {
    await deletePedido(id);
    revalidatePath("/pedidos");
    revalidatePath("/nfe");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao excluir pedido" };
  }
}
