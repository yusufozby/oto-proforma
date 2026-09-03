import jsPDF from "jspdf";
import type { Proforma } from "../types";
import { calcTotals, tl } from "./helpers";

// =========================================================
// FONT
// =========================================================
//
// src/assets/fonts/
//   Poppins-Regular.ttf
//   Poppins-Bold.ttf
//
// Eğer pdf.ts dosyan src/utils içerisindeyse bu import yolu doğrudur.
// =========================================================

// @ts-ignore
import PoppinsRegularUrl from "../assets/fonts/Poppins-Regular.ttf?url";

// @ts-ignore
import PoppinsBoldUrl from "../assets/fonts/Poppins-Bold.ttf?url";

// =========================================================
// İLETİŞİM İKONLARI
// =========================================================
//
// src/assets/icons/
//   phone.png
//   whatsapp.png
//   maps.png
//
// Bunlar marka logolarının kendisi (tam renkli, kare tuvale
// ortalanmış PNG'ler) — beyaz zeminli daire üzerine basılır.
// =========================================================

// @ts-ignore
import PhoneIconUrl from "../assets/icons/phone.png?url";

// @ts-ignore
import WhatsappIconUrl from "../assets/icons/whatsapp.png?url";

// @ts-ignore
import MapsIconUrl from "../assets/icons/maps.png?url";

// =========================================================
// SAYFA AYARLARI
// =========================================================

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;

const MARGIN_LEFT = 12;
const MARGIN_RIGHT = 12;
const MARGIN_TOP = 12;
const MARGIN_BOTTOM = 12;

const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

// =========================================================
// RENKLER
// =========================================================

const ORANGE = [240, 152, 46] as const;
const DARK = [30, 30, 30] as const;
const BORDER = [205, 205, 205] as const;
const LIGHT_BG = [248, 248, 248] as const;
const WHITE = [255, 255, 255] as const;
const GRAY_TEXT = [95, 95, 95] as const;

// =========================================================
// GENEL HELPERS
// =========================================================

function safeString(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

function numberValue(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// =========================================================
// ARRAY BUFFER -> BASE64
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

// =========================================================
// FONTLARI PDF'E EKLE
// =========================================================

async function registerFonts(pdf: jsPDF): Promise<void> {
  const [regularResponse, boldResponse] = await Promise.all([
    fetch(PoppinsRegularUrl),
    fetch(PoppinsBoldUrl),
  ]);

  if (!regularResponse.ok || !boldResponse.ok) {
    throw new Error("PDF fontları yüklenemedi.");
  }

  const [regularBuffer, boldBuffer] = await Promise.all([
    regularResponse.arrayBuffer(),
    boldResponse.arrayBuffer(),
  ]);

  const regularBase64 = arrayBufferToBase64(regularBuffer);
  const boldBase64 = arrayBufferToBase64(boldBuffer);

  pdf.addFileToVFS("Poppins-Regular.ttf", regularBase64);
  pdf.addFont("Poppins-Regular.ttf", "Poppins", "normal");

  pdf.addFileToVFS("Poppins-Bold.ttf", boldBase64);
  pdf.addFont("Poppins-Bold.ttf", "Poppins", "bold");
}

// =========================================================
// İKONLARI YÜKLE (base64)
// =========================================================

async function loadIconAsBase64(url: string): Promise<string> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`İkon yüklenemedi: ${url}`);
  }

  const buffer = await response.arrayBuffer();

  return arrayBufferToBase64(buffer);
}

type ContactIcons = {
  phone: string;
  whatsapp: string;
  maps: string;
};

async function registerIcons(): Promise<ContactIcons> {
  const [phone, whatsapp, maps] = await Promise.all([
    loadIconAsBase64(PhoneIconUrl),
    loadIconAsBase64(WhatsappIconUrl),
    loadIconAsBase64(MapsIconUrl),
  ]);

  return { phone, whatsapp, maps };
}

// =========================================================
// İLETİŞİM LİNKLERİ
// =========================================================

function buildTelUrl(phone: string): string {
  const cleaned = safeString(phone).replace(/[^\d+]/g, "");
  return `tel:${cleaned}`;
}

function buildWhatsappUrl(phone: string): string {
  let digits = safeString(phone).replace(/\D/g, "");

  // Türkiye numaraları için: başında 0 varsa ülke koduyla (90) değiştir
  if (digits.startsWith("0")) {
    digits = `90${digits.slice(1)}`;
  } else if (!digits.startsWith("90") && digits.length === 10) {
    digits = `90${digits}`;
  }

  return `https://wa.me/${digits}`;
}

function buildMapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    safeString(address)
  )}`;
}

// =========================================================
// TEXT HELPERS (yazı boyutları büyütüldü)
// =========================================================

function setText(
  pdf: jsPDF,
  text: string,
  x: number,
  y: number,
  size = 9, // 8 -> 9
  bold = false
) {
  pdf.setFont("Poppins", bold ? "bold" : "normal");
  pdf.setFontSize(size);
  pdf.setTextColor(...DARK);
  pdf.text(safeString(text), x, y);
}

function drawRightText(
  pdf: jsPDF,
  text: string,
  rightX: number,
  y: number,
  size = 9, // 8 -> 9
  bold = false
) {
  pdf.setFont("Poppins", bold ? "bold" : "normal");
  pdf.setFontSize(size);
  pdf.setTextColor(...DARK);
  pdf.text(safeString(text), rightX, y, { align: "right" });
}

function drawCenterText(
  pdf: jsPDF,
  text: string,
  centerX: number,
  y: number,
  size = 9, // 8 -> 9
  bold = false
) {
  pdf.setFont("Poppins", bold ? "bold" : "normal");
  pdf.setFontSize(size);
  pdf.setTextColor(...DARK);
  pdf.text(safeString(text), centerX, y, { align: "center" });
}

function splitText(pdf: jsPDF, text: string, maxWidth: number): string[] {
  return pdf.splitTextToSize(safeString(text), maxWidth) as string[];
}

// =========================================================
// ÇİZİM HELPERS
// =========================================================

function drawLine(
  pdf: jsPDF,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color = BORDER,
  width = 0.3
) {
  pdf.setDrawColor(...color);
  pdf.setLineWidth(width);
  pdf.line(x1, y1, x2, y2);
}

function drawRect(
  pdf: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  fillColor?: readonly [number, number, number],
  borderColor?: readonly [number, number, number]
) {
  if (fillColor) {
    pdf.setFillColor(...fillColor);
  }

  pdf.setDrawColor(...(borderColor || BORDER));
  pdf.setLineWidth(0.3);

  let style: "F" | "S" | "FD" = "S";

  if (fillColor && borderColor) {
    style = "FD";
  } else if (fillColor) {
    style = "F";
  }

  pdf.rect(x, y, width, height, style);
}

function drawRoundedRect(
  pdf: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  radius = 1.5,
  fillColor?: readonly [number, number, number],
  borderColor?: readonly [number, number, number]
) {
  if (fillColor) {
    pdf.setFillColor(...fillColor);
  }

  pdf.setDrawColor(...(borderColor || BORDER));
  pdf.setLineWidth(0.3);

  let style: "F" | "S" | "FD" = "S";

  if (fillColor && borderColor) {
    style = "FD";
  } else if (fillColor) {
    style = "F";
  }

  pdf.roundedRect(x, y, width, height, radius, radius, style);
}

// =========================================================
// SECTION TITLE (yükseklik ve font büyütüldü)
// =========================================================

function drawSectionTitle(
  pdf: jsPDF,
  title: string,
  x: number,
  y: number,
  width: number,
  height = 8 // 7 -> 8
) {
  pdf.setFillColor(...ORANGE);
  pdf.rect(x, y, width, height, "F");

  pdf.setFont("Poppins", "bold");
  pdf.setFontSize(8.5); // 7.5 -> 8.5
  pdf.setTextColor(...WHITE);

  pdf.text(title.toUpperCase(), x + 4, y + height / 2 + 1.8);
}

// =========================================================
// HEADER
// =========================================================

function drawHeader(pdf: jsPDF, pf: Proforma): number {
  const x = MARGIN_LEFT;
  const y = MARGIN_TOP;

  // Başlık
  setText(pdf, "PROFORMA", x, y + 10, 26, true); // 25 -> 26

  // Sağ üst bilgiler
  drawRightText(
    pdf,
    `Tarih: ${safeString(pf.tarih)}`,
    PAGE_WIDTH - MARGIN_RIGHT,
    y + 5,
    8.2, // 7.5 -> 8.2
    true
  );

  drawRightText(
    pdf,
    `Geçerlilik: ${safeString(pf.gecerlilik)}`,
    PAGE_WIDTH - MARGIN_RIGHT,
    y + 10,
    8.2, // 7.5 -> 8.2
    true
  );

  // Turuncu çizgi
  drawLine(pdf, x, y + 15, PAGE_WIDTH - MARGIN_RIGHT, y + 15, ORANGE, 1.1);

  return y + 21;
}

// =========================================================
// İLETİŞİM İKONLARI (tıklanabilir)
// =========================================================

// =========================================================
// İLETİŞİM İKONLARI (tıklanabilir, çerçevesiz)
// =========================================================

function drawContactIcons(
  pdf: jsPDF,
  icons: ContactIcons,
  pf: Proforma,
  leftX: number,
  centerY: number,
  size: number
) {
  const gap = 3.5; // ikonlar arası boşluk

  type IconDef = {
    image: string;
    url: string;
  };

  // Soldan sağa: Telefon, WhatsApp, Google Maps
  // Not: pf.seller.telefon / pf.seller.merkez neyse ona göre link üretilir —
  // yani veri neyse (hangi telefon/adres olursa olsun) otomatik çalışır.
  const defs: IconDef[] = [
    {
      image: icons.phone,
      url: "sample-phone",
    },
    {
      image: icons.whatsapp,
      url: "sample-whatsapp",
    },
    {
      image: icons.maps,
      url: "sample-maps",
    },
  ];

  // Soldan sağa yerleştir (Telefon en solda, Maps en sağda)
  let currentLeft = leftX;

  for (const def of defs) {
    const left = currentLeft;
    const top = centerY - size / 2;

    // Çerçevesiz / zeminsiz — logo doğrudan basılır
    try {
      pdf.addImage(def.image, "PNG", left, top, size, size);
    } catch {
      // İkon dosyası bulunamazsa/işlenemezse sessizce geç,
      // tıklanabilir alan yine de çalışır.
    }

    // Tıklanabilir alan (görselin tamamını kaplayan kare)
    pdf.link(left, top, size, size, { url: def.url });

    currentLeft += size + gap;
  }
}

// =========================================================
// SATICI BİLGİLERİ
// =========================================================

function drawSeller(pdf: jsPDF, pf: Proforma, startY: number): number {
  const x = MARGIN_LEFT;

  const rows = [
    ["FİRMA", "sample-firm"],
    ["MERKEZ", "sample-merkez"],
    ["FABRİKA", "sample-fabrika"],
    ["TELEFON", "sample-telefon"],
    ["E-MAİL", "sample-email"],
  ];

  let currentY = startY;

  for (const [label, value] of rows) {
    setText(pdf, label, x, currentY, 9, true); // 8.2 -> 9
    setText(pdf, value, x + 27, currentY, 9); // 8.2 -> 9
    currentY += 5.3; // 5 -> 5.3 (biraz daha nefes payı)
  }

  return currentY + 5;
}

// =========================================================
// ALICI + MUHATTAP
// =========================================================

function drawBuyerAndContact(pdf: jsPDF, pf: Proforma, startY: number): number {
  const gap = 5;
  const boxWidth = (CONTENT_WIDTH - gap) / 2;
  const leftX = MARGIN_LEFT;
  const rightX = MARGIN_LEFT + boxWidth + gap;
  const titleHeight = 8; // 7 -> 8

  const buyerRows = [
    ["FİRMA", "sample-firm"],
    ["ADRES", "sample-adres"],
    ["İLÇE / İL", "sample-ilce"],
    ["TELEFON", "sample-telefon"],
    ["E-MAİL", "sample-email"],
  ];

  const contactRows = [
    ["İSİM", "sample-name"],
    ["ÜNVAN", "sample-title"],
    ["TELEFON", "sample-contact-phone"],
    ["E-MAİL", "sample-contact-email"],
  ];

  function calculateHeight(rows: string[][]) {
    let height = 9;

    for (const [, value] of rows) {
      const lines = splitText(pdf, value, boxWidth - 36);
      height += Math.max(6, lines.length * 5); // 5.5/4.5 -> 6/5
    }

    return titleHeight + height + 3;
  }

  const buyerHeight = calculateHeight(buyerRows);
  const contactHeight = calculateHeight(contactRows);
  const boxHeight = Math.max(buyerHeight, contactHeight);

  // =======================================================
  // SOL KUTU
  // =======================================================

  drawRoundedRect(pdf, leftX, startY, boxWidth, boxHeight, 1.5, WHITE, BORDER);
  drawSectionTitle(pdf, "Teklif Verilen Firma", leftX, startY, boxWidth, titleHeight);

  let y = startY + 14; // 13 -> 14

  for (const [label, value] of buyerRows) {
    setText(pdf, label, leftX + 4, y, 8, true); // 7.3 -> 8
    const lines = splitText(pdf, value, boxWidth - 36);
    setText(pdf, lines.join("\n"), leftX + 30, y, 8); // 7.3 -> 8
    y += Math.max(5.5, lines.length * 5); // 5/4.5 -> 5.5/5
  }

  // =======================================================
  // SAĞ KUTU
  // =======================================================

  drawRoundedRect(pdf, rightX, startY, boxWidth, boxHeight, 1.5, WHITE, BORDER);
  drawSectionTitle(pdf, "Muhattap", rightX, startY, boxWidth, titleHeight);

  y = startY + 14; // 13 -> 14

  for (const [label, value] of contactRows) {
    setText(pdf, label, rightX + 4, y, 8, true); // 7.3 -> 8
    const lines = splitText(pdf, value, boxWidth - 36);
    setText(pdf, lines.join("\n"), rightX + 30, y, 8); // 7.3 -> 8
    y += Math.max(5.5, lines.length * 5); // 5/4.5 -> 5.5/5
  }

  return startY + boxHeight + 6;
}

// =========================================================
// ÜRÜN KOLONLARI
// =========================================================

type ProductColumn = {
  key:
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
    { key: "no", title: "No", width: 8, align: "center" },
    { key: "kod", title: "Kod", width: 20, align: "left" },
    { key: "isim", title: "İsim", width: 43, align: "left" },
    { key: "gtip", title: "GTİP", width: 21, align: "center" },
    { key: "koliSayisi", title: "Koli\nSayısı", width: 17, align: "center" },
    { key: "koliIciAdet", title: "Koli İçi\nAdet", width: 19, align: "center" },
    { key: "totalAdet", title: "Total\nAdet", width: 17, align: "center" },
    { key: "birim", title: "Birim ₺", width: 22, align: "right" },
    { key: "total", title: "Total ₺", width: 25, align: "right" },
  ];
}

// =========================================================
// ÜRÜN DEĞERİ
// =========================================================

function getProductValue(
  row: Proforma["products"][number],
  index: number,
  key: ProductColumn["key"]
): string {
  const totalAdet = numberValue(row.koliSayisi) * numberValue(row.koliIciAdet);
  const totalTutar = totalAdet * numberValue(row.birim);

  switch (key) {
    case "no":
      return String(index + 1);
    case "kod":
      return safeString(row.kod);
    case "isim":
      return safeString(row.isim);
    case "gtip":
      return safeString(row.gtip);
    case "koliSayisi":
      return safeString(row.koliSayisi);
    case "koliIciAdet":
      return safeString(row.koliIciAdet);
    case "totalAdet":
      return String(totalAdet);
    case "birim":
      return tl(numberValue(row.birim));
    case "total":
      return tl(totalTutar);
    default:
      return "";
  }
}

// =========================================================
// ÜRÜN TABLOSU HEADER (yükseklik ve font büyütüldü)
// =========================================================

function drawProductTableHeader(
  pdf: jsPDF,
  x: number,
  y: number,
  columns: ProductColumn[]
): number {
  const headerHeight = 13; // 11 -> 13

  let currentX = x;

  for (const column of columns) {
    pdf.setFillColor(...ORANGE);
    pdf.setDrawColor(...ORANGE);
    pdf.rect(currentX, y, column.width, headerHeight, "FD");

    pdf.setFont("Poppins", "bold");
    pdf.setFontSize(7.3); // 6.1 -> 7.3
    pdf.setTextColor(...WHITE);

    const lines = column.title.split("\n");
    const lineHeight = 4; // 3.5 -> 4

    const startLineY =
      y + headerHeight / 2 - ((lines.length - 1) * lineHeight) / 2 + 2;

    lines.forEach((line, index) => {
      const textY = startLineY + index * lineHeight;

      if (column.align === "center") {
        pdf.text(line, currentX + column.width / 2, textY, { align: "center" });
      } else if (column.align === "right") {
        pdf.text(line, currentX + column.width - 2, textY, { align: "right" });
      } else {
        pdf.text(line, currentX + 2, textY);
      }
    });

    currentX += column.width;
  }

  return headerHeight;
}

// =========================================================
// ÜRÜN SATIRI (yükseklik ve font büyütüldü)
// =========================================================

function drawProductRow(
  pdf: jsPDF,
  row: Proforma["products"][number],
  index: number,
  x: number,
  y: number,
  columns: ProductColumn[],
  alternate: boolean
): number {
  const rowHeight = 11.5; // 10 -> 11.5

  let currentX = x;

  for (const column of columns) {
    if (alternate) {
      pdf.setFillColor(...LIGHT_BG);
      pdf.rect(currentX, y, column.width, rowHeight, "F");
    }

    pdf.setDrawColor(...BORDER);
    pdf.setLineWidth(0.25);
    pdf.rect(currentX, y, column.width, rowHeight, "S");

    const value = getProductValue(row, index, column.key);

    pdf.setFont("Poppins", column.key === "total" ? "bold" : "normal");
    pdf.setFontSize(7.8); // 6.5 -> 7.8
    pdf.setTextColor(...DARK);

    const lines = splitText(pdf, value, column.width - 4);
    const visibleLines = lines.slice(0, 2);
    const lineHeight = 4.2; // 3.6 -> 4.2

    const startY =
      y + rowHeight / 2 - ((visibleLines.length - 1) * lineHeight) / 2 + 2;

    visibleLines.forEach((line, lineIndex) => {
      const textY = startY + lineIndex * lineHeight;

      if (column.align === "center") {
        pdf.text(line, currentX + column.width / 2, textY, { align: "center" });
      } else if (column.align === "right") {
        pdf.text(line, currentX + column.width - 2, textY, { align: "right" });
      } else {
        pdf.text(line, currentX + 2, textY);
      }
    });

    currentX += column.width;
  }

  return rowHeight;
}

// =========================================================
// ÜRÜN TABLOSU (başlık ile tablo arasına boşluk + dış çerçeve eklendi)
// =========================================================

function drawProductTable(pdf: jsPDF, pf: Proforma, startY: number): number {
  const columns = getProductColumns();

  const tableWidth = columns.reduce((sum, column) => sum + column.width, 0);

  // Bir önceki bloktan biraz nefes payı
  const tableStartY = startY + 2;
  let currentY = tableStartY;

  // Ürün başlığı
  drawSectionTitle(pdf, "Ürünler", MARGIN_LEFT, currentY, tableWidth, 8);
  currentY += 8;

  // Tablo header
  const headerHeight = drawProductTableHeader(pdf, MARGIN_LEFT, currentY, columns);
  currentY += headerHeight;
pf.products = [];
  // pf.products.forEach((row, index) => {
  //   const rowHeight = 11.5;

  //   // Sayfanın sonuna yaklaşıldıysa
  //   if (currentY + rowHeight > PAGE_HEIGHT - MARGIN_BOTTOM - 15) {
  //     pdf.addPage();
  //     currentY = MARGIN_TOP;

  //     // Yeni sayfa başlığı
  //     setText(pdf, "PROFORMA", MARGIN_LEFT, currentY + 7, 13, true); // 12 -> 13

  //     drawRightText(
  //       pdf,
  //       `Proforma ${safeString(pf.id)}`,
  //       PAGE_WIDTH - MARGIN_RIGHT,
  //       currentY + 7,
  //       7.2, // 6.5 -> 7.2
  //       true
  //     );

  //     currentY += 12;

  //     drawLine(pdf, MARGIN_LEFT, currentY, PAGE_WIDTH - MARGIN_RIGHT, currentY, ORANGE, 0.8);

  //     currentY += 5;

  //     drawSectionTitle(pdf, "Ürünler - Devam", MARGIN_LEFT, currentY, tableWidth, 8);
  //     currentY += 8;

  //     const h = drawProductTableHeader(pdf, MARGIN_LEFT, currentY, columns);
  //     currentY += h;
  //   }

  //   drawProductRow(pdf, row, index, MARGIN_LEFT, currentY, columns, index % 2 === 1);

  //   currentY += rowHeight;
  // });

  // Tüm tabloyu (başlık + header + satırlar) çevreleyen ince dış çerçeve
  drawRect(
    pdf,
    MARGIN_LEFT,
    tableStartY,
    tableWidth,
    currentY - tableStartY,
    undefined,
    DARK
  );

  return currentY + 6;
}

// =========================================================
// ŞARTLAR + TOPLAMLAR
// =========================================================

function drawConditionsAndTotals(pdf: jsPDF, pf: Proforma, startY: number): number {
  const { araTotal, total } = calcTotals(pf);

  const effectiveIskonto = pf.iskontoEtkin ? pf.iskonto || 0 : 0;

  const gap = 5;
  const totalsWidth = 55;
  const conditionsWidth = CONTENT_WIDTH - totalsWidth - gap;
  const conditionsX = MARGIN_LEFT;
  const totalsX = MARGIN_LEFT + conditionsWidth + gap;
  const titleHeight = 8; // 7 -> 8

  // =======================================================
  // ŞARTLAR
  // =======================================================

  const conditions = pf.conditions || [];
  const conditionLines: string[] = [];

  for (const condition of conditions) {
    const lines = splitText(pdf, `• ${condition}`, conditionsWidth - 8);
    conditionLines.push(...lines);
  }

  const conditionsHeight = Math.max(32, 14 + conditionLines.length * 5.5); // 30/13/5 -> 32/14/5.5

  drawRoundedRect(pdf, conditionsX, startY, conditionsWidth, conditionsHeight, 1.5, WHITE, BORDER);
  drawSectionTitle(pdf, "Şartlar ve Koşullar", conditionsX, startY, conditionsWidth, titleHeight);

  let conditionY = startY + 14; // 13 -> 14

  pdf.setFont("Poppins", "normal");
  pdf.setFontSize(8.3); // 7.5 -> 8.3
  pdf.setTextColor(...DARK);

  for (const line of conditionLines) {
    pdf.text(line, conditionsX + 4, conditionY);
    conditionY += 5.5; // 5 -> 5.5
  }

  // =======================================================
  // TOPLAMLAR
  // =======================================================

  const rows = [
    ["Ara Total", tl(araTotal)],
    ["İskonto", `%${effectiveIskonto}`],
    ["Total", tl(total)],
  ];

  let totalY = startY;

  rows.forEach(([label, value], index) => {
    const height = index === 2 ? 14 : 11; // 13/10 -> 14/11

    // Label
    pdf.setFillColor(...ORANGE);
    pdf.rect(totalsX, totalY, 26, height, "F");

    pdf.setDrawColor(...DARK);
    pdf.rect(totalsX, totalY, 26, height, "S");

    pdf.setFont("Poppins", "bold");
    pdf.setFontSize(index === 2 ? 7.8 : 7); // 7/6.2 -> 7.8/7

    pdf.setTextColor(...WHITE);

    pdf.text(label.toUpperCase(), totalsX + 2.5, totalY + height / 2 + 2);

    // Value
    pdf.setFillColor(...WHITE);
    pdf.rect(totalsX + 26, totalY, totalsWidth - 26, height, "F");

    pdf.setDrawColor(...DARK);
    pdf.rect(totalsX + 26, totalY, totalsWidth - 26, height, "S");

    drawRightText(
      pdf,
      value,
      totalsX + totalsWidth - 3,
      totalY + height / 2 + 2,
      index === 2 ? 10 : 8, // 9/7 -> 10/8
      index === 2
    );

    totalY += height;
  });

  return startY + Math.max(conditionsHeight, 36) + 6; // 33 -> 36
}

// =========================================================
// ÖDEME BİLGİLERİ
// =========================================================

function drawPayment(pdf: jsPDF, pf: Proforma, startY: number): number {
  const x = MARGIN_LEFT;
  const width = CONTENT_WIDTH;
  const titleHeight = 8; // 7 -> 8
  const rowHeight = 11; // 10 -> 11
  const totalHeight = titleHeight + rowHeight * 2;

  drawRoundedRect(pdf, x, startY, width, totalHeight, 1.5, WHITE, BORDER);
  drawSectionTitle(pdf, "Ödeme Bilgileri", x, startY, width, titleHeight);

  const firstRowY = startY + titleHeight;

  // -------------------------------------------------------
  // Kolon genişlikleri
  // -------------------------------------------------------

  const col1 = 25;
  const col2 = 65;
  const col3 = 25;
  const col4 = width - col1 - col2 - col3;

  // -------------------------------------------------------
  // UNVAN
  // -------------------------------------------------------

  drawRect(pdf, x, firstRowY, col1, rowHeight, LIGHT_BG, BORDER);
  setText(pdf, "UNVAN", x + 3, firstRowY + 7, 7.3, true); // 6.5/6.5 -> 7/7.3

  drawRect(pdf, x + col1, firstRowY, col2, rowHeight, WHITE, BORDER);
  setText(pdf,"sample-payment-unvan", x + col1 + 3, firstRowY + 7, 7.8); // 7 -> 7.8

  // -------------------------------------------------------
  // BANKA
  // -------------------------------------------------------

  drawRect(pdf, x + col1 + col2, firstRowY, col3, rowHeight, LIGHT_BG, BORDER);
  setText(pdf, "BANKA", x + col1 + col2 + 3, firstRowY + 7, 7.3, true); // 6.5 -> 7.3

  drawRect(pdf, x + col1 + col2 + col3, firstRowY, col4, rowHeight, WHITE, BORDER);
  setText(
    pdf,
    "sample-payment-banka",
    x + col1 + col2 + col3 + 3,
    firstRowY + 7,
    7.8 // 7 -> 7.8
  );

  // -------------------------------------------------------
  // IBAN
  // -------------------------------------------------------

  const ibanY = firstRowY + rowHeight;

  drawRect(pdf, x, ibanY, col1, rowHeight, LIGHT_BG, BORDER);
  setText(pdf, "IBAN", x + 3, ibanY + 7, 7.3, true); // 6.5 -> 7.3

  drawRect(pdf, x + col1, ibanY, width - col1, rowHeight, WHITE, BORDER);
  setText(pdf, "sample-payment-iban", x + col1 + 3, ibanY + 7, 7.8); // 7 -> 7.8

  return startY + totalHeight + 8;
}

// =========================================================
// FOOTER
// =========================================================

function drawFooter(pdf: jsPDF, pf: Proforma) {
  const pageCount = pdf.getNumberOfPages();

  for (let page = 1; page <= pageCount; page++) {
    pdf.setPage(page);

    const y = PAGE_HEIGHT - 7;

    drawLine(pdf, MARGIN_LEFT, y - 4, PAGE_WIDTH - MARGIN_RIGHT, y - 4, BORDER, 0.3);

    pdf.setFont("Poppins", "normal");
    pdf.setFontSize(6); // 5.5 -> 6
    pdf.setTextColor(...GRAY_TEXT);

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
// PDF OLUŞTUR
// =========================================================

async function createProformaPdf(pf: Proforma): Promise<jsPDF> {
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
    putOnlyUsedFonts: true,
  });

  // Fontları ekle
  await registerFonts(pdf);

  // İletişim ikonlarını yükle (telefon, whatsapp, maps)
  const icons = await registerIcons();

  // PDF metadata
  pdf.setProperties({
    title: `Proforma-${safeString(pf.id)}`,
    subject: "Proforma",
    author: "sample",
    creator: "Oto Proforma",
    keywords: "proforma, teklif, fatura",
  });

  // =======================================================
  // SAYFAYI OLUŞTUR
  // =======================================================

  let y = drawHeader(pdf, pf);

  // İletişim ikonları — FİRMA satırının hemen ÜSTÜNDE, ayrı bir satırda
  const contactIconSize = 8; // mm, ikon boyutu (küçültüldü)
  const contactIconAreaHeight = contactIconSize + 6; // FİRMA satırına daha fazla boşluk

  drawContactIcons(
    pdf,
    icons,
    pf,
    MARGIN_LEFT,
    y + contactIconSize / 2,
    contactIconSize
  );

  y += contactIconAreaHeight;

  y = drawSeller(pdf, pf, y);

  y = drawBuyerAndContact(pdf, pf, y);

  y = drawProductTable(pdf, pf, y);

  // =======================================================
  // ŞARTLAR + TOPLAMLAR
  // =======================================================

  if (y + 50 > PAGE_HEIGHT - MARGIN_BOTTOM) {
    pdf.addPage();
    y = MARGIN_TOP;
  }

  y = drawConditionsAndTotals(pdf, pf, y);

  // =======================================================
  // ÖDEME
  // =======================================================

  if (y + 35 > PAGE_HEIGHT - MARGIN_BOTTOM) {
    pdf.addPage();
    y = MARGIN_TOP;
  }

  drawPayment(pdf, pf, y);

  // =======================================================
  // FOOTER
  // =======================================================

  drawFooter(pdf, pf);

  return pdf;
}

// =========================================================
// DOWNLOAD
// =========================================================

export async function downloadProformaPdf(pf: Proforma): Promise<void> {
  const pdf = await createProformaPdf(pf);

  const blob = pdf.output("blob");

  console.log(`PDF boyutu: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);

  pdf.save(`Proforma-${safeString(pf.id)}.pdf`);
}

// =========================================================
// SHARE
// =========================================================

export async function shareProformaPdf(pf: Proforma): Promise<void> {
  const pdf = await createProformaPdf(pf);

  const blob = pdf.output("blob");

  const file = new File([blob], `Proforma-${safeString(pf.id)}.pdf`, {
    type: "application/pdf",
  });

  if (!navigator.share || !navigator.canShare?.({ files: [file] })) {
    throw new Error("Bu cihaz PDF dosyası paylaşmayı desteklemiyor.");
  }

  await navigator.share({
    title: `Proforma-${safeString(pf.id)}`,
    text: "Proforma PDF",
    files: [file],
  });
}