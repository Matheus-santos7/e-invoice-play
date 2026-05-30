import type { Metadata } from "next";
import { PageHeader } from "@/components/fiscal-ui";
import { AvancoCdForm } from "@/components/avanco-cd-form";
import { UnidadeLogisticaImportForm } from "@/components/unidade-logistica-import-form";
import { UnidadesLogisticasTable } from "@/components/unidades-logisticas-table";
import { resolveActiveTenantId } from "@/lib/active-tenant";
import { listMovimentacoesProduto, listProducts, listUnidadesLogisticas } from "@/lib/fiscal-api";

export const metadata: Metadata = { title: "Unidades Logísticas" };

type Props = {
  searchParams: Promise<{ q?: string }>;
};

export default async function UnidadesLogisticasPage({ searchParams }: Props) {
  const tenantId = await resolveActiveTenantId();
  const { q } = await searchParams;

  if (!tenantId) {
    return (
      <>
        <PageHeader title="Unidades Logísticas" subtitle="CDs Mercado Livre Full" />
        <p className="text-sm text-muted-foreground">Selecione uma empresa no header.</p>
      </>
    );
  }

  const [unidades, products, movimentacoes] = await Promise.all([
    listUnidadesLogisticas(tenantId, { q: q?.trim() || undefined, ativa: true }),
    listProducts(tenantId),
    listMovimentacoesProduto(tenantId, { limit: 30 }),
  ]);

  return (
    <>
      <PageHeader
        title="Unidades Logísticas"
        subtitle="Importação Meli Full, destino de remessa e avanço entre CDs"
      />

      <div className="space-y-8">
        <UnidadeLogisticaImportForm />

        <section className="space-y-3">
          <form className="flex gap-2 items-end">
            <label className="flex-1 space-y-1">
              <span className="text-xs text-muted-foreground">Buscar código, nome ou UF</span>
              <input
                name="q"
                defaultValue={q ?? ""}
                placeholder="Ex.: SP02, Cajamar, SC"
                className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              />
            </label>
            <button
              type="submit"
              className="rounded border border-border px-3 py-1.5 text-sm hover:bg-muted"
            >
              Filtrar
            </button>
          </form>
          <UnidadesLogisticasTable unidades={unidades} />
        </section>

        <AvancoCdForm products={products} unidades={unidades} />

        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Movimentações recentes (operação fiscal)</h2>
          {movimentacoes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma movimentação registrada ainda.</p>
          ) : (
            <div className="overflow-x-auto border border-border rounded-lg text-sm">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                    <th className="px-3 py-2">Data</th>
                    <th className="px-3 py-2">Operação</th>
                    <th className="px-3 py-2">Qtd</th>
                    <th className="px-3 py-2">Origem → Destino</th>
                    <th className="px-3 py-2">NF-e</th>
                  </tr>
                </thead>
                <tbody>
                  {movimentacoes.map((m) => (
                    <tr key={m.id} className="border-b border-border/60">
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(m.createdAt).toLocaleString("pt-BR")}
                      </td>
                      <td className="px-3 py-2">{m.tipoOperacao}</td>
                      <td className="px-3 py-2">{m.quantidade}</td>
                      <td className="px-3 py-2 text-xs">
                        {m.unidadeOrigem?.codigo ?? "—"} → {m.unidadeDestino?.codigo ?? "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {m.nfe?.chave?.slice(-8)}
                        {m.nfeSecundaria ? ` + ${m.nfeSecundaria.chave.slice(-8)}` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
