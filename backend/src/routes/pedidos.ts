import type { FastifyPluginAsync } from "fastify";
import { ZodError } from "zod";
import { resolveTenantId } from "../lib/fiscal-mappers.js";
import { productTenantQuery } from "../schemas/product.js";
import { pedidoCheckoutBody } from "../schemas/pedido-checkout.js";
import { CheckoutError } from "../services/checkout-service.js";
import {
  PedidoLockedError,
  PedidoService,
  SaldoRemessaInsuficienteError,
} from "../services/pedido-service.js";
import { z } from "zod";

const pedidoIdParam = z.object({ id: z.string().uuid() });

export const pedidoRoutes: FastifyPluginAsync = async (app) => {
  const service = new PedidoService(app.prisma);

  app.get("/pedidos", async (req) => {
    const { tenantId } = productTenantQuery.parse(req.query);
    const tid = await resolveTenantId(app.prisma, tenantId);
    return service.list(tid);
  });

  app.get("/pedidos/:id", async (req, reply) => {
    const { id } = pedidoIdParam.parse(req.params);
    const pedido = await service.getById(id);
    if (!pedido) return reply.status(404).send({ error: "Pedido não encontrado" });
    return pedido;
  });

  app.post("/pedidos", async (req, reply) => {
    try {
      const { tenantId } = productTenantQuery.parse(req.query);
      const tid = await resolveTenantId(app.prisma, tenantId);
      const body = pedidoCheckoutBody.parse(req.body);
      const pedido = await service.createDraft(tid, body);
      return reply.status(201).send(pedido);
    } catch (e) {
      return handlePedidoError(e, reply);
    }
  });

  app.patch("/pedidos/:id", async (req, reply) => {
    try {
      const { id } = pedidoIdParam.parse(req.params);
      const body = pedidoCheckoutBody.parse(req.body);
      const pedido = await service.updateDraft(id, body);
      if (!pedido) return reply.status(404).send({ error: "Pedido não encontrado" });
      return pedido;
    } catch (e) {
      return handlePedidoError(e, reply);
    }
  });

  app.post("/pedidos/:id/faturar", async (req, reply) => {
    try {
      const { id } = pedidoIdParam.parse(req.params);
      const result = await service.faturar(id);
      if (!result) return reply.status(404).send({ error: "Pedido não encontrado" });
      return reply.status(201).send(result);
    } catch (e) {
      return handlePedidoError(e, reply);
    }
  });

  app.delete("/pedidos/:id", async (req, reply) => {
    try {
      const { id } = pedidoIdParam.parse(req.params);
      const removed = await service.remove(id);
      if (!removed) return reply.status(404).send({ error: "Pedido não encontrado" });
      return reply.status(204).send();
    } catch (e) {
      return handlePedidoError(e, reply);
    }
  });

  app.post("/pedidos/checkout", async (req, reply) => {
    try {
      const { tenantId } = productTenantQuery.parse(req.query);
      const tid = await resolveTenantId(app.prisma, tenantId);
      const body = pedidoCheckoutBody.parse(req.body);
      const { CheckoutService } = await import("../services/checkout-service.js");
      const checkout = new CheckoutService(app.prisma);
      const nfe = await checkout.checkout(tid, body);
      return reply.status(201).send(nfe);
    } catch (e) {
      return handlePedidoError(e, reply);
    }
  });
};

function handlePedidoError(e: unknown, reply: { status: (code: number) => { send: (body: unknown) => unknown } }) {
  if (e instanceof ZodError) {
    const fieldErrors = e.flatten().fieldErrors as Record<string, string[]>;
    const first = Object.values(fieldErrors).flat()[0];
    return reply.status(400).send({
      error: first ?? "Dados inválidos",
      details: fieldErrors,
    });
  }
  if (e instanceof PedidoLockedError) {
    return reply.status(409).send({ error: e.message });
  }
  if (e instanceof CheckoutError) {
    return reply.status(400).send({ error: e.message });
  }
  if (e instanceof SaldoRemessaInsuficienteError) {
    return reply.status(422).send({
      error: e.message,
      disponivel: e.disponivel,
      solicitado: e.solicitado,
    });
  }
  throw e;
}
