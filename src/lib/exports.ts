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
// SAYFA & RENKLER — 2. görsele birebir
// =========================================================

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;

const MARGIN_LEFT = 5;
const MARGIN_RIGHT = 5;
const MARGIN_TOP = 5;
const MARGIN_BOTTOM = 5;

const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

const FONT = "Inter";

// Renk paleti
const INK: [number, number, number] = [30, 30, 30];            // koyu siyah başlıklar
const TEXT_DARK: [number, number, number] = [55, 55, 55];      // tablo değerleri / düz metin
const TEXT_LABEL: [number, number, number] = [120, 120, 120];  // etiketler (gri)
const TEXT_MUTED: [number, number, number] = [165, 165, 165];  // footer
const PINK: [number, number, number] = [244, 164, 164];        // logo karesi / ürün görseli
const BORDER: [number, number, number] = [215, 215, 215];      // tüm çerçeveler
const BORDER_SOFT: [number, number, number] = [228, 228, 228]; // iç ayırıcılar
const HEADER_BG: [number, number, number] = [248, 248, 248];   // tablo başlığı arka planı

const TABLE_ROW_H = 10.5;
const TABLE_HEADER_H = 8.5;
const PRODUCT_IMG_SIZE = 7;

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

const DEFAULT_COMPANY_LOGO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABd1NDZEAAAABGdBTUEAALGPC/xhBQAAADhlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAAqACAAQAAAABAAAAoKADAAQAAAABAAAAoAAAAAC118/4AAAIkUlEQVR4Ae1da1Qb1xl2R5Lgh3Ecx/m4SZw2Ttpme9p023/S3a/t5Kdpf6RpmqZNmrS3p/3R/pGm/dE2bdM0/SftJ333333333333333/084pS1iAnm4u4s54R/S8A3fmfu/3zpy5I63WsXDh/S0g0AICAi0gINACAi0gINACAi0gINACAi0gINACAi0gINACAi0gI=";

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
    return DEFAULT_COMPANY_LOGO;
  }
}

async function preloadProductImages(
  products: ProductProforma[]
): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  if (!products || !Array.isArray(products)) return map;

  await Promise.all(
    products.map(async (row) => {
      const productId = Number(row.product_id);
      const imagePath = row.Product?.image;
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
  color: readonly [number, number, number] = TEXT_DARK
) {
  pdf.setFont(FONT, bold ? "bold" : "normal");
  pdf.setFontSize(size);
  pdf.setTextColor(...color);
  pdf.text(safeString(text), x, y);
}

function drawRightText(
  pdf: jsPDF,
  text: string,
  rightX: number,
  y: number,
  size = 9,
  bold = false,
  color: readonly [number, number, number] = TEXT_DARK
) {
  pdf.setFont(FONT, bold ? "bold" : "normal");
  pdf.setFontSize(size);
  pdf.setTextColor(...color);
  pdf.text(safeString(text), rightX, y, { align: "right" });
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
// HEADER  (logo + firma adı + PROFORM başlığı)
// =========================================================

function drawHeader(
  pdf: jsPDF,
  pf: Proforma,
  session: Session,
  _logoBase64: string
): number {
  const x = MARGIN_LEFT;
  const y = MARGIN_TOP;

  // Pembe kare logo
  const logoSize = 12;
  pdf.setFillColor(...PINK);
  pdf.roundedRect(x, y, logoSize, logoSize, 2, 2, "F");

  // Firma adı — koyu siyah + bold
  const firmName = safeString(session.firm) || "ASEL Aydınlatma";
  setText(pdf, firmName, x + logoSize + 4, y + 5.8, 13, true, INK);

  // Alt başlık — gri, bold, küçük
  setText(
    pdf,
    "GRUP PRİZ • GOLYAT • AYDINLATMA",
    x + logoSize + 4,
    y + 11,
    6,
    true,
    TEXT_LABEL
  );

  // Sağ taraf — PROFORM siyah bold
  const rightX = PAGE_WIDTH - MARGIN_RIGHT;
  drawRightText(pdf, "PROFORM", rightX, y + 5.8, 15, true, INK);
  drawRightText(
    pdf,
    "Fiyat Teklifi by Oto Proforma",
    rightX,
    y + 11,
    6.2,
    false,
    TEXT_LABEL
  );

  // Alt divider
  const lineY = y + 16;
  drawLine(pdf, MARGIN_LEFT, lineY, PAGE_WIDTH - MARGIN_RIGHT, lineY, BORDER, 0.35);

  return lineY + 6;
}

// =========================================================
// FİRMA + TEKLİF BİLGİLERİ  (sol 4 satır / sağ 3 satır)
// =========================================================

function drawCompanyAndOfferInfo(
  pdf: jsPDF,
  pf: Proforma,
  session: Session,
  startY: number
): number {
  const leftX = MARGIN_LEFT;
  const rightX = PAGE_WIDTH / 2 + 8;
  const labelW = 16;
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
    setText(pdf, label, leftX, y, 7.2, true, TEXT_LABEL);
    const lines = splitText(pdf, value, 78);
    setText(pdf, lines[0] || "", leftX + labelW, y, 7.2, false, TEXT_DARK);
    if (lines.length > 1) {
      y += 3.6;
      setText(pdf, lines[1], leftX + labelW, y, 7.2, false, TEXT_DARK);
    }
    y += 4.4;
  });

  let ry = startY;
  rightRows.forEach(([label, value]) => {
    setText(pdf, label, rightX, ry, 7.2, true, TEXT_LABEL);
    setText(pdf, value, rightX + 22, ry, 7.2, false, TEXT_DARK);
    ry += 4.4;
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
    { key: "image", title: "RESİM", width: 10, align: "center" },
    { key: "kod", title: "KOD", width: 22, align: "left" },
    { key: "isim", title: "İSİM", width: 46, align: "left" },
    { key: "barkod", title: "BARKOD", width: 26, align: "center" },
    { key: "koliIci", title: "KOLİ\nİÇİ", width: 12, align: "center" },
    { key: "koli", title: "KOLİ", width: 12, align: "center" },
    { key: "totalAdet", title: "TOTAL\nADET", width: 14, align: "center" },
    { key: "birim", title: "BİRİM", width: 16, align: "right" },
    { key: "total", title: "FİYAT (₺)", width: 17, align: "right" },
  ];
}

function getProductValue(
  row: ProductProforma,
  index: number,
  key: ProductColumn["key"]
): string {
  const product = row.Product;
  const parcelCount = Number(row.parcel) || 0;
  const insideCount = Number(product?.parcel_inside) || 0;
  const totalAdet = parcelCount * insideCount;
  const unitPrice = Number(product?.unit) || 0;

  switch (key) {
    case "no":
      return String(index + 1).padStart(2, "0");
    case "kod":
      return safeString(product?.code);
    case "isim":
      return safeString(product?.name);
    case "barkod":
      return safeString(product?.gtype);
    case "koliIci":
      return safeString(product?.parcel_inside);
    case "koli":
      return safeString(row.parcel);
    case "totalAdet":
      return String(totalAdet);
    case "birim":
      return tl(unitPrice);
    case "total":
      return tl(totalAdet * unitPrice);
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

function drawProductTableHeader(
  pdf: jsPDF,
  x: number,
  y: number,
  columns: ProductColumn[]
): number {
  const headerHeight = TABLE_HEADER_H;
  const tableWidth = CONTENT_WIDTH;

  pdf.setFillColor(...HEADER_BG);
  pdf.rect(x, y, tableWidth, headerHeight, "F");

  drawLine(pdf, x, y, x + tableWidth, y, BORDER, 0.35);

  pdf.setFont(FONT, "bold");
  pdf.setFontSize(5.5);
  pdf.setTextColor(...TEXT_LABEL);

  let currentX = x;
  for (const column of columns) {
    const lines = column.title.split("\n");
    const lineHeight = 2.7;
    const startLineY =
      y + headerHeight / 2 - ((lines.length - 1) * lineHeight) / 2 + 1.2;

    lines.forEach((line, index) => {
      const textY = startLineY + index * lineHeight;
      const textX = columnTextX(column, currentX);
      const align = column.align === "left" ? "left" : column.align;
      pdf.text(line, textX, textY, { align });
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
    0.35
  );
  return headerHeight;
}

function drawProductRow(
  pdf: jsPDF,
  row: ProductProforma,
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
  const productId = Number(row.product_id);

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
    const startYText =
      y + rowHeight / 2 - ((visibleLines.length - 1) * lineHeight) / 2 + 1;

    visibleLines.forEach((line, lineIndex) => {
      const textY = startYText + lineIndex * lineHeight;
      const textX = columnTextX(column, currentX);
      const align = column.align === "left" ? "left" : column.align;
      pdf.text(line, textX, textY, { align });
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
    0.2
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

  const products: ProductProforma[] = (pf as any).products || [];
  const imageMap = await preloadProductImages(products);

  let currentY = startY;

  const headerHeight = drawProductTableHeader(pdf, MARGIN_LEFT, currentY, columns);
  currentY += headerHeight;

  let index = 0;
  while (index < products.length) {
    if (currentY + rowHeight > PAGE_HEIGHT - MARGIN_BOTTOM - 62) {
      drawLine(
        pdf,
        MARGIN_LEFT,
        currentY,
        MARGIN_LEFT + tableWidth,
        currentY,
        BORDER,
        0.35
      );
      pdf.addPage();
      currentY = MARGIN_TOP;
      const h = drawProductTableHeader(pdf, MARGIN_LEFT, currentY, columns);
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

  drawLine(
    pdf,
    MARGIN_LEFT,
    currentY,
    MARGIN_LEFT + tableWidth,
    currentY,
    BORDER,
    0.35
  );
  return currentY + 8;
}

// =========================================================
// ŞARTLAR + TOPLAMLAR
// =========================================================

// =========================================================
// ŞARTLAR + TOPLAMLAR
// =========================================================

// =========================================================
// ŞARTLAR + TOPLAMLAR
// =========================================================

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

  const totalsMinH = 34; // daha da sıkı
  const conditionsH = 12 + conditionLines.length * 4.5 + 6;
  const boxH = Math.max(totalsMinH, conditionsH);

  // ---- Sol kutu: Şartlar ----
  pdf.setDrawColor(...BORDER);
  pdf.setLineWidth(0.4);
  pdf.setFillColor(255, 255, 255);
  pdf.roundedRect(leftX, startY, leftW, boxH, 4, 4, "FD");

  setText(pdf, "Şartlar ve Koşullar", leftX + 6, startY + 7, 8, true, TEXT_LABEL);

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

  const { araTotal, total } = calcTotals(pf);
  const kdvAmount = araTotal * 0.2;

  const fmt = (n: number) =>
    n.toLocaleString("tr-TR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  // Üst boşluk azaltıldı → Ara Toplam yukarıya çok daha yakın
  const padX = 5;
  const padTop = 0.5;     // ← önemli: çok düşük
  const padBottom = 3.5;
  const usableH = boxH - padTop - padBottom;
  const rowH = usableH / 3;

  const rows: { label: string; value: string; isTotal: boolean }[] = [
    { label: "Ara Toplam", value: fmt(araTotal), isTotal: false },
    { label: "KDV (%20)", value: fmt(kdvAmount), isTotal: false },
    { label: "Toplam", value: fmt(total), isTotal: true },
  ];

  rows.forEach((row, idx) => {
    const rowTop = startY + padTop + idx * rowH;

    // DÜZELTME 3: Toplam satırı için dikey ortalama
    // Normal satırlarda baseline standart, Toplam satırında gri alanın tam ortasına denk getiriyoruz.
    let baselineY = rowTop + rowH / 2 + 1.2;

    if (row.isTotal) {
      // Toplam satırı için gri alanın yüksekliği: boxH - (rowTop - startY)
      // Bu alanın tam ortasına yazıyı oturtmak için +1.2 yerine daha nötr bir değer kullanıyoruz.
      // Böylece yazı gri alanın yukarısından ortalanmış olacak.
      baselineY = rowTop + (boxH - (rowTop - startY)) / 2 + 1.2;
    }

    // Sadece Toplam satırı gri – border’ı ezmeyecek şekilde içeriden
    // Sadece Toplam satırı gri – border’ı ezmeyecek şekilde içeriden
    if (row.isTotal) {
      pdf.setFillColor(...HEADER_BG);

      const fillX = rightX + 0.2;
      const fillW = rightW - 0.4;
      const fillY = rowTop + 0.5;
      const fillH = boxH - (rowTop - startY) - 0.7;
      const radius = 4; // Kartın köşe yuvarlaklığı ile aynı olmalı

      // 1. Parça: Üst kısım (Düz dikdörtgen)
      // Yuvarlak köşelerin başladığı yere kadar düz çiziyoruz
      pdf.rect(fillX, fillY, fillW, fillH - radius, "F");

      // 2. Parça: Alt kısım (Yuvarlak köşeli)
      // Sadece alt köşeleri yuvarlak olacak şekilde çiziyoruz
      // roundedRect(x, y, w, h, rx, ry, style)
      // Alt köşeleri yuvarlamak için tüm köşeleri yuvarlak çizip, üst kısmı düz çizgiyle kapatıyoruz
      pdf.roundedRect(fillX, fillY + fillH - radius * 2, fillW, radius * 2, radius, radius, "F");

      // Üstte kalan boşluğu (eğer varsa) düz dikdörtgenle kapat
      // Aslında yukarıdaki iki parça birleşince tamamı dolmuş oluyor.
      // Ancak garanti olması için üst parçayı biraz daha uzatabiliriz.
    }

    // Etiket
    setText(
      pdf,
      row.label,
      rightX + padX,
      baselineY,
      row.isTotal ? 9.5 : 8.2,
      true,
      row.isTotal ? INK : TEXT_LABEL
    );

    // Değer
    drawRightText(
      pdf,
      row.value,
      rightX + rightW - padX,
      baselineY,
      row.isTotal ? 11 : 9.2,
      row.isTotal,
      row.isTotal ? INK : TEXT_DARK
    );

    // DÜZELTME 1 & 2: Divider Çizgileri
    // Sadece ilk satırdan sonra (idx === 0) çizgi çekiyoruz. 
    // Böylece KDV'nin altındaki çizgi kalkmış oluyor.
    if (idx === 0) {
      const lineY = rowTop + rowH;
      drawLine(
        pdf,
        rightX + 0.7,               // Sol kenara tam yapışık (border içi)
        lineY,
        rightX + rightW - 0.7,      // Sağ kenara tam yapışık (border içi)
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

  // Sütun başlangıç noktaları (X koordinatları)
  const col1_LabelX = x + 5;          // Unvan / IBAN etiketleri
  const col1_ValueX = x + 25;         // Unvan / IBAN değerleri
  const col2_StartX = x + w * 0.55;   // Sağ blok (Banka) başlangıcı
  const col2_LabelX = col2_StartX + 5;// Banka etiketi
  const col2_ValueX = col2_StartX + 25;// Yapı Kredi değeri

  // Başlık bar (hafif gri)
  pdf.setFillColor(...HEADER_BG);
  pdf.rect(x, startY, w, headerH, "F");

  // Dış çerçeve
  pdf.setDrawColor(...BORDER);
  pdf.setLineWidth(0.4);
  pdf.rect(x, startY, w, headerH + rowH * 2, "S");

  // Başlık metni — ortada
  pdf.setFont(FONT, "bold");
  pdf.setFontSize(7.5);
  pdf.setTextColor(...TEXT_LABEL);
  const headerBaseline = startY + (headerH / 2) + 1.2;
  pdf.text("Ödeme Detayları", x + w / 2, headerBaseline, { align: "center" });

  // Başlık alt çizgi
  drawLine(pdf, x, startY + headerH, x + w, startY + headerH, BORDER, 0.35);

  // =========================================================
  // DİKEY ÇİZGİLER (Sizin istediğiniz eklemeler)
  // =========================================================

  // 1. Sol Dikey Çizgi (Etiket ve Değer arası)
  // Başlığın bittiği yerden (startY + headerH) tablonun bittiği yere kadar çiziyoruz.
  drawLine(
    pdf,
    col1_ValueX - 3, // Değerden 3mm önce (çizgi konumu)
    startY + headerH,
    col1_ValueX - 3,
    startY + headerH + rowH * 2, // En alta kadar iner (IBAN satırı dahil)
    BORDER_SOFT,
    0.3
  );

  // 2. Sağ Dikey Çizgi (Banka ve Yapı Kredi arası)
  // Sadece 1. satır boyunca (Banka satırı) çiziyoruz, IBAN satırına inmiyor.
  drawLine(
    pdf,
    col2_ValueX - 3, // Değerden 3mm önce
    startY + headerH,
    col2_ValueX - 3,
    startY + headerH + rowH, // Sadece 1. satırın sonuna kadar
    BORDER_SOFT,
    0.3
  );

  // 3. Orta Dikey Çizgi (Sol blok ile Sağ blok arası)
  // Zaten vardı, sadece koordinatını netleştirdik.
  drawLine(
    pdf,
    col2_StartX,
    startY + headerH,
    col2_StartX,
    startY + headerH + rowH, // Sadece 1. satır boyunca
    BORDER_SOFT,
    0.3
  );

  // =========================================================
  // METİNLER
  // =========================================================

  // ----- Satır 1 (Unvan & Banka) -----
  const r1Top = startY + headerH;
  const r1Baseline = r1Top + (rowH / 2) + 1.0;

  // Sol: Unvan
  setText(pdf, "Unvan", col1_LabelX, r1Baseline, 7, true, TEXT_LABEL);
  setText(pdf, safeString(pf.pay_title), col1_ValueX, r1Baseline, 7.5, false, TEXT_DARK);

  // Sağ: Banka
  setText(pdf, "Banka", col2_LabelX, r1Baseline, 7, true, TEXT_LABEL);
  setText(pdf, "Yapı Kredi", col2_ValueX, r1Baseline, 7.5, false, TEXT_DARK);

  // Satır 1 alt yatay çizgi
  drawLine(
    pdf,
    x,
    r1Top + rowH,
    x + w,
    r1Top + rowH,
    BORDER_SOFT,
    0.3
  );

  // ----- Satır 2 (IBAN) -----
  const r2Top = r1Top + rowH;
  const r2Baseline = r2Top + (rowH / 2) + 1.0;

  setText(pdf, "IBAN", col1_LabelX, r2Baseline, 7, true, TEXT_LABEL);
  setText(pdf, safeString(pf.iban), col1_ValueX, r2Baseline, 7.5, false, TEXT_DARK);

  return startY + headerH + rowH * 2 + 8;
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