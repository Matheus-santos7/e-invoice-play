import { Link, Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import {
  Building2,
  Package,
  ShoppingCart,
  FileText,
  Truck,
  Scale,
  History,
  Bell,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { TENANTS } from "@/lib/fiscal-mock";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

const NAV_OPERACIONAL = [
  { to: "/empresas", label: "Empresas", icon: Building2 },
  { to: "/produtos", label: "Produtos", icon: Package },
  { to: "/pedidos", label: "Pedidos", icon: ShoppingCart },
  { to: "/nfe", label: "NF-e Emitidas", icon: FileText },
  { to: "/cte", label: "CT-e Transportes", icon: Truck },
] as const;

const NAV_CONFIG = [
  { to: "/regras", label: "Regras Tributárias", icon: Scale },
  { to: "/auditoria", label: "Auditoria", icon: ShieldCheck },
  { to: "/eventos", label: "Eventos", icon: Bell },
  { to: "/ia", label: "IA Insights", icon: Sparkles },
] as const;

function AppLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (to: string) => path === to || (to !== "/" && path.startsWith(to));

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground text-[13px]">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-r border-border flex flex-col">
        <div className="p-4 border-b border-border flex items-center gap-3">
          <div className="size-6 bg-accent rounded flex items-center justify-center text-accent-foreground font-bold text-[10px]">
            FS
          </div>
          <span className="font-semibold tracking-tight uppercase text-[11px]">
            Fiscal Engine v3.2
          </span>
        </div>

        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          <Link
            to="/"
            className={`flex items-center gap-3 px-3 py-2 rounded transition-colors ${
              path === "/" ? "bg-white/5 text-foreground" : "text-muted-foreground hover:bg-white/5"
            }`}
          >
            <span className="size-1.5 rounded-full bg-success" />
            <span className="font-medium">Dashboard</span>
          </Link>

          <div className="px-3 pt-4 pb-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            Operacional
          </div>
          {NAV_OPERACIONAL.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
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

          <div className="px-3 pt-6 pb-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            Configuração
          </div>
          {NAV_CONFIG.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
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
            <div className="text-[10px] font-bold text-accent uppercase mb-1.5 tracking-widest">
              Ambiente
            </div>
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-accent animate-pulse" />
              <span className="font-medium text-foreground">HOMOLOGAÇÃO</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="h-14 shrink-0 border-b border-border flex items-center justify-between px-6 bg-background/80 backdrop-blur">
          <div className="flex items-center gap-4">
            <select
              defaultValue={TENANTS[0].id}
              className="bg-transparent border-none font-medium focus:outline-none focus:ring-0 cursor-pointer text-foreground"
            >
              {TENANTS.map((t) => (
                <option key={t.id} value={t.id} className="bg-background">
                  {t.razaoSocial}
                </option>
              ))}
            </select>
            <span className="h-4 w-px bg-border" />
            <div className="bg-accent text-accent-foreground px-2 py-0.5 rounded text-[10px] font-black tracking-tighter">
              SIMULAÇÃO — SEM VALIDADE FISCAL
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/nfe/nova"
              className="px-4 py-1.5 bg-accent text-accent-foreground font-bold rounded hover:opacity-90 transition-opacity text-[11px] tracking-wider"
            >
              EMITIR NF-E
            </Link>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>

        {/* Watermark footer — permanent */}
        <footer className="h-10 shrink-0 border-t border-border bg-accent/5 flex items-center justify-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-accent">
              Ambiente de Simulação
            </span>
            <span className="text-[10px] text-muted-foreground">•</span>
            <span className="text-[10px] font-mono text-muted-foreground">
              Sem validade fiscal perante SEFAZ • Build dev
            </span>
          </div>
        </footer>
      </main>
    </div>
  );
}
