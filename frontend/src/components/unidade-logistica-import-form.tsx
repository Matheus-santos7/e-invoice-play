"use client";

import { useActionState } from "react";
import type { UnidadeImportState } from "@/app/(app)/unidades-logisticas/actions";
import { importarUnidadesLogisticasAction } from "@/app/(app)/unidades-logisticas/actions";
import { Button } from "@/components/ui/button";

export function UnidadeLogisticaImportForm() {
  const [state, action, pending] = useActionState<UnidadeImportState, FormData>(
    importarUnidadesLogisticasAction,
    {},
  );

  return (
    <form action={action} className="border border-border rounded-lg bg-card p-4 space-y-3">
      <div className="text-[12px] uppercase font-bold tracking-widest text-muted-foreground">
        Importar planilha Unidades Logísticas Meli Full (.xlsx)
      </div>
      <p className="text-sm text-muted-foreground">
        Colunas esperadas: Unidade, CNPJ, Inscrição Estadual, Logradouro, Número, Cidade, UF, CEP.
        CNPJs duplicados são consolidados; o CEP é usado para preencher bairro e código IBGE quando possível.
      </p>
      <input
        type="file"
        name="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-foreground"
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Importando…" : "Importar unidades"}
      </Button>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && (
        <p className="text-sm text-success">
          Importação concluída: {state.created} criada(s), {state.updated} atualizada(s), {state.unicos}{" "}
          CNPJ(s) únicos.
        </p>
      )}
      {state.parseErrors && state.parseErrors.length > 0 && (
        <p className="text-xs text-amber-500">
          {state.parseErrors.length} aviso(s) de linha(s) ignorada(s) ou com inconsistência.
        </p>
      )}
    </form>
  );
}
