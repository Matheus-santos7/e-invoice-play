import type { Metadata } from "next";
import Link from "next/link";
import { FiscalDocumentDeleteButton } from "@/components/fiscal-document-delete-button";
import { PageHeader, StatusBadge } from "@/components/fiscal-ui";
import { resolveActiveTenantId } from "@/lib/active-tenant";
import { listNfes } from "@/lib/fiscal-api";
import { brl, formatChave } from "@/lib/format";

export const metadata: Metadata = { title: "NF-e Emitidas" };

export default async function NFeListPage() {
  const tenantId = await resolveActiveTenantId();
  const nfes = await listNfes(tenantId);

  return (
    <div className="p-6">
      <PageHeader
        title="NF-e Emitidas"
        subtitle="Notas fiscais eletrônicas modelo 55 — dados via API"
        actions={
          <Link
            href="/nfe/nova"
            className="px-4 py-2 bg-accent text-accent-foreground font-bold rounded text-[13px] tracking-wider hover:opacity-90"
          >
            EMITIR NF-E
          </Link>
        }
      />

      <div className="border border-border rounded-lg bg-card overflow-hidden">
        {nfes.length === 0 ? (
          <div className="p-6 text-muted-foreground">Nenhuma NF-e encontrada para o tenant selecionado.</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[12px] text-muted-foreground uppercase tracking-tighter border-b border-border">
                <th className="px-4 py-3 font-medium">Nº / Série</th>
                <th className="px-4 py-3 font-medium">Chave de Acesso</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">CFOP</th>
                <th className="px-4 py-3 font-medium">Qtd</th>
                <th className="px-4 py-3 font-medium">Destinatário</th>
                <th className="px-4 py-3 font-medium">Valor</th>
                <th className="px-4 py-3 font-medium">ICMS</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium w-12" aria-label="Ações" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {nfes.map((nfe) => (
                <tr key={nfe.chave} className="hover:bg-white/2 transition-colors">
                  <td className="px-4 py-3 font-mono text-[13px]">
                    <Link href={`/nfe/${nfe.chave}`} className="text-accent hover:underline">
                      {nfe.numero}/{nfe.serie}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-[13px] text-muted-foreground">{formatChave(nfe.chave)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        nfe.tipo === "REMESSA"
                          ? "text-[11px] font-bold uppercase tracking-wider text-amber-500"
                          : "text-[11px] font-bold uppercase tracking-wider text-muted-foreground"
                      }
                    >
                      {nfe.tipo === "REMESSA"
                        ? "Remessa"
                        : nfe.tipo === "RETORNO_SIMBOLICO"
                          ? "Retorno"
                          : nfe.tipo === "DEVOLUCAO"
                            ? "Devolução"
                            : "Venda"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono">{nfe.cfop}</td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">
                    {nfe.quantidade}
                    {nfe.tipo === "REMESSA" && nfe.saldoDisponivel != null && (
                      <span className="block text-[11px] text-amber-500/90">saldo {nfe.saldoDisponivel}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{nfe.destinatario.nome}</div>
                    <div className="text-[12px] text-muted-foreground font-mono">
                      {nfe.destinatario.doc} • {nfe.destinatario.uf}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono">{brl(nfe.valor)}</td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">
                    {brl(nfe.valorICMS)} <span className="text-[12px]">({nfe.aliqICMS}%)</span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={nfe.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <FiscalDocumentDeleteButton
                      tipo="nfe"
                      chave={nfe.chave}
                      label={`${nfe.numero}/${nfe.serie}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
