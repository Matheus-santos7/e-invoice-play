import { Link, createFileRoute } from "@tanstack/react-router";
import { KPI, SectionHeader, StatusBadge } from "@/components/fiscal-ui";
import { XMLViewer } from "@/components/xml-viewer";
import { NFES, TIMELINE_ATUAL, brl, formatChave, TENANTS } from "@/lib/fiscal-mock";
import { buildNFeXML } from "@/lib/xml-generator";

export const Route = createFileRoute("/_app/")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Dashboard — Fiscal Engine (Simulação)" },
      { name: "description", content: "Cockpit fiscal e logístico para simulação de operações Mercado Livre Full." },
    ],
  }),
});

function Dashboard() {
  const featured = NFES[0];
  const emit = TENANTS[0];
  const xml = buildNFeXML(featured, {
    cnpj: emit.cnpj,
    xNome: emit.razaoSocial,
    ie: emit.ie,
    uf: emit.uf,
  });

  return (
    <div className="p-6 space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <KPI label="NF-e Hoje" value="1.284" hint="+12,4% vs ontem" hintTone="success" />
        <KPI label="ICMS Calculado" value={brl(42901.2)} hint="Alíq. média 18%" hintTone="muted" />
        <KPI label="CT-e Gerados" value="412" hint="Aguardando SEFAZ" hintTone="accent" />
        <KPI label="Conformidade" value="100%" hint="Sem rejeições" hintTone="success" />
      </div>

      <div className="grid grid-cols-12 gap-6 items-start">
        {/* Últimas NF-e */}
        <div className="col-span-8 border border-border rounded-lg bg-card overflow-hidden animate-slide-in">
          <SectionHeader
            title="Últimas Notas Fiscais"
            right={
              <Link to="/nfe" className="text-[10px] font-bold uppercase tracking-wider text-accent hover:underline">
                Ver todas
              </Link>
            }
          />
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[10px] text-muted-foreground uppercase tracking-tighter border-b border-border">
                <th className="px-4 py-3 font-medium">Chave de Acesso</th>
                <th className="px-4 py-3 font-medium">Destinatário</th>
                <th className="px-4 py-3 font-medium">Valor</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {NFES.map((nfe, i) => (
                <tr
                  key={nfe.chave}
                  className={`hover:bg-white/2 transition-colors cursor-pointer ${
                    i === 0 ? "border-l-2 border-l-accent" : ""
                  }`}
                >
                  <td className={`px-4 py-3 font-mono text-[11px] ${i === 0 ? "text-accent/80" : "text-muted-foreground"}`}>
                    {formatChave(nfe.chave)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{nfe.destinatario.nome}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">{nfe.destinatario.doc}</div>
                  </td>
                  <td className="px-4 py-3 font-mono">{brl(nfe.valor)}</td>
                  <td className="px-4 py-3"><StatusBadge status={nfe.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Right column */}
        <div className="col-span-4 space-y-6">
          {/* Timeline */}
          <div className="border border-border rounded-lg bg-card animate-slide-in">
            <SectionHeader title="Timeline Operacional" />
            <div className="p-4 space-y-4">
              {TIMELINE_ATUAL.map((s, i) => {
                const last = i === TIMELINE_ATUAL.length - 1;
                const dot =
                  s.status === "done"
                    ? "bg-success"
                    : s.status === "current"
                    ? "bg-accent animate-pulse"
                    : "bg-border";
                return (
                  <div key={s.label} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`size-2 rounded-full ${dot}`} />
                      {!last && <div className="w-px flex-1 bg-border my-1" />}
                    </div>
                    <div className="pb-2">
                      <div className={`text-[11px] font-bold uppercase ${s.status === "pending" ? "text-muted-foreground" : ""}`}>
                        {s.label}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {s.at && <span className="font-mono">{s.at} • </span>}
                        {s.meta}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* XML preview */}
          <div className="h-[400px]">
            <XMLViewer xml={xml} filename={`nfe_${featured.numero}_v4.00.xml`} />
          </div>
        </div>
      </div>
    </div>
  );
}
