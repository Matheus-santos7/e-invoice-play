import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/fiscal-ui";
import { Sparkles, TrendingDown, AlertTriangle, Lightbulb } from "lucide-react";

export const Route = createFileRoute("/_app/ia")({
  component: IA,
  head: () => ({ meta: [{ title: "IA Insights — Fiscal Engine" }] }),
});

const INSIGHTS = [
  {
    icon: AlertTriangle,
    tone: "accent" as const,
    title: "Possível CFOP incorreto detectado",
    desc: "47 NF-e dos últimos 7 dias usaram CFOP 6404 para vendas intra-SP. CFOP esperado: 5102/5405. Confiança: 92%.",
    action: "Revisar regra R-003",
  },
  {
    icon: TrendingDown,
    tone: "success" as const,
    title: "Anomalia: queda de ICMS calculado",
    desc: "ICMS médio caiu 14% nas vendas para MG. Hipótese: ativação indevida de benefício fiscal Pró-Emprego.",
    action: "Abrir análise",
  },
  {
    icon: Lightbulb,
    tone: "muted" as const,
    title: "Sugestão de regra: FCP automático para AL/PE",
    desc: "RAG identificou 12 NF-e sem FCP para destinos AL/PE em produtos sujeitos. Sugere criar regra derivada de R-005.",
    action: "Gerar rascunho",
  },
];

function IA() {
  return (
    <div className="p-6">
      <PageHeader
        title="IA Fiscal Insights"
        subtitle="Detecção de anomalias, sugestões de CFOP/CST e geração de regras via RAG"
        actions={
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-accent">
            <Sparkles className="size-3" />
            Ollama + BGE-M3 (simulação)
          </div>
        }
      />

      <div className="space-y-4">
        {INSIGHTS.map((ins, i) => {
          const Icon = ins.icon;
          const tones = {
            accent: "border-accent/30 bg-accent/5",
            success: "border-success/30 bg-success/5",
            muted: "border-border bg-card",
          };
          const iconTones = {
            accent: "text-accent",
            success: "text-success",
            muted: "text-muted-foreground",
          };
          return (
            <div key={i} className={`border rounded-lg p-5 flex gap-4 ${tones[ins.tone]}`}>
              <Icon className={`size-5 shrink-0 mt-0.5 ${iconTones[ins.tone]}`} />
              <div className="flex-1">
                <div className="font-bold text-sm">{ins.title}</div>
                <div className="text-[12px] text-muted-foreground mt-1">{ins.desc}</div>
              </div>
              <button className="text-[10px] font-bold uppercase tracking-widest text-accent hover:underline self-start">
                {ins.action} →
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
