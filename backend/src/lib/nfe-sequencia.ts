import type { PrismaClient } from "../generated/prisma/client.js";
import { fiscalNotDeleted } from "../services/fiscal-service.js";

/** Próximo número da NF-e para a série informada (por tenant). */
export async function proximoNumeroNfe(
  prisma: PrismaClient,
  tenantId: string,
  serie: number,
): Promise<number> {
  const last = await prisma.nFe.findFirst({
    where: { tenantId, serie, ...fiscalNotDeleted },
    orderBy: { numero: "desc" },
    select: { numero: true },
  });
  return (last?.numero ?? 0) + 1;
}
