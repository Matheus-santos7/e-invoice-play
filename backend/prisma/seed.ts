import "dotenv/config";
import { prisma } from "../src/lib/db/prisma.js";
import {
  CteModal,
  EnvironmentKind,
  FiscalStatus,
  TimelineStatus,
} from "../src/generated/prisma/client.js";

const TENANT_1 = "a0000001-0000-4000-8000-000000000001";
const TENANT_2 = "a0000002-0000-4000-8000-000000000002";

function buildChave(
  uf: number,
  aamm: string,
  cnpj: string,
  mod: number,
  serie: number,
  nNF: number,
  tpEmis: number,
  cNF: number,
): string {
  const onlyDigits = (s: string) => s.replace(/\D/g, "");
  const k =
    String(uf).padStart(2, "0") +
    aamm +
    onlyDigits(cnpj).padStart(14, "0") +
    String(mod).padStart(2, "0") +
    String(serie).padStart(3, "0") +
    String(nNF).padStart(9, "0") +
    String(tpEmis).padStart(1, "0") +
    String(cNF).padStart(8, "0");
  let sum = 0;
  let mult = 2;
  for (let i = k.length - 1; i >= 0; i--) {
    sum += parseInt(k[i]!, 10) * mult;
    mult = mult === 9 ? 2 : mult + 1;
  }
  const dv = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  return k + String(dv);
}

async function main() {
  await prisma.fiscalEvent.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.timelineStep.deleteMany();
  await prisma.taxRule.deleteMany();
  await prisma.cTe.deleteMany();
  await prisma.nFe.deleteMany();
  await prisma.product.deleteMany();
  await prisma.tenant.deleteMany();

  await prisma.tenant.createMany({
    data: [
      {
        id: TENANT_1,
        razaoSocial: "Logística Brasil S.A. - Matriz",
        nomeFantasia: "LogBR Matriz",
        cnpj: "12.345.678/0001-90",
        ie: "123.456.789.012",
        crt: 3,
        logradouro: "Av. Paulista",
        numero: "1000",
        complemento: "Conj. 101",
        bairro: "Bela Vista",
        codigoMunicipio: "3550308",
        municipio: "São Paulo",
        uf: "SP",
        cep: "01310100",
        telefone: "1133334444",
        ambiente: EnvironmentKind.HOMOLOGACAO,
      },
      {
        id: TENANT_2,
        razaoSocial: "Logística Brasil S.A. - Filial Sul",
        nomeFantasia: "LogBR Curitiba",
        cnpj: "12.345.678/0002-71",
        ie: "907.654.321.098",
        crt: 3,
        logradouro: "Rua XV de Novembro",
        numero: "500",
        bairro: "Centro",
        codigoMunicipio: "4106902",
        municipio: "Curitiba",
        uf: "PR",
        cep: "80020310",
        telefone: "4132221100",
        ambiente: EnvironmentKind.HOMOLOGACAO,
      },
    ],
  });

  const produtos = [
    { sku: "300002137", ean: "7897180513306", nome: "Fogão 4 Bocas Atlas Atenas Glass", ncm: "73211100", cest: "2100100", exTipi: "01", cfop: "6107", origem: 0, unidade: "UNID", preco: 846 },
    { sku: "SKU-92381", nome: "Camiseta básica algodão M", ncm: "61091000", cest: "2804600", cfop: "5102", origem: 0, unidade: "UN", preco: 39.9 },
    { sku: "SKU-92382", nome: "Tênis esportivo masc 42", ncm: "64041100", cest: "2804900", cfop: "5102", origem: 0, unidade: "PR", preco: 249.9 },
    { sku: "SKU-92383", nome: "Smartphone 128GB", ncm: "85171231", cest: "2106500", cfop: "5102", origem: 2, unidade: "UN", preco: 1899 },
    { sku: "SKU-92384", nome: "Cabo HDMI 2m", ncm: "85444900", cest: "2108200", cfop: "5102", origem: 1, unidade: "UN", preco: 24.9 },
    { sku: "SKU-92385", nome: "Mouse sem fio", ncm: "84716054", cest: "2106600", cfop: "5102", origem: 1, unidade: "UN", preco: 89.9 },
  ];
  await prisma.product.createMany({
    data: produtos.map((p) => ({ ...p, tenantId: TENANT_1 })),
  });

  const nfeRows = [
    {
      chave: buildChave(35, "2511", "12345678000190", 55, 1, 428192, 1, 28374655),
      numero: 428192,
      serie: 1,
      natOp: "Venda de mercadoria adquirida de terceiros",
      cfop: "6404",
      ncm: "61091000",
      destNome: "Mercado Livre S.A.",
      destDoc: "03.007.331/0001-41",
      destUf: "SP",
      valor: 1240.0,
      valorIcms: 223.2,
      aliqIcms: 18,
      status: FiscalStatus.AUTORIZADA,
      emitidaEm: new Date("2026-05-27T14:22:13-03:00"),
      pedidoMl: "ML-2026-98230",
    },
    {
      chave: buildChave(35, "2511", "12345678000190", 55, 1, 428195, 1, 28374658),
      numero: 428195,
      serie: 1,
      natOp: "Venda de mercadoria",
      cfop: "5102",
      ncm: "84713012",
      destNome: "Varejo Online Ltda",
      destDoc: "45.102.304/0001-22",
      destUf: "SP",
      valor: 842.5,
      valorIcms: 151.65,
      aliqIcms: 18,
      status: FiscalStatus.PENDENTE,
      emitidaEm: new Date("2026-05-27T14:31:02-03:00"),
      pedidoMl: "ML-2026-98231",
    },
    {
      chave: buildChave(35, "2511", "12345678000190", 55, 1, 428201, 1, 28374671),
      numero: 428201,
      serie: 1,
      natOp: "Venda de mercadoria — interestadual",
      cfop: "6108",
      ncm: "61091000",
      destNome: "João Silva Rodrigues",
      destDoc: "***.442.108-**",
      destUf: "MG",
      valor: 459.9,
      valorIcms: 55.19,
      aliqIcms: 12,
      status: FiscalStatus.AUTORIZADA,
      emitidaEm: new Date("2026-05-27T13:58:41-03:00"),
      pedidoMl: "ML-2026-98225",
    },
    {
      chave: buildChave(35, "2511", "12345678000190", 55, 1, 428158, 1, 28374599),
      numero: 428158,
      serie: 1,
      natOp: "Devolução de venda",
      cfop: "1202",
      ncm: "85176259",
      destNome: "Ana Paula Oliveira",
      destDoc: "***.991.228-**",
      destUf: "RJ",
      valor: 89.9,
      valorIcms: 16.18,
      aliqIcms: 18,
      status: FiscalStatus.AUTORIZADA,
      emitidaEm: new Date("2026-05-27T12:14:07-03:00"),
      pedidoMl: "ML-2026-98119",
    },
    {
      chave: buildChave(35, "2511", "12345678000190", 55, 1, 428102, 1, 28374488),
      numero: 428102,
      serie: 1,
      natOp: "Venda de mercadoria",
      cfop: "5102",
      ncm: "39269090",
      destNome: "Marcos Vinícius Junior",
      destDoc: "***.118.302-**",
      destUf: "SP",
      valor: 45.9,
      valorIcms: 8.26,
      aliqIcms: 18,
      status: FiscalStatus.REJEITADA,
      emitidaEm: new Date("2026-05-27T11:02:19-03:00"),
      pedidoMl: "ML-2026-97902",
    },
  ];

  const createdNfes: { id: string; chave: string }[] = [];
  for (const row of nfeRows) {
    const n = await prisma.nFe.create({
      data: { tenantId: TENANT_1, ...row },
    });
    createdNfes.push({ id: n.id, chave: n.chave });
  }

  const nfeByChave = (ch: string) => createdNfes.find((x) => x.chave === ch)!;

  await prisma.cTe.createMany({
    data: [
      {
        tenantId: TENANT_1,
        chave: buildChave(35, "2511", "12345678000190", 57, 1, 10294, 1, 11220033),
        numero: 10294,
        serie: 1,
        cfop: "6353",
        natOp: "PRESTAÇÕES DE SERVIÇOS DE TRANSPORTE",
        modal: CteModal.RODOVIARIO,
        origem: "Cajamar/SP",
        destino: "Belo Horizonte/MG",
        valor: 38.4,
        valorCarga: 5600,
        pesoCarga: 40,
        status: FiscalStatus.AUTORIZADA,
        emitidoEm: new Date("2026-05-27T14:22:40-03:00"),
      },
      {
        tenantId: TENANT_1,
        chave: buildChave(35, "2511", "12345678000190", 57, 1, 10295, 1, 11220034),
        numero: 10295,
        serie: 1,
        cfop: "6353",
        natOp: "PRESTAÇÕES DE SERVIÇOS DE TRANSPORTE",
        modal: CteModal.RODOVIARIO,
        origem: "Cajamar/SP",
        destino: "São Paulo/SP",
        valor: 12.9,
        valorCarga: 1880,
        pesoCarga: 13.5,
        status: FiscalStatus.PENDENTE,
        emitidoEm: new Date("2026-05-27T14:33:00-03:00"),
      },
    ],
  });

  await prisma.fiscalEvent.createMany({
    data: [
      {
        tenantId: TENANT_1,
        nfeId: nfeByChave(nfeRows[4]!.chave).id,
        tipo: "110111",
        descricao: "Cancelamento de NF-e",
        ocorridoEm: new Date("2026-05-27T11:08:50-03:00"),
        protocolo: "135260000099420",
      },
      {
        tenantId: TENANT_1,
        nfeId: nfeByChave(nfeRows[2]!.chave).id,
        tipo: "110110",
        descricao: "Carta de Correção Eletrônica (CC-e)",
        ocorridoEm: new Date("2026-05-27T14:01:12-03:00"),
        protocolo: "135260000099421",
      },
      {
        tenantId: TENANT_1,
        nfeId: nfeByChave(nfeRows[0]!.chave).id,
        tipo: "210200",
        descricao: "Confirmação da operação (manifestação destinatário)",
        ocorridoEm: new Date("2026-05-27T14:24:55-03:00"),
        protocolo: "135260000099422",
      },
    ],
  });

  await prisma.auditLog.createMany({
    data: [
      {
        tenantId: TENANT_1,
        ator: "joao.silva@logbr.com",
        acao: "EMISSAO_NFE",
        recurso: nfeRows[0]!.chave,
        ocorridoEm: new Date("2026-05-27T14:22:13-03:00"),
        hash: "a1b2c3d4e5f6g7h8",
      },
      {
        tenantId: TENANT_1,
        ator: "system.tax-engine",
        acao: "CALCULO_ICMS",
        recurso: nfeRows[0]!.chave,
        ocorridoEm: new Date("2026-05-27T14:22:12-03:00"),
        hash: "b2c3d4e5f6g7h8i9",
      },
      {
        tenantId: TENANT_1,
        ator: "maria.oliveira@logbr.com",
        acao: "CANCELAMENTO_NFE",
        recurso: nfeRows[4]!.chave,
        ocorridoEm: new Date("2026-05-27T11:08:50-03:00"),
        hash: "c3d4e5f6g7h8i9j0",
      },
    ],
  });

  const timeline = [
    { sortOrder: 0, label: "Venda recebida ML", status: TimelineStatus.DONE, at: "14:02", meta: "Pedido ML-2026-98231" },
    { sortOrder: 1, label: "Picking concluído", status: TimelineStatus.DONE, at: "14:15", meta: "Operador: J. SILVA" },
    { sortOrder: 2, label: "Packing finalizado", status: TimelineStatus.DONE, at: "14:18", meta: "Caixa M-204" },
    { sortOrder: 3, label: "NF-e autorizada", status: TimelineStatus.CURRENT, at: "14:22", meta: "Aguardando protocolo" },
    { sortOrder: 4, label: "CT-e gerado", status: TimelineStatus.PENDING, at: null, meta: "Previsão 14:30" },
    { sortOrder: 5, label: "Coleta Mercado Livre", status: TimelineStatus.PENDING, at: null, meta: "Janela 16:00–17:00" },
  ];
  await prisma.timelineStep.createMany({
    data: timeline.map((t) => ({ ...t, tenantId: TENANT_1 })),
  });

  const rules = [
    { ruleId: "R-001", nome: "ICMS Venda Interna SP", uf: "SP", cfop: "5102", aliquota: "18%", tipo: "ICMS" },
    { ruleId: "R-002", nome: "ICMS Interestadual S→SE", uf: "SP→MG", cfop: "6108", aliquota: "12%", tipo: "ICMS" },
    { ruleId: "R-003", nome: "DIFAL Consumidor Final", uf: "*→*", cfop: "6404", aliquota: "calc", tipo: "DIFAL" },
    { ruleId: "R-004", nome: "Substituição Tributária — Eletrônicos", uf: "SP", cfop: "5405", aliquota: "MVA 38,24%", tipo: "ICMS-ST" },
    { ruleId: "R-005", nome: "FCP Rio de Janeiro", uf: "RJ", cfop: "6108", aliquota: "2%", tipo: "FCP" },
    { ruleId: "R-006", nome: "PIS/COFINS Regime Não-Cumulativo", uf: "*", cfop: "*", aliquota: "1,65% / 7,6%", tipo: "PIS/COFINS" },
  ];
  await prisma.taxRule.createMany({
    data: rules.map((r) => ({ ...r, tenantId: TENANT_1 })),
  });

  console.log("Seed OK — tenant demo:", TENANT_1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
