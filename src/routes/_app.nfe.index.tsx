import { Link, createFileRoute } from "@tanstack/react-router";
import { PageHeader, StatusBadge } from "@/components/fiscal-ui";
import { NFES, brl, formatChave } from "@/lib/fiscal-mock";

export const Route = createFileRoute("/_app/nfe/")({
  component: NFeList,
  head: () => ({ meta: [{ title: "NF-e Emitidas — Fiscal Engine" }] }),
});

function NFeList() {
  return (
    <div className="p-6">
      <PageHeader
        title="NF-e Emitidas"
        subtitle="Notas fiscais eletrônicas modelo 55 — simulação"
        actions={
          <Link
            to="/nfe/nova"
            className="px-4 py-2 bg-accent text-accent-foreground font-bold rounded text-[11px] tracking-wider hover:opacity-90"
          >
            EMITIR NF-E
          </Link>
        }
      />

      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[10px] text-muted-foreground uppercase tracking-tighter border-b border-border">
              <th className="px-4 py-3 font-medium">Nº / Série</th>
              <th className="px-4 py-3 font-medium">Chave de Acesso</th>
              <th className="px-4 py-3 font-medium">CFOP</th>
              <th className="px-4 py-3 font-medium">Destinatário</th>
              <th className="px-4 py-3 font-medium">Valor</th>
              <th className="px-4 py-3 font-medium">ICMS</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {NFES.map((nfe) => (
              <tr key={nfe.chave} className="hover:bg-white/2 transition-colors">
                <td className="px-4 py-3 font-mono text-[11px]">
                  <Link
                    to="/nfe/$chave"
                    params={{ chave: nfe.chave }}
                    className="text-accent hover:underline"
                  >
                    {nfe.numero}/{nfe.serie}
                  </Link>
                </td>
                <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                  {formatChave(nfe.chave)}
                </td>
                <td className="px-4 py-3 font-mono">{nfe.cfop}</td>
                <td className="px-4 py-3">
                  <div className="font-medium">{nfe.destinatario.nome}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    {nfe.destinatario.doc} • {nfe.destinatario.uf}
                  </div>
                </td>
                <td className="px-4 py-3 font-mono">{brl(nfe.valor)}</td>
                <td className="px-4 py-3 font-mono text-muted-foreground">
                  {brl(nfe.valorICMS)} <span className="text-[10px]">({nfe.aliqICMS}%)</span>
                </td>
                <td className="px-4 py-3"><StatusBadge status={nfe.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
