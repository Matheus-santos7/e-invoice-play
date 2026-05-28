/** Formatação pura (sem fetch). */

export function formatChave(c: string): string {
  return c.replace(/(\d{4})/g, "$1 ").trim();
}

export function brl(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
