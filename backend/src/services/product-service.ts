import type { Prisma, PrismaClient } from "../generated/prisma/client.js";
import { mapProduct } from "../lib/product-mapper.js";
import type { productCreateBody, productUpdateBody } from "../schemas/product.js";
import { emitirNFeRemessa, RemessaError } from "./remessa-service.js";
import type { z } from "zod";

type CreateInput = z.infer<typeof productCreateBody>;
type UpdateInput = z.infer<typeof productUpdateBody>;

export class ProductService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(tenantId: string) {
    const rows = await this.prisma.product.findMany({
      where: { tenantId },
      orderBy: { sku: "asc" },
    });
    return rows.map(mapProduct);
  }

  async getById(id: string) {
    const row = await this.prisma.product.findUnique({ where: { id } });
    return row ? mapProduct(row) : null;
  }

  async create(tenantId: string, data: CreateInput) {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    const estoque = data.estoque ?? 0;

    try {
      const row = await this.prisma.product.create({
        data: {
          tenantId,
          sku: data.sku,
          ean: data.ean,
          nome: data.nome,
          ncm: data.ncm,
          cest: data.cest,
          exTipi: data.exTipi,
          cfop: data.cfop,
          origem: data.origem,
          unidade: data.unidade,
          preco: data.preco,
          estoque,
        },
      });

      if (estoque > 0) {
        await emitirNFeRemessa(this.prisma, tenant, row, estoque);
      }

      return mapProduct(row);
    } catch (e) {
      if (isPrismaUniqueError(e)) {
        throw new ProductConflictError("SKU já cadastrado nesta empresa");
      }
      if (e instanceof RemessaError) throw e;
      throw e;
    }
  }

  async update(id: string, data: UpdateInput) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) return null;

    const newEstoque = data.estoque ?? existing.estoque;
    const deltaRemessa = newEstoque - existing.estoque;

    try {
      const row = await this.prisma.product.update({
        where: { id },
        data: { ...data, estoque: newEstoque } as Prisma.ProductUpdateInput,
      });

      if (deltaRemessa > 0) {
        const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: existing.tenantId } });
        await emitirNFeRemessa(this.prisma, tenant, row, deltaRemessa);
      }

      return mapProduct(row);
    } catch (e) {
      if (isPrismaUniqueError(e)) {
        throw new ProductConflictError("SKU já cadastrado nesta empresa");
      }
      if (e instanceof RemessaError) throw e;
      throw e;
    }
  }

  async remove(id: string) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) return false;
    await this.prisma.product.delete({ where: { id } });
    return true;
  }

  async bulkUpsert(tenantId: string, rows: CreateInput[]) {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    const existing = await this.prisma.product.findMany({
      where: { tenantId },
      select: { id: true, sku: true, estoque: true },
    });
    const bySku = new Map(existing.map((p) => [p.sku, { id: p.id, estoque: p.estoque }]));

    let created = 0;
    let updated = 0;
    const failed: { line: number; sku: string; error: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const line = i + 2;
      const prev = bySku.get(row.sku);
      const estoque = row.estoque ?? 0;

      try {
        if (prev) {
          const delta = estoque - prev.estoque;
          await this.prisma.product.update({
            where: { id: prev.id },
            data: {
              ean: row.ean,
              nome: row.nome,
              ncm: row.ncm,
              cest: row.cest,
              exTipi: row.exTipi,
              cfop: row.cfop,
              origem: row.origem,
              unidade: row.unidade,
              preco: row.preco,
              estoque,
            },
          });
          if (delta > 0) {
            const product = await this.prisma.product.findUniqueOrThrow({ where: { id: prev.id } });
            await emitirNFeRemessa(this.prisma, tenant, product, delta);
          }
          bySku.set(row.sku, { id: prev.id, estoque });
          updated++;
        } else {
          const createdRow = await this.prisma.product.create({
            data: {
              tenantId,
              sku: row.sku,
              ean: row.ean,
              nome: row.nome,
              ncm: row.ncm,
              cest: row.cest,
              exTipi: row.exTipi,
              cfop: row.cfop,
              origem: row.origem,
              unidade: row.unidade,
              preco: row.preco,
              estoque,
            },
          });
          if (estoque > 0) {
            await emitirNFeRemessa(this.prisma, tenant, createdRow, estoque);
          }
          bySku.set(row.sku, { id: createdRow.id, estoque });
          created++;
        }
      } catch (e) {
        failed.push({
          line,
          sku: row.sku,
          error: e instanceof Error ? e.message : "Erro ao salvar linha",
        });
      }
    }

    return { created, updated, failed, total: rows.length };
  }
}

export class ProductConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductConflictError";
  }
}

function isPrismaUniqueError(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "P2002";
}
