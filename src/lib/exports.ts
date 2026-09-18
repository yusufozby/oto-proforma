import jsPDF from "jspdf";
import type {
  Proforma,
  ProductProforma,
  Session,
  Product,
} from "../types";
import { calcTotals, tl, resolveImageUrl } from "./helpers";
import { baseApi } from "./storage";

// =========================================================
// SAYFA & RENKLER
// =========================================================

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;

const MARGIN_LEFT = 5;
const MARGIN_RIGHT = 5;
const MARGIN_TOP = 5;
const MARGIN_BOTTOM = 5;

const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

const FONT = "Inter";

const INK: [number, number, number] = [20, 20, 20];
const TEXT_DARK: [number, number, number] = [60, 60, 60];
const TEXT_LABEL: [number, number, number] = [130, 130, 130];
const TEXT_MUTED: [number, number, number] = [165, 165, 165];
const PINK: [number, number, number] = [244, 164, 164];
const BORDER: [number, number, number] = [200, 200, 200];
const BORDER_SOFT: [number, number, number] = [230, 230, 230];
const HEADER_BG: [number, number, number] = [248, 248, 248];

const TABLE_ROW_H = 10.5;
const TABLE_HEADER_H = 8.5;
const PRODUCT_IMG_SIZE = 9;

// Yuvarlatma yarıçapları
const TABLE_RADIUS = 2.5;
const PAYMENT_RADIUS = 2.5;

// =========================================================
// ASSET IMPORTLARI
// =========================================================

// @ts-ignore
import InterRegularUrl from "../assets/fonts/Inter-Regular.ttf?url";
// @ts-ignore
import InterBoldUrl from "../assets/fonts/Inter-Bold.ttf?url";
// @ts-ignore
import PhoneIconUrl from "../assets/icons/phone.png?url";
// @ts-ignore
import WhatsappIconUrl from "../assets/icons/whatsapp.png?url";
// @ts-ignore
import MapsIconUrl from "../assets/icons/maps.png?url";
// @ts-ignore
import CompanyLogoUrl from "../assets/icons/logo.png?url";

// =========================================================
// GÖRSEL DÖNÜŞTÜRÜCÜ
// =========================================================

async function compressAndResizeImage(
  src: string | Blob,
  targetWidth = 100,
  targetHeight = 100,
  quality = 0.7
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject("Canvas context oluşturulamadı");
        return;
      }
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, targetWidth, targetHeight);
      const scale = Math.min(targetWidth / img.width, targetHeight / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      const x = (targetWidth - w) / 2;
      const y = (targetHeight - h) / 2;
      ctx.drawImage(img, x, y, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = (err) => reject(err);
    if (typeof src === "string") {
      img.src = src;
    } else {
      img.src = URL.createObjectURL(src);
    }
  });
}

type ContactIcons = { phone: string; whatsapp: string; maps: string };

async function registerIcons(): Promise<ContactIcons> {
  try {
    const [phone, whatsapp, maps] = await Promise.all([
      compressAndResizeImage(PhoneIconUrl, 64, 64, 0.8),
      compressAndResizeImage(WhatsappIconUrl, 64, 64, 0.8),
      compressAndResizeImage(MapsIconUrl, 64, 64, 0.8),
    ]);
    return { phone, whatsapp, maps };
  } catch {
    return { phone: "", whatsapp: "", maps: "" };
  }
}

async function loadCompanyLogo(): Promise<string> {
  try {
    return await compressAndResizeImage(CompanyLogoUrl, 150, 150, 0.8);
  } catch {
    return "";
  }
}

async function preloadProductImages(
  products: Product[]
): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  if (!products || !Array.isArray(products)) return map;

  await Promise.all(
    products.map(async (row) => {
      const productId = Number(row.id);
      const imagePath = row.image;
      if (!Number.isFinite(productId) || !imagePath) return;

      const url = resolveImageUrl(imagePath, baseApi);
      if (!url) return;

      try {
        const response = await fetch(url);
        if (!response.ok) return;

        const blob = await response.blob();
        const compressed = await compressAndResizeImage(blob, 80, 80, 0.7);
        map.set(productId, compressed);
      } catch {
        // Görsel indirilemedi — pembe yer tutucu kare kullanılacak
      }
    })
  );

  return map;
}

// =========================================================
// FONT
// =========================================================

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function assertValidTtf(buffer: ArrayBuffer, label: string) {
  if (buffer.byteLength < 1000) throw new Error(`${label} dosyası çok küçük.`);
  const view = new DataView(buffer);
  const magic = view.getUint32(0, false);
  const validMagics = [0x00010000, 0x74727565, 0x4f54544f, 0x74746366];
  if (!validMagics.includes(magic)) {
    throw new Error(`${label} geçerli bir TTF/OTF dosyası değil.`);
  }
}

async function registerFonts(pdf: jsPDF): Promise<void> {
  try {
    const [regularResponse, boldResponse] = await Promise.all([
      fetch(InterRegularUrl),
      fetch(InterBoldUrl),
    ]);
    if (!regularResponse.ok || !boldResponse.ok) {
      throw new Error("Font dosyaları sunucudan alınamadı.");
    }
    const [regularBuffer, boldBuffer] = await Promise.all([
      regularResponse.arrayBuffer(),
      boldResponse.arrayBuffer(),
    ]);
    assertValidTtf(regularBuffer, "Inter-Regular.ttf");
    assertValidTtf(boldBuffer, "Inter-Bold.ttf");
    pdf.addFileToVFS("Inter-Regular.ttf", arrayBufferToBase64(regularBuffer));
    pdf.addFont("Inter-Regular.ttf", FONT, "normal");
    pdf.addFileToVFS("Inter-Bold.ttf", arrayBufferToBase64(boldBuffer));
    pdf.addFont("Inter-Bold.ttf", FONT, "bold");
  } catch {
    pdf.setFont("helvetica", "normal");
  }
}

// =========================================================
// YARDIMCI
// =========================================================

type Baseline = "top" | "middle" | "bottom" | "alphabetic";

function safeString(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function setText(
  pdf: jsPDF,
  text: string,
  x: number,
  y: number,
  size = 9,
  bold = false,
  color: readonly [number, number, number] = TEXT_DARK,
  baseline: Baseline = "alphabetic"
) {
  pdf.setFont(FONT, bold ? "bold" : "normal");
  pdf.setFontSize(size);
  pdf.setTextColor(...color);
  pdf.text(safeString(text), x, y, { baseline });
}

function drawRightText(
  pdf: jsPDF,
  text: string,
  rightX: number,
  y: number,
  size = 9,
  bold = false,
  color: readonly [number, number, number] = TEXT_DARK,
  baseline: Baseline = "alphabetic"
) {
  pdf.setFont(FONT, bold ? "bold" : "normal");
  pdf.setFontSize(size);
  pdf.setTextColor(...color);
  pdf.text(safeString(text), rightX, y, { align: "right", baseline });
}

function splitText(pdf: jsPDF, text: string, maxWidth: number): string[] {
  return pdf.splitTextToSize(safeString(text), maxWidth) as string[];
}

function drawLine(
  pdf: jsPDF,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: readonly [number, number, number] = BORDER_SOFT,
  width = 0.25
) {
  pdf.setDrawColor(...color);
  pdf.setLineWidth(width);
  pdf.line(x1, y1, x2, y2);
}

// =========================================================
// HEADER
// =========================================================

function drawHeader(
  pdf: jsPDF,
  pf: Proforma,
  session: Session,
  _logoBase64: string
): number {
  const x = MARGIN_LEFT;
  const y = MARGIN_TOP;

  const logoSize = 13.5;
  const logoY = y + 1.5;
  pdf.setFillColor(...PINK);
  pdf.roundedRect(x, logoY, logoSize, logoSize, 1.5, 1.5, "F");

  const firmName = safeString(session.firm) || "ASEL Aydınlatma";

  const titleBaselineY = y + 7.5;
  const subBaselineY = titleBaselineY + 5.8;

  setText(pdf, firmName, x + logoSize + 4, titleBaselineY, 18, true, INK);

  setText(
    pdf,
    "GRUP PRİZ • GOLYAT • AYDINLATMA",
    x + logoSize + 4,
    subBaselineY,
    7.5,
    true,
    TEXT_LABEL
  );

  const rightX = PAGE_WIDTH - MARGIN_RIGHT;
  drawRightText(pdf, "PROFORM", rightX, titleBaselineY, 26, true, INK);

  drawRightText(
    pdf,
    "Fiyat Teklifi by Oto Proforma",
    rightX,
    subBaselineY,
    7.5,
    false,
    TEXT_LABEL
  );

  const lineY = y + 18;
  drawLine(pdf, MARGIN_LEFT, lineY, PAGE_WIDTH - MARGIN_RIGHT, lineY, BORDER, 0.4);

  return lineY + 6;
}

// =========================================================
// FİRMA + TEKLİF BİLGİLERİ
// =========================================================

function drawCompanyAndOfferInfo(
  pdf: jsPDF,
  pf: Proforma,
  session: Session,
  startY: number
): number {
  const leftX = MARGIN_LEFT;
  const rightX = PAGE_WIDTH / 2 + 5;
  const labelW = 18;
  let y = startY;

  const leftRows: [string, string][] = [
    ["Unvan", safeString(session.firm)],
    ["Adres", safeString(session.center_address || session.fabric_address)],
    ["Telefon", safeString(session.phone)],
    ["Mail", safeString(session.email)],
  ];

  const rightRows: [string, string][] = [
    ["Teklif No", safeString(pf.code || pf.id)],
    [
      "Tarih",
      pf.created_date
        ? new Date(pf.created_date).toLocaleDateString("tr-TR")
        : "-",
    ],
    [
      "Geçerlilik",
      pf.validity_date
        ? new Date(pf.validity_date).toLocaleDateString("tr-TR")
        : "-",
    ],
  ];

  leftRows.forEach(([label, value]) => {
    setText(pdf, label, leftX, y, 7.5, true, TEXT_LABEL);
    const lines = splitText(pdf, value, 75);
    setText(pdf, lines[0] || "", leftX + labelW, y, 7.5, false, TEXT_DARK);
    if (lines.length > 1) {
      y += 3.8;
      setText(pdf, lines[1], leftX + labelW, y, 7.5, false, TEXT_DARK);
    }
    y += 4.8;
  });

  let ry = startY;
  rightRows.forEach(([label, value]) => {
    setText(pdf, label, rightX, ry, 7.5, true, TEXT_LABEL);
    setText(pdf, value, rightX + 24, ry, 7.5, false, TEXT_DARK);
    ry += 4.8;
  });

  return Math.max(y, ry) + 4;
}

// =========================================================
// ÜRÜN TABLOSU
// =========================================================

type ProductColumn = {
  key:
  | "image"
  | "no"
  | "kod"
  | "isim"
  | "barkod"
  | "koliIci"
  | "koli"
  | "totalAdet"
  | "birim"
  | "total";
  title: string;
  width: number;
  align: "left" | "center" | "right";
};

function getProductColumns(): ProductColumn[] {
  return [
    { key: "no", title: "#", width: 7, align: "center" },
    { key: "image", title: "RESİM", width: 14, align: "center" },
    { key: "kod", title: "KOD", width: 25, align: "left" },
    { key: "isim", title: "İSİM", width: 55, align: "left" },
    { key: "barkod", title: "BARKOD", width: 31, align: "center" },
    { key: "koliIci", title: "KOLİ\nİÇİ", width: 10, align: "center" },
    { key: "koli", title: "KOLİ", width: 10, align: "center" },
    { key: "totalAdet", title: "TOTAL\nADET", width: 12, align: "center" },
    { key: "birim", title: "BİRİM", width: 11, align: "right" },
    { key: "total", title: "FİYAT (₺)", width: 22, align: "right" },
  ];
}

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function getProductValue(
  row: Product,
  index: number,
  key: ProductColumn["key"]
): string {
  const r = row as any;
  switch (key) {
    case "no":
      return String(index + 1).padStart(2, "0");

    case "kod":
      return safeString(r.code ?? r.code ?? r.product_id);

    case "isim":
      return safeString(r.product_name ?? r.name ?? r.title ?? "");

    case "barkod":
      return safeString(r.gtype ?? r.barkod ?? "");

    case "koliIci": {
      const koliIci = toNumber(r.parcel_inside ?? r.koli_ici ?? r.per_box ?? 0);
      return koliIci ? String(koliIci) : "";
    }

    case "koli": {
      const koli = toNumber(r.parcel ?? r.koli ?? r.box_count ?? 0);
      return koli ? String(koli) : "";
    }

    case "totalAdet": {
      const koliIci = toNumber(r.parcel_inside ?? r.koli_ici ?? r.per_box ?? 0);
      const koli = toNumber(r.parcel ?? r.koli ?? r.box_count ?? 0);
      const total = koliIci * koli;
      return total ? String(total) : "";
    }

    case "birim": {
      const unitPrice = toNumber(r.unit ?? r.price ?? r.birim_fiyat ?? 0);
      return unitPrice ? tl(unitPrice) : "";
    }

    case "total": {
      const koliIci = toNumber(r.parcel_inside ?? r.koli_ici ?? r.per_box ?? 0);
      const koli = toNumber(r.parcel ?? r.koli ?? r.box_count ?? 0);
      const totalAdet = koliIci * koli;
      const unitPrice = toNumber(r.unit ?? r.price ?? r.birim_fiyat ?? 0);
      const totalPrice = totalAdet * unitPrice;
      return totalPrice ? tl(totalPrice) : "";
    }

    default:
      return "";
  }
}

function columnTextX(col: ProductColumn, colStartX: number): number {
  if (col.align === "center") return colStartX + col.width / 2;
  if (col.align === "right") return colStartX + col.width - 1.5;
  return colStartX + 1.5;
}

function addProductImage(
  pdf: jsPDF,
  base64Image: string | undefined,
  x: number,
  y: number,
  size: number
) {
  if (base64Image) {
    try {
      pdf.addImage(base64Image, "JPEG", x, y, size, size);
      return;
    } catch {
      // fallback
    }
  }
  pdf.setFillColor(...PINK);
  pdf.roundedRect(x, y, size, size, 1.2, 1.2, "F");
}

/**
 * Tablo başlığını çizer.
 * @param rounded true ise üst köşelere radius uygular (tablonun ilk başlığı).
 */
function drawProductTableHeader(
  pdf: jsPDF,
  x: number,
  y: number,
  columns: ProductColumn[],
  rounded = false
): number {
  const headerHeight = TABLE_HEADER_H;
  const tableWidth = CONTENT_WIDTH;

  pdf.setFillColor(...HEADER_BG);

  if (rounded) {
    pdf.roundedRect(x, y, tableWidth, headerHeight, TABLE_RADIUS, TABLE_RADIUS, "F");
    pdf.rect(x, y + headerHeight - TABLE_RADIUS, tableWidth, TABLE_RADIUS, "F");
  } else {
    pdf.rect(x, y, tableWidth, headerHeight, "F");
  }

  if (!rounded) {
    drawLine(pdf, x, y, x + tableWidth, y, BORDER, 0.4);
  }

  pdf.setFont(FONT, "bold");
  pdf.setFontSize(5.5);
  pdf.setTextColor(...INK);

  let currentX = x;
  for (const column of columns) {
    const lines = column.title.split("\n");
    const lineHeight = 2.7;

    // ★ Dikey ortalama: satırların toplam yüksekliğini hesapla,
    // hücre ortasından yukarı doğru kaydırarak başla
    const totalTextHeight = (lines.length - 1) * lineHeight;
    const firstLineCenterY = y + headerHeight / 2 - totalTextHeight / 2;

    lines.forEach((line, index) => {
      const textY = firstLineCenterY + index * lineHeight;
      const textX = columnTextX(column, currentX);
      const align = column.align === "left" ? "left" : column.align;
      pdf.text(line, textX, textY, { align, baseline: "middle" });
    });
    currentX += column.width;
  }

  drawLine(
    pdf,
    x,
    y + headerHeight,
    x + tableWidth,
    y + headerHeight,
    BORDER,
    0.4
  );
  return headerHeight;
}

function drawProductRow(
  pdf: jsPDF,
  row: Product,
  index: number,
  x: number,
  y: number,
  columns: ProductColumn[],
  alternate: boolean,
  rowHeight: number,
  imageMap: Map<number, string>
): number {
  const tableWidth = CONTENT_WIDTH;

  if (alternate) {
    pdf.setFillColor(...HEADER_BG);
    pdf.rect(x, y, tableWidth, rowHeight, "F");
  }

  let currentX = x;
  const productId = Number(row.id);

  for (const column of columns) {
    if (column.key === "image") {
      const size = PRODUCT_IMG_SIZE;
      const imgX = currentX + (column.width - size) / 2;
      const imgY = y + (rowHeight - size) / 2;
      addProductImage(pdf, imageMap.get(productId), imgX, imgY, size);
      currentX += column.width;
      continue;
    }

    const value = getProductValue(row, index, column.key);
    pdf.setFont(FONT, column.key === "total" ? "bold" : "normal");
    pdf.setFontSize(6);
    pdf.setTextColor(...TEXT_DARK);

    const lines = splitText(pdf, value, column.width - 2);
    const visibleLines = lines.slice(0, 2);
    const lineHeight = 2.9;

    // ★ Dikey ortalama: satırların toplam yüksekliğini hesapla,
    // hücre ortasından yukarı doğru kaydırarak başla
    const totalTextHeight = (visibleLines.length - 1) * lineHeight;
    const firstLineCenterY = y + rowHeight / 2 - totalTextHeight / 2;

    visibleLines.forEach((line, lineIndex) => {
      const textY = firstLineCenterY + lineIndex * lineHeight;
      const textX = columnTextX(column, currentX);
      const align = column.align === "left" ? "left" : column.align;
      pdf.text(line, textX, textY, { align, baseline: "middle" });
    });

    currentX += column.width;
  }

  drawLine(
    pdf,
    x,
    y + rowHeight,
    x + tableWidth,
    y + rowHeight,
    BORDER_SOFT,
    0.25
  );
  return rowHeight;
}

async function drawProductTable(
  pdf: jsPDF,
  pf: Proforma,
  startY: number
): Promise<number> {
  const columns = getProductColumns();
  const tableWidth = CONTENT_WIDTH;
  const rowHeight = TABLE_ROW_H;

  const products: Product[] = (pf as any).products || [];
  const imageMap = await preloadProductImages(products);

  const tableStartY = startY;
  let currentY = startY;

  // İlk tablo başlığı — üst köşeler yuvarlatılmış
  const headerHeight = drawProductTableHeader(
    pdf,
    MARGIN_LEFT,
    currentY,
    columns,
    true
  );
  currentY += headerHeight;

  let index = 0;
  while (index < products.length) {
    // Sayfa sonu kontrolü
    if (currentY + rowHeight > PAGE_HEIGHT - MARGIN_BOTTOM - 62) {
      drawLine(pdf, MARGIN_LEFT, tableStartY, MARGIN_LEFT, currentY, BORDER, 0.4);
      drawLine(pdf, MARGIN_LEFT + tableWidth, tableStartY, MARGIN_LEFT + tableWidth, currentY, BORDER, 0.4);
      drawLine(pdf, MARGIN_LEFT, currentY, MARGIN_LEFT + tableWidth, currentY, BORDER, 0.4);

      pdf.addPage();
      currentY = MARGIN_TOP;
      const h = drawProductTableHeader(pdf, MARGIN_LEFT, currentY, columns, true);
      currentY += h;
      continue;
    }

    drawProductRow(
      pdf,
      products[index],
      index,
      MARGIN_LEFT,
      currentY,
      columns,
      index % 2 === 1,
      rowHeight,
      imageMap
    );
    currentY += rowHeight;
    index += 1;
  }

  // Dış çerçeve (yuvarlatılmış)
  pdf.setDrawColor(...BORDER);
  pdf.setLineWidth(0.4);
  pdf.roundedRect(
    MARGIN_LEFT,
    tableStartY,
    tableWidth,
    currentY - tableStartY,
    TABLE_RADIUS,
    TABLE_RADIUS,
    "S"
  );

  return currentY + 8;
}

// =========================================================
// İSKONTOLU TOPLAM HESAPLAMA
// =========================================================

function calcDiscountedTotals(pf: Proforma): {
  rawTotal: number;
  discountedTotal: number;
  kdv: number;
  grandTotal: number;
} {
  const products: Product[] = (pf as any).products || [];

  let discountedTotal = 0;

  for (const row of products) {
    const r = row as any;
    const koliIci = toNumber(r.parcel_inside ?? r.koli_ici ?? r.per_box ?? 0);
    const koli = toNumber(r.parcel ?? r.koli ?? r.box_count ?? 0);
    const totalAdet = koliIci * koli;
    const unitPrice = toNumber(r.unit ?? r.price ?? r.birim_fiyat ?? 0);
    const lineTotal = totalAdet * unitPrice;

    const discountRate = toNumber(pf.discount ?? 0);
    const discountedLine = lineTotal * (1 - discountRate / 100);

    discountedTotal += discountedLine;
  }

  const kdv = discountedTotal * 0.2;
  const grandTotal = discountedTotal + kdv;

  return {
    rawTotal: discountedTotal,
    discountedTotal,
    kdv,
    grandTotal,
  };
}

// =========================================================
// ŞARTLAR + TOPLAMLAR
// =========================================================

function drawConditionsAndTotals(
  pdf: jsPDF,
  pf: Proforma,
  startY: number
): number {
  const gap = 8;
  const leftW = CONTENT_WIDTH * 0.56;
  const rightW = CONTENT_WIDTH - leftW - gap;
  const leftX = MARGIN_LEFT;
  const rightX = MARGIN_LEFT + leftW + gap;

  const conditions = pf.conditions || [];
  const conditionLines: string[] = [];
  for (const condition of conditions) {
    const lines = splitText(pdf, `• ${condition.name}`, leftW - 12);
    conditionLines.push(...lines);
  }

  const totalsMinH = 34;
  const conditionsH = 12 + conditionLines.length * 4.5 + 6;
  const boxH = Math.max(totalsMinH, conditionsH);

  // ---- Sol kutu: Şartlar ----
  pdf.setDrawColor(...BORDER);
  pdf.setLineWidth(0.4);
  pdf.setFillColor(255, 255, 255);
  pdf.roundedRect(leftX, startY, leftW, boxH, 4, 4, "FD");

  setText(pdf, "Şartlar ve Koşullar", leftX + 6, startY + 7, 8, true, INK);

  let cy = startY + 13.5;
  pdf.setFont(FONT, "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(...TEXT_DARK);
  for (const line of conditionLines) {
    pdf.text(line, leftX + 6, cy);
    cy += 4.5;
  }

  // ---- Sağ kutu: Toplamlar ----
  pdf.setDrawColor(...BORDER);
  pdf.setLineWidth(0.4);
  pdf.setFillColor(255, 255, 255);
  pdf.roundedRect(rightX, startY, rightW, boxH, 4, 4, "FD");

  const { discountedTotal, kdv, grandTotal } = calcDiscountedTotals(pf);

  const fmt = (n: number) =>
    n.toLocaleString("tr-TR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const padX = 5;
  const padTop = 0.5;
  const padBottom = 3.5;
  const usableH = boxH - padTop - padBottom;
  const rowH = usableH / 3;

  const rows: { label: string; value: string; isTotal: boolean; kdv: boolean }[] = [
    { label: "Ara Toplam", value: fmt(discountedTotal), isTotal: false, kdv: false },
    { label: "KDV (%20)", value: fmt(kdv), isTotal: false, kdv: true },
    { label: "Toplam", value: fmt(grandTotal), isTotal: true, kdv: false },
  ];

  rows.forEach((row, idx) => {
    const rowTop = startY + padTop + idx * rowH;

    // ★ Dikey ortalama: satırın üst ve alt sınırı arasındaki tam orta nokta
    const rowBottom = row.isTotal ? startY + boxH - padBottom : rowTop + rowH;
    const centerY = (rowTop + rowBottom) / 2;

    const baselineY = (rowTop + rowBottom) / 2;

    if (row.isTotal) {
      pdf.setFillColor(...HEADER_BG);

      const fillX = rightX + 0.2;
      const fillW = rightW - 0.4;
      const fillY = rowTop + 0.5;
      const fillH = boxH - (rowTop - startY) - 0.7;
      const radius = 4;

      pdf.rect(fillX, fillY, fillW, fillH - radius, "F");
      pdf.roundedRect(fillX, fillY + fillH - radius * 2, fillW, radius * 2, radius, radius, "F");
    }

    setText(
      pdf,
      row.label,
      rightX + padX,
      row.isTotal ? baselineY + 2 : row.kdv ? baselineY + 0.5 : baselineY,
      row.isTotal ? 9.5 : 8.2,
      true,
      row.isTotal ? INK : TEXT_LABEL,
      "middle"
    );

    drawRightText(
      pdf,
      row.value,
      rightX + rightW - padX,
      row.isTotal ? baselineY + 2 : row.kdv ? baselineY + 0.5 : baselineY,
      row.isTotal ? 11 : 9.2,
      row.isTotal,
      row.isTotal ? INK : TEXT_DARK,
      "middle"
    );

    if (idx === 0) {
      const lineY = rowTop + rowH;
      drawLine(
        pdf,
        rightX + 0.2,            // ← 0.8 → 0.2 (sol boşluk azaltıldı)
        lineY,
        rightX + rightW - 0.2,   // ← 0.5 → 0.2 (sağ boşluk azaltıldı)
        lineY,
        BORDER,
        0.35
      );
    }
  });

  return startY + boxH + 8;
}

// =========================================================
// ÖDEME DETAYLARI
// =========================================================

function drawPaymentDetails(
  pdf: jsPDF,
  pf: Proforma,
  startY: number
): number {
  const x = MARGIN_LEFT;
  const w = CONTENT_WIDTH;
  const headerH = 9;
  const rowH = 11;
  const totalH = headerH + rowH * 2;

  // Sol sütun
  const col1_LabelX = x + 5;
  const col1_ValueX = x + 25;
  const leftDividerX = x + 22;

  // Sağ sütun
  const col2_StartX = x + w * 0.48;
  const col2_LabelX = col2_StartX + 5;
  const col2_ValueX = col2_StartX + 25;
  const rightDividerX = col2_StartX + 22;

  // =====================================================
  // 1. FILL'LER (stroke yok)
  // =====================================================

  // Beyaz arka plan
  pdf.setFillColor(255, 255, 255);
  pdf.roundedRect(x, startY, w, totalH, PAYMENT_RADIUS, PAYMENT_RADIUS, "F");

  // Başlık bar (üst yuvarlak, alt düz)
  pdf.setFillColor(...HEADER_BG);
  pdf.roundedRect(x, startY, w, headerH, PAYMENT_RADIUS, PAYMENT_RADIUS, "F");
  pdf.rect(x, startY + headerH - PAYMENT_RADIUS, w, PAYMENT_RADIUS, "F");

  // =====================================================
  // 2. İÇ ÇİZGİLER
  // =====================================================

  pdf.setDrawColor(...BORDER);
  pdf.setLineWidth(0.4);

  // Başlık altı yatay çizgi
  pdf.line(x, startY + headerH, x + w, startY + headerH);

  // Sol dikey çizgi (Unvan / IBAN ayırıcı)
  pdf.line(
    leftDividerX,
    startY + headerH,
    leftDividerX,
    startY + totalH
  );

  // Sağ üst dikey çizgi (Banka sütunu)
  pdf.line(
    col2_StartX,
    startY + headerH,
    col2_StartX,
    startY + headerH + rowH
  );

  // Sağ alt dikey çizgi
  pdf.line(
    rightDividerX,
    startY + headerH,
    rightDividerX,
    startY + headerH + rowH
  );

  // Satır 1 alt yatay çizgi
  const r1Top = startY + headerH;
  pdf.line(x, r1Top + rowH, x + w, r1Top + rowH);

  // =====================================================
  // 3. DIŞ ÇERÇEVE (EN SON — üst ve alt border aynı olur)
  // =====================================================

  pdf.setDrawColor(...BORDER);
  pdf.setLineWidth(0.4);
  pdf.roundedRect(x, startY, w, totalH, PAYMENT_RADIUS, PAYMENT_RADIUS, "S");

  // =====================================================
  // 4. METİNLER
  // =====================================================

  // Başlık
  pdf.setFont(FONT, "bold");
  pdf.setFontSize(7.5);
  pdf.setTextColor(...INK);
  pdf.text("Ödeme Detayları", x + w / 2, startY + headerH / 2, {
    align: "center",
    baseline: "middle",
  });

  // ----- Satır 1 -----
  const r1Baseline = r1Top + rowH / 2;

  setText(pdf, "Unvan", col1_LabelX + 2, r1Baseline, 7, true, TEXT_LABEL, "middle");
  setText(pdf, safeString(pf.pay_title), col1_ValueX, r1Baseline, 7.5, false, TEXT_DARK, "middle");

  setText(pdf, "Banka", col2_LabelX + 2, r1Baseline, 7, true, TEXT_LABEL, "middle");
  setText(pdf, pf.bank ?? "", col2_ValueX, r1Baseline, 7.5, false, TEXT_DARK, "middle");

  // ----- Satır 2 -----
  const r2Top = r1Top + rowH;
  const r2Baseline = r2Top + rowH / 2;

  setText(pdf, "IBAN", col1_LabelX + 2, r2Baseline, 7, true, TEXT_LABEL, "middle");
  setText(pdf, safeString(pf.iban), col1_ValueX, r2Baseline, 7.5, false, TEXT_DARK, "middle");

  return startY + totalH + 8;
}

// =========================================================
// FOOTER
// =========================================================

function drawFooter(pdf: jsPDF, pf: Proforma) {
  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    pdf.setPage(page);
    const y = PAGE_HEIGHT - 9;

    drawLine(
      pdf,
      MARGIN_LEFT,
      y - 3.5,
      PAGE_WIDTH - MARGIN_RIGHT,
      y - 3.5,
      BORDER_SOFT,
      0.3
    );

    pdf.setFont(FONT, "normal");
    pdf.setFontSize(6.5);
    pdf.setTextColor(...TEXT_MUTED);

    pdf.text(`Sayfa ${page}/${pageCount}`, MARGIN_LEFT, y);
    pdf.text("otoproforma", PAGE_WIDTH - MARGIN_RIGHT, y, { align: "right" });
  }
}

// =========================================================
// PDF OLUŞTUR
// =========================================================

async function createProformaPdf(
  pf: Proforma,
  session: Session
): Promise<jsPDF> {
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  await registerFonts(pdf);

  const [, logoBase64] = await Promise.all([
    registerIcons(),
    loadCompanyLogo(),
  ]);

  pdf.setProperties({
    title: `Proforma-${safeString(pf.id)}`,
    subject: "Proforma",
    author: safeString(session.firm),
    creator: "Oto Proforma",
    keywords: "proforma, teklif, fatura",
  });

  let y = drawHeader(pdf, pf, session, logoBase64);
  y = drawCompanyAndOfferInfo(pdf, pf, session, y);
  y = await drawProductTable(pdf, pf, y);

  if (y + 60 > PAGE_HEIGHT - MARGIN_BOTTOM) {
    pdf.addPage();
    y = MARGIN_TOP;
  }

  y = drawConditionsAndTotals(pdf, pf, y);

  if (y + 30 > PAGE_HEIGHT - MARGIN_BOTTOM) {
    pdf.addPage();
    y = MARGIN_TOP;
  }

  drawPaymentDetails(pdf, pf, y);
  drawFooter(pdf, pf);

  return pdf;
}

// =========================================================
// DOWNLOAD / SHARE
// =========================================================

export async function downloadProformaPdf(
  pf: Proforma,
  session: Session
): Promise<void> {
  const pdf = await createProformaPdf(pf, session);
  pdf.save(`Proforma-${safeString(pf.id)}.pdf`);
}

export async function shareProformaPdf(
  pf: Proforma,
  session: Session
): Promise<void> {
  const pdf = await createProformaPdf(pf, session);
  const blob = pdf.output("blob");
  const file = new File([blob], `${safeString(pf.code)}.pdf`, {
    type: "application/pdf",
  });

  if (!navigator.share || !navigator.canShare?.({ files: [file] })) {
    throw new Error("Bu cihaz PDF dosyası paylaşmayı desteklemiyor.");
  }

  await navigator.share({
    title: safeString(pf.code),
    text: "Proforma PDF",
    files: [file],
  });
}