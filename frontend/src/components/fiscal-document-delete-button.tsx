"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { excluirCteAction } from "@/app/(app)/cte/actions";
import { excluirNfeAction } from "@/app/(app)/nfe/actions";
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
  tipo: "nfe" | "cte";
  chave: string;
  label: string;
  className?: string;
};

export function FiscalDocumentDeleteButton({ tipo, chave, label, className }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const titulo = tipo === "nfe" ? "Remover NF-e da lista?" : "Remover CT-e da lista?";
  const docLabel = tipo === "nfe" ? "NF-e" : "CT-e";

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={className ?? "size-8 text-muted-foreground hover:text-destructive"}
        aria-label={`Remover ${docLabel} ${label}`}
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
            <AlertDialogTitle>{titulo}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  O documento <strong className="text-foreground">{label}</strong> deixará de aparecer na
                  listagem.
                </p>
                <p>
                  Os dados permanecem no banco para auditoria e histórico fiscal. Esta ação não cancela o
                  documento na SEFAZ.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p className="text-[13px] text-destructive px-1">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                startTransition(async () => {
                  const result =
                    tipo === "nfe" ? await excluirNfeAction(chave) : await excluirCteAction(chave);
                  if (result.error) {
                    setError(result.error);
                    return;
                  }
                  setOpen(false);
                  router.refresh();
                })
              }
            >
              {pending ? "Removendo…" : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
