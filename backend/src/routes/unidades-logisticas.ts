import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  UnidadeLogisticaError,
  UnidadeLogisticaService,
  type UnidadeLogisticaImportRow,
} from "../services/unidade-logistica-service.js";
import { emitirAvancoEntreCds, AvancoCdError } from "../services/avanco-cd-service.js";
import { listarMovimentacoesProduto } from "../services/movimentacao-produto-service.js";

const importRowSchema = z.object({
  unidade: z.string().min(1),
  cnpj: z.union([z.string(), z.number()]),
  inscricaoEstadual: z.union([z.string(), z.number()]).optional(),
  logradouro: z.string(),
  numero: z.string(),
  cidade: z.string(),
  uf: z.string().min(2).max(2),
  cep: z.union([z.string(), z.number()]),
});

export async function unidadesLogisticasRoutes(app: FastifyInstance) {
  app.get("/unidades-logisticas", async (req, reply) => {
    const q = req.query as { tenantId?: string; ativa?: string; q?: string };
    if (!q.tenantId) return reply.status(400).send({ error: "tenantId obrigatório" });
    const service = new UnidadeLogisticaService(app.prisma);
    const ativa = q.ativa === "false" ? false : q.ativa === "true" ? true : undefined;
    return service.list(q.tenantId, { ativa, q: q.q });
  });

  app.get("/unidades-logisticas/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const q = req.query as { tenantId?: string };
    if (!q.tenantId) return reply.status(400).send({ error: "tenantId obrigatório" });
    const service = new UnidadeLogisticaService(app.prisma);
    const row = await service.getById(q.tenantId, id);
    if (!row) return reply.status(404).send({ error: "Unidade não encontrada" });
    return row;
  });

  app.post("/unidades-logisticas/bulk-import", async (req, reply) => {
    const body = req.body as {
      tenantId?: string;
      rows?: UnidadeLogisticaImportRow[];
      enrichCep?: boolean;
    };
    if (!body.tenantId) return reply.status(400).send({ error: "tenantId obrigatório" });
    const parsed = z.array(importRowSchema).safeParse(body.rows ?? []);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Linhas inválidas", details: parsed.error.flatten() });
    }
    try {
      const service = new UnidadeLogisticaService(app.prisma);
      const rows: UnidadeLogisticaImportRow[] = parsed.data.map((r) => ({
        ...r,
        cnpj: r.cnpj,
        cep: r.cep,
        inscricaoEstadual: r.inscricaoEstadual,
      }));
      return await service.bulkImport(body.tenantId, rows, body.enrichCep !== false);
    } catch (e) {
      if (e instanceof UnidadeLogisticaError) {
        return reply.status(400).send({ error: e.message });
      }
      throw e;
    }
  });

  app.patch("/unidades-logisticas/:id/padrao", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { tenantId?: string };
    if (!body.tenantId) return reply.status(400).send({ error: "tenantId obrigatório" });
    try {
      const service = new UnidadeLogisticaService(app.prisma);
      return await service.setPadrao(body.tenantId, id);
    } catch (e) {
      if (e instanceof UnidadeLogisticaError) {
        return reply.status(400).send({ error: e.message });
      }
      throw e;
    }
  });

  app.post("/movimentacoes/avanco-cd", async (req, reply) => {
    const body = req.body as {
      tenantId?: string;
      productId?: string;
      quantidade?: number;
      unidadeOrigemId?: string;
      unidadeDestinoId?: string;
    };
    const schema = z.object({
      tenantId: z.string().uuid(),
      productId: z.string().uuid(),
      quantidade: z.number().int().min(1),
      unidadeOrigemId: z.string().uuid(),
      unidadeDestinoId: z.string().uuid(),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Payload inválido", details: parsed.error.flatten() });
    }
    try {
      return await emitirAvancoEntreCds(app.prisma, parsed.data);
    } catch (e) {
      if (e instanceof AvancoCdError || e instanceof UnidadeLogisticaError) {
        return reply.status(400).send({ error: e.message });
      }
      throw e;
    }
  });

  app.get("/movimentacoes-produto", async (req, reply) => {
    const q = req.query as { tenantId?: string; productId?: string; limit?: string };
    if (!q.tenantId) return reply.status(400).send({ error: "tenantId obrigatório" });
    return listarMovimentacoesProduto(app.prisma, q.tenantId, {
      productId: q.productId,
      limit: q.limit ? Number(q.limit) : undefined,
    });
  });
}
