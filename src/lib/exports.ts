import jsPDF from "jspdf";
import type {
  Proforma,
  ProductProforma,
  Session,
  Product,
} from "../types";
import { calcTotals, tl } from "./helpers";
import { baseApi } from "./storage";

// =========================================================
// SABİTLER & RENKLER  – referans görsele birebir
// =========================================================

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;

const MARGIN_LEFT = 14;
const MARGIN_RIGHT = 14;
const MARGIN_TOP = 14;
const MARGIN_BOTTOM = 14;

const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

const FONT = "Inter";

// Referans renkleri (turuncu yok)
const INK: [number, number, number] = [33, 33, 33];
const TEXT_SECONDARY: [number, number, number] = [120, 120, 120];
const TEXT_MUTED: [number, number, number] = [160, 160, 160];

const LOGO_PINK: [number, number, number] = [240, 154, 154]; // referanstaki soft pembe
const SURFACE: [number, number, number] = [255, 255, 255];
const TABLE_HEADER_BG: [number, number, number] = [248, 248, 248];
const ROW_ALT_BG: [number, number, number] = [252, 252, 252];
const DIVIDER: [number, number, number] = [228, 228, 228];
const CARD_BORDER: [number, number, number] = [220, 220, 220];
const BOX_BG: [number, number, number] = [255, 255, 255];

const CARD_RADIUS = 5;
const PRODUCT_ROW_HEIGHT = 10.5;
const PRODUCT_IMAGE_SIZE = 7;

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

const DEFAULT_COMPANY_LOGO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABd1NDZEAAAABGdBTUEAALGPC/xhBQAAADhlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAAqACAAQAAAABAAAAoKADAAQAAAABAAAAoAAAAAC118/4AAAIkUlEQVR4Ae1da1Qb1xl2R5Lgh3Ecx/m4SZw2Ttpme9p023/S3a/t5Kdpf6RpmqZNmrS3p/3R/pGm/dE2bdM0/SftJ333333333333333333/084pS1iAnm4u4s54R/S8A3fmfu/3zpy5I63WsXDh/S0g0AICAi0gINACAi0gINACAi0gINACAi0gINACAi0gI=";

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
  const baseUrl = baseApi.replace(/\/+$/, "");
  await Promise.all(
    products.map(async (row) => {
      const productId = Number(row.product_id);
      if (!Number.isFinite(productId)) return;
      void baseUrl;
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

// =========================================================
// HEADER – soft pembe kare + isim sol, PROFORM sağ
// =========================================================

function drawHeader(
  pdf: jsPDF,
  pf: Proforma,
  session: Session,
  _logoBase64: string
): number {
  const x = MARGIN_LEFT;
  const y = MARGIN_TOP;

  // Soft pembe kare (referanstaki gibi, logo resmi yok)
  const logoSize = 12;
  pdf.setFillColor(...LOGO_PINK);
  pdf.roundedRect(x, y, logoSize, logoSize, 2.5, 2.5, "F");

  // Firma adı
  const firmName = safeString(session.firm) || "ASEL Aydınlatma";
  setText(pdf, firmName, x + logoSize + 4, y + 5.8, 13.5, true, INK);

  // Alt başlık
  setText(
    pdf,
    "GRUP PRİZ • GOLYAT • AYDINLATMA",
    x + logoSize + 4,
    y + 11,
    6.2,
    false,
    TEXT_SECONDARY
  );

  // Sağ taraf
  const rightX = PAGE_WIDTH - MARGIN_RIGHT;
  drawRightText(pdf, "PROFORM", rightX, y + 5.8, 15, true, INK);
  drawRightText(pdf, "Fiyat Teklifi by Oto Proforma", rightX, y + 11, 6.2, false, TEXT_SECONDARY);

  return y + 20;
}

// =========================================================
// FİRMA + TEKLİF BİLGİLERİ (kartsız, iki kolon)
// =========================================================

function drawCompanyAndOfferInfo(
  pdf: jsPDF,
  pf: Proforma,
  session: Session,
  startY: number
): number {
  const leftX = MARGIN_LEFT;
  const rightX = PAGE_WIDTH / 2 + 6;
  let y = startY;

  const leftRows: [string, string][] = [
    ["Unvan", safeString(session.firm)],
    ["Adres", safeString(session.center_address || session.fabric_address)],
    ["Telefon", safeString(session.phone)],
    ["Mail", safeString(session.seller_email)],
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

  const labelW = 16;

  leftRows.forEach(([label, value]) => {
    setText(pdf, label, leftX, y, 7.2, false, TEXT_SECONDARY);
    const lines = splitText(pdf, value, 78);
    setText(pdf, lines[0] || "", leftX + labelW, y, 7.2, false, INK);
    if (lines.length > 1) {
      y += 3.6;
      setText(pdf, lines[1], leftX + labelW, y, 7.2, false, INK);
    }
    y += 4.4;
  });

  let ry = startY;
  rightRows.forEach(([label, value]) => {
    setText(pdf, label, rightX, ry, 7.2, false, TEXT_SECONDARY);
    setText(pdf, value, rightX + 20, ry, 7.2, true, INK);
    ry += 4.4;
  });

  return Math.max(y, ry) + 5;
}

// =========================================================
// ÜRÜN TABLO SÜTUNLARI
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
  switch (key) {
    case "no":
      return String(index + 1).padStart(2, "0");
    case "kod":
      return safeString(row.product_id);
    case "isim":
      return "";
    case "barkod":
      return "";
    case "koliIci":
      return "";
    case "koli":
      return safeString(row.parcel);
    case "totalAdet":
      return safeString(row.parcel);
    case "birim":
      return "";
    case "total":
      return "";
    default:
      return "";
  }
}

function columnTextX(col: ProductColumn, colStartX: number): number {
  if (col.align === "center") return colStartX + col.width / 2;
  if (col.align === "right") return colStartX + col.width - 1.5;
  return colStartX + 1.2;
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
  // Referanstaki soft pembe kare
  pdf.setFillColor(...LOGO_PINK);
  pdf.roundedRect(x, y, size, size, 1.3, 1.3, "F");
}

function drawProductTableHeader(
  pdf: jsPDF,
  x: number,
  y: number,
  columns: ProductColumn[]
): number {
  const headerHeight = 8.5;
  const tableWidth = CONTENT_WIDTH;

  pdf.setFillColor(...TABLE_HEADER_BG);
  pdf.rect(x, y, tableWidth, headerHeight, "F");

  drawLine(pdf, x, y, x + tableWidth, y, DIVIDER, 0.25);

  pdf.setFont(FONT, "bold");
  pdf.setFontSize(5.5);
  pdf.setTextColor(...TEXT_SECONDARY);

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

  drawLine(pdf, x, y + headerHeight, x + tableWidth, y + headerHeight, DIVIDER, 0.3);
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
    pdf.setFillColor(...ROW_ALT_BG);
    pdf.rect(x, y, tableWidth, rowHeight, "F");
  }

  let currentX = x;
  const productId = Number(row.product_id);

  for (const column of columns) {
    if (column.key === "image") {
      const size = PRODUCT_IMAGE_SIZE;
      const imgX = currentX + (column.width - size) / 2;
      const imgY = y + (rowHeight - size) / 2;
      addProductImage(pdf, imageMap.get(productId), imgX, imgY, size);
      currentX += column.width;
      continue;
    }

    const value = getProductValue(row, index, column.key);
    pdf.setFont(FONT, column.key === "total" ? "bold" : "normal");
    pdf.setFontSize(6);
    pdf.setTextColor(...INK);

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

  drawLine(pdf, x, y + rowHeight, x + tableWidth, y + rowHeight, DIVIDER, 0.2);
  return rowHeight;
}

async function drawProductTable(
  pdf: jsPDF,
  pf: Proforma,
  startY: number
): Promise<number> {
  const columns = getProductColumns();
  const tableWidth = CONTENT_WIDTH;
  const rowHeight = PRODUCT_ROW_HEIGHT;

  const products: ProductProforma[] = (pf as any).products || [];
  const imageMap = await preloadProductImages(products);

  let currentY = startY;

  const headerHeight = drawProductTableHeader(pdf, MARGIN_LEFT, currentY, columns);
  currentY += headerHeight;

  let index = 0;
  while (index < products.length) {
    if (currentY + rowHeight > PAGE_HEIGHT - MARGIN_BOTTOM - 58) {
      drawLine(pdf, MARGIN_LEFT, currentY, MARGIN_LEFT + tableWidth, currentY, DIVIDER, 0.3);
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

  drawLine(pdf, MARGIN_LEFT, currentY, MARGIN_LEFT + tableWidth, currentY, DIVIDER, 0.3);
  return currentY + 7;
}

// =========================================================
// ŞARTLAR + TOPLAMLAR (yan yana, yumuşak kenarlı kutular)
// =========================================================

function drawConditionsAndTotals(
  pdf: jsPDF,
  pf: Proforma,
  startY: number
): number {
  const gap = 7;
  const leftW = CONTENT_WIDTH * 0.58;
  const rightW = CONTENT_WIDTH - leftW - gap;
  const leftX = MARGIN_LEFT;
  const rightX = MARGIN_LEFT + leftW + gap;

  const conditions = pf.conditions || [];
  const conditionLines: string[] = [];
  for (const condition of conditions) {
    const lines = splitText(pdf, `• ${condition.name}`, leftW - 10);
    conditionLines.push(...lines);
  }

  const boxH = Math.max(24, 8 + conditionLines.length * 4.5 + 5);

  // Sol kutu – Şartlar
  pdf.setDrawColor(...CARD_BORDER);
  pdf.setLineWidth(0.4);
  pdf.setFillColor(...BOX_BG);
  pdf.roundedRect(leftX, startY, leftW, boxH, CARD_RADIUS, CARD_RADIUS, "FD");

  setText(pdf, "Şartlar ve Koşullar", leftX + 5, startY + 6, 7.5, true, INK);

  let cy = startY + 11;
  pdf.setFont(FONT, "normal");
  pdf.setFontSize(6.8);
  pdf.setTextColor(...INK);
  for (const line of conditionLines) {
    pdf.text(line, leftX + 5, cy);
    cy += 4.5;
  }

  // Sağ kutu – Toplamlar
  pdf.setDrawColor(...CARD_BORDER);
  pdf.setLineWidth(0.4);
  pdf.setFillColor(...BOX_BG);
  pdf.roundedRect(rightX, startY, rightW, boxH, CARD_RADIUS, CARD_RADIUS, "FD");

  const { araTotal, total } = calcTotals(pf);
  const kdvAmount = araTotal * 0.2;

  const rows: [string, string, boolean][] = [
    ["Ara Toplam", tl(araTotal), false],
    ["KDV (%20)", tl(kdvAmount), false],
    ["Toplam", tl(total), true],
  ];

  let ty = startY + 5;
  const rowH = (boxH - 4) / 3;

  rows.forEach(([label, value, isTotal], idx) => {
    setText(
      pdf,
      label,
      rightX + 5,
      ty + rowH / 2 + 1.2,
      isTotal ? 8 : 7,
      true,
      isTotal ? INK : TEXT_SECONDARY
    );
    drawRightText(
      pdf,
      value,
      rightX + rightW - 5,
      ty + rowH / 2 + 1.2,
      isTotal ? 9 : 7.8,
      isTotal,
      INK
    );
    if (idx < rows.length - 1) {
      drawLine(
        pdf,
        rightX + 4,
        ty + rowH,
        rightX + rightW - 4,
        ty + rowH,
        DIVIDER,
        0.25
      );
    }
    ty += rowH;
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
  const headerH = 7;
  const rowH = 8.5;

  // Başlık
  pdf.setFillColor(...TABLE_HEADER_BG);
  pdf.rect(x, startY, w, headerH, "F");
  setText(pdf, "Ödeme Detayları", x + 4, startY + 4.8, 7.5, true, INK);

  // Dış çerçeve
  pdf.setDrawColor(...CARD_BORDER);
  pdf.setLineWidth(0.35);
  pdf.rect(x, startY, w, headerH + rowH * 2, "S");

  // Satır 1
  let ry = startY + headerH;
  drawLine(pdf, x, ry, x + w, ry, DIVIDER, 0.25);

  const col1 = 18;
  setText(pdf, "Unvan", x + 4, ry + 5.5, 6.8, false, TEXT_SECONDARY);
  setText(pdf, safeString(pf.pay_title), x + col1, ry + 5.5, 7, false, INK);

  const midX = x + w * 0.52;
  setText(pdf, "Unvan", midX, ry + 5.5, 6.8, false, TEXT_SECONDARY);
  setText(pdf, safeString(pf.bank), midX + col1, ry + 5.5, 7, false, INK);

  // Satır 2
  ry += rowH;
  drawLine(pdf, x, ry, x + w, ry, DIVIDER, 0.25);
  setText(pdf, "IBAN", x + 4, ry + 5.5, 6.8, false, TEXT_SECONDARY);
  setText(pdf, safeString(pf.iban), x + col1, ry + 5.5, 7, false, INK);

  return startY + headerH + rowH * 2 + 6;
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
      DIVIDER,
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

  if (y + 55 > PAGE_HEIGHT - MARGIN_BOTTOM) {
    pdf.addPage();
    y = MARGIN_TOP;
  }

  y = drawConditionsAndTotals(pdf, pf, y);

  if (y + 28 > PAGE_HEIGHT - MARGIN_BOTTOM) {
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
