/**
 * Operações transversais de documentos fiscais (exclusão lógica).
 *
 * NF-e e CT-e não são apagados do banco: `deletedAt` oculta da listagem.
 * Isso não cancela na SEFAZ — use `cancelamento-service` para evento 110111.
 */
import type { PrismaClient } from "../generated/prisma/client.js";

export class FiscalService {
  constructor(private readonly prisma: PrismaClient) {}

  async softDeleteNfe(chave: string): Promise<boolean> {
    const existing = await this.prisma.nFe.findUnique({ where: { chave } });
    if (!existing || existing.deletedAt) return false;
    await this.prisma.nFe.update({
      where: { chave },
      data: { deletedAt: new Date() },
    });
    return true;
  }

  async softDeleteCte(chave: string): Promise<boolean> {
    const existing = await this.prisma.cTe.findUnique({ where: { chave } });
    if (!existing || existing.deletedAt) return false;
    await this.prisma.cTe.update({
      where: { chave },
      data: { deletedAt: new Date() },
    });
    return true;
  }
}

/** Registros visíveis na UI (não excluídos logicamente). */
export const fiscalNotDeleted = { deletedAt: null } as const;
