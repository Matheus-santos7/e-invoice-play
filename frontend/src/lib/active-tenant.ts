import { cookies } from "next/headers";
import { getTenants } from "@/lib/fiscal-api";

export const ACTIVE_TENANT_COOKIE = "active_tenant_id";

export async function getActiveTenantId(knownIds: string[]): Promise<string | undefined> {
  const store = await cookies();
  const fromCookie = store.get(ACTIVE_TENANT_COOKIE)?.value;
  if (fromCookie && knownIds.includes(fromCookie)) return fromCookie;
  return knownIds[0];
}

/** Tenant selecionado no cookie (fallback: primeira empresa). */
export async function resolveActiveTenantId(): Promise<string | undefined> {
  const tenants = await getTenants();
  return getActiveTenantId(tenants.map((t) => t.id));
}
