"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, useActionState } from "react";
import { deleteProdutoAction, updateProdutoModalAction } from "@/app/(app)/produtos/actions";
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
import { ProductFormFields } from "@/components/product-form-fields";
import type { ProductDto } from "@/lib/fiscal-types";
import { brl } from "@/lib/format";

export function ProdutoCard({ product }: { product: ProductDto }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePending, startDelete] = useTransition();

  const boundUpdate = updateProdutoModalAction.bind(null, product.id);
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
            aria-label={`Editar ${product.nome}`}
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-destructive"
            aria-label={`Excluir ${product.nome}`}
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>

        <div className="pr-16">
          <div className="text-[12px] uppercase font-bold tracking-widest text-muted-foreground font-mono">{product.sku}</div>
          <div className="text-base font-bold line-clamp-2">{product.nome}</div>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[13px]">
          <div>
            <span className="text-muted-foreground">NCM:</span> {product.ncm}
          </div>
          <div>
            <span className="text-muted-foreground">CEST:</span> {product.cest}
          </div>
          <div>
            <span className="text-muted-foreground">CFOP:</span> {product.cfop}
          </div>
          <div>
            <span className="text-muted-foreground">Orig.:</span> {product.origem}
          </div>
          {product.ean && (
            <div className="col-span-2 truncate">
              <span className="text-muted-foreground">EAN:</span> {product.ean}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border font-mono text-[13px]">
          <span className="text-muted-foreground">
            {product.unidade} · estoque {product.estoque}
          </span>
          <span className="font-bold text-accent">{brl(product.preco)}</span>
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar produto</DialogTitle>
            <DialogDescription>Bloco NF-e &lt;prod&gt; — {product.sku}</DialogDescription>
          </DialogHeader>
          <form action={editAction} className="space-y-4">
            {editState.error && <FormError error={editState.error} />}
            <ProductFormFields
              product={product}
              draft={editState.values}
              fieldErrors={editState.fieldErrors}
              idPrefix={`edit-${product.id}`}
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
            <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{product.nome}</strong> ({product.sku}) será removido do catálogo desta empresa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deletePending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                startDelete(async () => {
                  const result = await deleteProdutoAction(product.id);
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
