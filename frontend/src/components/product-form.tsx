"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { ProdutoFormState } from "@/lib/produto-form";
import { Button } from "@/components/ui/button";
import { ProductFormFields } from "@/components/product-form-fields";
import type { ProductDto } from "@/lib/fiscal-types";

type Props = {
  product?: ProductDto;
  action: (prev: ProdutoFormState, formData: FormData) => Promise<ProdutoFormState>;
  submitLabel: string;
  cancelHref?: string;
};

export function ProductForm({ product, action, submitLabel, cancelHref = "/produtos" }: Props) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="max-w-xl space-y-4 border border-border rounded-lg bg-card p-6">
      {state.error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[14px] text-destructive">
          {state.error}
        </div>
      )}

      <ProductFormFields product={product} draft={state.values} fieldErrors={state.fieldErrors} idPrefix="novo-prod" />

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : submitLabel}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href={cancelHref}>Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
