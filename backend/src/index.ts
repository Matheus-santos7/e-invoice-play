import "dotenv/config";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { prismaPlugin } from "./plugins/prisma.js";
import { healthRoutes } from "./routes/health.js";
import { fiscalRoutes } from "./routes/fiscal.js";
import { lookupRoutes } from "./routes/lookup.js";
import { tenantRoutes } from "./routes/tenants.js";
import { productRoutes } from "./routes/products.js";
import { pedidoRoutes } from "./routes/pedidos.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(prismaPlugin);
await app.register(healthRoutes, { prefix: "/api" });
await app.register(lookupRoutes, { prefix: "/api" });
await app.register(tenantRoutes, { prefix: "/api" });
await app.register(productRoutes, { prefix: "/api" });
await app.register(pedidoRoutes, { prefix: "/api" });
await app.register(fiscalRoutes, { prefix: "/api" });

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "0.0.0.0";

await app.listen({ port, host });
app.log.info(`API em http://${host === "0.0.0.0" ? "localhost" : host}:${port}`);
