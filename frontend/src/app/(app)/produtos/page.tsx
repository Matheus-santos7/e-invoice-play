import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/fiscal-ui";
import { ProdutoCard } from "@/components/produto-card";
import { ProdutoPlanilhaToolbar } from "@/components/produto-planilha-toolbar";
import { Button } from "@/components/ui/button";
import { resolveActiveTenantId } from "@/lib/active-tenant";
import { listProducts } from "@/lib/fiscal-api";

export const metadata: Metadata = { title: "Produtos" };

export default async function ProdutosPage() {
  const tenantId = await resolveActiveTenantId();
  const produtos = await listProducts(tenantId);

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Catálogo de Produtos"
        subtitle="Itens NF-e — bloco &lt;prod&gt; (cProd, NCM, CEST, CFOP, preço…)"
        actions={
          <Button asChild>
            <Link href="/produtos/novo">Novo produto</Link>
          </Button>
        }
      />

      <ProdutoPlanilhaToolbar tenantId={tenantId} products={produtos} />

      {!tenantId ? (
        <div className="text-muted-foreground">Cadastre uma empresa e selecione-a no header.</div>
      ) : produtos.length === 0 ? (
        <div className="text-muted-foreground">
          Nenhum produto para esta empresa. Importe uma planilha,{" "}
          <Link href="/produtos/novo" className="text-accent hover:underline">
            cadastre manualmente
          </Link>{" "}
          ou baixe o modelo CSV acima.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {produtos.map((p) => (
            <ProdutoCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
