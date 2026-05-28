/**
 * NFe v4.00 XML generator — SIMULATION ONLY.
 * Produces a structurally faithful nfeProc XML so the UI can render real-looking
 * documents in the inspector. The <Signature> block is a deterministic FAKE
 * marker — never use this output against real SEFAZ.
 */

import type { EmitenteDto, NFeDto, ProductDto } from "./fiscal-types";
import { ufToCodigo } from "./nfe-uf";
import {
  REMESSA_INF_CPL,
  REMESSA_ML_DEST_IE,
  REMESSA_ML_INTERMED_CNPJ,
  REMESSA_ML_INTERMED_ID,
} from "./remessa-constants";

const xmlEscape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function formatEanForXml(ean?: string): string {
  const digits = (ean ?? "").replace(/\D/g, "");
  if (digits.length === 8 || digits.length === 12 || digits.length === 13 || digits.length === 14) {
    return digits;
  }
  return "SEM GTIN";
}

function asNum(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function startsWithTaxCode(v: unknown, prefix: string): boolean {
  return typeof v === "string" && v.trim().startsWith(prefix);
}

function buildIcmsXmlFromSnapshot(
  icms: Record<string, unknown>,
  args: { orig: number; valor: number; valorIcms: number },
): string {
  const cst = String(icms.cst ?? "00").slice(0, 2);
  const pIcms = asNum(icms.aliquota, 0);
  const pRedBc = asNum(icms.pRedBc, 0);
  const pRedBcSt = asNum(icms.pRedBcSt, 0);
  const pMva = asNum(icms.pMva, 0);
  const pIcmsStRet = asNum(icms.pIcmsStRet, 0);
  const pFcpStRet = asNum(icms.pFcpStRet, 0);
  const pIcmsEfet = asNum(icms.pIcmsEfet, 0);
  const pRedBcEfet = asNum(icms.pRedBcEfet, 0);
  const motDesIcms = Math.trunc(asNum(icms.motDesIcms, 0));

  const vBc = Math.max(0, args.valor * (1 - pRedBc / 100));
  const vIcms = args.valorIcms || Math.round(vBc * (pIcms / 100) * 100) / 100;
  const vBcSt = Math.max(0, vBc * (1 + pMva / 100) * (1 - pRedBcSt / 100));
  const vIcmsSt = Math.max(0, Math.round(vBcSt * (pIcmsStRet / 100) * 100) / 100);
  const vBcEfet = Math.max(0, args.valor * (1 - pRedBcEfet / 100));
  const vIcmsEfet = Math.max(0, Math.round(vBcEfet * (pIcmsEfet / 100) * 100) / 100);
  const vFcpSt = Math.max(0, Math.round(vBcSt * (pFcpStRet / 100) * 100) / 100);

  const cBenef = typeof icms.codBenef === "string" && icms.codBenef.trim() ? `<cBenef>${xmlEscape(String(icms.codBenef))}</cBenef>` : "";
  const motDes = motDesIcms > 0 ? `<motDesICMS>${motDesIcms}</motDesICMS>` : "";

  switch (cst) {
    case "10":
      return `<ICMS><ICMS10><orig>${args.orig}</orig><CST>10</CST><modBC>3</modBC><vBC>${vBc.toFixed(2)}</vBC><pICMS>${pIcms.toFixed(4)}</pICMS><vICMS>${vIcms.toFixed(2)}</vICMS><modBCST>4</modBCST><pMVAST>${pMva.toFixed(4)}</pMVAST><pRedBCST>${pRedBcSt.toFixed(4)}</pRedBCST><vBCST>${vBcSt.toFixed(2)}</vBCST><pICMSST>${pIcmsStRet.toFixed(4)}</pICMSST><vICMSST>${vIcmsSt.toFixed(2)}</vICMSST></ICMS10></ICMS>`;
    case "20":
      return `<ICMS><ICMS20><orig>${args.orig}</orig><CST>20</CST><modBC>3</modBC><pRedBC>${pRedBc.toFixed(4)}</pRedBC><vBC>${vBc.toFixed(2)}</vBC><pICMS>${pIcms.toFixed(4)}</pICMS><vICMS>${vIcms.toFixed(2)}</vICMS>${motDes}${cBenef}</ICMS20></ICMS>`;
    case "30":
      return `<ICMS><ICMS30><orig>${args.orig}</orig><CST>30</CST><modBCST>4</modBCST><pMVAST>${pMva.toFixed(4)}</pMVAST><pRedBCST>${pRedBcSt.toFixed(4)}</pRedBCST><vBCST>${vBcSt.toFixed(2)}</vBCST><pICMSST>${pIcmsStRet.toFixed(4)}</pICMSST><vICMSST>${vIcmsSt.toFixed(2)}</vICMSST><vBCFCPST>${vBcSt.toFixed(2)}</vBCFCPST><pFCPST>${pFcpStRet.toFixed(4)}</pFCPST><vFCPST>${vFcpSt.toFixed(2)}</vFCPST>${motDes}${cBenef}</ICMS30></ICMS>`;
    case "40":
    case "50":
      return `<ICMS><ICMS40><orig>${args.orig}</orig><CST>${cst}</CST>${motDes}${cBenef}</ICMS40></ICMS>`;
    case "41":
      return `<ICMS><ICMS40><orig>${args.orig}</orig><CST>41</CST>${motDes}${cBenef}</ICMS40></ICMS>`;
    case "51":
      return `<ICMS><ICMS51><orig>${args.orig}</orig><CST>51</CST><modBC>3</modBC><pRedBC>${pRedBc.toFixed(4)}</pRedBC><pICMS>${pIcms.toFixed(4)}</pICMS></ICMS51></ICMS>`;
    case "60":
      return `<ICMS><ICMS60><orig>${args.orig}</orig><CST>60</CST><vBCSTRet>${vBcSt.toFixed(2)}</vBCSTRet><pST>${pIcmsStRet.toFixed(4)}</pST><vICMSSubstituto>${vIcmsSt.toFixed(2)}</vICMSSubstituto><vICMSSTRet>${vIcmsSt.toFixed(2)}</vICMSSTRet><vBCFCPSTRet>${vBcSt.toFixed(2)}</vBCFCPSTRet><pFCPSTRet>${pFcpStRet.toFixed(4)}</pFCPSTRet><vFCPSTRet>${vFcpSt.toFixed(2)}</vFCPSTRet></ICMS60></ICMS>`;
    case "70":
      return `<ICMS><ICMS70><orig>${args.orig}</orig><CST>70</CST><modBC>3</modBC><pRedBC>${pRedBc.toFixed(4)}</pRedBC><vBC>${vBc.toFixed(2)}</vBC><pICMS>${pIcms.toFixed(4)}</pICMS><vICMS>${vIcms.toFixed(2)}</vICMS><modBCST>4</modBCST><pMVAST>${pMva.toFixed(4)}</pMVAST><pRedBCST>${pRedBcSt.toFixed(4)}</pRedBCST><vBCST>${vBcSt.toFixed(2)}</vBCST><pICMSST>${pIcmsStRet.toFixed(4)}</pICMSST><vICMSST>${vIcmsSt.toFixed(2)}</vICMSST><vICMSDeson>${vIcmsEfet.toFixed(2)}</vICMSDeson>${motDes}${cBenef}</ICMS70></ICMS>`;
    case "90":
      return `<ICMS><ICMS90><orig>${args.orig}</orig><CST>90</CST><modBC>3</modBC><vBC>${vBc.toFixed(2)}</vBC><pRedBC>${pRedBc.toFixed(4)}</pRedBC><pICMS>${pIcms.toFixed(4)}</pICMS><vICMS>${vIcms.toFixed(2)}</vICMS><modBCST>4</modBCST><pMVAST>${pMva.toFixed(4)}</pMVAST><pRedBCST>${pRedBcSt.toFixed(4)}</pRedBCST><vBCST>${vBcSt.toFixed(2)}</vBCST><pICMSST>${pIcmsStRet.toFixed(4)}</pICMSST><vICMSST>${vIcmsSt.toFixed(2)}</vICMSST></ICMS90></ICMS>`;
    default:
      return `<ICMS><ICMS00><orig>${args.orig}</orig><CST>00</CST><modBC>3</modBC><vBC>${args.valor.toFixed(2)}</vBC><pICMS>${pIcms.toFixed(4)}</pICMS><vICMS>${args.valorIcms.toFixed(2)}</vICMS></ICMS00></ICMS>`;
  }
}

function protNFeBlock(nfe: NFeDto, dhEmi: string): string {
  return `  <protNFe versao="4.00">
    <infProt>
      <tpAmb>2</tpAmb>
      <verAplic>SIMULATION-3.2</verAplic>
      <chNFe>${nfe.chave}</chNFe>
      <dhRecbto>${dhEmi}</dhRecbto>
      <nProt>135260000099${nfe.numero}</nProt>
      <digVal>SIM-${nfe.chave.slice(-8)}</digVal>
      <cStat>${nfe.status === "AUTORIZADA" ? 100 : nfe.status === "REJEITADA" ? 539 : 103}</cStat>
      <xMotivo>${nfe.status === "AUTORIZADA" ? "Autorizado o uso da NF-e (SIMULAÇÃO)" : nfe.status}</xMotivo>
    </infProt>
  </protNFe>`;
}

function signatureBlock(id: string, chave: string): string {
  return `    <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
      <SignedInfo>
        <CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
        <SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>
        <Reference URI="#${id}">
          <DigestValue>SIMULATION-${chave.slice(-12)}</DigestValue>
        </Reference>
      </SignedInfo>
      <SignatureValue>FAKE-SIGNATURE-FOR-SIMULATION-ONLY</SignatureValue>
      <KeyInfo><KeyName>FAKE-SIMULATION-ONLY</KeyName></KeyInfo>
    </Signature>`;
}

export function buildNFeXML(nfe: NFeDto, emit: EmitenteDto, product?: ProductDto): string {
  if (nfe.tipo === "REMESSA") {
    return buildRemessaNFeXML(nfe, emit, product);
  }
  return buildVendaNFeXML(nfe, emit, product);
}

function buildRemessaNFeXML(nfe: NFeDto, emit: EmitenteDto, product?: ProductDto): string {
  const id = "NFe" + nfe.chave;
  const dhEmi = nfe.emitidaEm;
  const e = emit.endereco;
  const xCplXml = e.xCpl ? `\n          <xCpl>${xmlEscape(e.xCpl)}</xCpl>` : "";
  const foneXml = e.fone ? `\n          <fone>${e.fone.replace(/\D/g, "")}</fone>` : "";
  const iestXml = emit.iest ? `\n        <IEST>${emit.iest.replace(/\D/g, "")}</IEST>` : "";

  const qCom = nfe.quantidade;
  const cProd = product?.sku ?? `SKU-${nfe.numero}`;
  const cEAN = formatEanForXml(product?.ean);
  const xProd = product?.nome ?? nfe.natOp;
  const ncm = product?.ncm ?? nfe.ncm;
  const cfop = nfe.cfop;
  const uCom = product?.unidade ?? "UNID";
  const vUnCom = product?.preco ?? nfe.valor / qCom;
  const vProd = nfe.valor;
  const orig = product?.origem ?? 1;
  const cestXml = product?.cest ? `\n          <CEST>${product.cest}</CEST>` : "";

  const d = nfe.destinatario;
  const de = d.endereco;
  const docDigits = d.doc.replace(/\D/g, "");
  const destXCpl = de.complemento ? `\n          <xCpl>${xmlEscape(de.complemento)}</xCpl>` : "";
  const destIeXml = d.indIEDest === 1 ? `\n        <IE>${REMESSA_ML_DEST_IE}</IE>` : "";
  const cUF = ufToCodigo(e.uf);
  const infAdProd = nfe.pedidoML ? `\n        <infAdProd>xPed:${xmlEscape(nfe.pedidoML)}</infAdProd>` : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="${id}" versao="4.00">
      <ide>
        <cUF>${cUF}</cUF>
        <cNF>${nfe.chave.slice(35, 43)}</cNF>
        <natOp>${xmlEscape(nfe.natOp)}</natOp>
        <mod>55</mod>
        <serie>${nfe.serie}</serie>
        <nNF>${nfe.numero}</nNF>
        <dhEmi>${dhEmi}</dhEmi>
        <dhSaiEnt>${dhEmi}</dhSaiEnt>
        <tpNF>1</tpNF>
        <idDest>2</idDest>
        <cMunFG>${e.cMun}</cMunFG>
        <tpImp>1</tpImp>
        <tpEmis>1</tpEmis>
        <cDV>${nfe.chave.slice(-1)}</cDV>
        <tpAmb>2</tpAmb>
        <finNFe>1</finNFe>
        <indFinal>0</indFinal>
        <indPres>2</indPres>
        <indIntermed>1</indIntermed>
        <procEmi>0</procEmi>
        <verProc>mercadolivre.invoice-SIMULATION</verProc>
      </ide>
      <emit>
        <CNPJ>${emit.cnpj.replace(/\D/g, "")}</CNPJ>
        <xNome>${xmlEscape(emit.xNome)}</xNome>
        <enderEmit>
          <xLgr>${xmlEscape(e.xLgr)}</xLgr>
          <nro>${xmlEscape(e.nro)}</nro>${xCplXml}
          <xBairro>${xmlEscape(e.xBairro)}</xBairro>
          <cMun>${e.cMun}</cMun>
          <xMun>${xmlEscape(e.xMun)}</xMun>
          <UF>${e.uf}</UF>
          <CEP>${e.cep.replace(/\D/g, "")}</CEP>
          <cPais>${e.cPais}</cPais>
          <xPais>${xmlEscape(e.xPais)}</xPais>${foneXml}
        </enderEmit>
        <IE>${emit.ie.replace(/\D/g, "")}</IE>${iestXml}
        <CRT>${emit.crt}</CRT>
      </emit>
      <dest>
        <CNPJ>${docDigits}</CNPJ>
        <xNome>${xmlEscape(d.nome)}</xNome>
        <enderDest>
          <xLgr>${xmlEscape(de.logradouro)}</xLgr>
          <nro>${xmlEscape(de.numero)}</nro>${destXCpl}
          <xBairro>${xmlEscape(de.bairro)}</xBairro>
          <cMun>${de.codigoMunicipio}</cMun>
          <xMun>${xmlEscape(de.municipio)}</xMun>
          <UF>${de.uf}</UF>
          <CEP>${de.cep.replace(/\D/g, "")}</CEP>
          <cPais>${de.codigoPais}</cPais>
          <xPais>${xmlEscape(de.nomePais)}</xPais>
        </enderDest>
        <indIEDest>${d.indIEDest}</indIEDest>${destIeXml}
      </dest>
      <det nItem="1">
        <prod>
          <cProd>${xmlEscape(cProd)}</cProd>
          <cEAN>${cEAN}</cEAN>
          <xProd>${xmlEscape(xProd)}</xProd>
          <NCM>${ncm}</NCM>${cestXml}
          <CFOP>${cfop}</CFOP>
          <uCom>${xmlEscape(uCom)}</uCom>
          <qCom>${qCom.toFixed(4)}</qCom>
          <vUnCom>${vUnCom.toFixed(8)}</vUnCom>
          <vProd>${vProd.toFixed(2)}</vProd>
          <cEANTrib>${cEAN}</cEANTrib>
          <uTrib>${xmlEscape(uCom)}</uTrib>
          <qTrib>${qCom.toFixed(4)}</qTrib>
          <vUnTrib>${vUnCom.toFixed(8)}</vUnTrib>
          <indTot>1</indTot>
        </prod>
        <imposto>
          <vTotTrib>0.00</vTotTrib>
          <ICMS>
            <ICMS00>
              <orig>${orig}</orig>
              <CST>00</CST>
              <modBC>3</modBC>
              <vBC>${vProd.toFixed(2)}</vBC>
              <pICMS>${nfe.aliqICMS.toFixed(4)}</pICMS>
              <vICMS>${nfe.valorICMS.toFixed(2)}</vICMS>
            </ICMS00>
          </ICMS>
          <IPI>
            <cEnq>103</cEnq>
            <IPINT><CST>55</CST></IPINT>
          </IPI>
          <PIS><PISNT><CST>09</CST></PISNT></PIS>
          <COFINS><COFINSNT><CST>09</CST></COFINSNT></COFINS>
        </imposto>${infAdProd}
      </det>
      <total>
        <ICMSTot>
          <vBC>${vProd.toFixed(2)}</vBC>
          <vICMS>${nfe.valorICMS.toFixed(2)}</vICMS>
          <vICMSDeson>0.00</vICMSDeson>
          <vFCP>0.00</vFCP>
          <vBCST>0.00</vBCST>
          <vST>0.00</vST>
          <vFCPST>0.00</vFCPST>
          <vFCPSTRet>0.00</vFCPSTRet>
          <vProd>${vProd.toFixed(2)}</vProd>
          <vFrete>0.00</vFrete>
          <vSeg>0.00</vSeg>
          <vDesc>0.00</vDesc>
          <vII>0.00</vII>
          <vIPI>0.00</vIPI>
          <vIPIDevol>0.00</vIPIDevol>
          <vPIS>0.00</vPIS>
          <vCOFINS>0.00</vCOFINS>
          <vOutro>0.00</vOutro>
          <vNF>${vProd.toFixed(2)}</vNF>
          <vTotTrib>0.00</vTotTrib>
        </ICMSTot>
      </total>
      <transp>
        <modFrete>0</modFrete>
        <vol>
          <qVol>1</qVol>
          <pesoL>3.800</pesoL>
          <pesoB>4.380</pesoB>
        </vol>
      </transp>
      <pag>
        <detPag>
          <indPag>0</indPag>
          <tPag>90</tPag>
          <vPag>0.00</vPag>
        </detPag>
      </pag>
      <infIntermed>
        <CNPJ>${REMESSA_ML_INTERMED_CNPJ}</CNPJ>
        <idCadIntTran>${REMESSA_ML_INTERMED_ID}</idCadIntTran>
      </infIntermed>
      <infAdic>
        <infCpl>${xmlEscape(REMESSA_INF_CPL)}</infCpl>
      </infAdic>
    </infNFe>
${signatureBlock(id, nfe.chave)}
  </NFe>
${protNFeBlock(nfe, dhEmi)}
</nfeProc>`;
}

function buildVendaNFeXML(nfe: NFeDto, emit: EmitenteDto, product?: ProductDto): string {
  const id = "NFe" + nfe.chave;
  const dhEmi = nfe.emitidaEm;
  const e = emit.endereco;
  const xCplXml = e.xCpl ? `\n          <xCpl>${xmlEscape(e.xCpl)}</xCpl>` : "";
  const foneXml = e.fone ? `\n          <fone>${e.fone.replace(/\D/g, "")}</fone>` : "";
  const iestXml = emit.iest ? `\n        <IEST>${emit.iest.replace(/\D/g, "")}</IEST>` : "";

  const qCom = nfe.quantidade ?? 1;
  const cProd = product?.sku ?? `SKU-${nfe.numero}`;
  const cEAN = formatEanForXml(product?.ean);
  const xProd = product?.nome ?? nfe.natOp;
  const ncm = product?.ncm ?? nfe.ncm;
  const cfop = product?.cfop ?? nfe.cfop;
  const uCom = product?.unidade ?? "UN";
  const vUnCom = product?.preco ?? nfe.valor;
  const vProd = product ? product.preco * qCom : nfe.valor;
  const orig = product?.origem ?? 0;
  const cestXml = product?.cest ? `\n          <CEST>${product.cest}</CEST>` : "";
  const exTipiXml = product?.exTipi ? `\n          <EXTIPI>${product.exTipi}</EXTIPI>` : "";

  const d = nfe.destinatario;
  const de = d.endereco;
  const docDigits = d.doc.replace(/\D/g, "");
  const docTag = d.docTipo === "CNPJ" ? "CNPJ" : "CPF";
  const destXCpl = de.complemento ? `\n          <xCpl>${xmlEscape(de.complemento)}</xCpl>` : "";
  const destFone = de.telefone ? `\n          <fone>${de.telefone.replace(/\D/g, "")}</fone>` : "";
  const cUF = ufToCodigo(e.uf);

  const fiscal = (nfe.fiscalPayload ?? {}) as Record<string, unknown>;
  const icms = (fiscal.icms as Record<string, unknown> | undefined) ?? {};
  const ipi = (fiscal.ipi as Record<string, unknown> | undefined) ?? {};
  const pis = (fiscal.pis as Record<string, unknown> | undefined) ?? {};
  const cofins = (fiscal.cofins as Record<string, unknown> | undefined) ?? {};
  const ibsCbs = (fiscal.ibsCbs as Record<string, unknown> | undefined) ?? {};

  const pIpi = asNum(ipi.aliquota, 0);
  const vIpi = Math.round((nfe.valor * (pIpi / 100)) * 100) / 100;
  const pPis = asNum(pis.aliquota, 1.65);
  const vPis = Math.round((nfe.valor * (pPis / 100)) * 100) / 100;
  const pCofins = asNum(cofins.aliquota, 7.6);
  const vCofins = Math.round((nfe.valor * (pCofins / 100)) * 100) / 100;
  const cstPis = typeof pis.st === "string" ? pis.st.slice(0, 2) : "01";
  const cstCofins = typeof cofins.st === "string" ? cofins.st.slice(0, 2) : "01";
  const cstIpi = typeof ipi.st === "string" ? ipi.st.slice(0, 2) : "50";
  const cenq = typeof ipi.codEnq === "string" ? ipi.codEnq : "999";

  const icmsXml = buildIcmsXmlFromSnapshot(icms, { orig, valor: nfe.valor, valorIcms: nfe.valorICMS });

  const ipiXml =
    startsWithTaxCode(ipi.st, "55") || startsWithTaxCode(ipi.st, "54") || startsWithTaxCode(ipi.st, "53")
      ? `<IPI><cEnq>${cenq}</cEnq><IPINT><CST>${cstIpi}</CST></IPINT></IPI>`
      : `<IPI><cEnq>${cenq}</cEnq><IPITrib><CST>${cstIpi}</CST><vBC>${nfe.valor.toFixed(2)}</vBC><pIPI>${pIpi.toFixed(2)}</pIPI><vIPI>${vIpi.toFixed(2)}</vIPI></IPITrib></IPI>`;

  const ibsCbsXml =
    ibsCbs.st || ibsCbs.cClassTrib
      ? `<IBSCBS><CST>${String(ibsCbs.st ?? "000").slice(0, 3)}</CST><cClassTrib>${String(ibsCbs.cClassTrib ?? "000001").slice(0, 6)}</cClassTrib></IBSCBS>`
      : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="${id}" versao="4.00">
      <ide>
        <cUF>${cUF}</cUF>
        <cNF>${nfe.chave.slice(35, 43)}</cNF>
        <natOp>${xmlEscape(nfe.natOp)}</natOp>
        <mod>55</mod>
        <serie>${nfe.serie}</serie>
        <nNF>${nfe.numero}</nNF>
        <dhEmi>${dhEmi}</dhEmi>
        <tpNF>1</tpNF>
        <idDest>${de.uf === e.uf ? 1 : 2}</idDest>
        <cMunFG>${e.cMun}</cMunFG>
        <tpImp>1</tpImp>
        <tpEmis>1</tpEmis>
        <cDV>${nfe.chave.slice(-1)}</cDV>
        <tpAmb>2</tpAmb>
        <finNFe>1</finNFe>
        <indFinal>1</indFinal>
        <indPres>2</indPres>
        <procEmi>0</procEmi>
        <verProc>fiscal-engine-3.2-SIMULATION</verProc>
      </ide>
      <emit>
        <CNPJ>${emit.cnpj.replace(/\D/g, "")}</CNPJ>
        <xNome>${xmlEscape(emit.xNome)}</xNome>
        <xFant>${xmlEscape(emit.xFant)}</xFant>
        <enderEmit>
          <xLgr>${xmlEscape(e.xLgr)}</xLgr>
          <nro>${xmlEscape(e.nro)}</nro>${xCplXml}
          <xBairro>${xmlEscape(e.xBairro)}</xBairro>
          <cMun>${e.cMun}</cMun>
          <xMun>${xmlEscape(e.xMun)}</xMun>
          <UF>${e.uf}</UF>
          <CEP>${e.cep.replace(/\D/g, "")}</CEP>
          <cPais>${e.cPais}</cPais>
          <xPais>${xmlEscape(e.xPais)}</xPais>${foneXml}
        </enderEmit>
        <IE>${emit.ie.replace(/\D/g, "")}</IE>${iestXml}
        <CRT>${emit.crt}</CRT>
      </emit>
      <dest>
        <${docTag}>${docDigits}</${docTag}>
        <xNome>${xmlEscape(d.nome)}</xNome>
        <enderDest>
          <xLgr>${xmlEscape(de.logradouro)}</xLgr>
          <nro>${xmlEscape(de.numero)}</nro>${destXCpl}
          <xBairro>${xmlEscape(de.bairro)}</xBairro>
          <cMun>${de.codigoMunicipio}</cMun>
          <xMun>${xmlEscape(de.municipio)}</xMun>
          <UF>${de.uf}</UF>
          <CEP>${de.cep.replace(/\D/g, "")}</CEP>
          <cPais>${de.codigoPais}</cPais>
          <xPais>${xmlEscape(de.nomePais)}</xPais>${destFone}
        </enderDest>
        <indIEDest>${d.indIEDest}</indIEDest>
      </dest>
      <det nItem="1">
        <prod>
          <cProd>${xmlEscape(cProd)}</cProd>
          <cEAN>${cEAN}</cEAN>
          <xProd>${xmlEscape(xProd)}</xProd>
          <NCM>${ncm}</NCM>${cestXml}${exTipiXml}
          <CFOP>${cfop}</CFOP>
          <uCom>${xmlEscape(uCom)}</uCom>
          <qCom>${qCom.toFixed(4)}</qCom>
          <vUnCom>${vUnCom.toFixed(8)}</vUnCom>
          <vProd>${vProd.toFixed(2)}</vProd>
          <cEANTrib>${cEAN}</cEANTrib>
          <uTrib>${xmlEscape(uCom)}</uTrib>
          <qTrib>${qCom.toFixed(4)}</qTrib>
          <vUnTrib>${vUnCom.toFixed(8)}</vUnTrib>
          <indTot>1</indTot>
        </prod>
        <imposto>
          ${icmsXml}
          ${ipiXml}
          <PIS><PISAliq><CST>${cstPis}</CST><vBC>${nfe.valor.toFixed(2)}</vBC><pPIS>${pPis.toFixed(2)}</pPIS><vPIS>${vPis.toFixed(2)}</vPIS></PISAliq></PIS>
          <COFINS><COFINSAliq><CST>${cstCofins}</CST><vBC>${nfe.valor.toFixed(2)}</vBC><pCOFINS>${pCofins.toFixed(2)}</pCOFINS><vCOFINS>${vCofins.toFixed(2)}</vCOFINS></COFINSAliq></COFINS>
          ${ibsCbsXml}
        </imposto>
      </det>
      <total>
        <ICMSTot>
          <vBC>${nfe.valor.toFixed(2)}</vBC>
          <vICMS>${nfe.valorICMS.toFixed(2)}</vICMS>
          <vProd>${nfe.valor.toFixed(2)}</vProd>
          <vNF>${nfe.valor.toFixed(2)}</vNF>
        </ICMSTot>
      </total>
    </infNFe>
${signatureBlock(id, nfe.chave)}
  </NFe>
${protNFeBlock(nfe, dhEmi)}
</nfeProc>`;
}

/** Lightweight XML pretty token highlighter (tag, attr, value). */
export function highlightXML(xml: string): { kind: "tag" | "attr" | "value" | "text" | "comment"; text: string }[] {
  const tokens: { kind: "tag" | "attr" | "value" | "text" | "comment"; text: string }[] = [];
  const re = /(<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<\/?[^>]+>)|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    if (m[1]) {
      const tag = m[1];
      const inner = tag.replace(/^<\/?|\/?>$|\?>$|^<\?/g, "");
      const parts = inner.split(/\s+/);
      tokens.push({
        kind: "tag",
        text:
          tag.startsWith("<?") || tag.startsWith("<!--")
            ? tag.split(" ")[0]!
            : `<${tag.startsWith("</") ? "/" : ""}${parts[0]}`,
      });
      for (let i = 1; i < parts.length; i++) {
        const a = parts[i];
        if (a?.includes("=")) {
          const [k, v] = a.split("=");
          tokens.push({ kind: "text", text: " " });
          tokens.push({ kind: "attr", text: k! });
          tokens.push({ kind: "text", text: "=" });
          tokens.push({ kind: "value", text: v! });
        } else if (a) {
          tokens.push({ kind: "text", text: " " + a });
        }
      }
      tokens.push({ kind: "tag", text: tag.endsWith("/>") ? "/>" : ">" });
    } else if (m[2]) {
      tokens.push({ kind: "text", text: m[2] });
    }
  }
  return tokens;
}
