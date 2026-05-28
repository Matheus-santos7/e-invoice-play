import fp from "fastify-plugin";
import { prisma } from "../lib/db/prisma.js";

export const prismaPlugin = fp(async (fastify) => {
  fastify.decorate("prisma", prisma);
  fastify.addHook("onClose", async () => {
    await prisma.$disconnect();
  });
});

declare module "fastify" {
  interface FastifyInstance {
    prisma: typeof prisma;
  }
}
