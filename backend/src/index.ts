/**
 * Ponto de entrada da API Fastify (porta padrão 3001).
 *
 * Rotas sob `/api/*`. O frontend Next consome via `NEXT_PUBLIC_API_URL`.
 * Prisma é injetado pelo plugin `plugins/prisma.ts`.
 */
import "dotenv/config";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { prismaPlugin } from "./plugins/prisma.js";
import { healthRoutes } from "./routes/health.js";
import { fiscalRoutes } from "./routes/fiscal.js";
import { fiscalSettingsRoutes } from "./routes/fiscal-settings.js";
import { lookupRoutes } from "./routes/lookup.js";
import { tenantRoutes } from "./routes/tenants.js";
import { productRoutes } from "./routes/products.js";
import { pedidoRoutes } from "./routes/pedidos.js";
import { unidadesLogisticasRoutes } from "./routes/unidades-logisticas.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(prismaPlugin);
await app.register(healthRoutes, { prefix: "/api" });
await app.register(lookupRoutes, { prefix: "/api" });
await app.register(tenantRoutes, { prefix: "/api" });
await app.register(productRoutes, { prefix: "/api" });
await app.register(pedidoRoutes, { prefix: "/api" });
await app.register(fiscalRoutes, { prefix: "/api" });
await app.register(fiscalSettingsRoutes, { prefix: "/api" });
await app.register(unidadesLogisticasRoutes, { prefix: "/api" });

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "0.0.0.0";

await app.listen({ port, host });
app.log.info(`API em http://${host === "0.0.0.0" ? "localhost" : host}:${port}`);
