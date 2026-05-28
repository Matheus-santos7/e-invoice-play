const BRASIL_API = "https://brasilapi.com.br/api";
const OPEN_CNPJ_API = "https://api.opencnpj.org";

const FETCH_HEADERS = {
  Accept: "application/json",
  "User-Agent": "e-invoice-play/1.0 (fiscal-simulator)",
};

export class LookupNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LookupNotFoundError";
  }
}

export class LookupValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LookupValidationError";
  }
}

type BrasilApiCnpj = {
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  codigo_municipio_ibge?: number;
  ddd_telefone_1?: string;
  opcao_pelo_simples?: boolean;
  opcao_pelo_mei?: boolean;
  message?: string;
};

type OpenCnpjResponse = {
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  tipo_logradouro?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  codigo_municipio?: number;
  telefones?: { ddd: string; numero: string }[];
  opcao_simples?: boolean;
  opcao_mei?: boolean;
};

type BrasilApiCep = {
  cep?: string;
  state?: string;
  city?: string;
  neighborhood?: string;
  street?: string;
  city_ibge?: string;
};

type ViaCepResponse = {
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  ibge?: string;
  erro?: boolean;
};

export type CnpjLookupResult = {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  municipio: string;
  codigoMunicipio: string;
  uf: string;
  cep: string;
  telefone?: string;
  crt: number;
};

export type CepLookupResult = {
  cep: string;
  logradouro: string;
  bairro: string;
  municipio: string;
  codigoMunicipio?: string;
  uf: string;
};

function inferCrt(simples?: boolean, mei?: boolean): number {
  if (simples || mei) return 1;
  return 3;
}

function buildLogradouro(tipo?: string, logradouro?: string): string {
  const t = tipo?.trim();
  const l = logradouro?.trim();
  if (t && l) {
    const upper = t.toUpperCase();
    if (l.toUpperCase().startsWith(upper)) return l;
    return `${t} ${l}`.trim();
  }
  return l ?? t ?? "";
}

function mapBrasilCnpj(data: BrasilApiCnpj, cnpj: string): CnpjLookupResult {
  return {
    razaoSocial: data.razao_social ?? "",
    nomeFantasia: data.nome_fantasia?.trim() || data.razao_social || "",
    cnpj,
    logradouro: data.logradouro ?? "",
    numero: data.numero?.trim() || "SN",
    complemento: data.complemento?.trim() || undefined,
    bairro: data.bairro ?? "",
    municipio: data.municipio ?? "",
    codigoMunicipio: data.codigo_municipio_ibge ? String(data.codigo_municipio_ibge) : "",
    uf: (data.uf ?? "").toUpperCase(),
    cep: (data.cep ?? "").replace(/\D/g, ""),
    telefone: data.ddd_telefone_1?.replace(/\D/g, "") || undefined,
    crt: inferCrt(data.opcao_pelo_simples, data.opcao_pelo_mei),
  };
}

async function mapOpenCnpj(data: OpenCnpjResponse, cnpj: string): Promise<CnpjLookupResult> {
  const tel = data.telefones?.[0];
  const cep = (data.cep ?? "").replace(/\D/g, "");

  let codigoMunicipio = "";
  let municipio = data.municipio ?? "";
  let uf = (data.uf ?? "").toUpperCase();

  if (cep.length === 8) {
    try {
      const viaCep = await lookupCep(cep);
      if (viaCep.codigoMunicipio) codigoMunicipio = viaCep.codigoMunicipio;
      if (!municipio) municipio = viaCep.municipio;
      if (!uf) uf = viaCep.uf;
    } catch {
      // IBGE opcional via CEP
    }
  }

  return {
    razaoSocial: data.razao_social ?? "",
    nomeFantasia: data.nome_fantasia?.trim() || data.razao_social || "",
    cnpj,
    logradouro: buildLogradouro(data.tipo_logradouro, data.logradouro),
    numero: data.numero?.trim() || "SN",
    complemento: data.complemento?.trim() || undefined,
    bairro: data.bairro ?? "",
    municipio,
    codigoMunicipio,
    uf,
    cep,
    telefone: tel ? `${tel.ddd}${tel.numero}`.replace(/\D/g, "") : undefined,
    crt: inferCrt(data.opcao_simples, data.opcao_mei),
  };
}

async function lookupCnpjBrasilApi(cnpj: string): Promise<CnpjLookupResult | null> {
  const res = await fetch(`${BRASIL_API}/cnpj/v1/${cnpj}`, { headers: FETCH_HEADERS });

  if (res.status === 404) {
    throw new LookupNotFoundError("CNPJ não encontrado na base pública");
  }

  if (res.status === 400) {
    throw new LookupValidationError(
      "CNPJ inválido ou fictício (ex.: dados do seed). Use um CNPJ real da Receita ou preencha os campos manualmente.",
    );
  }

  if (res.status === 403 || res.status === 429) {
    return null;
  }

  if (!res.ok) {
    return null;
  }

  return mapBrasilCnpj((await res.json()) as BrasilApiCnpj, cnpj);
}

async function lookupCnpjOpenCnpj(cnpj: string): Promise<CnpjLookupResult> {
  const res = await fetch(`${OPEN_CNPJ_API}/${cnpj}`, { headers: FETCH_HEADERS });

  if (res.status === 404) {
    throw new LookupNotFoundError("CNPJ não encontrado na base pública");
  }

  if (!res.ok) {
    throw new Error(`Consulta CNPJ indisponível (${res.status})`);
  }

  const data = (await res.json()) as OpenCnpjResponse;
  return mapOpenCnpj(data, cnpj);
}

export async function lookupCnpj(raw: string): Promise<CnpjLookupResult> {
  const cnpj = raw.replace(/\D/g, "");
  if (cnpj.length !== 14) throw new LookupValidationError("CNPJ deve ter 14 dígitos");

  try {
    const fromBrasil = await lookupCnpjBrasilApi(cnpj);
    if (fromBrasil) return fromBrasil;
  } catch (e) {
    if (e instanceof LookupNotFoundError || e instanceof LookupValidationError) throw e;
  }

  return lookupCnpjOpenCnpj(cnpj);
}

export async function lookupCep(raw: string): Promise<CepLookupResult> {
  const cep = raw.replace(/\D/g, "");
  if (cep.length !== 8) throw new LookupValidationError("CEP deve ter 8 dígitos");

  const res = await fetch(`${BRASIL_API}/cep/v2/${cep}`, { headers: FETCH_HEADERS });

  if (res.status === 404) throw new LookupNotFoundError("CEP não encontrado");
  if (!res.ok) throw new Error(`Consulta CEP indisponível (${res.status})`);

  const data = (await res.json()) as BrasilApiCep;

  let codigoMunicipio = data.city_ibge;

  if (!codigoMunicipio) {
    codigoMunicipio = await lookupIbgeViaCep(cep);
  }

  return {
    cep,
    logradouro: data.street ?? "",
    bairro: data.neighborhood ?? "",
    municipio: data.city ?? "",
    codigoMunicipio,
    uf: (data.state ?? "").toUpperCase(),
  };
}

async function lookupIbgeViaCep(cep: string): Promise<string | undefined> {
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { headers: FETCH_HEADERS });
    if (!res.ok) return undefined;
    const data = (await res.json()) as ViaCepResponse;
    if (data.erro || !data.ibge) return undefined;
    return data.ibge.length === 7 ? data.ibge : undefined;
  } catch {
    return undefined;
  }
}
