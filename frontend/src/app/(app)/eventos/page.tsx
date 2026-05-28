import type { Metadata } from "next";
import { PageHeader } from "@/components/fiscal-ui";
import { resolveActiveTenantId } from "@/lib/active-tenant";
import { listFiscalEvents } from "@/lib/fiscal-api";
import { formatChave } from "@/lib/format";

export const metadata: Metadata = { title: "Eventos SEFAZ" };

const EVENT_NAMES: Record<string, string> = {
  "110111": "Cancelamento",
  "110110": "Carta de Correção",
  "210200": "Confirmação da operação",
  "210210": "Ciência da operação",
  "210220": "Desconhecimento da operação",
  "210240": "Operação não realizada",
};

export default async function EventosPage() {
  const tenantId = await resolveActiveTenantId();
  const events = await listFiscalEvents(tenantId);

  return (
    <div className="p-6">
      <PageHeader title="Eventos SEFAZ" subtitle="Eventos fiscais persistidos no banco" />
      <div className="border border-border rounded-lg bg-card overflow-hidden">
        {events.length === 0 ? (
          <div className="p-6 text-muted-foreground">Nenhum evento para este tenant.</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[12px] text-muted-foreground uppercase tracking-tighter border-b border-border">
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Descrição</th>
                <th className="px-4 py-3 font-medium">Chave NF-e</th>
                <th className="px-4 py-3 font-medium">Protocolo</th>
                <th className="px-4 py-3 font-medium">Ocorrido em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {events.map((e) => (
                <tr key={e.id} className="hover:bg-white/2 transition-colors">
                  <td className="px-4 py-3 font-mono text-[13px] text-accent">{e.tipo}</td>
                  <td className="px-4 py-3">{EVENT_NAMES[e.tipo] ?? e.descricao}</td>
                  <td className="px-4 py-3 font-mono text-[13px] text-muted-foreground">{formatChave(e.chaveRef)}</td>
                  <td className="px-4 py-3 font-mono text-[13px]">{e.protocolo}</td>
                  <td className="px-4 py-3 text-[14px]">{new Date(e.ocorridoEm).toLocaleString("pt-BR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
