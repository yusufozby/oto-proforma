import * as XLSX from "xlsx";
import type { ProductRow } from "../types";

/** Excel başlıklarını esnek biçimde ürün alanlarına eşler (Türkçe/İngilizce, boşluk/aksan toleranslı). */
const HEADER_MAP: Record<string, keyof ProductRow> = {
  kod: "kod",
  code: "kod",
  isim: "isim",
  "i̇sim": "isim",
  ad: "isim",
  urun: "isim",
  "ürün": "isim",
  "urun adi": "isim",
  "ürün adı": "isim",
  name: "isim",
  gtip: "gtip",
  "koli sayisi": "koliSayisi",
  "koli sayısı": "koliSayisi",
  koli: "koliSayisi",
  "koli ici adet": "koliIciAdet",
  "koli içi adet": "koliIciAdet",
  "koli ici": "koliIciAdet",
  "koli içi": "koliIciAdet",
  birim: "birim",
  "birim fiyat": "birim",
  "birim fiyati": "birim",
  "birim fiyatı": "birim",
  "birim ₺": "birim",
  price: "birim",
  fiyat: "birim",
};

function normalizeHeader(h: string): string {
  return h.toString().trim().toLowerCase().replace(/\s+/g, " ");
}

export interface ExcelImportResult {
  products: ProductRow[];
  skipped: number;
}

/**
 * Yüklenen .xlsx / .xls / .csv dosyasının ilk sayfasını okur ve sütun
 * başlıklarını (Kod, İsim, GTİP, Koli Sayısı, Koli İçi Adet, Birim) eşleyerek
 * ürün satırlarına dönüştürür. En az "isim" veya "kod" dolu olmayan satırlar atlanır.
 */
export async function parseExcelToProducts(file: File): Promise<ExcelImportResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  let skipped = 0;
  const products: ProductRow[] = [];

  for (const row of rows) {
    const mapped: Partial<Record<keyof ProductRow, unknown>> = {};
    for (const [rawKey, value] of Object.entries(row)) {
      const key = HEADER_MAP[normalizeHeader(rawKey)];
      if (key) mapped[key] = value;
    }
    if (!mapped.isim && !mapped.kod) {
      skipped++;
      continue;
    }
    products.push({
      id: crypto.randomUUID(),
      kod: String(mapped.kod ?? ""),
      isim: String(mapped.isim ?? ""),
      gtip: String(mapped.gtip ?? ""),
      koliSayisi: Number(mapped.koliSayisi) || 1,
      koliIciAdet: Number(mapped.koliIciAdet) || 1,
      birim: Number(mapped.birim) || 0,
    });
  }

  return { products, skipped };
}
