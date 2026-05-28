import type { ProductDto, ProductInput } from "@/lib/fiscal-types";

/** Colunas da planilha padrão (CSV compatível com Excel BR — separador `;`). */
export const PRODUTO_PLANILHA_COLUMNS = [
  "sku",
  "ean",
  "nome",
  "ncm",
  "cest",
  "ex_tipi",
  "cfop",
  "origem",
  "unidade",
  "preco",
  "estoque",
] as const;

export type ProdutoPlanilhaColumn = (typeof PRODUTO_PLANILHA_COLUMNS)[number];

const HEADER_ALIASES: Record<string, ProdutoPlanilhaColumn> = {
  sku: "sku",
  cprod: "sku",
  codigo: "sku",
  "código": "sku",
  ean: "ean",
  gtin: "ean",
  cean: "ean",
  nome: "nome",
  xprod: "nome",
  descricao: "nome",
  descrição: "nome",
  ncm: "ncm",
  cest: "cest",
  ex_tipi: "ex_tipi",
  extipi: "ex_tipi",
  cfop: "cfop",
  origem: "origem",
  orig: "origem",
  unidade: "unidade",
  ucom: "unidade",
  utrib: "unidade",
  preco: "preco",
  preço: "preco",
  vuncom: "preco",
  estoque: "estoque",
  stock: "estoque",
  quantidade: "estoque",
};

const EXAMPLE_ROW: Record<ProdutoPlanilhaColumn, string> = {
  sku: "300002137",
  ean: "7897180513306",
  nome: "Fogão 4 Bocas Atlas Atenas Glass",
  ncm: "73211100",
  cest: "2100100",
  ex_tipi: "01",
  cfop: "6107",
  origem: "0",
  unidade: "UNID",
  preco: "846,00",
  estoque: "0",
};

export type ProdutoPlanilhaParseResult = {
  rows: ProductInput[];
  errors: { line: number; message: string }[];
};

function normalizeHeader(h: string): string {
  return h
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function detectDelimiter(line: string): ";" | "," {
  const semi = (line.match(/;/g) ?? []).length;
  const comma = (line.match(/,/g) ?? []).length;
  return semi >= comma ? ";" : ",";
}

/** Parser CSV simples com suporte a campos entre aspas. */
export function parseCsvLines(text: string, delimiter: ";" | ","): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    const next = text[i + 1];

    if (inQuotes) {
      if (c === '"' && next === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      continue;
    }

    if (c === delimiter) {
      row.push(field);
      field = "";
      continue;
    }

    if (c === "\n" || (c === "\r" && next === "\n")) {
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim().length > 0)) rows.push(row);
      row = [];
      if (c === "\r") i++;
      continue;
    }

    if (c === "\r") continue;
    field += c;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((cell) => cell.trim().length > 0)) rows.push(row);
  }

  return rows;
}

function parsePreco(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  let normalized = t;
  if (/,\d{1,8}$/.test(t)) {
    normalized = t.replace(/\./g, "").replace(",", ".");
  }
  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function cell(row: Record<ProdutoPlanilhaColumn, string>, col: ProdutoPlanilhaColumn): string {
  return row[col]?.trim() ?? "";
}

function rowToProductInput(row: Record<ProdutoPlanilhaColumn, string>): ProductInput | string {
  const sku = cell(row, "sku");
  const nome = cell(row, "nome");
  const ncm = cell(row, "ncm").replace(/\D/g, "");
  const cest = cell(row, "cest").replace(/\D/g, "");
  const cfopRaw = cell(row, "cfop").replace(/\D/g, "");
  const cfop = cfopRaw.length === 4 ? cfopRaw : "5102";
  const preco = parsePreco(cell(row, "preco"));
  const origemRaw = cell(row, "origem");
  const origem = origemRaw === "" ? 0 : Number(origemRaw);

  if (!sku) return "SKU (sku) obrigatório";
  if (!nome) return "Descrição (nome) obrigatória";
  if (ncm.length !== 8) return "NCM deve ter 8 dígitos";
  if (cest.length !== 7) return "CEST deve ter 7 dígitos";
  if (preco == null) return "Preço inválido";
  if (!Number.isInteger(origem) || origem < 0 || origem > 8) return "Origem deve ser 0–8";

  const eanRaw = cell(row, "ean").replace(/\D/g, "");
  const ean = eanRaw.length > 0 ? eanRaw : undefined;
  if (ean && ![8, 12, 13, 14].includes(ean.length)) return "EAN/GTIN inválido";

  const exTipiRaw = cell(row, "ex_tipi");
  const exTipi = exTipiRaw.length > 0 ? exTipiRaw : undefined;
  if (exTipi && !/^\d{2,3}$/.test(exTipi)) return "EXTIPI inválido";

  const unidade = cell(row, "unidade") || "UN";

  const estoqueRaw = cell(row, "estoque");
  const estoque = estoqueRaw === "" ? 0 : Number(estoqueRaw.replace(/\D/g, "") || estoqueRaw);
  if (!Number.isInteger(estoque) || estoque < 0) return "Estoque deve ser inteiro ≥ 0";

  return {
    sku,
    ean,
    nome,
    ncm,
    cest,
    exTipi,
    cfop,
    origem,
    unidade,
    preco,
    estoque,
  };
}

export function parseProdutoPlanilhaCsv(text: string): ProdutoPlanilhaParseResult {
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  if (!trimmed) {
    return { rows: [], errors: [{ line: 1, message: "Arquivo vazio" }] };
  }

  const firstLine = trimmed.split(/\r?\n/)[0] ?? "";
  const delimiter = detectDelimiter(firstLine);
  const matrix = parseCsvLines(trimmed, delimiter);
  if (matrix.length === 0) {
    return { rows: [], errors: [{ line: 1, message: "Nenhuma linha encontrada" }] };
  }

  const headerRow = matrix[0]!;
  const colIndex = new Map<ProdutoPlanilhaColumn, number>();
  for (let i = 0; i < headerRow.length; i++) {
    const key = normalizeHeader(headerRow[i] ?? "");
    const col = HEADER_ALIASES[key];
    if (col && !colIndex.has(col)) colIndex.set(col, i);
  }

  const missing = PRODUTO_PLANILHA_COLUMNS.filter((c) => c !== "ean" && c !== "ex_tipi" && !colIndex.has(c));
  if (missing.length > 0) {
    return {
      rows: [],
      errors: [{ line: 1, message: `Colunas obrigatórias ausentes: ${missing.join(", ")}` }],
    };
  }

  const rows: ProductInput[] = [];
  const errors: { line: number; message: string }[] = [];

  for (let r = 1; r < matrix.length; r++) {
    const line = r + 1;
    const cells = matrix[r]!;
    if (cells.every((c) => !c.trim())) continue;

    const record = {} as Record<ProdutoPlanilhaColumn, string>;
    for (const col of PRODUTO_PLANILHA_COLUMNS) {
      const idx = colIndex.get(col);
      record[col] = idx != null ? (cells[idx] ?? "") : "";
    }

    const parsed = rowToProductInput(record);
    if (typeof parsed === "string") {
      errors.push({ line, message: parsed });
      continue;
    }
    rows.push(parsed);
  }

  if (rows.length === 0 && errors.length === 0) {
    errors.push({ line: 2, message: "Nenhum produto válido na planilha" });
  }

  return { rows, errors };
}

function escapeCsv(value: string): string {
  if (/[;"\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function formatPrecoBr(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 8 });
}

function productToRow(p: ProductDto): string[] {
  return [
    p.sku,
    p.ean ?? "",
    p.nome,
    p.ncm,
    p.cest,
    p.exTipi ?? "",
    p.cfop,
    String(p.origem),
    p.unidade,
    formatPrecoBr(p.preco),
  ];
}

export function buildProdutoPlanilhaCsv(products: ProductDto[], includeExample = false): string {
  const header = PRODUTO_PLANILHA_COLUMNS.join(";");
  const lines = [header];
  if (includeExample) {
    lines.push(PRODUTO_PLANILHA_COLUMNS.map((c) => escapeCsv(EXAMPLE_ROW[c])).join(";"));
  }
  for (const p of products) {
    lines.push(productToRow(p).map(escapeCsv).join(";"));
  }
  return `\uFEFF${lines.join("\r\n")}`;
}

export function buildProdutoPlanilhaTemplateCsv(): string {
  return buildProdutoPlanilhaCsv([], true);
}

export function downloadCsvFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
