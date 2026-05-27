import type { FiscalStatus } from "@/lib/fiscal-mock";

export function StatusBadge({ status }: { status: FiscalStatus }) {
  const styles: Record<FiscalStatus, string> = {
    AUTORIZADA: "bg-success/10 text-success",
    PENDENTE: "bg-accent/10 text-accent",
    REJEITADA: "bg-destructive/10 text-destructive",
    CANCELADA: "bg-muted text-muted-foreground",
    DENEGADA: "bg-destructive/10 text-destructive",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider ${styles[status]}`}
    >
      {status}
    </span>
  );
}

export function KPI({
  label,
  value,
  hint,
  hintTone = "muted",
}: {
  label: string;
  value: string;
  hint?: string;
  hintTone?: "success" | "accent" | "muted" | "destructive";
}) {
  const tones = {
    success: "text-success",
    accent: "text-accent",
    muted: "text-muted-foreground",
    destructive: "text-destructive",
  } as const;
  return (
    <div className="p-4 border border-border rounded-lg bg-card animate-slide-in">
      <div className="text-muted-foreground text-[11px] font-medium uppercase tracking-wider">
        {label}
      </div>
      <div className="text-2xl font-bold mt-1 tracking-tight">{value}</div>
      {hint && (
        <div className={`text-[10px] font-bold mt-2 ${tones[hintTone]}`}>{hint}</div>
      )}
    </div>
  );
}

export function SectionHeader({
  title,
  right,
}: {
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="px-4 py-3 border-b border-border flex items-center justify-between">
      <h3 className="font-bold text-[11px] uppercase tracking-wider text-foreground">
        {title}
      </h3>
      {right}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between mb-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        {subtitle && (
          <p className="text-[12px] text-muted-foreground mt-1">{subtitle}</p>
        )}
      </div>
      {actions}
    </div>
  );
}
