import jsPDF from "jspdf";
import type { Proforma, Session } from "../types";
import { calcTotals, tl } from "./helpers";

// =========================================================
// FONT
// =========================================================

// @ts-ignore
import InterRegularUrl from "../assets/fonts/Inter-Regular.ttf?url";

// @ts-ignore
import InterBoldUrl from "../assets/fonts/Inter-Bold.ttf?url";

// =========================================================
// İLETİŞİM İKONLARI
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

const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT; // 186mm

// =========================================================
// MATERIAL RENK PALETİ
// =========================================================

const ORANGE = [240, 152, 46] as const;
const ORANGE_DARK = [214, 124, 22] as const;
const INK = [33, 33, 33] as const;
const TEXT_SECONDARY = [110, 110, 110] as const;
const DIVIDER = [224, 224, 224] as const;
const CARD_BORDER = [214, 214, 214] as const;
const SURFACE = [255, 255, 255] as const;
const TABLE_HEADER_BG = [246, 246, 246] as const;
const ROW_ALT_BG = [250, 250, 250] as const;
const SHADOW = [232, 232, 232] as const;

const CARD_RADIUS = 2.4;

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
// FONTLARI PDF'E EKLE (Inter)
// =========================================================

async function registerFonts(pdf: jsPDF): Promise<void> {
  const [regularResponse, boldResponse] = await Promise.all([
    fetch(InterRegularUrl),
    fetch(InterBoldUrl),
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

  pdf.addFileToVFS("Inter-Regular.ttf", regularBase64);
  pdf.addFont("Inter-Regular.ttf", "Inter", "normal");

  pdf.addFileToVFS("Inter-Bold.ttf", boldBase64);
  pdf.addFont("Inter-Bold.ttf", "Inter", "bold");
}

const FONT = "Inter";

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
// TEXT HELPERS
// =========================================================

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

function drawCenterText(
  pdf: jsPDF,
  text: string,
  centerX: number,
  y: number,
  size = 9,
  bold = false,
  color: readonly [number, number, number] = INK
) {
  pdf.setFont(FONT, bold ? "bold" : "normal");
  pdf.setFontSize(size);
  pdf.setTextColor(...color);
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
  }
): number {
  const radius = CARD_RADIUS;
  h = h + 2;
  // 1. Gölge (Gölgenin de dışarı turunculuk sıçratmaması için kartın arkasında tutulur)
  if (opts?.elevated !== false) {
    pdf.setFillColor(...SHADOW);
    pdf.roundedRect(x + 0.6, y + 0.8, w, h, radius, radius, "F");
  }

  // 2. Beyaz Kart Arka Planı (Tam rounded)
  pdf.setFillColor(...SURFACE);
  pdf.roundedRect(x, y, w, h, radius, radius, "F");

  let headerHeight = 0;

  if (opts?.header) {
    headerHeight = opts.header.height ?? 8;
    const headerColor = opts.header.color ?? ORANGE;

    pdf.setFillColor(...headerColor);

    // Header yüksekliği kart yüksekliğinden küçükse sadece üst taraf turuncu olsun
    if (h > headerHeight + radius) {
      // Üstü yuvarlatılmış header
      pdf.roundedRect(x, y, w, headerHeight, radius, radius, "F");
      // Üst header'ın altındaki yuvarlatmayı kapat, düz yap (sol-sağ alt köşelere taşmayacak şekilde)
      pdf.rect(x, y + radius, w, headerHeight - radius, "F");
    } else {
      // Eğer kart çok kısa ise turuncu tüm kartı kaplamasın, sadece üst kısmı kaplasın
      pdf.roundedRect(x, y, w, Math.min(headerHeight, h), radius, radius, "F");
    }

    pdf.setFont(FONT, "bold");
    pdf.setFontSize(8.5);
    pdf.setTextColor(...SURFACE);
    pdf.text(opts.header.title.toUpperCase(), x + 4, y + headerHeight / 2 + 1.8);
  }

  // 3. Dış Çerçeve (En üste basılır)
  pdf.setDrawColor(...CARD_BORDER);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(x, y, w, h, radius, radius, "S");

  return headerHeight;
}

// =========================================================
// HEADER
// =========================================================

function drawHeader(pdf: jsPDF, pf: Proforma): number {
  const x = MARGIN_LEFT;
  const y = MARGIN_TOP;

  setText(pdf, "PROFORMA", x, y + 10, 26, true);

  drawRightText(
    pdf,
    `Tarih: ${safeString(pf.created_date)}`,
    PAGE_WIDTH - MARGIN_RIGHT,
    y + 5,
    8.2,
    true
  );

  drawRightText(
    pdf,
    `Geçerlilik: ${safeString(pf.validity_date)}`,
    PAGE_WIDTH - MARGIN_RIGHT,
    y + 10,
    8.2,
    true
  );

  drawLine(pdf, x, y + 15, PAGE_WIDTH - MARGIN_RIGHT, y + 15, ORANGE, 1.1);

  return y + 21;
}

// =========================================================
// İLETİŞİM İKONLARI
// =========================================================

function drawContactIcons(
  pdf: jsPDF,
  icons: ContactIcons,
  pf: Proforma,
  leftX: number,
  centerY: number,
  size: number
) {
  const gap = 3.5;

  type IconDef = {
    image: string;
    url: string;
  };

  const defs: IconDef[] = [
    { image: icons.phone, url: pf.phone_link ?? "" },
    { image: icons.whatsapp, url: pf.website_link ?? "" },
    { image: icons.maps, url: pf.google_map_link ?? "" },
  ];

  let currentLeft = leftX;

  for (const def of defs) {
    const left = currentLeft;
    const top = centerY - size / 2;

    try {
      pdf.addImage(def.image, "PNG", left, top, size, size);
    } catch {
      // İkon dosyası bulunamazsa/işlenemezse sessizce geç
    }

    pdf.link(left, top, size, size, { url: def.url });

    currentLeft += size + gap;
  }
}

// =========================================================
// TEKLİF VERİLEN FİRMA + SATICI BİLGİLERİ
// =========================================================

function drawBuyerAndSeller(pdf: jsPDF, pf: Proforma, startY: number): number {
  const gap = 5;
  const boxWidth = (CONTENT_WIDTH - gap) / 2;
  const leftX = MARGIN_LEFT;
  const rightX = MARGIN_LEFT + boxWidth + gap;
  const titleHeight = 8;
  const labelColWidth = 26;

  const buyerRows = [
    ["FİRMA", ""],
    ["ADRES", "sample-adres"],
    ["İLÇE / İL", "sample-ilce"],
    ["TELEFON", "sample-telefon"],
    ["E-MAİL", "sample-email"],
  ];

  const sellerRows = [
    ["FİRMA", "sample-firm"],
    ["MERKEZ", "sample-merkez"],
    ["FABRİKA", "sample-fabrika"],
    ["TELEFON", "sample-telefon"],
    ["E-MAİL", "sample-email"],
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

  // Sol kart — Teklif Verilen Firma (alıcı)
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

  // Sağ kart — Satıcı Bilgileri
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
  // Toplam: 8 + 19 + 41 + 20 + 16 + 18 + 16 + 21 + 27 = 186mm (CONTENT_WIDTH)
  return [
    { key: "no", title: "No", width: 8, align: "center" },
    { key: "kod", title: "Kod", width: 19, align: "left" },
    { key: "isim", title: "İsim", width: 41, align: "left" },
    { key: "gtip", title: "GTİP", width: 20, align: "center" },
    { key: "koliSayisi", title: "Koli\nSayısı", width: 16, align: "center" },
    { key: "koliIciAdet", title: "Koli İçi\nAdet", width: 18, align: "center" },
    { key: "totalAdet", title: "Total\nAdet", width: 16, align: "center" },
    { key: "birim", title: "Birim ₺", width: 21, align: "right" },
    { key: "total", title: "Total ₺", width: 27, align: "right" },
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
  if (col.align === "right") return colStartX + col.width - 3;
  return colStartX + 3;
}

// =========================================================
// TABLO KOLON BAŞLIK SATIRI
// =========================================================

function drawProductTableHeader(
  pdf: jsPDF,
  x: number,
  y: number,
  columns: ProductColumn[]
): number {
  const headerHeight = 12;
  const tableWidth = CONTENT_WIDTH;

  pdf.setFillColor(...TABLE_HEADER_BG);
  pdf.rect(x, y, tableWidth, headerHeight, "F");

  pdf.setFont(FONT, "bold");
  pdf.setFontSize(7.3);
  pdf.setTextColor(...TEXT_SECONDARY);

  let currentX = x;

  for (const column of columns) {
    const lines = column.title.split("\n");
    const lineHeight = 4;
    const startLineY =
      y + headerHeight / 2 - ((lines.length - 1) * lineHeight) / 2 + 2;

    lines.forEach((line, index) => {
      const textY = startLineY + index * lineHeight;
      const textX = columnTextX(column, currentX);
      const align = column.align === "left" ? "left" : column.align;
      pdf.text(line, textX, textY, { align });
    });

    currentX += column.width;
  }

  // Taşmayı önlemek için çizgiye x + 1 ile x + tableWidth - 1 marjı verildi
  drawLine(pdf, x + 1, y + headerHeight, x + tableWidth - 1, y + headerHeight, ORANGE_DARK, 0.5);

  return headerHeight;
}

// =========================================================
// ÜRÜN SATIRI
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
  const rowHeight = 11.5;
  const tableWidth = CONTENT_WIDTH;

  if (alternate) {
    pdf.setFillColor(...ROW_ALT_BG);
    pdf.rect(x, y, tableWidth, rowHeight, "F");
  }

  let currentX = x;

  for (const column of columns) {
    const value = getProductValue(row, index, column.key);

    pdf.setFont(FONT, column.key === "total" ? "bold" : "normal");
    pdf.setFontSize(7.8);
    pdf.setTextColor(...INK);

    const lines = splitText(pdf, value, column.width - 5);
    const visibleLines = lines.slice(0, 2);
    const lineHeight = 4.2;

    const startY =
      y + rowHeight / 2 - ((visibleLines.length - 1) * lineHeight) / 2 + 2;

    visibleLines.forEach((line, lineIndex) => {
      const textY = startY + lineIndex * lineHeight;
      const textX = columnTextX(column, currentX);
      const align = column.align === "left" ? "left" : column.align;
      pdf.text(line, textX, textY, { align });
    });

    currentX += column.width;
  }

  drawLine(pdf, x, y + rowHeight, x + tableWidth, y + rowHeight, DIVIDER, 0.25);

  return rowHeight;
}

// =========================================================
// ÜRÜN TABLOSU (Full Width)
// =========================================================

function drawProductTable(pdf: jsPDF, pf: Proforma, startY: number): number {
  const columns = getProductColumns();
  const tableWidth = CONTENT_WIDTH; // Sayfaya tam oturt
  const titleHeight = 8;

  const cardStartY = startY + 2;
  let currentY = cardStartY + titleHeight;

  const headerHeight = drawProductTableHeader(pdf, MARGIN_LEFT, currentY, columns);
  currentY += headerHeight;

  pf.products = []; // Gerekirse ürün döngünüzü buraya açabilirsiniz.

  const cardHeight = currentY - cardStartY;

  drawCard(pdf, MARGIN_LEFT, cardStartY, tableWidth, cardHeight, {
    header: { title: "Ürünler", height: titleHeight },
    elevated: true,
  });

  return cardStartY + cardHeight + 6;
}

// =========================================================
// ŞARTLAR VE KOŞULLAR
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

// =========================================================
// ÖDEME BİLGİLERİ (3/4) + TOPLAMLAR (1/4) (YAN YANA)
// =========================================================

function drawPaymentAndTotals(pdf: jsPDF, pf: Proforma, startY: number): number {
  const { araTotal, total } = calcTotals(pf);
  const effectiveIskonto = pf.discount !== 0 ? pf.discount || 0 : 0;

  const gap = 5;

  // 4/3 ödeme bilgileri (%75), 4/1 toplamlar (%25)
  const paymentWidth = (CONTENT_WIDTH - gap) * 0.75;
  const totalsWidth = (CONTENT_WIDTH - gap) * 0.25;

  const paymentX = MARGIN_LEFT;
  const totalsX = MARGIN_LEFT + paymentWidth + gap;

  const titleHeight = 8;
  const rowHeight = 10.5;
  const labelColWidth = 26;

  // Ortak kart yüksekliği
  const cardHeight = titleHeight + rowHeight * 3 + 4;

  // ---------------------------------------------------------
  // 1. SOL KART: ÖDEME BİLGİLERİ (3/4)
  // ---------------------------------------------------------
  drawCard(pdf, paymentX, startY, paymentWidth, cardHeight, {
    header: { title: "Ödeme Bilgileri", height: titleHeight },
  });

  const paymentRows: [string, string][] = [
    ["UNVAN", "sample-payment-unvan"],
    ["BANKA", "sample-payment-banka"],
    ["IBAN", "sample-payment-iban"],
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

  // ---------------------------------------------------------
  // 2. SAĞ KART: TOPLAMLAR (1/4)
  // ---------------------------------------------------------
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

    // Etiket ve değer yazdır (Turuncu BG tamamen kaldırıldı, Siyah text kullanılıyor)
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

// =========================================================
// FOOTER — her sayfanın altında sabit dipnot
// =========================================================

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

  await registerFonts(pdf);

  const icons = await registerIcons();

  pdf.setProperties({
    title: `Proforma-${safeString(pf.id)}`,
    subject: "Proforma",
    author: "sample",
    creator: "Oto Proforma",
    keywords: "proforma, teklif, fatura",
  });

  let y = drawHeader(pdf, pf);

  const contactIconSize = 8;
  const contactIconAreaHeight = contactIconSize + 6;

  drawContactIcons(
    pdf,
    icons,
    pf,
    MARGIN_LEFT,
    y + contactIconSize / 2,
    contactIconSize
  );

  y += contactIconAreaHeight;

  y = drawBuyerAndSeller(pdf, pf, y);

  y = drawProductTable(pdf, pf, y);

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

// =========================================================
// DOWNLOAD
// =========================================================

export async function downloadProformaPdf(pf: Proforma, session: Session): Promise<void> {
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