import type { Metadata } from "next";
import { PageHeader } from "@/components/fiscal-ui";
import { resolveActiveTenantId } from "@/lib/active-tenant";
import { listAuditLogs } from "@/lib/fiscal-api";

export const metadata: Metadata = { title: "Auditoria" };

export default async function AuditoriaPage() {
  const tenantId = await resolveActiveTenantId();
  const audit = await listAuditLogs(tenantId);

  return (
    <div className="p-6">
      <PageHeader title="Trilha de Auditoria" subtitle="Registros append-only no banco — simulação" />
      <div className="border border-border rounded-lg bg-card overflow-hidden">
        {audit.length === 0 ? (
          <div className="p-6 text-muted-foreground">Nenhum registro de auditoria.</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[12px] text-muted-foreground uppercase tracking-tighter border-b border-border">
                <th className="px-4 py-3 font-medium">Ator</th>
                <th className="px-4 py-3 font-medium">Ação</th>
                <th className="px-4 py-3 font-medium">Recurso</th>
                <th className="px-4 py-3 font-medium">Hash</th>
                <th className="px-4 py-3 font-medium">Ocorrido em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {audit.map((a) => (
                <tr key={a.id} className="hover:bg-white/2 transition-colors">
                  <td className="px-4 py-3 font-mono text-[13px]">{a.ator}</td>
                  <td className="px-4 py-3">
                    <span className="text-[12px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-foreground">
                      {a.acao}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-[13px] text-muted-foreground truncate max-w-xs">{a.recurso}</td>
                  <td className="px-4 py-3 font-mono text-[13px] text-accent">{a.hash.slice(0, 16)}…</td>
                  <td className="px-4 py-3 text-[14px]">{new Date(a.ocorridoEm).toLocaleString("pt-BR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
