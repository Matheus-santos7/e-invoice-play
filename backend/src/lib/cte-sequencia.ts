import type { PrismaClient } from "../generated/prisma/client.js";
import { fiscalNotDeleted } from "../services/fiscal-service.js";

export async function proximoNumeroCte(
  prisma: PrismaClient,
  tenantId: string,
  serie: number,
): Promise<number> {
  const last = await prisma.cTe.findFirst({
    where: { tenantId, serie, ...fiscalNotDeleted },
    orderBy: { numero: "desc" },
    select: { numero: true },
  });
  return (last?.numero ?? 0) + 1;
}
