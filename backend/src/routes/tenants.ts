import type { FastifyPluginAsync } from "fastify";
import { ZodError } from "zod";
import { tenantCreateBody, tenantIdParam, tenantUpdateBody } from "../schemas/tenant.js";
import { TenantConflictError, TenantService } from "../services/tenant-service.js";

export const tenantRoutes: FastifyPluginAsync = async (app) => {
  const service = new TenantService(app.prisma);

  app.get("/tenants", async () => service.list());

  app.get("/tenants/:id", async (req, reply) => {
    const { id } = tenantIdParam.parse(req.params);
    const tenant = await service.getById(id);
    if (!tenant) return reply.status(404).send({ error: "Empresa não encontrada" });
    return tenant;
  });

  app.post("/tenants", async (req, reply) => {
    try {
      const body = tenantCreateBody.parse(req.body);
      const tenant = await service.create(body);
      return reply.status(201).send(tenant);
    } catch (e) {
      return handleTenantError(e, reply);
    }
  });

  app.patch("/tenants/:id", async (req, reply) => {
    try {
      const { id } = tenantIdParam.parse(req.params);
      const body = tenantUpdateBody.parse(req.body);
      const tenant = await service.update(id, body);
      if (!tenant) return reply.status(404).send({ error: "Empresa não encontrada" });
      return tenant;
    } catch (e) {
      return handleTenantError(e, reply);
    }
  });

  app.delete("/tenants/:id", async (req, reply) => {
    const { id } = tenantIdParam.parse(req.params);
    const removed = await service.remove(id);
    if (!removed) return reply.status(404).send({ error: "Empresa não encontrada" });
    return reply.status(204).send();
  });
};

function handleTenantError(e: unknown, reply: { status: (code: number) => { send: (body: unknown) => unknown } }) {
  if (e instanceof ZodError) {
    const fieldErrors = e.flatten().fieldErrors as Record<string, string[]>;
    const first = Object.values(fieldErrors).flat()[0];
    return reply.status(400).send({
      error: first ?? "Dados inválidos",
      details: fieldErrors,
    });
  }
  if (e instanceof TenantConflictError) {
    return reply.status(409).send({ error: e.message });
  }
  throw e;
}
