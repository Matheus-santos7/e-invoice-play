import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("api"),
  timestamp: z.string().datetime(),
});

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/health", async () => {
    const body = {
      status: "ok" as const,
      service: "api" as const,
      timestamp: new Date().toISOString(),
    };
    return healthResponseSchema.parse(body);
  });
};
