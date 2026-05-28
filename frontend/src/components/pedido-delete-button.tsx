"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { excluirPedidoAction } from "@/app/(app)/pedidos/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { PedidoDto } from "@/lib/fiscal-types";

type Props = {
  pedido: PedidoDto;
  className?: string;
};

export function PedidoDeleteButton({ pedido, className }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!pedido.excluivel) return null;

  const isFaturado = pedido.status === "FATURADO";
  const label = pedido.pedidoMl ?? `RASC-${pedido.id.slice(0, 8)}`;

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={className ?? "size-8 text-muted-foreground hover:text-destructive"}
        aria-label={`Excluir pedido ${label}`}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        <Trash2 className="size-3.5" />
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isFaturado ? "Remover pedido faturado?" : "Excluir pedido?"}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  O pedido de <strong className="text-foreground">{pedido.comprador.nome}</strong> ({label}) será
                  removido da lista.
                </p>
                {isFaturado && pedido.nfe ? (
                  <p>
                    A NF-e <strong className="text-foreground font-mono">{pedido.nfe.numero}/{pedido.nfe.serie}</strong>{" "}
                    permanece emitida. A numeração não será reutilizada e o pedido não poderá ser editado novamente.
                  </p>
                ) : (
                  <p>Rascunhos excluídos não geram NF-e.</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <p className="text-[13px] text-destructive px-1">{error}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                startTransition(async () => {
                  const result = await excluirPedidoAction(pedido.id);
                  if (result.error) {
                    setError(result.error);
                    return;
                  }
                  setOpen(false);
                  router.refresh();
                })
              }
            >
              {pending ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
