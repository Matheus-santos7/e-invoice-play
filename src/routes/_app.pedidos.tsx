import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/fiscal-ui";
import { NFES, brl } from "@/lib/fiscal-mock";

export const Route = createFileRoute("/_app/pedidos")({
  component: Pedidos,
  head: () => ({ meta: [{ title: "Pedidos ML — Fiscal Engine" }] }),
});

function Pedidos() {
  return (
    <div className="p-6">
      <PageHeader title="Pedidos Mercado Livre" subtitle="Pedidos sincronizados via webhook — simulação" />
      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[10px] text-muted-foreground uppercase tracking-tighter border-b border-border">
              <th className="px-4 py-3 font-medium">Pedido ML</th>
              <th className="px-4 py-3 font-medium">Comprador</th>
              <th className="px-4 py-3 font-medium">UF</th>
              <th className="px-4 py-3 font-medium">Valor</th>
              <th className="px-4 py-3 font-medium">NF-e Vinculada</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {NFES.map((n) => (
              <tr key={n.pedidoML} className="hover:bg-white/2 transition-colors">
                <td className="px-4 py-3 font-mono text-[11px] text-accent">{n.pedidoML}</td>
                <td className="px-4 py-3">{n.destinatario.nome}</td>
                <td className="px-4 py-3 font-mono">{n.destinatario.uf}</td>
                <td className="px-4 py-3 font-mono">{brl(n.valor)}</td>
                <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                  NF-e {n.numero}/{n.serie}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
