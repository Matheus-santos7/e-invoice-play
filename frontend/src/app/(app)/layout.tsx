import { AppShell } from "@/components/app-shell";
import { getActiveTenantId } from "@/lib/active-tenant";
import { getTenants } from "@/lib/fiscal-api";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const tenants = await getTenants();
  const activeTenantId = await getActiveTenantId(tenants.map((t) => t.id));
  return (
    <AppShell tenants={tenants} activeTenantId={activeTenantId}>
      {children}
    </AppShell>
  );
}
