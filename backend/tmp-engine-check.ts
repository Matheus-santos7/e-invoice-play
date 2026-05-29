import { calcularNotaFiscal, type ItemFiscalInput } from "./src/lib/tax-engine.js";

// Reproduz a NF-e real 781 (PR → SP, consumidor final): Fogão Atlas.
const item: ItemFiscalInput = {
  numeroItem: 1,
  codigo: "300002137",
  descricao: "Fogao 4 Bocas Atlas",
  ncm: "73211100",
  cfop: "6105",
  unidade: "UNID",
  quantidade: 1,
  valorUnitario: 1033.42,
  icms: { cst: "00", orig: 5, pICMS: 12, pRedBC: 0, pFCP: 0 },
  ipi: { cst: "50", pIPI: 2.6, cEnq: "999" },
  // Base PIS/COFINS reduzida (benefício): 842.57 / 1033.42 ≈ 18.4675% de redução.
  pis: { cst: "01", aliquota: 1.65, pRedBC: 18.4675 },
  cofins: { cst: "01", aliquota: 7.6, pRedBC: 18.4675 },
  difal: { pICMSInter: 12, pICMSUFDest: 18, pFCPUFDest: 0 },
  incluirIpiNaBaseIcms: true,
};

const nota = calcularNotaFiscal([item]);
const r = nota.itens[0]!;
const esperado = {
  vProd: 1033.42, vBCIcms: 1060.29, vICMS: 127.23, vIPI: 26.87,
  vPIS: 13.9, vCOFINS: 64.04, vICMSUFDest: 63.62, vNF: 1060.29,
};
const obtido = {
  vProd: r.vProd, vBCIcms: r.icms.vBC, vICMS: r.icms.vICMS, vIPI: r.ipi?.vIPI,
  vPIS: r.pis.vPIS, vCOFINS: r.cofins.vCOFINS, vICMSUFDest: r.difal?.vICMSUFDest,
  vNF: nota.totais.vNF,
};
console.log("Esperado (XML real):", esperado);
console.log("Obtido   (engine)  :", obtido);
console.log("PIS base:", r.pis.vBC, "COFINS base:", r.cofins.vBC);
