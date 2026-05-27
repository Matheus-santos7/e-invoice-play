import { Link, createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/fiscal-ui";

export const Route = createFileRoute("/_app/nfe/nova")({
  component: NovaNFe,
  head: () => ({ meta: [{ title: "Emitir NF-e — Fiscal Engine" }] }),
});

function NovaNFe() {
  return (
    <div className="p-6 max-w-3xl">
      <Link to="/nfe" className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground hover:text-foreground">
        ← Cancelar
      </Link>

      <PageHeader
        title="Emitir Nova NF-e"
        subtitle="Modelo 55 • Ambiente HOMOLOGAÇÃO • Simulação"
      />

      <div className="border border-accent/30 bg-accent/5 rounded-lg p-4 mb-6">
        <div className="text-[10px] font-bold text-accent uppercase tracking-widest mb-1">
          Em construção
        </div>
        <p className="text-[12px] text-muted-foreground">
          O wizard de emissão (destinatário, itens, tributação, transporte, totais)
          será implementado na próxima iteração junto com o motor declarativo de
          regras tributárias. O fluxo de geração XML, assinatura simulada e
          protocolo já está disponível na visualização das NF-e existentes.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Stub title="1. Destinatário" desc="Busca por CNPJ/CPF, validação de IE, regime tributário" />
        <Stub title="2. Itens" desc="Catálogo de produtos com NCM/CEST automáticos" />
        <Stub title="3. Tributação" desc="ICMS, ICMS-ST, DIFAL, FCP, IPI, PIS, COFINS via regras DSL" />
        <Stub title="4. Transporte" desc="Modalidade, transportadora, volumes — gera CT-e" />
        <Stub title="5. Totais" desc="Cálculo determinístico com cache Redis" />
        <Stub title="6. Emissão" desc="XML v4.00 → assinatura simulada → protocolo fake" />
      </div>
    </div>
  );
}

function Stub({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="border border-border rounded-lg bg-card p-4">
      <div className="text-[11px] font-bold uppercase tracking-wider mb-1">{title}</div>
      <div className="text-[11px] text-muted-foreground">{desc}</div>
    </div>
  );
}
