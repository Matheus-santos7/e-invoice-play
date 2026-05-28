"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { ACTIVE_TENANT_COOKIE } from "@/lib/active-tenant";
import { getTenants } from "@/lib/fiscal-api";

export async function setActiveTenantAction(tenantId: string): Promise<void> {
  const tenants = await getTenants();
  if (!tenants.some((t) => t.id === tenantId)) {
    throw new Error("Empresa inválida");
  }

  const store = await cookies();
  store.set(ACTIVE_TENANT_COOKIE, tenantId, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
  });

  revalidatePath("/", "layout");
}
