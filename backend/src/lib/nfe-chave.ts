const UF_IBGE: Record<string, number> = {
  AC: 12, AL: 27, AM: 13, AP: 16, BA: 29, CE: 23, DF: 53, ES: 32, GO: 52, MA: 21, MG: 31, MS: 50,
  MT: 51, PA: 15, PB: 25, PE: 26, PI: 22, PR: 41, RJ: 33, RN: 24, RO: 11, RR: 14, RS: 43, SC: 42,
  SE: 28, SP: 35, TO: 17,
};

export function ufToCodigo(uf: string): number {
  return UF_IBGE[uf.toUpperCase()] ?? 35;
}

export function buildChaveNFe(params: {
  uf: string;
  cnpj: string;
  serie: number;
  numero: number;
  tpEmis?: number;
  cNF?: number;
}): string {
  const now = new Date();
  const aamm = String(now.getFullYear()).slice(-2) + String(now.getMonth() + 1).padStart(2, "0");
  const cNF = params.cNF ?? Math.floor(Math.random() * 99_999_999);
  const onlyDigits = (s: string) => s.replace(/\D/g, "");

  const k =
    String(ufToCodigo(params.uf)).padStart(2, "0") +
    aamm +
    onlyDigits(params.cnpj).padStart(14, "0") +
    "55" +
    String(params.serie).padStart(3, "0") +
    String(params.numero).padStart(9, "0") +
    String(params.tpEmis ?? 1).padStart(1, "0") +
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

export function gerarPedidoMl(): string {
  const n = Date.now().toString().slice(-12);
  return `ML-${n}`;
}
