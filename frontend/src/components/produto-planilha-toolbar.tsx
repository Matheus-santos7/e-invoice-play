"use client";

import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { importProdutosPlanilhaAction, type ProdutoPlanilhaImportResult } from "@/app/(app)/produtos/actions";
import { Button } from "@/components/ui/button";
import type { ProductDto } from "@/lib/fiscal-types";
import {
  buildProdutoPlanilhaCsv,
  buildProdutoPlanilhaTemplateCsv,
  downloadCsvFile,
} from "@/lib/produto-planilha";

type Props = {
  tenantId?: string;
  products: ProductDto[];
};

export function ProdutoPlanilhaToolbar({ tenantId, products }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ProdutoPlanilhaImportResult | null>(null);

  const disabled = !tenantId || pending;

  function handleDownloadTemplate() {
    downloadCsvFile("produtos-modelo.csv", buildProdutoPlanilhaTemplateCsv());
  }

  function handleDownloadCatalog() {
    downloadCsvFile("produtos-catalogo.csv", buildProdutoPlanilhaCsv(products));
  }

  function handleImport(file: File) {
    setResult(null);
    const fd = new FormData();
    fd.set("file", file);
    startTransition(async () => {
      const res = await importProdutosPlanilhaAction(fd);
      setResult(res);
      if (!res.error || res.created != null || res.updated != null) {
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card/50 p-3">
        <span className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground mr-1">
          Planilha
        </span>
        <Button type="button" variant="outline" size="sm" onClick={handleDownloadTemplate} className="gap-2">
          <Download className="size-3.5" />
          Baixar modelo
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleDownloadCatalog}
          disabled={!tenantId || products.length === 0}
          className="gap-2"
        >
          <FileSpreadsheet className="size-3.5" />
          Exportar catálogo
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImport(file);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          size="sm"
          disabled={disabled}
          className="gap-2"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="size-3.5" />
          {pending ? "Importando…" : "Importar CSV"}
        </Button>
        <span className="text-[12px] text-muted-foreground ml-auto hidden sm:inline">
          CSV com <code className="font-mono">;</code> — cria ou atualiza por SKU
        </span>
      </div>

      {result && <ImportResultBanner result={result} onDismiss={() => setResult(null)} />}
    </div>
  );
}

function ImportResultBanner({
  result,
  onDismiss,
}: {
  result: ProdutoPlanilhaImportResult;
  onDismiss: () => void;
}) {
  const hasSuccess = (result.created ?? 0) + (result.updated ?? 0) > 0;
  const failed = [...(result.parseErrors ?? []), ...(result.failed ?? [])];

  return (
    <div
      className={`rounded-lg border px-4 py-3 text-[14px] space-y-2 ${
        result.error && !hasSuccess
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-accent/30 bg-accent/5"
      }`}
    >
      {result.error && !hasSuccess ? (
        <p>{result.error}</p>
      ) : (
        <p className="text-foreground">
          Importação concluída: <strong>{result.created ?? 0}</strong> criado(s),{" "}
          <strong>{result.updated ?? 0}</strong> atualizado(s)
          {failed.length > 0 && (
            <>
              , <strong>{failed.length}</strong> com aviso/erro
            </>
          )}
          .
        </p>
      )}

      {failed.length > 0 && (
        <ul className="text-[13px] text-muted-foreground max-h-32 overflow-y-auto font-mono space-y-0.5">
          {failed.slice(0, 20).map((f, i) => (
            <li key={`${"line" in f ? f.line : i}-${"sku" in f ? f.sku : i}`}>
              {"message" in f
                ? `Linha ${f.line}: ${f.message}`
                : `Linha ${f.line} (${f.sku}): ${f.error}`}
            </li>
          ))}
          {failed.length > 20 && <li>… e mais {failed.length - 20} linha(s)</li>}
        </ul>
      )}

      <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={onDismiss}>
        Fechar
      </Button>
    </div>
  );
}
