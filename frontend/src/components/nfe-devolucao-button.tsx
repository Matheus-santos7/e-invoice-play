"use client";

import { Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { devolverVendaAction } from "@/app/(app)/nfe/actions";
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

type Props = {
  chave: string;
  label: string;
  jaDevolvida?: boolean;
};

export function NfeDevolucaoButton({ chave, label, jaDevolvida }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 text-muted-foreground hover:text-amber-500 disabled:opacity-40"
        aria-label={`Emitir devolução da venda ${label}`}
        title={jaDevolvida ? "Venda já devolvida" : "Emitir devolução desta venda"}
        disabled={jaDevolvida}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        <Undo2 className="size-3.5" />
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Emitir devolução da venda {label}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Será emitida uma <strong className="text-foreground">NF-e de devolução</strong> referenciando
                  esta venda, espelhando os impostos originais.
                </p>
                <p>
                  O saldo consumido retornará às <strong className="text-foreground">remessas</strong> da cadeia
                  (estorno FIFO): remessa → retorno → venda → devolução.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p className="text-[13px] text-destructive px-1">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              className="bg-amber-500 text-black hover:bg-amber-500/90"
              onClick={(e) => {
                e.preventDefault();
                startTransition(async () => {
                  const result = await devolverVendaAction(chave);
                  if (result.error) {
                    setError(result.error);
                    return;
                  }
                  setOpen(false);
                  router.refresh();
                });
              }}
            >
              {pending ? "Emitindo…" : "Emitir devolução"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
