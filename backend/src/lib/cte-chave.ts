import { ufToCodigo } from "./nfe-chave.js";

export function buildChaveCTe(params: {
  uf: string;
  cnpj: string;
  serie: number;
  numero: number;
  tpEmis?: number;
  cCT?: number;
}): string {
  const now = new Date();
  const aamm = String(now.getFullYear()).slice(-2) + String(now.getMonth() + 1).padStart(2, "0");
  const cCT = params.cCT ?? Math.floor(Math.random() * 99_999_999);
  const onlyDigits = (s: string) => s.replace(/\D/g, "");

  const k =
    String(ufToCodigo(params.uf)).padStart(2, "0") +
    aamm +
    onlyDigits(params.cnpj).padStart(14, "0") +
    "57" +
    String(params.serie).padStart(3, "0") +
    String(params.numero).padStart(9, "0") +
    String(params.tpEmis ?? 1).padStart(1, "0") +
    String(cCT).padStart(8, "0");

  let sum = 0;
  let mult = 2;
  for (let i = k.length - 1; i >= 0; i--) {
    sum += parseInt(k[i]!, 10) * mult;
    mult = mult === 9 ? 2 : mult + 1;
  }
  const dv = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  return k + String(dv);
}
