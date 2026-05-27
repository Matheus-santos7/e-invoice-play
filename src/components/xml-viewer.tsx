import { highlightXML } from "@/lib/xml-generator";
import { useState } from "react";

export function XMLViewer({ xml, filename = "documento.xml" }: { xml: string; filename?: string }) {
  const [copied, setCopied] = useState(false);
  const tokens = highlightXML(xml);

  const onCopy = async () => {
    await navigator.clipboard.writeText(xml);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="border border-border rounded-lg bg-black overflow-hidden flex flex-col h-full">
      <div className="px-4 py-2 border-b border-border bg-white/5 flex justify-between items-center shrink-0">
        <span className="text-[10px] font-mono text-muted-foreground">{filename}</span>
        <button
          onClick={onCopy}
          className="text-[10px] text-accent font-bold uppercase tracking-wider hover:underline"
        >
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <pre className="p-4 font-mono text-[11px] leading-relaxed overflow-auto flex-1 whitespace-pre-wrap break-all">
        {tokens.map((t, i) => {
          if (t.kind === "tag") return <span key={i} className="text-emerald-400">{t.text}</span>;
          if (t.kind === "attr") return <span key={i} className="text-amber-400">{t.text}</span>;
          if (t.kind === "value") return <span key={i} className="text-sky-400">{t.text}</span>;
          if (t.kind === "comment") return <span key={i} className="text-zinc-500">{t.text}</span>;
          return <span key={i} className="text-zinc-300">{t.text}</span>;
        })}
      </pre>
    </div>
  );
}
