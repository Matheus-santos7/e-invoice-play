import type { Metadata } from "next";
import Link from "next/link";
import { FiscalDocumentDeleteButton } from "@/components/fiscal-document-delete-button";
import { PageHeader, StatusBadge } from "@/components/fiscal-ui";
import { resolveActiveTenantId } from "@/lib/active-tenant";
import { listCtes } from "@/lib/fiscal-api";
import { brl, formatChave } from "@/lib/format";

export const metadata: Metadata = { title: "CT-e" };

export default async function CTePage() {
  const tenantId = await resolveActiveTenantId();
  const ctes = await listCtes(tenantId);

  return (
    <div className="p-6">
      <PageHeader title="CT-e Transportes" subtitle="Conhecimento de transporte eletrônico — dados via API" />
      <div className="border border-border rounded-lg bg-card overflow-hidden">
        {ctes.length === 0 ? (
          <div className="p-6 text-muted-foreground">Nenhum CT-e para este tenant.</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[12px] text-muted-foreground uppercase tracking-tighter border-b border-border">
                <th className="px-4 py-3 font-medium">Número</th>
                <th className="px-4 py-3 font-medium">NF-e ref.</th>
                <th className="px-4 py-3 font-medium">Chave</th>
                <th className="px-4 py-3 font-medium">Modal</th>
                <th className="px-4 py-3 font-medium">Origem → Destino</th>
                <th className="px-4 py-3 font-medium">Valor Frete</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium w-12" aria-label="Ações" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ctes.map((c) => (
                <tr key={c.chave} className="hover:bg-white/2 transition-colors">
                  <td className="px-4 py-3 font-mono">
                    <Link href={`/cte/${c.chave}`} className="text-accent hover:underline">
                      {c.numero}/{c.serie}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-[12px]">
                    {c.nfeChaveRef ? (
                      <Link href={`/nfe/${c.nfeChaveRef}`} className="text-accent hover:underline">
                        {c.nfeChaveRef.slice(-8)}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-[13px] text-muted-foreground">{formatChave(c.chave)}</td>
                  <td className="px-4 py-3">{c.modal}</td>
                  <td className="px-4 py-3 text-[14px]">
                    {c.origem} → {c.destino}
                  </td>
                  <td className="px-4 py-3 font-mono">{brl(c.valor)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <FiscalDocumentDeleteButton tipo="cte" chave={c.chave} label={`CT-e ${c.numero}`} />
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
