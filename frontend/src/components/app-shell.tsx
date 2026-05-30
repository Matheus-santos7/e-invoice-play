"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useTransition } from "react";
import {
  Building2,
  Package,
  ShoppingCart,
  FileText,
  Truck,
  Warehouse,
  Scale,
  Bell,
  Sparkles,
  ShieldCheck,
  Settings2,
} from "lucide-react";
import { setActiveTenantAction } from "@/app/(app)/tenant-actions";
import type { TenantDto } from "@/lib/fiscal-types";

const NAV_OPERACIONAL = [
  { href: "/empresas", label: "Empresas", icon: Building2 },
  { href: "/produtos", label: "Produtos", icon: Package },
  { href: "/pedidos", label: "Pedidos", icon: ShoppingCart },
  { href: "/nfe", label: "NF-e Emitidas", icon: FileText },
  { href: "/cte", label: "CT-e Transportes", icon: Truck },
  { href: "/unidades-logisticas", label: "Unidades ML", icon: Warehouse },
] as const;

const NAV_CONFIG = [
  { href: "/configuracoes-fiscais", label: "Config. fiscais", icon: Settings2 },
  { href: "/regras", label: "Regras Tributárias", icon: Scale },
  { href: "/auditoria", label: "Auditoria", icon: ShieldCheck },
  { href: "/eventos", label: "Eventos", icon: Bell },
  { href: "/ia", label: "IA Insights", icon: Sparkles },
] as const;

function ambienteLabel(a: TenantDto["ambiente"]): string {
  return a === "PRODUCAO" ? "PRODUÇÃO" : "HOMOLOGAÇÃO";
}

function AppShellInner({
  tenants,
  activeTenantId,
  children,
}: {
  tenants: TenantDto[];
  activeTenantId?: string;
  children: React.ReactNode;
}) {
  const path = usePathname() ?? "/";
  const router = useRouter();
  const [switching, startSwitch] = useTransition();
  const isActive = (href: string) => path === href || (href !== "/" && path.startsWith(href));

  const effectiveTenantId = activeTenantId ?? tenants[0]?.id ?? "";
  const selected = tenants.find((t) => t.id === effectiveTenantId) ?? tenants[0];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground text-[15px]">
      <aside className="w-64 shrink-0 border-r border-border flex flex-col">
        <div className="p-4 border-b border-border flex items-center gap-3">
          <div className="size-6 bg-accent rounded flex items-center justify-center text-accent-foreground font-bold text-[12px]">
            FS
          </div>
          <span className="font-semibold tracking-tight uppercase text-[13px]">Fiscal Engine v3.2</span>
        </div>

        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          <Link
            href="/"
            className={`flex items-center gap-3 px-3 py-2 rounded transition-colors ${
              path === "/" ? "bg-white/5 text-foreground" : "text-muted-foreground hover:bg-white/5"
            }`}
          >
            <span className="size-1.5 rounded-full bg-success" />
            <span className="font-medium">Dashboard</span>
          </Link>

          <div className="px-3 pt-4 pb-2 text-[12px] font-bold text-muted-foreground uppercase tracking-widest">
            Operacional
          </div>
          {NAV_OPERACIONAL.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded transition-colors ${
                  active
                    ? "bg-accent/5 text-accent font-medium"
                    : "text-muted-foreground hover:bg-white/5"
                }`}
              >
                <Icon className="size-3.5" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <div className="px-3 pt-6 pb-2 text-[12px] font-bold text-muted-foreground uppercase tracking-widest">
            Configuração
          </div>
          {NAV_CONFIG.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded transition-colors ${
                  active
                    ? "bg-accent/5 text-accent font-medium"
                    : "text-muted-foreground hover:bg-white/5"
                }`}
              >
                <Icon className="size-3.5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="bg-accent/10 border border-accent/20 p-3 rounded">
            <div className="text-[12px] font-bold text-accent uppercase mb-1.5 tracking-widest">Ambiente</div>
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-accent animate-pulse" />
              <span className="font-medium text-foreground">{selected ? ambienteLabel(selected.ambiente) : "—"}</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="h-14 shrink-0 border-b border-border flex items-center justify-between px-6 bg-background/80 backdrop-blur">
          <div className="flex items-center gap-4">
            <select
              value={effectiveTenantId}
              onChange={(e) => {
                const id = e.target.value;
                startSwitch(async () => {
                  await setActiveTenantAction(id);
                  router.refresh();
                });
              }}
              disabled={tenants.length === 0 || switching}
              className="bg-transparent border-none font-medium focus:outline-none focus:ring-0 cursor-pointer text-foreground max-w-[min(100%,320px)] truncate disabled:opacity-60"
            >
              {tenants.length === 0 ? (
                <option value="">Nenhum tenant (rode o seed)</option>
              ) : (
                tenants.map((t) => (
                  <option key={t.id} value={t.id} className="bg-background">
                    {t.razaoSocial}
                  </option>
                ))
              )}
            </select>
            <span className="h-4 w-px bg-border" />
            <div className="bg-accent text-accent-foreground px-2 py-0.5 rounded text-[12px] font-black tracking-tighter">
              SIMULAÇÃO — SEM VALIDADE FISCAL
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/nfe/nova"
              className="px-4 py-1.5 bg-accent text-accent-foreground font-bold rounded hover:opacity-90 transition-opacity text-[13px] tracking-wider"
            >
              EMITIR NF-E
            </Link>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">{children}</div>

        <footer className="h-10 shrink-0 border-t border-border bg-accent/5 flex items-center justify-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-bold uppercase tracking-widest text-accent">Ambiente de Simulação</span>
            <span className="text-[12px] text-muted-foreground">•</span>
            <span className="text-[12px] font-mono text-muted-foreground">
              Sem validade fiscal perante SEFAZ • Next.js
            </span>
          </div>
        </footer>
      </main>
    </div>
  );
}

export function AppShell({
  tenants,
  activeTenantId,
  children,
}: {
  tenants: TenantDto[];
  activeTenantId?: string;
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={<div className="flex h-screen w-full items-center justify-center bg-background text-muted-foreground" />}
    >
      <AppShellInner tenants={tenants} activeTenantId={activeTenantId}>
        {children}
      </AppShellInner>
    </Suspense>
  );
}
