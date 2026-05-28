import { cache } from "react";
import type {
  AuditEntryDto,
  CepLookupDto,
  CnpjLookupDto,
  CTeDto,
  EmitenteDto,
  FiscalEventDto,
  NFeDto,
  PedidoCheckoutInput,
  PedidoDto,
  PedidoFaturarResult,
  ProductDto,
  ProductInput,
  TaxRuleDto,
  TenantDto,
  TenantInput,
  TimelineChainDto,
  TimelineStepDto,
} from "./fiscal-types";

function apiBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001").replace(/\/$/, "");
}

function url(path: string, query?: Record<string, string | undefined>): string {
  const u = new URL(path.startsWith("/") ? path : `/${path}`, `${apiBase()}/`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v) u.searchParams.set(k, v);
    }
  }
  return u.toString();
}

async function readApiError(res: Response): Promise<string> {
  return (await readApiErrorPayload(res)).error;
}

type ApiErrorPayload = {
  error: string;
  details?: Record<string, string[]>;
};

async function readApiErrorPayload(res: Response): Promise<ApiErrorPayload> {
  const text = await res.text().catch(() => "");
  if (!text) return { error: res.statusText || `Erro ${res.status}` };
  try {
    const parsed = JSON.parse(text) as {
      error?: string;
      message?: string;
      details?: Record<string, string[]>;
    };
    const error =
      (typeof parsed.error === "string" && parsed.error) ||
      (typeof parsed.message === "string" && parsed.message) ||
      text;
    return { error, details: parsed.details };
  } catch {
    return { error: text };
  }
}

export class ApiValidationError extends Error {
  fieldErrors?: Record<string, string[]>;

  constructor(message: string, fieldErrors?: Record<string, string[]>) {
    super(message);
    this.name = "ApiValidationError";
    this.fieldErrors = fieldErrors;
  }
}

async function getJson<T>(href: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(href, { cache: "no-store" });
  } catch (err) {
    const base = apiBase();
    const msg =
      err instanceof Error && "cause" in err && err.cause instanceof Error && err.cause.message.includes("ECONNREFUSED")
        ? `API indisponível em ${base}. Rode \`pnpm dev\` na raiz (sobe API + Next) ou \`pnpm dev:backend\` em outro terminal.`
        : err instanceof Error
          ? err.message
          : "Falha ao conectar na API";
    throw new Error(msg);
  }
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
  return res.json() as Promise<T>;
}

export async function listTenants(): Promise<TenantDto[]> {
  return getJson<TenantDto[]>(url("/api/tenants"));
}

export async function getTenant(id: string): Promise<TenantDto | null> {
  const href = url(`/api/tenants/${id}`);
  const res = await fetch(href, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
  return res.json() as Promise<TenantDto>;
}

async function mutateJson<T>(
  href: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<T | void> {
  let res: Response;
  try {
    res = await fetch(href, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch (err) {
    const base = apiBase();
    throw new Error(
      err instanceof Error && String(err).includes("ECONNREFUSED")
        ? `API indisponível em ${base}. Rode \`pnpm dev\` na raiz.`
        : err instanceof Error
          ? err.message
          : "Falha ao conectar na API",
    );
  }
  if (res.status === 204) return;
  if (!res.ok) {
    const payload = await readApiErrorPayload(res);
    if (payload.details) {
      throw new ApiValidationError(payload.error, payload.details);
    }
    throw new Error(payload.error);
  }
  return res.json() as Promise<T>;
}

export async function createTenant(input: TenantInput): Promise<TenantDto> {
  return mutateJson<TenantDto>(url("/api/tenants"), "POST", input) as Promise<TenantDto>;
}

export async function updateTenant(id: string, input: Partial<TenantInput>): Promise<TenantDto> {
  return mutateJson<TenantDto>(url(`/api/tenants/${id}`), "PATCH", input) as Promise<TenantDto>;
}

export async function deleteTenant(id: string): Promise<void> {
  await mutateJson(url(`/api/tenants/${id}`), "DELETE");
}

/** Uma chamada por request (layout + páginas compartilham o mesmo resultado). */
export const getTenants = cache(listTenants);

export async function listNfes(tenantId?: string): Promise<NFeDto[]> {
  return getJson<NFeDto[]>(url("/api/nfes", { tenantId }));
}

export async function getNfeByChave(chave: string): Promise<NFeDto | null> {
  const href = url(`/api/nfes/${chave}`);
  const res = await fetch(href, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
  return res.json() as Promise<NFeDto>;
}

export async function deleteNfe(chave: string): Promise<void> {
  await mutateJson(url(`/api/nfes/${chave}`), "DELETE");
}

export async function lookupCnpj(cnpj: string): Promise<CnpjLookupDto> {
  const digits = cnpj.replace(/\D/g, "");
  return getJson<CnpjLookupDto>(url(`/api/lookup/cnpj/${digits}`));
}

export async function lookupCep(cep: string): Promise<CepLookupDto> {
  const digits = cep.replace(/\D/g, "");
  return getJson<CepLookupDto>(url(`/api/lookup/cep/${digits}`));
}

export async function getEmitente(tenantId?: string): Promise<EmitenteDto> {
  return getJson<EmitenteDto>(url("/api/emitente", { tenantId }));
}

export async function listCtes(tenantId?: string): Promise<CTeDto[]> {
  return getJson<CTeDto[]>(url("/api/ctes", { tenantId }));
}

export async function getCteByChave(chave: string): Promise<CTeDto | null> {
  const href = url(`/api/ctes/${chave}`);
  const res = await fetch(href, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json() as Promise<CTeDto>;
}

export async function deleteCte(chave: string): Promise<void> {
  await mutateJson(url(`/api/ctes/${chave}`), "DELETE");
}

export async function listFiscalEvents(tenantId?: string): Promise<FiscalEventDto[]> {
  return getJson<FiscalEventDto[]>(url("/api/fiscal-events", { tenantId }));
}

export async function listAuditLogs(tenantId?: string): Promise<AuditEntryDto[]> {
  return getJson<AuditEntryDto[]>(url("/api/audit-logs", { tenantId }));
}

export async function listTimeline(tenantId?: string): Promise<TimelineChainDto[]> {
  return getJson<TimelineChainDto[]>(url("/api/timeline", { tenantId }));
}

export async function listTimelineSteps(tenantId?: string): Promise<TimelineStepDto[]> {
  return getJson<TimelineStepDto[]>(url("/api/timeline/steps", { tenantId }));
}

export async function listProducts(tenantId?: string): Promise<ProductDto[]> {
  return getJson<ProductDto[]>(url("/api/products", { tenantId }));
}

export async function getProduct(id: string): Promise<ProductDto | null> {
  const href = url(`/api/products/${id}`);
  const res = await fetch(href, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json() as Promise<ProductDto>;
}

export async function checkoutPedido(tenantId: string, input: PedidoCheckoutInput): Promise<NFeDto> {
  return mutateJson<NFeDto>(url("/api/pedidos/checkout", { tenantId }), "POST", input) as Promise<NFeDto>;
}

export async function listPedidos(tenantId?: string): Promise<PedidoDto[]> {
  return getJson<PedidoDto[]>(url("/api/pedidos", { tenantId }));
}

export async function createPedido(tenantId: string, input: PedidoCheckoutInput): Promise<PedidoDto> {
  return mutateJson<PedidoDto>(url("/api/pedidos", { tenantId }), "POST", input) as Promise<PedidoDto>;
}

export async function updatePedido(id: string, input: PedidoCheckoutInput): Promise<PedidoDto> {
  return mutateJson<PedidoDto>(url(`/api/pedidos/${id}`), "PATCH", input) as Promise<PedidoDto>;
}

export async function faturarPedido(id: string): Promise<PedidoFaturarResult> {
  return mutateJson<PedidoFaturarResult>(url(`/api/pedidos/${id}/faturar`), "POST") as Promise<PedidoFaturarResult>;
}

export async function deletePedido(id: string): Promise<void> {
  await mutateJson(url(`/api/pedidos/${id}`), "DELETE");
}

export async function createProduct(tenantId: string, input: ProductInput): Promise<ProductDto> {
  return mutateJson<ProductDto>(url("/api/products", { tenantId }), "POST", input) as Promise<ProductDto>;
}

export async function updateProduct(id: string, input: Partial<ProductInput>): Promise<ProductDto> {
  return mutateJson<ProductDto>(url(`/api/products/${id}`), "PATCH", input) as Promise<ProductDto>;
}

export async function deleteProduct(id: string): Promise<void> {
  await mutateJson(url(`/api/products/${id}`), "DELETE");
}

export type ProductBulkUpsertResult = {
  created: number;
  updated: number;
  failed: { line: number; sku: string; error: string }[];
  total: number;
};

export async function bulkUpsertProducts(
  tenantId: string,
  rows: ProductInput[],
): Promise<ProductBulkUpsertResult> {
  return mutateJson<ProductBulkUpsertResult>(url("/api/products/bulk-upsert", { tenantId }), "POST", {
    rows,
  }) as Promise<ProductBulkUpsertResult>;
}

export async function listTaxRules(tenantId?: string): Promise<TaxRuleDto[]> {
  return getJson<TaxRuleDto[]>(url("/api/tax-rules", { tenantId }));
}

export type TaxRuleImportRow = {
  ruleId: string;
  nome: string;
  tipo: string;
  uf: string;
  cfop?: string;
  aliquota?: string;
  transactionType?: string;
  customerType?: string;
  origin?: string;
  payload?: Record<string, unknown>;
};

export type TaxRuleBulkUpsertResult = {
  created: number;
  updated: number;
  total: number;
};

export async function bulkUpsertTaxRules(
  tenantId: string,
  rows: TaxRuleImportRow[],
): Promise<TaxRuleBulkUpsertResult> {
  return mutateJson<TaxRuleBulkUpsertResult>(url("/api/tax-rules/bulk-upsert", { tenantId }), "POST", {
    rows,
  }) as Promise<TaxRuleBulkUpsertResult>;
}
