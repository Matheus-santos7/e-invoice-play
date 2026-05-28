import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { mapCte, mapNfe, mapTimeline, resolveTenantId } from "../lib/fiscal-mappers.js";
import { mapEmitente } from "../lib/tenant-mapper.js";
import { FiscalService, fiscalNotDeleted } from "../services/fiscal-service.js";
import { listTimelineChains } from "../services/timeline-service.js";

const tenantQuery = z.object({
  tenantId: z.string().uuid().optional(),
});

const chaveParam = z.object({
  chave: z.string().length(44),
});

const taxRuleImportRow = z.object({
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

const taxRulesBulkBody = z.object({
  rows: z.array(taxRuleImportRow).min(1).max(5000),
});

export const fiscalRoutes: FastifyPluginAsync = async (app) => {
  const fiscal = new FiscalService(app.prisma);

  app.get("/nfes", async (req) => {
    const { tenantId } = tenantQuery.parse(req.query);
    const tid = await resolveTenantId(app.prisma, tenantId);
    const rows = await app.prisma.nFe.findMany({
      where: { tenantId: tid, ...fiscalNotDeleted },
      include: { nfeReferencia: { select: { chave: true } } },
      orderBy: { emitidaEm: "desc" },
    });
    return rows.map((r) => mapNfe(r, r.nfeReferencia?.chave));
  });

  app.get("/nfes/:chave", async (req, reply) => {
    const { chave } = chaveParam.parse(req.params);
    const row = await app.prisma.nFe.findFirst({
      where: { chave, ...fiscalNotDeleted },
      include: {
        cteRemessa: { select: { chave: true } },
        nfeReferencia: { select: { chave: true, tipo: true, numero: true, serie: true } },
        nfeReferenciadas: { select: { chave: true, tipo: true, numero: true, serie: true } },
      },
    });
    if (!row) return reply.status(404).send({ error: "NF-e não encontrada" });
    const dto = mapNfe(row, row.nfeReferencia?.chave);
    return {
      ...dto,
      cteChaveRef: row.cteRemessa?.chave,
      referencias: row.nfeReferenciadas.map((n) => ({
        chave: n.chave,
        tipo: n.tipo,
        numero: n.numero,
        serie: n.serie,
      })),
    };
  });

  app.delete("/nfes/:chave", async (req, reply) => {
    const { chave } = chaveParam.parse(req.params);
    const removed = await fiscal.softDeleteNfe(chave);
    if (!removed) return reply.status(404).send({ error: "NF-e não encontrada" });
    return reply.status(204).send();
  });

  app.get("/emitente", async (req) => {
    const { tenantId } = tenantQuery.parse(req.query);
    const tid = await resolveTenantId(app.prisma, tenantId);
    const t = await app.prisma.tenant.findUniqueOrThrow({ where: { id: tid } });
    return mapEmitente(t);
  });

  app.get("/ctes", async (req) => {
    const { tenantId } = tenantQuery.parse(req.query);
    const tid = await resolveTenantId(app.prisma, tenantId);
    const rows = await app.prisma.cTe.findMany({
      where: { tenantId: tid, ...fiscalNotDeleted },
      include: { nfeRemessa: { select: { chave: true } } },
      orderBy: { emitidoEm: "desc" },
    });
    return rows.map((r) => mapCte(r, r.nfeRemessa?.chave));
  });

  app.get("/ctes/:chave", async (req, reply) => {
    const { chave } = chaveParam.parse(req.params);
    const row = await app.prisma.cTe.findFirst({
      where: { chave, ...fiscalNotDeleted },
      include: { nfeRemessa: { select: { chave: true } } },
    });
    if (!row) return reply.status(404).send({ error: "CT-e não encontrado" });
    return mapCte(row, row.nfeRemessa?.chave);
  });

  app.delete("/ctes/:chave", async (req, reply) => {
    const { chave } = chaveParam.parse(req.params);
    const removed = await fiscal.softDeleteCte(chave);
    if (!removed) return reply.status(404).send({ error: "CT-e não encontrado" });
    return reply.status(204).send();
  });

  app.get("/fiscal-events", async (req) => {
    const { tenantId } = tenantQuery.parse(req.query);
    const tid = await resolveTenantId(app.prisma, tenantId);
    const rows = await app.prisma.fiscalEvent.findMany({
      where: { tenantId: tid },
      include: { nfe: true },
      orderBy: { ocorridoEm: "desc" },
    });
    return rows.map((e) => ({
      id: e.id,
      tipo: e.tipo,
      descricao: e.descricao,
      chaveRef: e.nfe.chave,
      ocorridoEm: e.ocorridoEm.toISOString(),
      protocolo: e.protocolo,
    }));
  });

  app.get("/audit-logs", async (req) => {
    const { tenantId } = tenantQuery.parse(req.query);
    const tid = await resolveTenantId(app.prisma, tenantId);
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

  /** Cadeias fiscais: Remessa → Retorno simbólico → Venda → (Devolução) */
  app.get("/timeline", async (req) => {
    const { tenantId } = tenantQuery.parse(req.query);
    const tid = await resolveTenantId(app.prisma, tenantId);
    return listTimelineChains(app.prisma, tid);
  });

  /** Passos operacionais estáticos (legado / seed) */
  app.get("/timeline/steps", async (req) => {
    const { tenantId } = tenantQuery.parse(req.query);
    const tid = await resolveTenantId(app.prisma, tenantId);
    const rows = await app.prisma.timelineStep.findMany({
      where: { tenantId: tid },
      orderBy: { sortOrder: "asc" },
    });
    return rows.map(mapTimeline);
  });

  app.get("/tax-rules", async (req) => {
    const { tenantId } = tenantQuery.parse(req.query);
    const tid = await resolveTenantId(app.prisma, tenantId);
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
    const { tenantId } = tenantQuery.parse(req.query);
    const tid = await resolveTenantId(app.prisma, tenantId);
    const { rows } = taxRulesBulkBody.parse(req.body);

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
};
