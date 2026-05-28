import type { Metadata } from "next";
import Link from "next/link";
import { createEmpresaAction } from "../actions";
import { PageHeader } from "@/components/fiscal-ui";
import { TenantForm } from "@/components/tenant-form";

export const metadata: Metadata = { title: "Nova empresa" };

export default function NovaEmpresaPage() {
  return (
    <div className="p-6">
      <Link
        href="/empresas"
        className="text-[12px] uppercase font-bold tracking-widest text-muted-foreground hover:text-foreground"
      >
        ← Voltar
      </Link>
      <PageHeader title="Nova empresa" subtitle="Cadastro de emitente / filial" />
      <TenantForm action={createEmpresaAction} submitLabel="Criar empresa" />
    </div>
  );
}
