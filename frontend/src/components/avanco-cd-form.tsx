"use client";

import { useActionState } from "react";
import type { AvancoCdState } from "@/app/(app)/unidades-logisticas/actions";
import { emitirAvancoCdAction } from "@/app/(app)/unidades-logisticas/actions";
import { Button } from "@/components/ui/button";
import type { UnidadeLogisticaDto } from "@/lib/fiscal-api";
import type { ProductDto } from "@/lib/fiscal-types";

type Props = {
  products: ProductDto[];
  unidades: UnidadeLogisticaDto[];
};

export function AvancoCdForm({ products, unidades }: Props) {
  const [state, action, pending] = useActionState<AvancoCdState, FormData>(emitirAvancoCdAction, {});

  if (unidades.length < 2) {
    return (
      <p className="text-sm text-muted-foreground">
        Cadastre pelo menos dois CDs (importação da planilha) para emitir avanço entre unidades.
      </p>
    );
  }

  return (
    <form action={action} className="border border-border rounded-lg bg-card p-4 space-y-3">
      <div className="text-[12px] uppercase font-bold tracking-widest text-muted-foreground">
        Avanço de mercadoria entre CDs (cenário 3)
      </div>
      <p className="text-sm text-muted-foreground">
        Emite remessa simbólica no CD de origem (debita saldo FIFO) e nova remessa física no CD destino, com
        registro de movimentação fiscal.
      </p>

      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">Produto</span>
        <select
          name="productId"
          required
          className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
        >
          <option value="">Selecione…</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.sku} — {p.nome} (estoque {p.estoque})
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">CD origem (saldo)</span>
          <select
            name="unidadeOrigemId"
            required
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
          >
            <option value="">Selecione…</option>
            {unidades.map((u) => (
              <option key={u.id} value={u.id}>
                {u.codigo} — {u.endereco.uf} / {u.endereco.municipio}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">CD destino</span>
          <select
            name="unidadeDestinoId"
            required
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
          >
            <option value="">Selecione…</option>
            {unidades.map((u) => (
              <option key={u.id} value={u.id}>
                {u.codigo} — {u.endereco.uf} / {u.endereco.municipio}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block space-y-1 max-w-[8rem]">
        <span className="text-xs text-muted-foreground">Quantidade</span>
        <input
          type="number"
          name="quantidade"
          min={1}
          defaultValue={1}
          required
          className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
        />
      </label>

      <Button type="submit" disabled={pending || products.length === 0}>
        {pending ? "Emitindo…" : "Emitir avanço entre CDs"}
      </Button>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && (
        <p className="text-sm text-success">
          Avanço emitido. Remessa destino: {state.chaveRemessa?.slice(-8)} · Simbólica:{" "}
          {state.chaveSimbolica?.slice(-8)}
        </p>
      )}
    </form>
  );
}
