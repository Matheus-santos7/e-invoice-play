import type { CompradorCheckoutInput, PedidoCheckoutInput, PedidoDto } from "@/lib/fiscal-types";

export type PedidoFormState = {
  error?: string;
  success?: boolean;
  fieldErrors?: Record<string, string[]>;
};

export type PedidoFormValues = {
  productId: string;
  quantidade: string;
  cpf: string;
  nome: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  codigoMunicipio: string;
  municipio: string;
  uf: string;
  cep: string;
  telefone: string;
};

export const PEDIDO_FORM_EMPTY: PedidoFormValues = {
  productId: "",
  quantidade: "1",
  cpf: "",
  nome: "",
  logradouro: "",
  numero: "SN",
  complemento: "",
  bairro: "",
  codigoMunicipio: "",
  municipio: "",
  uf: "SP",
  cep: "",
  telefone: "",
};

export const PEDIDO_FORM_EXAMPLE: PedidoFormValues = {
  productId: "",
  quantidade: "1",
  cpf: "079.516.039-96",
  nome: "Claudilene Aparecida Bonfim",
  logradouro: "Rua Cafarnaum",
  numero: "260",
  complemento: "casa",
  bairro: "canaa",
  codigoMunicipio: "4122701",
  municipio: "Sabaudia",
  uf: "PR",
  cep: "86720-000",
  telefone: "43999999999",
};

export function pedidoToFormValues(p: PedidoDto): PedidoFormValues {
  const c = p.comprador;
  return {
    productId: p.productId,
    quantidade: String(p.quantidade),
    cpf: c.cpf,
    nome: c.nome,
    logradouro: c.logradouro,
    numero: c.numero,
    complemento: c.complemento ?? "",
    bairro: c.bairro,
    codigoMunicipio: c.codigoMunicipio,
    municipio: c.municipio,
    uf: c.uf,
    cep: c.cep,
    telefone: c.telefone ?? "",
  };
}

export function parsePedidoForm(formData: FormData): PedidoCheckoutInput {
  const opt = (key: string) => {
    const v = String(formData.get(key) ?? "").trim();
    return v.length > 0 ? v : undefined;
  };

  const comprador: CompradorCheckoutInput = {
    cpf: String(formData.get("cpf") ?? "").replace(/\D/g, ""),
    nome: String(formData.get("nome") ?? "").trim(),
    logradouro: String(formData.get("logradouro") ?? "").trim(),
    numero: String(formData.get("numero") ?? "SN").trim(),
    complemento: opt("complemento"),
    bairro: String(formData.get("bairro") ?? "").trim(),
    codigoMunicipio: String(formData.get("codigoMunicipio") ?? "").replace(/\D/g, ""),
    municipio: String(formData.get("municipio") ?? "").trim(),
    uf: String(formData.get("uf") ?? "SP").trim().toUpperCase(),
    cep: String(formData.get("cep") ?? "").replace(/\D/g, ""),
    telefone: opt("telefone"),
    codigoPais: 1058,
    nomePais: "Brasil",
    indIEDest: 9,
  };

  return {
    productId: String(formData.get("productId") ?? ""),
    quantidade: Number(formData.get("quantidade") ?? 1),
    comprador,
  };
}

export function formValuesToFormData(v: PedidoFormValues): FormData {
  const fd = new FormData();
  for (const [k, val] of Object.entries(v)) fd.set(k, val);
  return fd;
}
