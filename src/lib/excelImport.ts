import * as XLSX from "xlsx";
import JSZip from "jszip";
import type { ProductRow } from "../types";

/** Excel başlıklarını esnek biçimde ürün alanlarına eşler. */
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
  return h
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Excel içerisindeki resmi temsil eder.
 */
export interface ExcelImage {
  file: File;
  path: string;
}

export interface ExcelImportResult {
  products: ProductRow[];
  skipped: number;
  images: ExcelImage[];
}

/**
 * Excel içerisindeki gömülü resimleri çıkarır.
 *
 * .xlsx dosyası ZIP yapısında olduğu için resimler:
 *
 * xl/media/image1.png
 * xl/media/image2.jpeg
 * ...
 *
 * şeklinde bulunur.
 */
async function extractExcelImages(
  buffer: ArrayBuffer
): Promise<ExcelImage[]> {
  const zip = await JSZip.loadAsync(buffer);

  const images: ExcelImage[] = [];

  for (const path of Object.keys(zip.files)) {
    if (!path.startsWith("xl/media/")) {
      continue;
    }

    const zipFile = zip.files[path];

    if (zipFile.dir) {
      continue;
    }

    const blob = await zipFile.async("blob");

    const fileName = path.split("/").pop() ?? "image";

    const file = new File([blob], fileName, {
      type: blob.type || getMimeType(fileName),
    });

    images.push({
      file,
      path,
    });
  }

  return images;
}

/**
 * Dosya uzantısına göre MIME type belirler.
 */
function getMimeType(fileName: string): string {
  const extension = fileName
    .split(".")
    .pop()
    ?.toLowerCase();

  switch (extension) {
    case "png":
      return "image/png";

    case "jpg":
    case "jpeg":
      return "image/jpeg";

    case "gif":
      return "image/gif";

    case "webp":
      return "image/webp";

    case "bmp":
      return "image/bmp";

    default:
      return "application/octet-stream";
  }
}

/**
 * Yüklenen Excel dosyasının ilk sayfasını okur.
 *
 * Hem:
 * - hücre verilerini
 * - Excel içerisine gömülmüş resimleri
 *
 * birlikte döndürür.
 */
export async function parseExcelToProducts(
  file: File
): Promise<ExcelImportResult> {
  const buf = await file.arrayBuffer();

  // -------------------------
  // 1. Excel'i oku
  // -------------------------

  const wb = XLSX.read(buf, {
    type: "array",
  });

  const sheetName = wb.SheetNames[0];

  if (!sheetName) {
    return {
      products: [],
      skipped: 0,
      images: [],
    };
  }

  const sheet = wb.Sheets[sheetName];

  // -------------------------
  // 2. Hücre verilerini oku
  // -------------------------

  const rows: Record<string, unknown>[] =
    XLSX.utils.sheet_to_json(sheet, {
      defval: "",
    });

  let skipped = 0;

  const products: ProductRow[] = [];

  for (const row of rows) {
    const mapped: Partial<
      Record<keyof ProductRow, unknown>
    > = {};

    for (const [rawKey, value] of Object.entries(row)) {
      const key = HEADER_MAP[normalizeHeader(rawKey)];

      if (key) {
        mapped[key] = value;
      }
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

      koliSayisi:
        Number(mapped.koliSayisi) || 1,

      koliIciAdet:
        Number(mapped.koliIciAdet) || 1,

      birim:
        Number(mapped.birim) || 0,
    });
  }

  // -------------------------
  // 3. Excel içerisindeki
  //    resimleri çıkar
  // -------------------------

  const images = await extractExcelImages(buf);
  console.log("Excel içerisindeki resimler:", images);
  return {
    products,
    skipped,
    images,
  };
}