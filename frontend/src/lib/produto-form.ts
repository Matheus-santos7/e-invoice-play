import type { ProductInput } from "@/lib/fiscal-types";

export type ProdutoFormValues = {
  sku: string;
  ean: string;
  nome: string;
  ncm: string;
  cest: string;
  exTipi: string;
  cfop: string;
  origem: string;
  unidade: string;
  preco: string;
  estoque: string;
};

export type ProdutoFormState = {
  error?: string;
  success?: boolean;
  fieldErrors?: Record<string, string[]>;
  values?: ProdutoFormValues;
};

export function inputToFormValues(input: ProductInput): ProdutoFormValues {
  return {
    sku: input.sku,
    ean: input.ean ?? "",
    nome: input.nome,
    ncm: input.ncm,
    cest: input.cest,
    exTipi: input.exTipi ?? "",
    cfop: input.cfop,
    origem: String(input.origem),
    unidade: input.unidade,
    preco: String(input.preco),
    estoque: String(input.estoque ?? 0),
  };
}

export function productToFormValues(p: {
  sku: string;
  ean?: string;
  nome: string;
  ncm: string;
  cest: string;
  exTipi?: string;
  cfop: string;
  origem: number;
  unidade: string;
  preco: number;
  estoque: number;
}): ProdutoFormValues {
  return inputToFormValues({
    sku: p.sku,
    ean: p.ean,
    nome: p.nome,
    ncm: p.ncm,
    cest: p.cest,
    exTipi: p.exTipi,
    cfop: p.cfop,
    origem: p.origem,
    unidade: p.unidade,
    preco: p.preco,
    estoque: p.estoque,
  });
}

export function formatFieldErrors(fieldErrors?: Record<string, string[]>): string | undefined {
  if (!fieldErrors) return undefined;
  const msgs = Object.entries(fieldErrors).flatMap(([, v]) => v);
  return msgs.length > 0 ? msgs.join(" • ") : undefined;
}

export function parseProductForm(formData: FormData): ProductInput {
  const opt = (key: string) => {
    const v = String(formData.get(key) ?? "").trim();
    return v.length > 0 ? v : undefined;
  };

  return {
    sku: String(formData.get("sku") ?? "").trim(),
    ean: opt("ean"),
    nome: String(formData.get("nome") ?? "").trim(),
    ncm: String(formData.get("ncm") ?? "").replace(/\D/g, ""),
    cest: String(formData.get("cest") ?? "").replace(/\D/g, ""),
    exTipi: opt("exTipi"),
    cfop: String(formData.get("cfop") ?? "5102").replace(/\D/g, ""),
    origem: Number(formData.get("origem") ?? 0),
    unidade: String(formData.get("unidade") ?? "UN").trim(),
    preco: Number(String(formData.get("preco") ?? "0").replace(",", ".")),
    estoque: Number(String(formData.get("estoque") ?? "0").replace(",", ".")) || 0,
  };
}
