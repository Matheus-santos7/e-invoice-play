import type { Metadata } from "next";
import Link from "next/link";
import { KPI, SectionHeader, StatusBadge } from "@/components/fiscal-ui";
import { XMLViewer } from "@/components/xml-viewer";
import { resolveActiveTenantId } from "@/lib/active-tenant";
import { TimelineChains } from "@/components/timeline-chains";
import { getEmitente, getFiscalEmitterSettings, listNfes, listProducts, listTimeline } from "@/lib/fiscal-api";
import { brl, formatChave } from "@/lib/format";
import { buildNFeXML } from "@/lib/xml-generator";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Cockpit fiscal e logístico para simulação de operações Mercado Livre Full.",
};

export default async function DashboardPage() {
  const tenantId = await resolveActiveTenantId();
  const [nfes, timeline, produtos] = await Promise.all([
    listNfes(tenantId),
    listTimeline(tenantId),
    listProducts(tenantId),
  ]);
  const featured = nfes[0];
  const featuredProduct = featured ? produtos.find((p) => p.ncm === featured.ncm) ?? produtos[0] : undefined;
  const xml =
    featured && tenantId
      ? buildNFeXML(
          featured,
          await getEmitente(featured.tenantId),
          featuredProduct,
          (await getFiscalEmitterSettings(featured.tenantId))?.settings ?? null,
        )
      : "";

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <KPI label="NF-e (tenant)" value={String(nfes.length)} hint="Notas retornadas pela API" hintTone="success" />
        <KPI label="ICMS (amostra)" value={featured ? brl(featured.valorICMS) : brl(0)} hint="Primeira NF-e da lista" hintTone="muted" />
        <KPI
          label="Cadeias fiscais"
          value={String(timeline.reduce((acc, g) => acc + g.cenarios.length, 0))}
          hint={`${timeline.filter((g) => g.remessaChave).length} remessa(s) · cenários`}
          hintTone="accent"
        />
        <KPI label="Conformidade" value="100%" hint="Simulação" hintTone="success" />
      </div>

      <div className="grid grid-cols-12 gap-6 items-start">
        <div className="col-span-8 border border-border rounded-lg bg-card overflow-hidden animate-slide-in">
          <SectionHeader
            title="Últimas Notas Fiscais"
            right={
              <Link
                href="/nfe"
                className="text-[12px] font-bold uppercase tracking-wider text-accent hover:underline"
              >
                Ver todas
              </Link>
            }
          />
          {nfes.length === 0 ? (
            <div className="p-6 text-muted-foreground text-[14px]">
              Nenhuma NF-e para este tenant. Confirme o seed do backend e a variável{" "}
              <span className="font-mono">NEXT_PUBLIC_API_URL</span>.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[12px] text-muted-foreground uppercase tracking-tighter border-b border-border">
                  <th className="px-4 py-3 font-medium">Chave de Acesso</th>
                  <th className="px-4 py-3 font-medium">Destinatário</th>
                  <th className="px-4 py-3 font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {nfes.map((nfe, i) => (
                  <tr
                    key={nfe.chave}
                    className={`hover:bg-white/2 transition-colors ${
                      i === 0 ? "border-l-2 border-l-accent" : ""
                    }`}
                  >
                    <td
                      className={`px-4 py-3 font-mono text-[13px] ${
                        i === 0 ? "text-accent/80" : "text-muted-foreground"
                      }`}
                    >
                      <Link href={`/nfe/${nfe.chave}`} className="hover:underline">
                        {formatChave(nfe.chave)}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{nfe.destinatario.nome}</div>
                      <div className="text-[12px] text-muted-foreground font-mono">{nfe.destinatario.doc}</div>
                    </td>
                    <td className="px-4 py-3 font-mono">{brl(nfe.valor)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={nfe.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="col-span-4 space-y-6">
          <div className="border border-border rounded-lg bg-card animate-slide-in">
            <SectionHeader title="Timeline — Cadeias de NF-e" />
            <TimelineChains groups={timeline} />
          </div>

          {featured && xml ? (
            <div className="h-[400px]">
              <XMLViewer xml={xml} filename={`nfe_${featured.numero}_v4.00.xml`} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
