import type { Proforma } from "../types";

/* ---------------- fuzzy "3'lü" search helper ---------------- */
export function normalizeTr(s: string): string {
  return s
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/\s+/g, "")
    .replace(/ü/g, "u")
    .replace(/ç/g, "c")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ö/g, "o");
}

export function detectTripleTrigger(query: string): boolean {
  const n = normalizeTr(query);
  if (!n) return false;
  return n.includes("3lu") || n.includes("uclu");
}

/* ---------------- totals & formatting ---------------- */
export function calcTotals(proforma: Proforma): { araTotal: number; total: number } {
  const araTotal = proforma.products.reduce(
    (sum, p) => sum + (Number(p.koliSayisi) || 0) * (Number(p.koliIciAdet) || 0) * (Number(p.birim) || 0),
    0
  );
  const effectiveIskonto = proforma.iskontoEtkin ? Number(proforma.iskonto) || 0 : 0;
  const total = araTotal * (1 - effectiveIskonto / 100);
  return { araTotal, total };
}

export function tl(n: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(n || 0);
}

export function structuredCloneLite<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}
