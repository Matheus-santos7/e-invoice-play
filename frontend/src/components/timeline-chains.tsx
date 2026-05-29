import Link from "next/link";
import type { TimelineChainDto, TimelineRemessaGroupDto } from "@/lib/fiscal-types";

const TIPO_STYLE: Record<string, string> = {
  REMESSA: "text-amber-500",
  RETORNO_SIMBOLICO: "text-sky-400",
  VENDA: "text-emerald-400",
  DEVOLUCAO: "text-violet-400",
  REMESSA_SIMBOLICA: "text-orange-400",
};

export function TimelineChains({ groups }: { groups: TimelineRemessaGroupDto[] }) {
  if (groups.length === 0) {
    return (
      <p className="text-[13px] text-muted-foreground p-4">
        Nenhuma cadeia fiscal ainda. Emita remessas em Produtos e fature pedidos para formar Remessa → Retorno → Venda.
      </p>
    );
  }

  return (
    <div className="p-4 space-y-4 max-h-[560px] overflow-y-auto">
      {groups.map((group) => (
        <RemessaGroup key={group.remessaChave || "avulsa"} group={group} />
      ))}
    </div>
  );
}

function RemessaGroup({ group }: { group: TimelineRemessaGroupDto }) {
  const avulsa = !group.remessaChave;
  return (
    <div className="border border-border rounded-md overflow-hidden">
      <div className="flex items-center justify-between gap-2 bg-amber-500/5 border-b border-border px-3 py-2">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-widest text-amber-500">
            {avulsa ? "Vendas avulsas" : `Remessa ${group.remessaNumero}/${group.remessaSerie}`}
          </div>
          {!avulsa && (
            <div className="text-[11px] text-muted-foreground font-mono">
              {group.quantidadeRemessa} und enviadas
              {group.saldoDisponivel != null && (
                <>
                  {" · "}
                  <span className={group.saldoDisponivel > 0 ? "text-amber-500" : "text-muted-foreground"}>
                    saldo {group.saldoDisponivel}
                  </span>
                </>
              )}
            </div>
          )}
        </div>
        <span className="text-[10px] uppercase font-bold text-muted-foreground whitespace-nowrap">
          {group.cenarios.length} {group.cenarios.length === 1 ? "cenário" : "cenários"}
        </span>
      </div>

      {group.cenarios.length === 0 ? (
        <p className="px-3 py-2 text-[11px] text-muted-foreground">
          Saldo disponível no full — ainda sem venda associada.
        </p>
      ) : (
        <div className="divide-y divide-border">
          {group.cenarios.map((cenario, i) => (
            <ScenarioRow key={cenario.id} cenario={cenario} index={i + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function ScenarioRow({ cenario, index }: { cenario: TimelineChainDto; index: number }) {
  return (
    <div className="px-3 py-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">
          Cenário {index}
          {cenario.pedidoMl && (
            <span className="ml-1.5 font-normal normal-case text-muted-foreground">{cenario.pedidoMl}</span>
          )}
        </span>
        <span
          className={
            cenario.status === "completa"
              ? "text-[10px] uppercase font-bold text-success"
              : "text-[10px] uppercase font-bold text-amber-500"
          }
        >
          {cenario.status === "completa" ? "Completa" : "Em aberto"}
        </span>
      </div>

      <div className="flex flex-wrap items-stretch gap-x-1 gap-y-2">
        {cenario.steps.map((step, i) => (
          <div key={step.chave} className="flex items-center gap-1">
            <Link
              href={`/nfe/${step.chave}`}
              className="group flex flex-col rounded border border-border px-2 py-1 hover:border-accent transition-colors"
            >
              <span className={`text-[10px] font-bold uppercase leading-tight ${TIPO_STYLE[step.tipo] ?? ""}`}>
                {step.tipoLabel}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground group-hover:text-accent">
                {step.numero}/{step.serie}
                {step.tipo === "REMESSA" && step.saldoDisponivel != null && (
                  <span className="text-amber-500"> · saldo {step.saldoDisponivel}</span>
                )}
              </span>
            </Link>
            {i < cenario.steps.length - 1 && <span className="text-muted-foreground text-xs">→</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
