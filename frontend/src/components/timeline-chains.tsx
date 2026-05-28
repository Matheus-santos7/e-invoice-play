import Link from "next/link";
import type { TimelineChainDto } from "@/lib/fiscal-types";

const TIPO_STYLE: Record<string, string> = {
  REMESSA: "text-amber-500",
  RETORNO_SIMBOLICO: "text-sky-400",
  VENDA: "text-emerald-400",
  DEVOLUCAO: "text-violet-400",
};

export function TimelineChains({ chains }: { chains: TimelineChainDto[] }) {
  if (chains.length === 0) {
    return (
      <p className="text-[13px] text-muted-foreground p-4">
        Nenhuma cadeia fiscal ainda. Emita remessas em Produtos e fature pedidos para formar Remessa → Retorno → Venda.
      </p>
    );
  }

  return (
    <div className="p-4 space-y-5 max-h-[520px] overflow-y-auto">
      {chains.map((chain) => (
        <div key={chain.id} className="border border-border rounded-md p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              {chain.pedidoMl ?? "Remessa avulsa"}
            </span>
            <span
              className={
                chain.status === "completa"
                  ? "text-[10px] uppercase font-bold text-success"
                  : "text-[10px] uppercase font-bold text-amber-500"
              }
            >
              {chain.status === "completa" ? "Cadeia completa" : "Em aberto"}
            </span>
          </div>
          <div className="space-y-2">
            {chain.steps.map((step, i) => {
              const last = i === chain.steps.length - 1;
              return (
                <div key={step.chave} className="flex gap-2">
                  <div className="flex flex-col items-center pt-1">
                    <div className={`size-2 rounded-full ${last ? "bg-accent" : "bg-border"}`} />
                    {!last && <div className="w-px flex-1 bg-border my-0.5 min-h-[12px]" />}
                  </div>
                  <div className="pb-1 min-w-0 flex-1">
                    <div className={`text-[12px] font-bold uppercase ${TIPO_STYLE[step.tipo] ?? ""}`}>
                      {step.tipoLabel}
                      {step.tipo === "REMESSA" && step.saldoDisponivel != null && (
                        <span className="text-muted-foreground font-normal normal-case ml-1">
                          (saldo {step.saldoDisponivel})
                        </span>
                      )}
                    </div>
                    <Link
                      href={`/nfe/${step.chave}`}
                      className="font-mono text-[11px] text-accent hover:underline block"
                    >
                      {step.numero}/{step.serie}
                    </Link>
                    {step.nfeReferenciaChave && (
                      <div className="text-[10px] text-muted-foreground font-mono">
                        ref. nota anterior
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
