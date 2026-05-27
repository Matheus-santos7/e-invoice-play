import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/fiscal-ui";

export const Route = createFileRoute("/_app/regras")({
  component: Regras,
  head: () => ({ meta: [{ title: "Regras Tributárias — Fiscal Engine" }] }),
});

const RULES = [
  { id: "R-001", nome: "ICMS Venda Interna SP", uf: "SP", cfop: "5102", aliquota: "18%", tipo: "ICMS" },
  { id: "R-002", nome: "ICMS Interestadual S→SE", uf: "SP→MG", cfop: "6108", aliquota: "12%", tipo: "ICMS" },
  { id: "R-003", nome: "DIFAL Consumidor Final", uf: "*→*", cfop: "6404", aliquota: "calc", tipo: "DIFAL" },
  { id: "R-004", nome: "Substituição Tributária — Eletrônicos", uf: "SP", cfop: "5405", aliquota: "MVA 38,24%", tipo: "ICMS-ST" },
  { id: "R-005", nome: "FCP Rio de Janeiro", uf: "RJ", cfop: "6108", aliquota: "2%", tipo: "FCP" },
  { id: "R-006", nome: "PIS/COFINS Regime Não-Cumulativo", uf: "*", cfop: "*", aliquota: "1,65% / 7,6%", tipo: "PIS/COFINS" },
];

function Regras() {
  return (
    <div className="p-6">
      <PageHeader title="Regras Tributárias" subtitle="Motor declarativo de cálculo fiscal (DSL JSON/YAML)" />
      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[10px] text-muted-foreground uppercase tracking-tighter border-b border-border">
              <th className="px-4 py-3 font-medium">ID</th>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">UF</th>
              <th className="px-4 py-3 font-medium">CFOP</th>
              <th className="px-4 py-3 font-medium">Alíquota</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {RULES.map((r) => (
              <tr key={r.id} className="hover:bg-white/2 transition-colors">
                <td className="px-4 py-3 font-mono text-[11px] text-accent">{r.id}</td>
                <td className="px-4 py-3">{r.nome}</td>
                <td className="px-4 py-3"><span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{r.tipo}</span></td>
                <td className="px-4 py-3 font-mono">{r.uf}</td>
                <td className="px-4 py-3 font-mono">{r.cfop}</td>
                <td className="px-4 py-3 font-mono">{r.aliquota}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
