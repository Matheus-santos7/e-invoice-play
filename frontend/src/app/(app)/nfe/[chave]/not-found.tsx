import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "NF-e não encontrada" };

export default function NFeNotFound() {
  return (
    <div className="p-6">
      <p className="text-sm text-muted-foreground">NF-e não encontrada para a chave informada.</p>
      <Link href="/nfe" className="text-accent text-[13px] uppercase font-bold mt-4 inline-block hover:underline">
        ← Voltar
      </Link>
    </div>
  );
}
