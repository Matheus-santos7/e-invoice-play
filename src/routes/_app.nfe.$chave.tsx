import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { PageHeader, StatusBadge } from "@/components/fiscal-ui";
import { XMLViewer } from "@/components/xml-viewer";
import { NFES, TENANTS, brl, formatChave } from "@/lib/fiscal-mock";
import { buildNFeXML } from "@/lib/xml-generator";

export const Route = createFileRoute("/_app/nfe/$chave")({
  component: NFeDetail,
  notFoundComponent: NFeNotFound,
  head: ({ params }) => ({
    meta: [{ title: `NF-e ${params.chave.slice(-9)} — Fiscal Engine` }],
  }),
});

function NFeNotFound() {
  const params = Route.useParams();
  return (
    <div className="p-6">
      <p className="text-sm text-muted-foreground font-mono">
        NF-e não encontrada para chave {params.chave}
      </p>
      <Link to="/nfe" className="text-accent text-[11px] uppercase font-bold mt-4 inline-block hover:underline">
        ← Voltar
      </Link>
    </div>
  );
}

function NFeDetail() {
  const { chave } = Route.useParams();
  const nfe = NFES.find((n) => n.chave === chave);
  if (!nfe) throw notFound();
  const emit = TENANTS[0];
  const xml = buildNFeXML(nfe, {
    cnpj: emit.cnpj,
    xNome: emit.razaoSocial,
    ie: emit.ie,
    uf: emit.uf,
  });

  return (
    <div className="p-6 space-y-6">
      <Link to="/nfe" className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground hover:text-foreground">
        ← Todas as NF-e
      </Link>

      <PageHeader
        title={`NF-e nº ${nfe.numero} / série ${nfe.serie}`}
        subtitle={nfe.natOp}
        actions={<StatusBadge status={nfe.status} />}
      />

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-5 space-y-4">
          <div className="border border-border rounded-lg bg-card p-4 space-y-3">
            <h3 className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Chave de Acesso</h3>
            <div className="font-mono text-[12px] text-accent break-all">{formatChave(nfe.chave)}</div>
          </div>

          <div className="border border-border rounded-lg bg-card p-4 grid grid-cols-2 gap-4">
            <Field label="CFOP" value={nfe.cfop} mono />
            <Field label="NCM" value={nfe.ncm} mono />
            <Field label="Pedido ML" value={nfe.pedidoML} mono />
            <Field label="Emitida em" value={new Date(nfe.emitidaEm).toLocaleString("pt-BR")} />
          </div>

          <div className="border border-border rounded-lg bg-card p-4 space-y-3">
            <h3 className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Destinatário</h3>
            <div className="text-sm font-medium">{nfe.destinatario.nome}</div>
            <div className="font-mono text-[11px] text-muted-foreground">
              {nfe.destinatario.doc} • {nfe.destinatario.uf}
            </div>
          </div>

          <div className="border border-border rounded-lg bg-card p-4 space-y-2">
            <h3 className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-2">Resumo Fiscal</h3>
            <Row label="Valor produtos" value={brl(nfe.valor)} />
            <Row label={`ICMS (${nfe.aliqICMS}%)`} value={brl(nfe.valorICMS)} />
            <Row label="PIS (1,65%)" value={brl(nfe.valor * 0.0165)} muted />
            <Row label="COFINS (7,60%)" value={brl(nfe.valor * 0.076)} muted />
            <div className="border-t border-border pt-2 mt-2">
              <Row label="Total da NF" value={brl(nfe.valor)} bold />
            </div>
          </div>
        </div>

        <div className="col-span-7">
          <div className="h-[700px]">
            <XMLViewer xml={xml} filename={`nfe_${nfe.numero}_v4.00.xml`} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-1">{label}</div>
      <div className={`text-sm ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}

function Row({ label, value, muted, bold }: { label: string; value: string; muted?: boolean; bold?: boolean }) {
  return (
    <div className="flex justify-between items-baseline text-[12px]">
      <span className={muted ? "text-muted-foreground" : ""}>{label}</span>
      <span className={`font-mono ${bold ? "font-bold text-base" : ""}`}>{value}</span>
    </div>
  );
}
