import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/fiscal-ui";
import { AUDIT } from "@/lib/fiscal-mock";

export const Route = createFileRoute("/_app/auditoria")({
  component: Auditoria,
  head: () => ({ meta: [{ title: "Auditoria — Fiscal Engine" }] }),
});

function Auditoria() {
  return (
    <div className="p-6">
      <PageHeader
        title="Trilha de Auditoria"
        subtitle="Append-only com hash chain — simulação"
      />
      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[10px] text-muted-foreground uppercase tracking-tighter border-b border-border">
              <th className="px-4 py-3 font-medium">Ator</th>
              <th className="px-4 py-3 font-medium">Ação</th>
              <th className="px-4 py-3 font-medium">Recurso</th>
              <th className="px-4 py-3 font-medium">Hash</th>
              <th className="px-4 py-3 font-medium">Ocorrido em</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {AUDIT.map((a) => (
              <tr key={a.id} className="hover:bg-white/2 transition-colors">
                <td className="px-4 py-3 font-mono text-[11px]">{a.ator}</td>
                <td className="px-4 py-3"><span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-foreground">{a.acao}</span></td>
                <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground truncate max-w-xs">{a.recurso}</td>
                <td className="px-4 py-3 font-mono text-[11px] text-accent">{a.hash}…</td>
                <td className="px-4 py-3 text-[12px]">{new Date(a.ocorridoEm).toLocaleString("pt-BR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
