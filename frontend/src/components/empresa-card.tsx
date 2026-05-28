"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, useActionState } from "react";
import {
  deleteEmpresaAction,
  updateEmpresaModalAction,
} from "@/app/(app)/empresas/actions";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TenantFormFields } from "@/components/tenant-form-fields";
import type { TenantDto } from "@/lib/fiscal-types";

export function EmpresaCard({ tenant }: { tenant: TenantDto }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePending, startDelete] = useTransition();

  const boundUpdate = updateEmpresaModalAction.bind(null, tenant.id);
  const [editState, editAction, editPending] = useActionState(boundUpdate, {});

  useEffect(() => {
    if (editState.success) {
      setEditOpen(false);
      router.refresh();
    }
  }, [editState.success, router]);

  return (
    <>
      <div className="relative border border-border rounded-lg bg-card p-5 space-y-3">
        <div className="absolute top-3 right-3 flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground"
            aria-label={`Editar ${tenant.nomeFantasia}`}
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-destructive"
            aria-label={`Excluir ${tenant.nomeFantasia}`}
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>

        <div className="pr-16">
          <div className="text-[12px] uppercase font-bold tracking-widest text-muted-foreground">{tenant.uf}</div>
          <div className="text-base font-bold">{tenant.razaoSocial}</div>
          <div className="text-[13px] text-muted-foreground">{tenant.nomeFantasia}</div>
        </div>

        <div className="space-y-1 font-mono text-[13px]">
          <div>
            <span className="text-muted-foreground">CNPJ:</span> {tenant.cnpj}
          </div>
          <div>
            <span className="text-muted-foreground">IE:</span> {tenant.ie}
          </div>
          <div className="text-muted-foreground truncate">
            {tenant.logradouro}, {tenant.numero} — {tenant.municipio}/{tenant.uf}
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-border">
          <span className="size-1.5 rounded-full bg-accent animate-pulse" />
          <span className="text-[12px] font-bold uppercase tracking-widest text-accent">{tenant.ambiente}</span>
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar empresa</DialogTitle>
            <DialogDescription>Dados do emitente NF-e — {tenant.razaoSocial}</DialogDescription>
          </DialogHeader>
          <form action={editAction} className="space-y-4">
            {editState.error && <FormError error={editState.error} />}
            <TenantFormFields
              tenant={tenant}
              draft={editState.values}
              fieldErrors={editState.fieldErrors}
              idPrefix={`edit-${tenant.id}`}
            />
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={editPending}>
                {editPending ? "Salvando…" : "Salvar"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir empresa?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{tenant.razaoSocial}</strong> e todos os dados vinculados (produtos, NF-e, CT-e, eventos, etc.)
              serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deletePending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                startDelete(async () => {
                  const result = await deleteEmpresaAction(tenant.id);
                  if (result.error) {
                    alert(result.error);
                    return;
                  }
                  setDeleteOpen(false);
                  router.refresh();
                })
              }
            >
              {deletePending ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function FormError({ error }: { error: string }) {
  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[14px] text-destructive">
      {error}
    </div>
  );
}
