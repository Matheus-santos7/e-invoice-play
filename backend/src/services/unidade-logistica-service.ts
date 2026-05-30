import type { Prisma, PrismaClient } from "../generated/prisma/client.js";
import {
  extractCodigoUnidade,
  normalizeCepMeli,
  normalizeCnpjMeli,
  normalizeIeMeli,
  remessaDestinoLegado,
  unidadeParaDestinoFiscal,
  type UnidadeDestinoFiscal,
} from "../lib/meli-unidade.js";
import type { MeliUnidadeLogistica } from "../generated/prisma/client.js";
import { lookupCep } from "./lookup-service.js";

export type UnidadeLogisticaImportRow = {
  unidade: string;
  cnpj: string | number;
  inscricaoEstadual?: string | number;
  logradouro: string;
  numero: string;
  cidade: string;
  uf: string;
  cep: string | number;
};

export function mapUnidadeLogistica(row: {
  id: string;
  tenantId: string;
  codigo: string;
  nome: string;
  destNomeFiscal: string;
  cnpj: string;
  ie: string | null;
  logradouro: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  codigoMunicipio: string;
  codigoPais: number;
  nomePais: string;
  indIeDest: number;
  ativa: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    codigo: row.codigo,
    nome: row.nome,
    destNomeFiscal: row.destNomeFiscal,
    cnpj: row.cnpj,
    ie: row.ie ?? undefined,
    endereco: {
      logradouro: row.logradouro,
      numero: row.numero,
      complemento: row.complemento ?? undefined,
      bairro: row.bairro,
      municipio: row.municipio,
      uf: row.uf,
      cep: row.cep,
      codigoMunicipio: row.codigoMunicipio,
    },
    destinatarioFiscal: unidadeParaDestinoFiscal(row),
    ativa: row.ativa,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class UnidadeLogisticaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnidadeLogisticaError";
  }
}

export class UnidadeLogisticaService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(tenantId: string, opts?: { ativa?: boolean; q?: string }) {
    const q = opts?.q?.trim();
    const rows = await this.prisma.meliUnidadeLogistica.findMany({
      where: {
        tenantId,
        ...(opts?.ativa !== undefined ? { ativa: opts.ativa } : {}),
        ...(q
          ? {
              OR: [
                { codigo: { contains: q, mode: "insensitive" } },
                { nome: { contains: q, mode: "insensitive" } },
                { municipio: { contains: q, mode: "insensitive" } },
                { uf: { equals: q.toUpperCase(), mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ uf: "asc" }, { codigo: "asc" }],
    });
    return rows.map(mapUnidadeLogistica);
  }

  async getById(tenantId: string, id: string) {
    const row = await this.prisma.meliUnidadeLogistica.findFirst({
      where: { id, tenantId },
    });
    return row ? mapUnidadeLogistica(row) : null;
  }

  async resolveDestinoRemessa(
    tenantId: string,
    unidadeDestinoId?: string,
  ): Promise<{ unidade: MeliUnidadeLogistica | null; destino: UnidadeDestinoFiscal }> {
    if (unidadeDestinoId) {
      const u = await this.prisma.meliUnidadeLogistica.findFirst({
        where: { id: unidadeDestinoId, tenantId, ativa: true },
      });
      if (!u) throw new UnidadeLogisticaError("Unidade logística de destino não encontrada ou inativa");
      return { unidade: u, destino: unidadeParaDestinoFiscal(u) };
    }

    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      include: { unidadeLogisticaPadrao: true },
    });
    if (tenant.unidadeLogisticaPadrao?.ativa) {
      return {
        unidade: tenant.unidadeLogisticaPadrao,
        destino: unidadeParaDestinoFiscal(tenant.unidadeLogisticaPadrao),
      };
    }

    return { unidade: null, destino: remessaDestinoLegado() };
  }

  async setPadrao(tenantId: string, unidadeId: string) {
    const u = await this.prisma.meliUnidadeLogistica.findFirst({
      where: { id: unidadeId, tenantId, ativa: true },
    });
    if (!u) throw new UnidadeLogisticaError("Unidade não encontrada");
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { unidadeLogisticaPadraoId: unidadeId },
    });
    return mapUnidadeLogistica(u);
  }

  async bulkImport(tenantId: string, rows: UnidadeLogisticaImportRow[], enrichCep = true) {
    const seenCnpj = new Map<string, UnidadeLogisticaImportRow>();
    const errors: { line: number; message: string }[] = [];
    let line = 0;

    for (const raw of rows) {
      line++;
      const cnpj = normalizeCnpjMeli(raw.cnpj);
      if (!cnpj) {
        errors.push({ line, message: `CNPJ inválido: ${raw.cnpj}` });
        continue;
      }
      if (!raw.unidade?.trim()) {
        errors.push({ line, message: "Nome da unidade obrigatório" });
        continue;
      }
      if (!seenCnpj.has(cnpj)) {
        seenCnpj.set(cnpj, raw);
      }
    }

    let created = 0;
    let updated = 0;
    const cepCache = new Map<string, { bairro: string; codigoMunicipio: string }>();

    for (const raw of seenCnpj.values()) {
      const cnpj = normalizeCnpjMeli(raw.cnpj)!;
      const nome = raw.unidade.trim();
      let codigo = extractCodigoUnidade(nome);
      const cep = normalizeCepMeli(raw.cep);
      let bairro = "";
      let codigoMunicipio = "";

      if (enrichCep && cep.length === 8) {
        if (!cepCache.has(cep)) {
          try {
            const cepData = await lookupCep(cep);
            cepCache.set(cep, {
              bairro: cepData.bairro ?? "",
              codigoMunicipio: cepData.codigoMunicipio ?? "",
            });
          } catch {
            cepCache.set(cep, { bairro: "", codigoMunicipio: "" });
          }
        }
        const cached = cepCache.get(cep)!;
        bairro = cached.bairro;
        codigoMunicipio = cached.codigoMunicipio;
      }

      const existing = await this.prisma.meliUnidadeLogistica.findUnique({
        where: { tenantId_cnpj: { tenantId, cnpj } },
      });

      if (existing && existing.codigo !== codigo) {
        const conflict = await this.prisma.meliUnidadeLogistica.findUnique({
          where: { tenantId_codigo: { tenantId, codigo } },
        });
        if (conflict && conflict.id !== existing.id) {
          codigo = `${codigo}_${cnpj.slice(-4)}`;
        }
      }

      const data: Prisma.MeliUnidadeLogisticaCreateInput = {
        tenant: { connect: { id: tenantId } },
        codigo,
        nome,
        cnpj,
        ie: normalizeIeMeli(raw.inscricaoEstadual),
        logradouro: raw.logradouro?.trim() || "—",
        numero: raw.numero?.trim() || "SN",
        municipio: raw.cidade?.trim() || "",
        uf: (raw.uf ?? "").trim().toUpperCase().slice(0, 2),
        cep,
        bairro,
        codigoMunicipio,
        indIeDest: normalizeIeMeli(raw.inscricaoEstadual) ? 1 : 9,
        ativa: true,
      };

      if (existing) {
        await this.prisma.meliUnidadeLogistica.update({
          where: { id: existing.id },
          data: {
            nome: data.nome,
            ie: data.ie,
            logradouro: data.logradouro,
            numero: data.numero,
            municipio: data.municipio,
            uf: data.uf,
            cep: data.cep,
            bairro: bairro || existing.bairro,
            codigoMunicipio: codigoMunicipio || existing.codigoMunicipio,
            indIeDest: data.indIeDest,
            ativa: true,
          },
        });
        updated++;
      } else {
        await this.prisma.meliUnidadeLogistica.create({ data });
        created++;
      }
    }

    return {
      totalPlanilha: rows.length,
      unicos: seenCnpj.size,
      created,
      updated,
      skipped: rows.length - seenCnpj.size,
      errors,
    };
  }
}
