import type { Metadata } from "next";
import { PedidosView } from "@/components/pedidos-view";
import { resolveActiveTenantId } from "@/lib/active-tenant";
import { listPedidos, listProducts } from "@/lib/fiscal-api";

export const metadata: Metadata = { title: "Pedidos ML" };

export default async function PedidosPage() {
  const tenantId = await resolveActiveTenantId();
  const [pedidos, products] = await Promise.all([listPedidos(tenantId), listProducts(tenantId)]);

  return <PedidosView tenantId={tenantId} pedidos={pedidos} products={products} />;
}
