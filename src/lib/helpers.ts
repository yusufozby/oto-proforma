import type { Proforma } from "../types";
import type { Product } from "../types";

/**
 * Backend'den gelen ürün listesinde Id alanı eksik (undefined) veya
 * birden fazla üründe aynıysa, bu ürünler aynı "kimlik"e sahipmiş gibi
 * davranır — biri silinmek istendiğinde hepsi birden filtrelenip
 * kaybolur. Bu fonksiyon her ürüne garanti benzersiz bir Id atar:
 * geçerli VE tekil olan Id'ler olduğu gibi korunur, geçersiz/eksik/
 * tekrarlı olanlara yeni benzersiz negatif Id verilir.
 */
export function normalizeProductIds(products: Product[]): Product[] {
  const idCounts = new Map<number, number>();

  for (const p of products) {
    const rawId = Number((p as any).Id ?? (p as any).id);
    if (Number.isFinite(rawId)) {
      idCounts.set(rawId, (idCounts.get(rawId) ?? 0) + 1);
    }
  }

  const usedIds = new Set<number>();
  let nextTempId = 0;

  return products.map((p) => {
    const rawId = Number((p as any).Id ?? (p as any).id);
    const isValidAndUnique = Number.isFinite(rawId) && idCounts.get(rawId) === 1;

    if (isValidAndUnique) {
      usedIds.add(rawId);
      return { ...p, Id: rawId };
    }

    nextTempId -= 1;
    while (usedIds.has(nextTempId)) nextTempId -= 1;
    usedIds.add(nextTempId);
    return { ...p, Id: nextTempId };
  });
}
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
    (sum, p) => sum + (Number(p.parcel) || 0) * (Number(p.unit) || 0) * (Number(p.parcel_inside)),
    0
  );
  const effectiveIskonto = proforma.discount !== 0 ? Number(proforma.discount) || 0 : 0;
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

/**
 * Türkçe ondalık/binlik ayırıcı formatlarını (virgül = ondalık, nokta =
 * binlik) ve düz noktalı sayıları (12.5) aynı anda doğru şekilde sayıya
 * çevirir. Ayrıca "₺", "TL" gibi para birimi işaretlerini ve boşlukları
 * temizler. Excel'den veya elle klavyeden "12,5" / "12,5 ₺" gibi bir
 * değer geldiğinde bu tek fonksiyon her yerde aynı sonucu üretsin diye
 * merkezi olarak burada tutuluyor — kopyalarını başka dosyalara
 * çoğaltmayın, hep buradan import edin.
 */
export function parseTurkishNumber(input: unknown, fallback = 0): number {
  if (typeof input === "number") return Number.isFinite(input) ? input : fallback;
  if (input === null || input === undefined) return fallback;

  let s = String(input).trim();
  if (s === "") return fallback;

  // Para birimi sembolleri, "TL", ve tüm boşlukları temizle
  s = s.replace(/[₺$€]|tl\.?/gi, "").replace(/\s/g, "");
  if (s === "") return fallback;

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    // "1.234,56" -> nokta binlik ayırıcı, virgül ondalık -> "1234.56"
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    // "12,5" -> "12.5"
    s = s.replace(",", ".");
  }
  // sadece nokta varsa (12.5) ya da ayırıcı yoksa (125) zaten doğru

  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}