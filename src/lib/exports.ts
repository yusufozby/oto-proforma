import jsPDF from "jspdf";
import type { Proforma, Session } from "../types";
import { calcTotals, tl } from "./helpers";
import { baseApi } from "./storage";

// =========================================================
// SABİTLER & RENKLER
// =========================================================
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN_LEFT = 10;
const MARGIN_RIGHT = 10;
const MARGIN_TOP = 10;
const MARGIN_BOTTOM = 10;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

const FONT = "Inter";

// Renk Paleti (RGB)
const INK: [number, number, number] = [20, 20, 20];
const TEXT_SECONDARY: [number, number, number] = [100, 100, 100];
const ORANGE: [number, number, number] = [238, 140, 43];
const ORANGE_DARK: [number, number, number] = [210, 115, 20];
const SURFACE: [number, number, number] = [255, 255, 255];
const CARD_BORDER: [number, number, number] = [225, 225, 225];
const DIVIDER: [number, number, number] = [230, 230, 230];
const SHADOW: [number, number, number] = [240, 240, 240];
const TABLE_HEADER_BG: [number, number, number] = [248, 249, 250];
const ROW_ALT_BG: [number, number, number] = [252, 252, 253];

const CARD_RADIUS = 3;
const PRODUCT_ROW_HEIGHT = 12;
const PRODUCT_IMAGE_SIZE = 8;

// =========================================================
// FONT & ASSET IMPORTLARI
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

// Varsayılan Logo Placeholder (Base64)
const DEFAULT_COMPANY_LOGO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABd1NDZEAAAABGdBTUEAALGPC/xhBQAAADhlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAAqACAAQAAAABAAAAoKADAAQAAAABAAAAoAAAAAC118/4AAAIkUlEQVR4Ae1da1Qb1xl2R5Lgh3Ecx/m4SZw2Ttpme9p023/S3a/t5Kdpf6RpmqZNmrS3p/3R/pGm/dE2bdM0/SftJ333333333333333333/084pS1iAnm4u4s54R/S8A3fmfu/3zpy5I63WsXDh/S0g0AICAi0gINACAi0gINACAi0gINACAi0gINACAi0gI=";

// =========================================================
// GÖRSEL DÖNÜŞTÜRÜCÜ VE SIKIŞTIRICI HELPERS
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

      const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
      resolve(compressedDataUrl);
    };

    img.onerror = (err) => reject(err);

    if (typeof src === "string") {
      img.src = src;
    } else {
      img.src = URL.createObjectURL(src);
    }
  });
}

type ContactIcons = {
  phone: string;
  whatsapp: string;
  maps: string;
};

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

async function preloadProductImages(products: Proforma["products"]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!products || !Array.isArray(products)) return map;

  const baseUrl = baseApi.replace(/\/+$/, "");

  await Promise.all(
    products.map(async (row) => {
      const code = safeString(row.code).trim();
      if (!code) return;

      const url = `${baseUrl}/public/storage/${code}.jpg`;

      try {
        const response = await fetch(url);
        if (!response.ok) return;

        const blob = await response.blob();
        const compressedBase64 = await compressAndResizeImage(blob, 100, 100, 0.6);

        map.set(code, compressedBase64);
      } catch {
        // Görsel yoksa pas geç
      }
    })
  );

  return map;
}

// =========================================================
// FONT YÜKLEME
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
  if (buffer.byteLength < 1000) {
    throw new Error(`${label} dosyası çok küçük.`);
  }
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
// YARDIMCI DİZİM FONKSİYONLARI
// =========================================================

function safeString(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function numberValue(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function setText(
  pdf: jsPDF,
  text: string,
  x: number,
  y: number,
  size = 9,
  bold = false,
  color: readonly [number, number, number] = INK
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
  color: readonly [number, number, number] = INK
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
  color: readonly [number, number, number] = DIVIDER,
  width = 0.3
) {
  pdf.setDrawColor(...color);
  pdf.setLineWidth(width);
  pdf.line(x1, y1, x2, y2);
}

function drawCard(
  pdf: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  opts?: {
    header?: { title: string; height?: number; color?: readonly [number, number, number] };
    elevated?: boolean;
    fill?: boolean;
  }
): number {
  const radius = CARD_RADIUS;
  h = h + 2;

  const shouldFill = opts?.fill !== false;

  if (shouldFill && opts?.elevated !== false) {
    pdf.setFillColor(...SHADOW);
    pdf.roundedRect(x + 0.6, y + 0.8, w, h, radius, radius, "F");
  }

  if (shouldFill) {
    pdf.setFillColor(...SURFACE);
    pdf.roundedRect(x, y, w, h, radius, radius, "F");
  }

  let headerHeight = 0;

  if (opts?.header) {
    headerHeight = opts.header.height ?? 8;
    const headerColor = opts.header.color ?? ORANGE;

    pdf.setFillColor(...headerColor);

    if (h > headerHeight + radius) {
      pdf.roundedRect(x, y, w, headerHeight, radius, radius, "F");
      pdf.rect(x, y + radius, w, headerHeight - radius, "F");
    } else {
      pdf.roundedRect(x, y, w, Math.min(headerHeight, h), radius, radius, "F");
    }

    pdf.setFont(FONT, "bold");
    pdf.setFontSize(8.5);
    pdf.setTextColor(...SURFACE);
    pdf.text(opts.header.title.toUpperCase(), x + 4, y + headerHeight / 2 + 1.8);
  }

  pdf.setDrawColor(...CARD_BORDER);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(x, y, w, h, radius, radius, "S");

  return headerHeight;
}

// =========================================================
// HEADER (PROFORMA + TARİHLER + ŞİRKET LOGOSU)
// =========================================================

function drawHeader(pdf: jsPDF, pf: Proforma, logoBase64: string): number {
  const x = MARGIN_LEFT;
  const y = MARGIN_TOP;

  // 1. Sol Üst: PROFORMA Başlığı
  setText(pdf, "PROFORMA", x, y + 8, 22, true, INK);

  // 2. Alt alta Tarih ve Geçerlilik Tarihi (PROFORMA başlığının altında aynı hizada)
  const dateY = y + 15;

  const createdDateStr = pf.created_date
    ? new Date(pf.created_date).toLocaleString("tr-TR").replace(",", "")
    : "-";

  const validityDateStr = pf.validity_date
    ? new Date(pf.validity_date).toLocaleString("tr-TR").replace(",", "")
    : "-";

  setText(pdf, `Tarih: ${createdDateStr}`, x, dateY, 8.5, true, TEXT_SECONDARY);
  setText(pdf, `Geçerlilik: ${validityDateStr}`, x, dateY + 4.5, 8.5, true, TEXT_SECONDARY);

  // 3. Şirket Logosu (En sağa dayalı - justify-content: space-between)
  const logoWidth = 24;
  const logoHeight = 24;
  const logoX = PAGE_WIDTH - MARGIN_RIGHT - logoWidth;
  const logoY = y;

  if (logoBase64) {
    try {
      pdf.addImage(logoBase64, "JPEG", logoX, logoY, logoWidth, logoHeight);
    } catch {
      // Yüklenemezse pas geç
    }
  }

  // 4. Alt Turuncu Çizgi
  const lineY = y + 26;
  drawLine(pdf, x, lineY, PAGE_WIDTH - MARGIN_RIGHT, lineY, ORANGE, 1.1);

  return lineY + 6;
}

// =========================================================
// İLETİŞİM İKONLARI
// =========================================================

// =========================================================
// İLETİŞİM İKONLARI
// =========================================================

function drawContactIcons(
  pdf: jsPDF,
  icons: ContactIcons,
  session: Session,
  leftX: number,
  centerY: number,
  size: number
) {
  const gap = 3.5;
  const defs = [
    { image: icons.phone, url: session.phone_link ?? "" },
    { image: icons.whatsapp, url: session.website_link ?? "" },
    { image: icons.maps, url: session.google_map_link ?? "" },
  ];

  let currentLeft = leftX;

  for (const def of defs) {
    const left = currentLeft;
    const top = centerY - size / 2;

    if (def.image) {
      try {
        pdf.addImage(def.image, "JPEG", left, top, size, size);
      } catch {
        // İkon çizilemezse
      }
    }

    if (def.url) {
      pdf.link(left, top, size, size, { url: def.url });
    }

    currentLeft += size + gap;
  }
}

// =========================================================
// MÜŞTERİ VEYA SATICI KARTLARI
// =========================================================

function drawBuyerAndSeller(pdf: jsPDF, pf: Proforma, session: Session, startY: number): number {
  const gap = 5;
  const boxWidth = (CONTENT_WIDTH - gap) / 2;
  const leftX = MARGIN_LEFT;
  const rightX = MARGIN_LEFT + boxWidth + gap;
  const titleHeight = 8;
  const labelColWidth = 26;

  const buyerRows = [
    ["FİRMA", safeString(pf.buyer_name)],
    ["ADRES", safeString(pf.address)],
    ["İLÇE / İL", safeString(pf.province)],
    ["TELEFON", safeString(pf.phone)],
    ["E-MAİL", safeString(pf.buyer_email)],
    ["MUHATTAP", safeString(pf.interlocuter_name)],
    ["ÜNVAN", safeString(pf.interlocuter_title)],
    ["M. TELEFON", safeString(pf.interlocuter_phone)],
    ["M. E-MAİL", safeString(pf.interlocuter_email)],
  ];

  const sellerRows = [
    ["FİRMA", safeString(session.firm)],
    ["MERKEZ", safeString(session.center_address)],
    ["FABRİKA", safeString(session.fabric_address)],
    ["TELEFON", safeString(session.phone)],
    ["E-MAİL", safeString(session.seller_email)],
  ];

  function calculateHeight(rows: string[][]) {
    let height = 9;
    for (const [, value] of rows) {
      const lines = splitText(pdf, value, boxWidth - labelColWidth - 8);
      height += Math.max(6, lines.length * 5);
    }
    return titleHeight + height + 3;
  }

  const buyerHeight = calculateHeight(buyerRows);
  const sellerHeight = calculateHeight(sellerRows);
  const boxHeight = Math.max(buyerHeight, sellerHeight);

  // Sol Kart
  drawCard(pdf, leftX, startY, boxWidth, boxHeight, {
    header: { title: "Teklif Verilen Firma", height: titleHeight },
  });

  let y = startY + titleHeight + 6;
  for (const [label, value] of buyerRows) {
    setText(pdf, label, leftX + 4, y, 8, true, TEXT_SECONDARY);
    const lines = splitText(pdf, value, boxWidth - labelColWidth - 8);
    setText(pdf, lines.join("\n"), leftX + labelColWidth, y, 8, false, INK);
    y += Math.max(5.5, lines.length * 5);
  }

  // Sağ Kart
  drawCard(pdf, rightX, startY, boxWidth, boxHeight, {
    header: { title: "Satıcı Bilgileri", height: titleHeight },
  });

  y = startY + titleHeight + 6;
  for (const [label, value] of sellerRows) {
    setText(pdf, label, rightX + 4, y, 8, true, TEXT_SECONDARY);
    const lines = splitText(pdf, value, boxWidth - labelColWidth - 8);
    setText(pdf, lines.join("\n"), rightX + labelColWidth, y, 8, false, INK);
    y += Math.max(5.5, lines.length * 5);
  }

  return startY + boxHeight + 6;
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
  | "gtip"
  | "koliSayisi"
  | "koliIciAdet"
  | "totalAdet"
  | "birim"
  | "total";
  title: string;
  width: number;
  align: "left" | "center" | "right";
};

function getProductColumns(): ProductColumn[] {
  return [
    { key: "image", title: "Görsel", width: 10, align: "center" },
    { key: "no", title: "No", width: 6, align: "center" },
    { key: "kod", title: "Kod", width: 26, align: "left" },
    { key: "isim", title: "İsim", width: 46, align: "left" },
    { key: "gtip", title: "GTİP", width: 22, align: "center" },
    { key: "koliSayisi", title: "Koli\nSayısı", width: 13, align: "center" },
    { key: "koliIciAdet", title: "Koli İçi\nAdet", width: 13, align: "center" },
    { key: "totalAdet", title: "Total\nAdet", width: 13, align: "center" },
    { key: "birim", title: "Birim ₺", width: 18, align: "right" },
    { key: "total", title: "Total ₺", width: 19, align: "right" },
  ];
}

function getProductValue(
  row: Proforma["products"][number],
  index: number,
  key: ProductColumn["key"]
): string {
  const totalAdet = numberValue(row.parcel) * numberValue(row.parcel_inside);
  const totalTutar = totalAdet * numberValue(row.unit);

  switch (key) {
    case "no":
      return String(index + 1);
    case "kod":
      return safeString(row.code);
    case "isim":
      return safeString(row.name);
    case "gtip":
      return safeString(row.gtype);
    case "koliSayisi":
      return safeString(row.parcel);
    case "koliIciAdet":
      return safeString(row.parcel_inside);
    case "totalAdet":
      return String(totalAdet);
    case "birim":
      return tl(numberValue(row.unit));
    case "total":
      return tl(totalTutar);
    default:
      return "";
  }
}

function columnTextX(col: ProductColumn, colStartX: number): number {
  if (col.align === "center") return colStartX + col.width / 2;
  if (col.align === "right") return colStartX + col.width - 2;
  return colStartX + 1.5;
}

function addProductImage(pdf: jsPDF, base64Image: string | undefined, x: number, y: number, size: number) {
  if (base64Image) {
    try {
      pdf.addImage(base64Image, "JPEG", x, y, size, size);
      return;
    } catch {
      // Çizim hatasında fallback kutuya düş
    }
  }

  pdf.setFillColor(...TABLE_HEADER_BG);
  pdf.setDrawColor(...DIVIDER);
  pdf.setLineWidth(0.25);
  pdf.roundedRect(x, y, size, size, 1, 1, "FD");
}

function drawProductTableHeader(
  pdf: jsPDF,
  x: number,
  y: number,
  columns: ProductColumn[]
): number {
  const headerHeight = 10;
  const tableWidth = CONTENT_WIDTH;

  pdf.setFillColor(...TABLE_HEADER_BG);
  pdf.rect(x, y, tableWidth, headerHeight, "F");

  pdf.setFont(FONT, "bold");
  pdf.setFontSize(5.8);
  pdf.setTextColor(...TEXT_SECONDARY);

  let currentX = x;

  for (const column of columns) {
    const lines = column.title.split("\n");
    const lineHeight = 3.0;
    const startLineY =
      y + headerHeight / 2 - ((lines.length - 1) * lineHeight) / 2 + 1.5;

    lines.forEach((line, index) => {
      const textY = startLineY + index * lineHeight;
      const textX = columnTextX(column, currentX);
      const align = column.align === "left" ? "left" : column.align;
      pdf.text(line, textX, textY, { align });
    });

    currentX += column.width;
  }

  drawLine(pdf, x + 1, y + headerHeight, x + tableWidth - 1, y + headerHeight, ORANGE_DARK, 0.5);

  return headerHeight;
}

function drawProductRow(
  pdf: jsPDF,
  row: Proforma["products"][number],
  index: number,
  x: number,
  y: number,
  columns: ProductColumn[],
  alternate: boolean,
  rowHeight: number,
  imageMap: Map<string, string>
): number {
  const tableWidth = CONTENT_WIDTH;

  if (alternate) {
    pdf.setFillColor(...ROW_ALT_BG);
    pdf.rect(x, y, tableWidth, rowHeight, "F");
  }

  let currentX = x;
  const productCode = safeString(row.code).trim();

  for (const column of columns) {
    if (column.key === "image") {
      const size = PRODUCT_IMAGE_SIZE;
      const imgX = currentX + (column.width - size) / 2;
      const imgY = y + (rowHeight - size) / 2;
      addProductImage(pdf, imageMap.get(productCode), imgX, imgY, size);
      currentX += column.width;
      continue;
    }

    const value = getProductValue(row, index, column.key);

    pdf.setFont(FONT, column.key === "total" ? "bold" : "normal");
    pdf.setFontSize(5.8);
    pdf.setTextColor(...INK);

    const lines = splitText(pdf, value, column.width - 2);
    const visibleLines = lines.slice(0, 2);
    const lineHeight = 3.0;

    const startYText =
      y + rowHeight / 2 - ((visibleLines.length - 1) * lineHeight) / 2 + 1.2;

    visibleLines.forEach((line, lineIndex) => {
      const textY = startYText + lineIndex * lineHeight;
      const textX = columnTextX(column, currentX);
      const align = column.align === "left" ? "left" : column.align;
      pdf.text(line, textX, textY, { align });
    });

    currentX += column.width;
  }

  drawLine(pdf, x, y + rowHeight, x + tableWidth, y + rowHeight, DIVIDER, 0.25);

  return rowHeight;
}

async function drawProductTable(pdf: jsPDF, pf: Proforma, startY: number): Promise<number> {
  const columns = getProductColumns();
  const tableWidth = CONTENT_WIDTH;
  const titleHeight = 8;
  const rowHeight = PRODUCT_ROW_HEIGHT;
  const products = pf.products || [];

  const imageMap = await preloadProductImages(products);

  let chunkStartY = startY + 2;
  let currentY = chunkStartY + titleHeight;
  let headerHeight = drawProductTableHeader(pdf, MARGIN_LEFT, currentY, columns);
  currentY += headerHeight;

  let isFirstChunk = true;
  let index = 0;

  while (index < products.length) {
    if (currentY + rowHeight > PAGE_HEIGHT - MARGIN_BOTTOM - 15) {
      const chunkHeight = currentY - chunkStartY;
      drawCard(pdf, MARGIN_LEFT, chunkStartY, tableWidth, chunkHeight, {
        header: { title: isFirstChunk ? "Ürünler" : "Ürünler (devam)", height: titleHeight },
        elevated: false,
        fill: false,
      });

      pdf.addPage();
      isFirstChunk = false;
      chunkStartY = MARGIN_TOP;
      currentY = chunkStartY + titleHeight;
      headerHeight = drawProductTableHeader(pdf, MARGIN_LEFT, currentY, columns);
      currentY += headerHeight;
      continue;
    }

    drawProductRow(pdf, products[index], index, MARGIN_LEFT, currentY, columns, index % 2 === 1, rowHeight, imageMap);
    currentY += rowHeight;
    index += 1;
  }

  const chunkHeight = currentY - chunkStartY;
  drawCard(pdf, MARGIN_LEFT, chunkStartY, tableWidth, chunkHeight, {
    header: { title: isFirstChunk ? "Ürünler" : "Ürünler (devam)", height: titleHeight },
    elevated: false,
    fill: false,
  });

  return currentY + 6;
}

// =========================================================
// ŞARTLAR VE ÖDEME BİLGİLERİ
// =========================================================

function drawConditions(pdf: jsPDF, pf: Proforma, startY: number): number {
  const width = CONTENT_WIDTH;
  const titleHeight = 8;
  const conditions = pf.conditions || [];
  const conditionLines: string[] = [];

  for (const condition of conditions) {
    const lines = splitText(pdf, `• ${condition.name}`, width - 8);
    conditionLines.push(...lines);
  }

  const conditionsHeight = Math.max(24, titleHeight + 6 + conditionLines.length * 5.5 + 4);

  drawCard(pdf, MARGIN_LEFT, startY, width, conditionsHeight, {
    header: { title: "Şartlar ve Koşullar", height: titleHeight },
  });

  let conditionY = startY + titleHeight + 6;

  pdf.setFont(FONT, "normal");
  pdf.setFontSize(8.3);
  pdf.setTextColor(...INK);

  for (const line of conditionLines) {
    pdf.text(line, MARGIN_LEFT + 4, conditionY);
    conditionY += 5.5;
  }

  return startY + conditionsHeight + 6;
}

function drawPaymentAndTotals(pdf: jsPDF, pf: Proforma, startY: number): number {
  const { araTotal, total } = calcTotals(pf);
  const effectiveIskonto = pf.discount !== 0 ? pf.discount || 0 : 0;

  const gap = 5;
  const paymentWidth = (CONTENT_WIDTH - gap) * 0.75;
  const totalsWidth = (CONTENT_WIDTH - gap) * 0.25;

  const paymentX = MARGIN_LEFT;
  const totalsX = MARGIN_LEFT + paymentWidth + gap;

  const titleHeight = 8;
  const rowHeight = 10.5;
  const labelColWidth = 26;

  const cardHeight = titleHeight + rowHeight * 3 + 4;

  drawCard(pdf, paymentX, startY, paymentWidth, cardHeight, {
    header: { title: "Ödeme Bilgileri", height: titleHeight },
  });

  const paymentRows: [string, string][] = [
    ["UNVAN", safeString(pf.pay_title)],
    ["BANKA", safeString(pf.bank)],
    ["IBAN", safeString(pf.iban)],
  ];

  let rowY = startY + titleHeight + 7;

  paymentRows.forEach(([label, value], index) => {
    setText(pdf, label, paymentX + 4, rowY, 7.6, true, TEXT_SECONDARY);
    setText(pdf, value, paymentX + labelColWidth, rowY, 8.4, false, INK);

    if (index < paymentRows.length - 1) {
      drawLine(
        pdf,
        paymentX + 4,
        rowY + rowHeight / 2 - 1,
        paymentX + paymentWidth - 4,
        rowY + rowHeight / 2 - 1,
        DIVIDER,
        0.25
      );
    }

    rowY += rowHeight;
  });

  drawCard(pdf, totalsX, startY, totalsWidth, cardHeight, { elevated: true });

  const rows = [
    ["Ara Total", tl(araTotal)],
    ["İskonto", `%${effectiveIskonto}`],
    ["Total", tl(total)],
  ] as const;

  let totalY = startY + 6;
  const totalRowHeight = (cardHeight - 10) / 3;

  rows.forEach(([label, value], index) => {
    const isTotal = label === "Total";
    const pillX = totalsX + 4;
    const pillWidth = totalsWidth - 8;

    setText(
      pdf,
      label.toUpperCase(),
      pillX,
      totalY + totalRowHeight / 2 + 1,
      isTotal ? 7.8 : 7.3,
      true,
      isTotal ? INK : TEXT_SECONDARY
    );

    drawRightText(
      pdf,
      value,
      pillX + pillWidth,
      totalY + totalRowHeight / 2 + 1,
      isTotal ? 9 : 8.6,
      isTotal,
      INK
    );

    if (index < rows.length - 1) {
      drawLine(
        pdf,
        pillX,
        totalY + totalRowHeight,
        pillX + pillWidth,
        totalY + totalRowHeight,
        DIVIDER,
        0.25
      );
    }

    totalY += totalRowHeight;
  });

  return startY + cardHeight + 8;
}

function drawFooter(pdf: jsPDF, pf: Proforma) {
  const pageCount = pdf.getNumberOfPages();

  for (let page = 1; page <= pageCount; page++) {
    pdf.setPage(page);

    const y = PAGE_HEIGHT - 7;

    drawLine(pdf, MARGIN_LEFT, y - 4, PAGE_WIDTH - MARGIN_RIGHT, y - 4, DIVIDER, 0.3);

    pdf.setFont(FONT, "normal");
    pdf.setFontSize(6);
    pdf.setTextColor(...TEXT_SECONDARY);

    pdf.text(
      "Teklifimizi bilginize sunar, iş birliğimizin verimli ve uzun soluklu olmasını temenni ederiz.",
      PAGE_WIDTH / 2,
      y,
      { align: "center" }
    );

    pdf.text(
      `Proforma ${safeString(pf.id)}  •  Sayfa ${page} / ${pageCount}`,
      PAGE_WIDTH / 2,
      y + 3.5,
      { align: "center" }
    );
  }
}

// =========================================================
// MÜŞTERİ DIŞA AKTARMA FONKSİYONLARI
// =========================================================

async function createProformaPdf(pf: Proforma, session: Session): Promise<jsPDF> {
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  await registerFonts(pdf);

  const [icons, logoBase64] = await Promise.all([
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

  let y = drawHeader(pdf, pf, logoBase64);

  const contactIconSize = 8;
  const contactIconAreaHeight = contactIconSize + 6;

  drawContactIcons(
    pdf,
    icons,
    session,
    MARGIN_LEFT,
    y + contactIconSize / 2,
    contactIconSize
  );

  y += contactIconAreaHeight;

  y = drawBuyerAndSeller(pdf, pf, session, y);

  y = await drawProductTable(pdf, pf, y);

  if (y + 35 > PAGE_HEIGHT - MARGIN_BOTTOM) {
    pdf.addPage();
    y = MARGIN_TOP;
  }

  y = drawConditions(pdf, pf, y);

  if (y + 40 > PAGE_HEIGHT - MARGIN_BOTTOM) {
    pdf.addPage();
    y = MARGIN_TOP;
  }

  drawPaymentAndTotals(pdf, pf, y);

  drawFooter(pdf, pf);

  return pdf;
}

export async function downloadProformaPdf(pf: Proforma, session: Session): Promise<void> {
  const pdf = await createProformaPdf(pf, session);
  pdf.save(`Proforma-${safeString(pf.id)}.pdf`);
}

export async function shareProformaPdf(pf: Proforma, session: Session): Promise<void> {
  const pdf = await createProformaPdf(pf, session);
  const blob = pdf.output("blob");

  const file = new File([blob], `${safeString(pf.code)}.pdf`, {
    type: "application/pdf",
  });

  if (!navigator.share || !navigator.canShare?.({ files: [file] })) {
    throw new Error("Bu cihaz PDF dosyası paylaşmayı desteklemiyor.");
  }

  await navigator.share({
    title: `${safeString(pf.code)}`,
    text: "Proforma PDF",
    files: [file],
  });
}