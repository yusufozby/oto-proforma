import * as XLSX from "xlsx";
import JSZip from "jszip";
import type { Product } from "../types";

/**
 * Excel başlıklarını Product alanlarına eşler.
 *
 * Excel'de örneğin:
 *
 * Kod              -> code
 * Ürün Adı         -> name
 * GTİP             -> gtype
 * Koli Sayısı      -> parcel
 * Koli İçi Adet    -> parcel_inside
 * Birim Fiyat      -> unit
 */
const HEADER_MAP: Record<string, keyof Product> = {
  // Kod
  kod: "code",
  code: "code",

  // Ürün adı
  isim: "name",
  "i̇sim": "name",
  ad: "name",
  urun: "name",
  "ürün": "name",
  "urun adi": "name",
  "ürün adı": "name",
  name: "name",

  // GTİP
  gtip: "gtype",
  "g.t.i.p": "gtype",
  gtype: "gtype",

  // Koli sayısı
  "koli sayisi": "parcel",
  "koli sayısı": "parcel",
  koli: "parcel",
  parcel: "parcel",

  // Koli içi adet
  "koli ici adet": "parcel_inside",
  "koli içi adet": "parcel_inside",
  "koli ici": "parcel_inside",
  "koli içi": "parcel_inside",
  "koli içi miktar": "parcel_inside",
  parcel_inside: "parcel_inside",

  // Birim fiyat
  birim: "unit",
  "birim fiyat": "unit",
  "birim fiyati": "unit",
  "birim fiyatı": "unit",
  "birim ₺": "unit",
  "birim tl": "unit",
  price: "unit",
  fiyat: "unit",
  unit: "unit",
};

/**
 * Excel başlığını normalize eder.
 *
 * Örneğin:
 *
 * " Ürün Adı " -> "ürün adı"
 * "KOLİ SAYISI" -> "koli sayisi"
 */
function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .replace(/ğ/g, "g")
    .replace(/Ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/Ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/Ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/Ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/Ç/g, "c")
    .replace(/\s+/g, " ");
}

/**
 * Excel içerisindeki resmi temsil eder.
 */
export interface ExcelImage {
  file: File;
  path: string;
}

/**
 * Excel import sonucu.
 */
export interface ExcelImportResult {
  products: Product[];
  skipped: number;
  images: ExcelImage[];
}

/**
 * Excel içerisindeki gömülü resimleri çıkarır.
 *
 * .xlsx dosyası ZIP yapısındadır.
 *
 * Resimler genellikle:
 *
 * xl/media/image1.png
 * xl/media/image2.jpeg
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

    const fileName =
      path.split("/").pop() ?? "image";

    const file = new File([blob], fileName, {
      type:
        blob.type ||
        getMimeType(fileName),
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
function getMimeType(
  fileName: string
): string {
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
 * Excel içerisindeki sayı değerlerini güvenli şekilde number'a çevirir.
 *
 * Örneğin:
 *
 * "10"       -> 10
 * "10,50"    -> 10.50
 * 25         -> 25
 * ""         -> fallback
 */
function parseNumber(
  value: unknown,
  fallback: number
): number {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return fallback;
  }

  if (typeof value === "number") {
    return Number.isFinite(value)
      ? value
      : fallback;
  }

  let text = String(value).trim();

  if (!text) {
    return fallback;
  }

  // Türkçe sayı formatı:
  // 1.250,50 -> 1250.50
  if (
    text.includes(".") &&
    text.includes(",")
  ) {
    text = text
      .replace(/\./g, "")
      .replace(",", ".");
  } else if (text.includes(",")) {
    text = text.replace(",", ".");
  }

  const parsed = Number(text);

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
}

/**
 * Yüklenen Excel dosyasının ilk sayfasını okur.
 *
 * Hücre verileri + gömülü resimler döndürülür.
 */
export async function parseExcelToProducts(
  file: File
): Promise<ExcelImportResult> {
  const buffer = await file.arrayBuffer();

  // =====================================================
  // 1. EXCEL'İ OKU
  // =====================================================

  const workbook = XLSX.read(buffer, {
    type: "array",
  });

  const sheetName =
    workbook.SheetNames[0];

  if (!sheetName) {
    return {
      products: [],
      skipped: 0,
      images: [],
    };
  }

  const sheet =
    workbook.Sheets[sheetName];

  // =====================================================
  // 2. SATIRLARI OKU
  // =====================================================

  const rows =
    XLSX.utils.sheet_to_json<
      Record<string, unknown>
    >(sheet, {
      defval: "",
      raw: true,
    });

  let skipped = 0;

  const products: Product[] = [];

  // =====================================================
  // 3. HER SATIRI PRODUCT'A ÇEVİR
  // =====================================================

  for (const row of rows) {
    const mapped: Partial<
      Record<keyof Product, unknown>
    > = {};

    // ---------------------------------------------------
    // Excel başlıklarını Product alanlarına eşleştir
    // ---------------------------------------------------

    for (const [
      rawKey,
      value,
    ] of Object.entries(row)) {
      const normalizedKey =
        normalizeHeader(rawKey);

      const productKey =
        HEADER_MAP[normalizedKey];

      if (productKey) {
        mapped[productKey] = value;
      }
    }

    // ---------------------------------------------------
    // Ürün tamamen boşsa atla
    // ---------------------------------------------------

    const code =
      String(mapped.code ?? "").trim();

    const name =
      String(mapped.name ?? "").trim();

    if (!code && !name) {
      skipped++;
      continue;
    }

    // ---------------------------------------------------
    // Product oluştur
    // ---------------------------------------------------

    const product: Product = {
      Id: 0,

      code,

      name,

      gtype:
        String(mapped.gtype ?? "").trim(),

      parcel: parseNumber(
        mapped.parcel,
        1
      ),

      parcel_inside: parseNumber(
        mapped.parcel_inside,
        1
      ),

      unit: parseNumber(
        mapped.unit,
        0
      ),

      image:
        String(mapped.image ?? ""),

      DynamicValues: [],

      proforma_id: undefined,
    };

    products.push(product);
  }

  // =====================================================
  // 4. EXCEL RESİMLERİNİ ÇIKAR
  // =====================================================

  const images =
    await extractExcelImages(buffer);

  console.log(
    "Excel içerisindeki ürünler:",
    products
  );

  console.log(
    "Excel içerisindeki resimler:",
    images
  );

  // =====================================================
  // 5. SONUÇ
  // =====================================================

  return {
    products,
    skipped,
    images,
  };
}