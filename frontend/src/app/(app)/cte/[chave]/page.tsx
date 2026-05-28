import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, StatusBadge } from "@/components/fiscal-ui";
import { XMLViewer } from "@/components/xml-viewer";
import { getCteByChave, getTenant } from "@/lib/fiscal-api";
import { buildCTeXML } from "@/lib/cte-xml-generator";
import { brl, formatChave } from "@/lib/format";

type Props = { params: Promise<{ chave: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { chave } = await params;
  return { title: `CT-e ${chave.slice(-9)}` };
}

export default async function CTeDetailPage({ params }: Props) {
  const { chave } = await params;
  const cte = await getCteByChave(chave);
  if (!cte) notFound();

  const tenant = await getTenant(cte.tenantId);
  if (!tenant) notFound();

  const xml = buildCTeXML(cte, tenant);

  return (
    <div className="p-6 space-y-6">
      <Link
        href="/cte"
        className="text-[12px] uppercase font-bold tracking-widest text-muted-foreground hover:text-foreground"
      >
        ← Todos os CT-e
      </Link>

      <PageHeader
        title={`CT-e nº ${cte.numero} / série ${cte.serie}`}
        subtitle={cte.natOp}
        actions={<StatusBadge status={cte.status} />}
      />

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-5 space-y-4">
          <div className="border border-border rounded-lg bg-card p-4 space-y-3">
            <h3 className="text-[12px] uppercase tracking-widest font-bold text-muted-foreground">Chave de Acesso</h3>
            <div className="font-mono text-[14px] text-accent break-all">{formatChave(cte.chave)}</div>
          </div>

          <div className="border border-border rounded-lg bg-card p-4 grid grid-cols-2 gap-4">
            <Field label="CFOP" value={cte.cfop} mono />
            <Field label="Modal" value={cte.modal} />
            <Field label="Origem" value={cte.origem} />
            <Field label="Destino" value={cte.destino} />
            <Field label="Emitido em" value={new Date(cte.emitidoEm).toLocaleString("pt-BR")} />
          </div>

          {cte.nfeChaveRef && (
            <div className="border border-border rounded-lg bg-card p-4 space-y-2">
              <h3 className="text-[12px] uppercase tracking-widest font-bold text-muted-foreground">NF-e de remessa</h3>
              <Link href={`/nfe/${cte.nfeChaveRef}`} className="font-mono text-[13px] text-accent hover:underline break-all">
                {formatChave(cte.nfeChaveRef)}
              </Link>
            </div>
          )}

          <div className="border border-border rounded-lg bg-card p-4 space-y-2">
            <h3 className="text-[12px] uppercase tracking-widest font-bold text-muted-foreground mb-2">Valores</h3>
            <Row label="Valor da carga" value={brl(cte.valorCarga)} />
            <Row label="Peso bruto (kg)" value={cte.pesoCarga.toFixed(4)} mono />
            <div className="border-t border-border pt-2 mt-2">
              <Row label="Frete (vTPrest)" value={brl(cte.valor)} bold />
            </div>
          </div>
        </div>

        <div className="col-span-7">
          <div className="h-[700px]">
            <XMLViewer xml={xml} filename={`cte_${cte.numero}_v4.00.xml`} />
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

function Row({ label, value, mono, bold }: { label: string; value: string; mono?: boolean; bold?: boolean }) {
  return (
    <div className="flex justify-between items-baseline text-[15px]">
      <span className="text-muted-foreground">{label}</span>
      <span className={`${mono ? "font-mono" : ""} ${bold ? "font-bold text-lg" : ""}`}>{value}</span>
    </div>
  );
}
