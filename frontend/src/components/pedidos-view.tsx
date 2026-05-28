"use client";

import { FileText, Lock, Pencil, Plus, Receipt } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { faturarPedidoAction } from "@/app/(app)/pedidos/actions";
import { PageHeader } from "@/components/fiscal-ui";
import { PedidoDeleteButton } from "@/components/pedido-delete-button";
import { PedidoWizardDialog } from "@/components/pedido-wizard-dialog";
import { Button } from "@/components/ui/button";
import type { PedidoDto, ProductDto } from "@/lib/fiscal-types";
import { brl } from "@/lib/format";
import { formValuesToFormData, pedidoToFormValues } from "@/lib/pedido-form";

type Props = {
  tenantId?: string;
  pedidos: PedidoDto[];
  products: ProductDto[];
};

export function PedidosView({ tenantId, pedidos, products }: Props) {
  const router = useRouter();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editing, setEditing] = useState<PedidoDto | undefined>();
  const [faturarPending, startFaturar] = useTransition();

  function openNew() {
    setEditing(undefined);
    setWizardOpen(true);
  }

  function openEdit(p: PedidoDto) {
    if (!p.editavel) return;
    setEditing(p);
    setWizardOpen(true);
  }

  function quickFaturar(p: PedidoDto) {
    startFaturar(async () => {
      const fd = formValuesToFormData(pedidoToFormValues(p));
      fd.set("pedidoId", p.id);
      const result = await faturarPedidoAction({}, fd);
      if (result.error) alert(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Pedidos Mercado Livre"
        subtitle="Rascunhos editáveis · faturamento gera NF-e com numeração sequencial"
        actions={
          <Button onClick={openNew} disabled={!tenantId || products.length === 0}>
            <Plus className="size-4 mr-2" />
            Novo pedido
          </Button>
        }
      />

      {!tenantId ? (
        <p className="text-muted-foreground">Selecione uma empresa no header.</p>
      ) : products.length === 0 ? (
        <p className="text-muted-foreground">
          Cadastre produtos em <Link href="/produtos" className="text-accent hover:underline">Produtos</Link> primeiro.
        </p>
      ) : (
        <div className="border border-border rounded-lg bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <span className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground">
              Pedidos ({pedidos.length})
            </span>
            <span className="text-[12px] text-muted-foreground">
              {pedidos.filter((p) => p.status === "RASCUNHO").length} rascunho(s)
            </span>
          </div>
          {pedidos.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-[14px]">
              Nenhum pedido ainda. Clique em <strong className="text-foreground">Novo pedido</strong> para começar.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[12px] text-muted-foreground uppercase tracking-tighter border-b border-border">
                    <th className="px-4 py-3 font-medium">Pedido</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Comprador</th>
                    <th className="px-4 py-3 font-medium">Valor</th>
                    <th className="px-4 py-3 font-medium">NF-e</th>
                    <th className="px-4 py-3 font-medium w-[120px]" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pedidos.map((p) => (
                    <tr key={p.id} className="hover:bg-white/2">
                      <td className="px-4 py-3 font-mono text-[13px] text-accent">
                        {p.pedidoMl ?? `RASC-${p.id.slice(0, 8)}`}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-[14px]">{p.comprador.nome}</div>
                        <div className="text-[12px] text-muted-foreground font-mono">{p.comprador.cpf}</div>
                      </td>
                      <td className="px-4 py-3 font-mono">{brl(p.valorTotal)}</td>
                      <td className="px-4 py-3 font-mono text-[13px]">
                        {p.nfe ? (
                          <Link href={`/nfe/${p.nfe.chave}`} className="text-accent hover:underline">
                            {p.nfe.numero}/{p.nfe.serie}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-0.5">
                          {p.editavel ? (
                            <>
                              <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => openEdit(p)} title="Editar">
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8 text-accent"
                                onClick={() => quickFaturar(p)}
                                disabled={faturarPending}
                                title="Faturar"
                              >
                                <Receipt className="size-3.5" />
                              </Button>
                              <PedidoDeleteButton pedido={p} />
                            </>
                          ) : (
                            <>
                              <span className="inline-flex items-center px-2 text-muted-foreground" title="Faturado — somente leitura">
                                <Lock className="size-3.5" />
                              </span>
                              {p.nfe && (
                                <Button type="button" variant="ghost" size="icon" className="size-8" asChild title="Ver NF-e">
                                  <Link href={`/nfe/${p.nfe.chave}`}>
                                    <FileText className="size-3.5" />
                                  </Link>
                                </Button>
                              )}
                              <PedidoDeleteButton pedido={p} />
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <PedidoWizardDialog
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        products={products}
        pedido={editing}
      />

    </div>
  );
}

function StatusBadge({ status }: { status: PedidoDto["status"] }) {
  const isDraft = status === "RASCUNHO";
  return (
    <span
      className={`inline-flex text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
        isDraft ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "bg-success/15 text-success"
      }`}
    >
      {isDraft ? "Rascunho" : "Faturado"}
    </span>
  );
}
