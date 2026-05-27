import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, StatusBadge } from "@/components/fiscal-ui";
import { CTES, brl, formatChave } from "@/lib/fiscal-mock";

export const Route = createFileRoute("/_app/cte")({
  component: CTeList,
  head: () => ({ meta: [{ title: "CT-e — Fiscal Engine" }] }),
});

function CTeList() {
  return (
    <div className="p-6">
      <PageHeader
        title="CT-e Transportes"
        subtitle="Conhecimento de transporte eletrônico modelo 57 — simulação"
      />
      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[10px] text-muted-foreground uppercase tracking-tighter border-b border-border">
              <th className="px-4 py-3 font-medium">Número</th>
              <th className="px-4 py-3 font-medium">Chave</th>
              <th className="px-4 py-3 font-medium">Modal</th>
              <th className="px-4 py-3 font-medium">Origem → Destino</th>
              <th className="px-4 py-3 font-medium">Valor Frete</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {CTES.map((c) => (
              <tr key={c.chave} className="hover:bg-white/2 transition-colors">
                <td className="px-4 py-3 font-mono">{c.numero}</td>
                <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">{formatChave(c.chave)}</td>
                <td className="px-4 py-3">{c.modal}</td>
                <td className="px-4 py-3 text-[12px]">{c.origem} → {c.destino}</td>
                <td className="px-4 py-3 font-mono">{brl(c.valor)}</td>
                <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
