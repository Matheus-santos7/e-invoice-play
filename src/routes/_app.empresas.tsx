import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/fiscal-ui";
import { TENANTS } from "@/lib/fiscal-mock";

export const Route = createFileRoute("/_app/empresas")({
  component: Empresas,
  head: () => ({ meta: [{ title: "Empresas — Fiscal Engine" }] }),
});

function Empresas() {
  return (
    <div className="p-6">
      <PageHeader title="Empresas" subtitle="Tenants e filiais cadastradas no ambiente" />
      <div className="grid grid-cols-2 gap-4">
        {TENANTS.map((t) => (
          <div key={t.id} className="border border-border rounded-lg bg-card p-5 space-y-3">
            <div>
              <div className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">{t.uf}</div>
              <div className="text-base font-bold">{t.razaoSocial}</div>
              <div className="text-[11px] text-muted-foreground">{t.nomeFantasia}</div>
            </div>
            <div className="space-y-1 font-mono text-[11px]">
              <div><span className="text-muted-foreground">CNPJ:</span> {t.cnpj}</div>
              <div><span className="text-muted-foreground">IE:</span> {t.ie}</div>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-border">
              <span className="size-1.5 rounded-full bg-accent animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-accent">{t.ambiente}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
