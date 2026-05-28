import type { Prisma, PrismaClient } from "../generated/prisma/client.js";
import { mapTenant } from "../lib/tenant-mapper.js";
import type { tenantCreateBody, tenantUpdateBody } from "../schemas/tenant.js";
import type { z } from "zod";

type CreateInput = z.infer<typeof tenantCreateBody>;
type UpdateInput = z.infer<typeof tenantUpdateBody>;

export class TenantService {
  constructor(private readonly prisma: PrismaClient) {}

  async list() {
    const rows = await this.prisma.tenant.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map(mapTenant);
  }

  async getById(id: string) {
    const row = await this.prisma.tenant.findUnique({ where: { id } });
    return row ? mapTenant(row) : null;
  }

  async create(data: CreateInput) {
    try {
      const row = await this.prisma.tenant.create({ data: data as Prisma.TenantCreateInput });
      return mapTenant(row);
    } catch (e) {
      if (isPrismaUniqueError(e)) {
        throw new TenantConflictError("CNPJ já cadastrado");
      }
      throw e;
    }
  }

  async update(id: string, data: UpdateInput) {
    const existing = await this.prisma.tenant.findUnique({ where: { id } });
    if (!existing) return null;

    try {
      const row = await this.prisma.tenant.update({
        where: { id },
        data: data as Prisma.TenantUpdateInput,
      });
      return mapTenant(row);
    } catch (e) {
      if (isPrismaUniqueError(e)) {
        throw new TenantConflictError("CNPJ já cadastrado");
      }
      throw e;
    }
  }

  async remove(id: string) {
    const existing = await this.prisma.tenant.findUnique({ where: { id } });
    if (!existing) return false;
    await this.prisma.tenant.delete({ where: { id } });
    return true;
  }
}

export class TenantConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantConflictError";
  }
}

function isPrismaUniqueError(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "P2002";
}
