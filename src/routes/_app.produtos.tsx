import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/fiscal-ui";

export const Route = createFileRoute("/_app/produtos")({
  component: Produtos,
  head: () => ({ meta: [{ title: "Produtos — Fiscal Engine" }] }),
});

const PRODUTOS = [
  { sku: "SKU-92381", nome: "Camiseta básica algodão M", ncm: "61091000", cest: "2804600", origem: 0, unidade: "UN", preco: 39.9 },
  { sku: "SKU-92382", nome: "Tênis esportivo masc 42", ncm: "64041100", cest: "2804900", origem: 0, unidade: "PR", preco: 249.9 },
  { sku: "SKU-92383", nome: "Smartphone 128GB", ncm: "85171231", cest: "2106500", origem: 2, unidade: "UN", preco: 1899.0 },
  { sku: "SKU-92384", nome: "Cabo HDMI 2m", ncm: "85444900", cest: "2108200", origem: 1, unidade: "UN", preco: 24.9 },
  { sku: "SKU-92385", nome: "Mouse sem fio", ncm: "84716054", cest: "2106600", origem: 1, unidade: "UN", preco: 89.9 },
];

function Produtos() {
  return (
    <div className="p-6">
      <PageHeader title="Catálogo de Produtos" subtitle="SKUs com classificação fiscal" />
      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[10px] text-muted-foreground uppercase tracking-tighter border-b border-border">
              <th className="px-4 py-3 font-medium">SKU</th>
              <th className="px-4 py-3 font-medium">Descrição</th>
              <th className="px-4 py-3 font-medium">NCM</th>
              <th className="px-4 py-3 font-medium">CEST</th>
              <th className="px-4 py-3 font-medium">Orig.</th>
              <th className="px-4 py-3 font-medium">Un.</th>
              <th className="px-4 py-3 font-medium">Preço</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {PRODUTOS.map((p) => (
              <tr key={p.sku} className="hover:bg-white/2 transition-colors">
                <td className="px-4 py-3 font-mono text-[11px] text-accent">{p.sku}</td>
                <td className="px-4 py-3">{p.nome}</td>
                <td className="px-4 py-3 font-mono">{p.ncm}</td>
                <td className="px-4 py-3 font-mono text-muted-foreground">{p.cest}</td>
                <td className="px-4 py-3 font-mono">{p.origem}</td>
                <td className="px-4 py-3">{p.unidade}</td>
                <td className="px-4 py-3 font-mono">{p.preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
