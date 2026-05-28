"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { EmpresaFormState } from "@/lib/empresa-form";
import { Button } from "@/components/ui/button";
import { TenantFormFields } from "@/components/tenant-form-fields";
import type { TenantDto } from "@/lib/fiscal-types";

type Props = {
  tenant?: TenantDto;
  action: (prev: EmpresaFormState, formData: FormData) => Promise<EmpresaFormState>;
  submitLabel: string;
};

export function TenantForm({ tenant, action, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="max-w-xl space-y-4 border border-border rounded-lg bg-card p-6">
      {state.error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[14px] text-destructive">
          {state.error}
        </div>
      )}

      <TenantFormFields tenant={tenant} draft={state.values} fieldErrors={state.fieldErrors} idPrefix="nova" />

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : submitLabel}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/empresas">Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
