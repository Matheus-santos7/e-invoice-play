/**
 * CT-e v4.00 XML generator — SIMULATION ONLY (modelo ML com NF-e referenciada).
 */

import type { CTeDto, TenantDto } from "./fiscal-types";
import { ufToCodigo } from "./nfe-uf";

const xmlEscape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const CTE_ML_EMIT = {
  cnpj: "03007331010295",
  ie: "12500181",
  nome: "EBAZARCOMBR LTDA",
  logradouro: "Rua Francisco de Souza e Mello",
  numero: "1590",
  bairro: "Cordovil",
  codigoMunicipio: "3304557",
  municipio: "Rio de Janeiro",
  uf: "RJ",
  cep: "21010410",
} as const;

const CTE_RNTRC = "47923462";

export function buildCTeXML(cte: CTeDto, remetente: TenantDto): string {
  const id = "CTe" + cte.chave;
  const dhEmi = cte.emitidoEm;
  const cUF = ufToCodigo(CTE_ML_EMIT.uf);
  const vFrete = cte.valor;
  const vCarga = cte.valorCarga;
  const pICMS = 12;
  const vICMS = Math.round(vFrete * (pICMS / 100) * 100) / 100;
  const [xMunIni, ufIni] = parseRota(cte.origem);
  const [xMunFim, ufFim] = parseRota(cte.destino);
  const cMunIni = remetente.codigoMunicipio;
  const cMunFim = "4206009";
  const dPrev = dhEmi.slice(0, 10);
  const nfeChave = cte.nfeChaveRef ?? "";

  const remCnpj = remetente.cnpj.replace(/\D/g, "");
  const remIe = remetente.ie.replace(/\D/g, "");
  const destCnpj = "03007331012077";
  const destIe = "261755994";

  const infNFeXml = nfeChave
    ? `
          <infNFe>
            <chave>${nfeChave}</chave>
            <dPrev>${dPrev}</dPrev>
          </infNFe>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<cteProc xmlns="http://www.portalfiscal.inf.br/cte" versao="4.00">
  <CTe>
    <infCte Id="${id}" versao="4.00">
      <ide>
        <cUF>${cUF}</cUF>
        <cCT>${cte.chave.slice(35, 43)}</cCT>
        <CFOP>${cte.cfop}</CFOP>
        <natOp>${xmlEscape(cte.natOp)}</natOp>
        <mod>57</mod>
        <serie>${cte.serie}</serie>
        <nCT>${cte.numero}</nCT>
        <dhEmi>${dhEmi}</dhEmi>
        <tpImp>1</tpImp>
        <tpEmis>1</tpEmis>
        <cDV>${cte.chave.slice(-1)}</cDV>
        <tpAmb>2</tpAmb>
        <tpCTe>0</tpCTe>
        <procEmi>0</procEmi>
        <verProc>1.0.0-SIMULATION</verProc>
        <cMunEnv>${CTE_ML_EMIT.codigoMunicipio}</cMunEnv>
        <xMunEnv>${xmlEscape(CTE_ML_EMIT.municipio)}</xMunEnv>
        <UFEnv>${CTE_ML_EMIT.uf}</UFEnv>
        <modal>01</modal>
        <tpServ>0</tpServ>
        <cMunIni>${cMunIni}</cMunIni>
        <xMunIni>${xmlEscape(xMunIni)}</xMunIni>
        <UFIni>${ufIni}</UFIni>
        <cMunFim>${cMunFim}</cMunFim>
        <xMunFim>${xmlEscape(xMunFim)}</xMunFim>
        <UFFim>${ufFim}</UFFim>
        <retira>1</retira>
        <indIEToma>1</indIEToma>
        <toma3><toma>0</toma></toma3>
      </ide>
      <emit>
        <CNPJ>${CTE_ML_EMIT.cnpj}</CNPJ>
        <IE>${CTE_ML_EMIT.ie}</IE>
        <xNome>${xmlEscape(CTE_ML_EMIT.nome)}</xNome>
        <enderEmit>
          <xLgr>${xmlEscape(CTE_ML_EMIT.logradouro)}</xLgr>
          <nro>${CTE_ML_EMIT.numero}</nro>
          <xBairro>${xmlEscape(CTE_ML_EMIT.bairro)}</xBairro>
          <cMun>${CTE_ML_EMIT.codigoMunicipio}</cMun>
          <xMun>${xmlEscape(CTE_ML_EMIT.municipio)}</xMun>
          <CEP>${CTE_ML_EMIT.cep}</CEP>
          <UF>${CTE_ML_EMIT.uf}</UF>
        </enderEmit>
        <CRT>3</CRT>
      </emit>
      <rem>
        <CNPJ>${remCnpj}</CNPJ>
        <IE>${remIe}</IE>
        <xNome>${xmlEscape(remetente.razaoSocial)}</xNome>
        <enderReme>
          <xLgr>${xmlEscape(remetente.logradouro)}</xLgr>
          <nro>${xmlEscape(remetente.numero)}</nro>
          <xBairro>${xmlEscape(remetente.bairro)}</xBairro>
          <cMun>${remetente.codigoMunicipio}</cMun>
          <xMun>${xmlEscape(remetente.municipio)}</xMun>
          <CEP>${remetente.cep.replace(/\D/g, "")}</CEP>
          <UF>${remetente.uf}</UF>
        </enderReme>
      </rem>
      <dest>
        <CNPJ>${destCnpj}</CNPJ>
        <IE>${destIe}</IE>
        <xNome>EBAZAR.COM.BR LTDA</xNome>
        <enderDest>
          <xLgr>Av. Papenborg</xLgr>
          <nro>S/N</nro>
          <xCpl>Nao consta</xCpl>
          <xBairro>Guaporanga</xBairro>
          <cMun>4206009</cMun>
          <xMun>Governador Celso Ramos</xMun>
          <CEP>88190000</CEP>
          <UF>SC</UF>
        </enderDest>
      </dest>
      <vPrest>
        <vTPrest>${vFrete.toFixed(2)}</vTPrest>
        <vRec>${vFrete.toFixed(2)}</vRec>
      </vPrest>
      <imp>
        <ICMS>
          <ICMS00>
            <CST>00</CST>
            <vBC>${vFrete.toFixed(2)}</vBC>
            <pICMS>${pICMS.toFixed(2)}</pICMS>
            <vICMS>${vICMS.toFixed(2)}</vICMS>
          </ICMS00>
        </ICMS>
        <vTotTrib>${vICMS.toFixed(2)}</vTotTrib>
      </imp>
      <infCTeNorm>
        <infCarga>
          <vCarga>${vCarga.toFixed(2)}</vCarga>
          <proPred>CAIXA</proPred>
          <infQ>
            <cUnid>01</cUnid>
            <tpMed>PESO BRUTO</tpMed>
            <qCarga>${cte.pesoCarga.toFixed(4)}</qCarga>
          </infQ>
        </infCarga>
        <infDoc>${infNFeXml}
        </infDoc>
        <infModal versaoModal="4.00">
          <rodo><RNTRC>${CTE_RNTRC}</RNTRC></rodo>
        </infModal>
      </infCTeNorm>
    </infCte>
    <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
      <SignedInfo>
        <Reference URI="#${id}">
          <DigestValue>SIMULATION-${cte.chave.slice(-12)}</DigestValue>
        </Reference>
      </SignedInfo>
      <SignatureValue>FAKE-SIGNATURE-FOR-SIMULATION-ONLY</SignatureValue>
    </Signature>
  </CTe>
  <protCTe versao="4.00">
    <infProt>
      <tpAmb>2</tpAmb>
      <verAplic>SIMULATION-CTe</verAplic>
      <chCTe>${cte.chave}</chCTe>
      <dhRecbto>${dhEmi}</dhRecbto>
      <nProt>333260367974${cte.numero}</nProt>
      <digVal>SIM-${cte.chave.slice(-8)}</digVal>
      <cStat>${cte.status === "AUTORIZADA" ? 100 : 103}</cStat>
      <xMotivo>${cte.status === "AUTORIZADA" ? "Autorizado o uso do CT-e (SIMULAÇÃO)" : cte.status}</xMotivo>
    </infProt>
  </protCTe>
</cteProc>`;
}

function parseRota(rota: string): [string, string] {
  const parts = rota.split("/");
  if (parts.length >= 2) return [parts[0]!.trim(), parts[1]!.trim()];
  return [rota, "SP"];
}
