/** Tipos alinhados à API Fastify `/api/*` (dados vindos do Prisma). */

export type FiscalStatus =
  | "AUTORIZADA"
  | "PENDENTE"
  | "REJEITADA"
  | "CANCELADA"
  | "DENEGADA";

export type EnvironmentType = "HOMOLOGACAO" | "PRODUCAO";

export type TenantDto = {
  id: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  ie: string;
  iest?: string;
  crt: number;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  codigoMunicipio: string;
  municipio: string;
  uf: string;
  cep: string;
  codigoPais: number;
  nomePais: string;
  telefone?: string;
  ambiente: EnvironmentType;
};

export type TenantInput = {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  ie: string;
  iest?: string;
  crt: number;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  codigoMunicipio: string;
  municipio: string;
  uf: string;
  cep: string;
  codigoPais?: number;
  nomePais?: string;
  telefone?: string;
  ambiente: EnvironmentType;
};

export type CnpjLookupDto = {
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

export type CepLookupDto = {
  cep: string;
  logradouro: string;
  bairro: string;
  municipio: string;
  codigoMunicipio?: string;
  uf: string;
};

/** Endereço do destinatário — bloco NF-e `<enderDest>` */
export type DestinatarioEnderecoDto = {
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  codigoMunicipio: string;
  municipio: string;
  uf: string;
  cep: string;
  codigoPais: number;
  nomePais: string;
  telefone?: string;
};

export type DestinatarioDto = {
  nome: string;
  doc: string;
  uf: string;
  docTipo: "CPF" | "CNPJ";
  indIEDest: number;
  endereco: DestinatarioEnderecoDto;
};

export type CompradorCheckoutInput = {
  cpf: string;
  nome: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  codigoMunicipio: string;
  municipio: string;
  uf: string;
  cep: string;
  telefone?: string;
  codigoPais?: number;
  nomePais?: string;
  indIEDest?: number;
};

export type PedidoCheckoutInput = {
  productId: string;
  quantidade: number;
  comprador: CompradorCheckoutInput;
};

export type PedidoDto = {
  id: string;
  tenantId: string;
  status: "RASCUNHO" | "FATURADO";
  pedidoMl?: string;
  productId: string;
  quantidade: number;
  product: { id: string; sku: string; nome: string; preco: number };
  comprador: CompradorCheckoutInput;
  valorTotal: number;
  nfe?: { chave: string; numero: number; serie: number; status: string };
  createdAt: string;
  updatedAt: string;
  editavel: boolean;
  excluivel: boolean;
};

export type PedidoFaturarResult = {
  pedido: PedidoDto;
  nfe: NFeDto;
};

/** Dados de NF-e para UI e para `buildNFeXML` */
export type NFeDto = {
  id: string;
  tenantId: string;
  productId?: string;
  chave: string;
  numero: number;
  serie: number;
  natOp: string;
  cfop: string;
  ncm: string;
  destinatario: DestinatarioDto;
  valor: number;
  valorICMS: number;
  aliqICMS: number;
  status: FiscalStatus;
  emitidaEm: string;
  pedidoML: string;
  quantidade: number;
  tipo: "VENDA" | "REMESSA" | "RETORNO_SIMBOLICO" | "DEVOLUCAO";
  saldoDisponivel?: number;
  nfeReferenciaChave?: string;
  cteChaveRef?: string;
  referencias?: { chave: string; tipo: string; numero: number; serie: number }[];
  fiscalPayload?: Record<string, unknown>;
};

export type EmitenteEnderecoDto = {
  xLgr: string;
  nro: string;
  xCpl?: string;
  xBairro: string;
  cMun: string;
  xMun: string;
  uf: string;
  cep: string;
  cPais: number;
  xPais: string;
  fone?: string;
};

export type EmitenteDto = {
  cnpj: string;
  xNome: string;
  xFant: string;
  ie: string;
  iest?: string;
  crt: number;
  uf: string;
  endereco: EmitenteEnderecoDto;
};

export type CTeDto = {
  id: string;
  tenantId: string;
  chave: string;
  numero: number;
  serie: number;
  cfop: string;
  natOp: string;
  modal: string;
  origem: string;
  destino: string;
  valor: number;
  valorCarga: number;
  pesoCarga: number;
  status: FiscalStatus;
  emitidoEm: string;
  nfeChaveRef?: string;
  vinculadoRemessa: boolean;
};

export type FiscalEventDto = {
  id: string;
  tipo: string;
  descricao: string;
  chaveRef: string;
  ocorridoEm: string;
  protocolo: string;
};

export type AuditEntryDto = {
  id: string;
  ator: string;
  acao: string;
  recurso: string;
  ocorridoEm: string;
  hash: string;
};

export type TimelineStepDto = {
  label: string;
  status: "done" | "current" | "pending";
  at?: string;
  meta?: string;
};

export type TimelineChainStepDto = {
  tipo: NFeDto["tipo"];
  tipoLabel: string;
  chave: string;
  numero: number;
  serie: number;
  emitidaEm: string;
  quantidade: number;
  saldoDisponivel?: number;
  nfeReferenciaChave?: string;
};

export type TimelineChainDto = {
  id: string;
  pedidoMl?: string;
  emitidaEm: string;
  status: "completa" | "parcial";
  steps: TimelineChainStepDto[];
};

export type ProductDto = {
  id: string;
  tenantId: string;
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
};

export type ProductInput = {
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
  estoque?: number;
};

export type TaxRuleDto = {
  id: string;
  nome: string;
  tipo: string;
  uf: string;
  origin?: string;
  cfop: string;
  aliquota: string;
  transactionType?: string;
  customerType?: string;
  source?: string;
  payload?: Record<string, unknown>;
};
