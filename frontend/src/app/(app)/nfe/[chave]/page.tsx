import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, StatusBadge } from "@/components/fiscal-ui";
import { NfeXmlActions } from "@/components/nfe-xml-actions";
import { XMLViewer } from "@/components/xml-viewer";
import { getEmitente, getFiscalEmitterSettings, getNfeByChave, listProducts } from "@/lib/fiscal-api";
import { brl, formatChave } from "@/lib/format";
import { buildNFeXML } from "@/lib/xml-generator";

type Props = { params: Promise<{ chave: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { chave } = await params;
  return { title: `NF-e ${chave.slice(-9)}` };
}

export default async function NFeDetailPage({ params }: Props) {
  const { chave } = await params;
  const nfe = await getNfeByChave(chave);
  if (!nfe) notFound();

  const [emit, fiscalCfg] = await Promise.all([
    getEmitente(nfe.tenantId),
    getFiscalEmitterSettings(nfe.tenantId),
  ]);
  let product = undefined;
  if (nfe.productId) {
    product = (await listProducts(nfe.tenantId)).find((p) => p.id === nfe.productId);
  }
  if (!product) {
    const produtos = await listProducts(nfe.tenantId);
    product = produtos.find((p) => p.ncm === nfe.ncm) ?? produtos[0];
  }
  const xml = buildNFeXML(nfe, emit, product, fiscalCfg?.settings ?? null);

  return (
    <div className="p-6 space-y-6">
      <Link
        href="/nfe"
        className="text-[12px] uppercase font-bold tracking-widest text-muted-foreground hover:text-foreground"
      >
        ← Todas as NF-e
      </Link>

      <PageHeader
        title={`NF-e nº ${nfe.numero} / série ${nfe.serie}`}
        subtitle={nfe.natOp}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <NfeXmlActions chave={nfe.chave} variant="toolbar" />
            <StatusBadge status={nfe.status} />
          </div>
        }
      />

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-5 space-y-4">
          <div className="border border-border rounded-lg bg-card p-4 space-y-3">
            <h3 className="text-[12px] uppercase tracking-widest font-bold text-muted-foreground">Chave de Acesso</h3>
            <div className="font-mono text-[14px] text-accent break-all">{formatChave(nfe.chave)}</div>
          </div>

          <div className="border border-border rounded-lg bg-card p-4 grid grid-cols-2 gap-4">
            <Field label="CFOP" value={nfe.cfop} mono />
            <Field label="NCM" value={nfe.ncm} mono />
            <Field label="Pedido ML" value={nfe.pedidoML} mono />
            <Field label="Emitida em" value={new Date(nfe.emitidaEm).toLocaleString("pt-BR")} />
            {nfe.tipo === "REMESSA" && (
              <Field label="Tipo" value="Remessa (depósito ML)" />
            )}
          </div>

          {nfe.nfeReferenciaChave && (
            <div className="border border-border rounded-lg bg-card p-4 space-y-2">
              <h3 className="text-[12px] uppercase tracking-widest font-bold text-muted-foreground">Referencia</h3>
              <Link href={`/nfe/${nfe.nfeReferenciaChave}`} className="font-mono text-[13px] text-accent hover:underline break-all">
                {formatChave(nfe.nfeReferenciaChave)}
              </Link>
            </div>
          )}

          {nfe.referenciadas && nfe.referenciadas.length > 0 && (
            <div className="border border-border rounded-lg bg-card p-4 space-y-2">
              <h3 className="text-[12px] uppercase tracking-widest font-bold text-muted-foreground">Documentos posteriores</h3>
              <ul className="space-y-1">
                {nfe.referenciadas.map((r) => (
                  <li key={r.chave}>
                    <Link href={`/nfe/${r.chave}`} className="font-mono text-[13px] text-accent hover:underline">
                      {r.tipo} {r.numero}/{r.serie}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {nfe.tipo === "REMESSA" && nfe.saldoDisponivel != null && (
            <div className="border border-border rounded-lg bg-card p-4">
              <Field label="Saldo disponível (FIFO)" value={String(nfe.saldoDisponivel)} mono />
            </div>
          )}

          {nfe.cteChaveRef && (
            <div className="border border-border rounded-lg bg-card p-4 space-y-2">
              <h3 className="text-[12px] uppercase tracking-widest font-bold text-muted-foreground">CT-e vinculado</h3>
              <Link href={`/cte/${nfe.cteChaveRef}`} className="font-mono text-[13px] text-accent hover:underline break-all">
                {formatChave(nfe.cteChaveRef)}
              </Link>
            </div>
          )}

          <div className="border border-border rounded-lg bg-card p-4 space-y-3">
            <h3 className="text-[12px] uppercase tracking-widest font-bold text-muted-foreground">Destinatário</h3>
            <div className="text-base font-medium">{nfe.destinatario.nome}</div>
            <div className="font-mono text-[13px] text-muted-foreground">
              {nfe.destinatario.doc} • {nfe.destinatario.uf}
            </div>
          </div>

          <div className="border border-border rounded-lg bg-card p-4 space-y-2">
            <h3 className="text-[12px] uppercase tracking-widest font-bold text-muted-foreground mb-2">Resumo Fiscal</h3>
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
      <div className="text-[12px] uppercase tracking-widest font-bold text-muted-foreground mb-1">{label}</div>
      <div className={`text-base ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}

function Row({ label, value, muted, bold }: { label: string; value: string; muted?: boolean; bold?: boolean }) {
  return (
    <div className="flex justify-between items-baseline text-[15px]">
      <span className={muted ? "text-muted-foreground" : ""}>{label}</span>
      <span className={`font-mono ${bold ? "font-bold text-lg" : ""}`}>{value}</span>
    </div>
  );
}
