/**
 * Rotas HTTP `/api/*` de documentos fiscais, timeline e regras tributárias.
 *
 * ## Responsabilidade desta camada
 *
 * - Validar query/params/body (Zod).
 * - Resolver `tenantId` (query opcional → tenant padrão do ambiente).
 * - Delegar regras de negócio aos *services* (`*-service.ts`).
 * - Mapear entidades Prisma → DTO (`fiscal-mappers`, `tenant-mapper`).
 *
 * Emissões (remessa, venda, devolução) ficam em `pedidos`, `products` e services;
 * aqui há leitura, soft delete, cancelamento, inutilização e import de planilha.
 *
 * ## Mapa de rotas (prefixo `/api`)
 *
 * | Método | Caminho | Service / origem |
 * |--------|---------|------------------|
 * | GET | `/nfes` | Prisma + `mapNfe` |
 * | GET | `/nfes/:chave` | Prisma (detalhe + referenciadas + CT-e) |
 * | DELETE | `/nfes/:chave` | `FiscalService.softDeleteNfe` |
 * | POST | `/nfes/:chave/devolucao` | `emitirDevolucaoVenda` |
 * | POST | `/nfes/:chave/cancelamento` | `cancelarVenda` |
 * | POST | `/nfes/inutilizar` | `inutilizarNumeracao` — registrar **antes** de rotas com `:chave` |
 * | GET | `/emitente` | Tenant |
 * | GET/DELETE | `/ctes`, `/ctes/:chave` | Prisma / `FiscalService` |
 * | GET | `/fiscal-events` | Eventos 110111 + inutilizações (`INUT`) |
 * | GET | `/audit-logs` | Auditoria |
 * | GET | `/timeline` | `listTimelineChains` |
 * | GET | `/timeline/steps` | Seed legado |
 * | GET | `/tax-rules`, `/tax-rules/catalog` | Planilha / catálogo |
 * | POST | `/tax-rules/bulk-upsert` | Importação em lote |
 *
 * @see backend/docs/COMENTARIOS.md — convenções de comentário no backend
 */
import type { FastifyInstance, FastifyReply } from "fastify";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { mapCte, mapNfe, mapTimeline, resolveTenantId } from "../lib/fiscal-mappers.js";
import { mapEmitente } from "../lib/tenant-mapper.js";
import { FiscalService, fiscalNotDeleted } from "../services/fiscal-service.js";
import { listTaxRuleCatalog } from "../services/tax-rule-catalog-service.js";
import { listTimelineChains } from "../services/timeline-service.js";
import { CancelamentoError, cancelarVenda } from "../services/cancelamento-service.js";
import { DevolucaoError, emitirDevolucaoVenda } from "../services/devolucao-service.js";
import { InutilizacaoError, inutilizarNumeracao } from "../services/inutilizacao-service.js";

// ---------------------------------------------------------------------------
// Schemas Zod
// ---------------------------------------------------------------------------

const tenantQuerySchema = z.object({
  tenantId: z.string().uuid().optional(),
});

const chaveParamSchema = z.object({
  chave: z.string().length(44),
});

const cancelamentoBodySchema = z.object({
  xJust: z.string().min(15).max(255).optional(),
});

const inutilizarBodySchema = z.object({
  tenantId: z.string().uuid().optional(),
  serie: z.number().int().positive(),
  numeroIni: z.number().int().positive(),
  numeroFim: z.number().int().positive(),
  xJust: z.string().min(15).max(255).optional(),
});

const taxRuleImportRowSchema = z.object({
  ruleId: z.string().min(1),
  nome: z.string().min(1),
  tipo: z.string().min(1),
  uf: z.string().length(2),
  cfop: z.string().optional().default(""),
  aliquota: z.string().optional().default(""),
  transactionType: z.string().optional(),
  customerType: z.string().optional(),
  origin: z.string().optional(),
  payload: z.record(z.any()).optional(),
});

const taxRulesBulkBodySchema = z.object({
  rows: z.array(taxRuleImportRowSchema).min(1).max(5000),
});

// ---------------------------------------------------------------------------
// Helpers HTTP
// ---------------------------------------------------------------------------

async function resolveTenant(app: FastifyInstance, tenantId?: string) {
  return resolveTenantId(app.prisma, tenantId);
}

/** Converte erros de domínio (*Error com `.status`) em JSON `{ error }` sem vazar stack. */
function replyDomainError(
  reply: FastifyReply,
  e: unknown,
  types: Array<new (message: string, status?: number) => Error & { status: number }>,
): boolean {
  for (const Ctor of types) {
    if (e instanceof Ctor) {
      void reply.status(e.status).send({ error: e.message });
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// NF-e
// ---------------------------------------------------------------------------

function registerNfeRoutes(app: FastifyInstance, fiscal: FiscalService) {
  app.get("/nfes", async (req) => {
    const { tenantId } = tenantQuerySchema.parse(req.query);
    const tid = await resolveTenant(app, tenantId);
    const rows = await app.prisma.nFe.findMany({
      where: { tenantId: tid, ...fiscalNotDeleted },
      include: { nfeReferencia: { select: { chave: true } } },
      orderBy: [{ emitidaEm: "desc" }, { serie: "desc" }, { numero: "desc" }],
    });
    return rows.map((r) => mapNfe(r, r.nfeReferencia?.chave));
  });

  app.get("/nfes/:chave", async (req, reply) => {
    const { chave } = chaveParamSchema.parse(req.params);
    const row = await app.prisma.nFe.findFirst({
      where: { chave, ...fiscalNotDeleted },
      include: {
        cteRemessa: { select: { chave: true } },
        cteVenda: { select: { chave: true } },
        nfeReferencia: { select: { chave: true, tipo: true, numero: true, serie: true } },
        nfeReferenciadas: { select: { chave: true, tipo: true, numero: true, serie: true } },
      },
    });
    if (!row) return reply.status(404).send({ error: "NF-e não encontrada" });

    const dto = mapNfe(row, row.nfeReferencia?.chave);
    return {
      ...dto,
      cteChaveRef: row.cteRemessa?.chave ?? row.cteVenda?.chave,
      referenciadas: row.nfeReferenciadas.map((n) => ({
        chave: n.chave,
        tipo: n.tipo,
        numero: n.numero,
        serie: n.serie,
      })),
    };
  });

  // Rota estática antes das rotas com `:chave` (evita ambiguidade no roteador).
  app.post("/nfes/inutilizar", async (req, reply) => {
    try {
      const body = inutilizarBodySchema.parse(req.body ?? {});
      const tid = await resolveTenant(app, body.tenantId);
      const result = await inutilizarNumeracao(app.prisma, {
        tenantId: tid,
        serie: body.serie,
        numeroIni: body.numeroIni,
        numeroFim: body.numeroFim,
        xJust: body.xJust,
      });
      return reply.status(201).send(result);
    } catch (e) {
      if (replyDomainError(reply, e, [InutilizacaoError])) return;
      throw e;
    }
  });

  app.delete("/nfes/:chave", async (req, reply) => {
    const { chave } = chaveParamSchema.parse(req.params);
    const removed = await fiscal.softDeleteNfe(chave);
    if (!removed) return reply.status(404).send({ error: "NF-e não encontrada" });
    return reply.status(204).send();
  });

  app.post("/nfes/:chave/devolucao", async (req, reply) => {
    try {
      const { chave } = chaveParamSchema.parse(req.params);
      const result = await emitirDevolucaoVenda(app.prisma, chave);
      return reply.status(201).send(result);
    } catch (e) {
      if (replyDomainError(reply, e, [DevolucaoError])) return;
      throw e;
    }
  });

  app.post("/nfes/:chave/cancelamento", async (req, reply) => {
    try {
      const { chave } = chaveParamSchema.parse(req.params);
      const body = cancelamentoBodySchema.parse(req.body ?? {});
      const result = await cancelarVenda(app.prisma, chave, body.xJust);
      return reply.status(200).send(result);
    } catch (e) {
      if (replyDomainError(reply, e, [CancelamentoError])) return;
      throw e;
    }
  });
}

// ---------------------------------------------------------------------------
// CT-e, emitente, eventos, auditoria, timeline
// ---------------------------------------------------------------------------

function registerCteAndEmitenteRoutes(app: FastifyInstance, fiscal: FiscalService) {
  app.get("/emitente", async (req) => {
    const { tenantId } = tenantQuerySchema.parse(req.query);
    const tid = await resolveTenant(app, tenantId);
    const t = await app.prisma.tenant.findUniqueOrThrow({ where: { id: tid } });
    return mapEmitente(t);
  });

  app.get("/ctes", async (req) => {
    const { tenantId } = tenantQuerySchema.parse(req.query);
    const tid = await resolveTenant(app, tenantId);
    const rows = await app.prisma.cTe.findMany({
      where: { tenantId: tid, ...fiscalNotDeleted },
      include: { nfeRemessa: { select: { chave: true } } },
      orderBy: { emitidoEm: "desc" },
    });
    return rows.map((r) => mapCte(r, r.nfeRemessa?.chave));
  });

  app.get("/ctes/:chave", async (req, reply) => {
    const { chave } = chaveParamSchema.parse(req.params);
    const row = await app.prisma.cTe.findFirst({
      where: { chave, ...fiscalNotDeleted },
      include: { nfeRemessa: { select: { chave: true } } },
    });
    if (!row) return reply.status(404).send({ error: "CT-e não encontrado" });
    return mapCte(row, row.nfeRemessa?.chave);
  });

  app.delete("/ctes/:chave", async (req, reply) => {
    const { chave } = chaveParamSchema.parse(req.params);
    const removed = await fiscal.softDeleteCte(chave);
    if (!removed) return reply.status(404).send({ error: "CT-e não encontrado" });
    return reply.status(204).send();
  });
}

async function listFiscalEventsForTenant(app: FastifyInstance, tenantId: string) {
  const [rows, inuts] = await Promise.all([
    app.prisma.fiscalEvent.findMany({
      where: { tenantId },
      include: { nfe: true },
      orderBy: { ocorridoEm: "desc" },
    }),
    app.prisma.nfeInutilizacao.findMany({
      where: { tenantId },
      orderBy: { ocorridoEm: "desc" },
    }),
  ]);

  const eventos = rows.map((e) => ({
    id: e.id,
    tipo: e.tipo,
    descricao: e.descricao,
    chaveRef: e.nfe.chave,
    ocorridoEm: e.ocorridoEm.toISOString(),
    protocolo: e.protocolo,
    xJust: e.xJust ?? undefined,
  }));

  const inutilizacoes = inuts.map((i) => ({
    id: i.id,
    tipo: "INUT" as const,
    descricao: "Inutilização de numeração",
    serie: i.serie,
    numeroIni: i.numeroIni,
    numeroFim: i.numeroFim,
    ocorridoEm: i.ocorridoEm.toISOString(),
    protocolo: i.protocolo,
    xJust: i.xJust,
  }));

  return [...eventos, ...inutilizacoes].sort(
    (a, b) => new Date(b.ocorridoEm).getTime() - new Date(a.ocorridoEm).getTime(),
  );
}

function registerObservabilityRoutes(app: FastifyInstance) {
  app.get("/fiscal-events", async (req) => {
    const { tenantId } = tenantQuerySchema.parse(req.query);
    const tid = await resolveTenant(app, tenantId);
    return listFiscalEventsForTenant(app, tid);
  });

  app.get("/audit-logs", async (req) => {
    const { tenantId } = tenantQuerySchema.parse(req.query);
    const tid = await resolveTenant(app, tenantId);
    const rows = await app.prisma.auditLog.findMany({
      where: { tenantId: tid },
      orderBy: { ocorridoEm: "desc" },
    });
    return rows.map((a) => ({
      id: a.id,
      ator: a.ator,
      acao: a.acao,
      recurso: a.recurso,
      ocorridoEm: a.ocorridoEm.toISOString(),
      hash: a.hash,
    }));
  });

  /** Cadeias: remessa → retorno → venda → (devolução). */
  app.get("/timeline", async (req) => {
    const { tenantId } = tenantQuerySchema.parse(req.query);
    const tid = await resolveTenant(app, tenantId);
    return listTimelineChains(app.prisma, tid);
  });

  /** Passos estáticos do seed (UI legada). */
  app.get("/timeline/steps", async (req) => {
    const { tenantId } = tenantQuerySchema.parse(req.query);
    const tid = await resolveTenant(app, tenantId);
    const rows = await app.prisma.timelineStep.findMany({
      where: { tenantId: tid },
      orderBy: { sortOrder: "asc" },
    });
    return rows.map(mapTimeline);
  });
}

// ---------------------------------------------------------------------------
// Regras fiscais (planilha)
// ---------------------------------------------------------------------------

function registerTaxRuleRoutes(app: FastifyInstance) {
  app.get("/tax-rules/catalog", async (req) => {
    const { tenantId } = tenantQuerySchema.parse(req.query);
    const tid = await resolveTenant(app, tenantId);
    return listTaxRuleCatalog(app.prisma, tid);
  });

  app.get("/tax-rules", async (req) => {
    const { tenantId } = tenantQuerySchema.parse(req.query);
    const tid = await resolveTenant(app, tenantId);
    const rows = await app.prisma.taxRule.findMany({
      where: { tenantId: tid },
      orderBy: { ruleId: "asc" },
    });
    return rows.map((r) => ({
      id: r.ruleId,
      nome: r.nome,
      tipo: r.tipo,
      uf: r.uf,
      origin: r.origin ?? undefined,
      cfop: r.cfop,
      aliquota: r.aliquota,
      transactionType: r.transactionType ?? undefined,
      customerType: r.customerType ?? undefined,
      source: r.source,
      payload: r.payload ?? undefined,
    }));
  });

  app.post("/tax-rules/bulk-upsert", async (req, reply) => {
    const { tenantId } = tenantQuerySchema.parse(req.query);
    const tid = await resolveTenant(app, tenantId);
    const { rows } = taxRulesBulkBodySchema.parse(req.body);

    let created = 0;
    let updated = 0;

    for (const row of rows) {
      const existing = await app.prisma.taxRule.findUnique({
        where: { tenantId_ruleId: { tenantId: tid, ruleId: row.ruleId } },
        select: { id: true },
      });

      await app.prisma.taxRule.upsert({
        where: { tenantId_ruleId: { tenantId: tid, ruleId: row.ruleId } },
        create: {
          tenantId: tid,
          ruleId: row.ruleId,
          nome: row.nome,
          tipo: row.tipo,
          uf: row.uf,
          cfop: row.cfop,
          aliquota: row.aliquota,
          transactionType: row.transactionType,
          customerType: row.customerType,
          origin: row.origin,
          source: "xlsx",
          payload: row.payload,
        },
        update: {
          nome: row.nome,
          tipo: row.tipo,
          uf: row.uf,
          cfop: row.cfop,
          aliquota: row.aliquota,
          transactionType: row.transactionType,
          customerType: row.customerType,
          origin: row.origin,
          source: "xlsx",
          payload: row.payload,
        },
      });

      if (existing) updated++;
      else created++;
    }

    return reply.status(200).send({ created, updated, total: rows.length });
  });
}

// ---------------------------------------------------------------------------
// Plugin Fastify
// ---------------------------------------------------------------------------

export const fiscalRoutes: FastifyPluginAsync = async (app) => {
  const fiscal = new FiscalService(app.prisma);

  registerNfeRoutes(app, fiscal);
  registerCteAndEmitenteRoutes(app, fiscal);
  registerObservabilityRoutes(app);
  registerTaxRuleRoutes(app);
};
