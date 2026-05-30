"use client";

import { useTransition } from "react";
import { definirUnidadePadraoAction } from "@/app/(app)/unidades-logisticas/actions";
import { Button } from "@/components/ui/button";
import type { UnidadeLogisticaDto } from "@/lib/fiscal-api";

type Props = {
  unidades: UnidadeLogisticaDto[];
};

export function UnidadesLogisticasTable({ unidades }: Props) {
  const [pending, startTransition] = useTransition();

  if (unidades.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Nenhuma unidade cadastrada. Importe a planilha Meli Full acima.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto border border-border rounded-lg">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2">Código</th>
            <th className="px-3 py-2">Nome</th>
            <th className="px-3 py-2">CNPJ</th>
            <th className="px-3 py-2">UF</th>
            <th className="px-3 py-2">Município</th>
            <th className="px-3 py-2">CEP</th>
            <th className="px-3 py-2 w-28" />
          </tr>
        </thead>
        <tbody>
          {unidades.map((u) => (
            <tr key={u.id} className="border-b border-border/60 hover:bg-muted/20">
              <td className="px-3 py-2 font-mono text-xs">{u.codigo}</td>
              <td className="px-3 py-2 max-w-[240px] truncate" title={u.nome}>
                {u.nome}
              </td>
              <td className="px-3 py-2 font-mono text-xs">{u.cnpj}</td>
              <td className="px-3 py-2">{u.endereco.uf}</td>
              <td className="px-3 py-2">{u.endereco.municipio}</td>
              <td className="px-3 py-2 font-mono text-xs">{u.endereco.cep}</td>
              <td className="px-3 py-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await definirUnidadePadraoAction(u.id);
                    })
                  }
                >
                  Padrão remessa
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-3 py-2 text-xs text-muted-foreground">{unidades.length} unidade(s) ativa(s)</p>
    </div>
  );
}
