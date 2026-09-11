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

// Ürün satırı ve görsel boyutu — 100x100'lük önizleme PDF'te bu ölçüde
// (12x12mm, 16mm'lik kolonun içinde 2mm boşluk payıyla) basılıyor.
// Ürün satırı ve görsel boyutu — 100x100'lük önizleme PDF'te bu ölçüde
// basılıyor. Önceki 16/12mm boyutları tabloyu gereksiz büyütüyordu,
// küçültüldü.
const PRODUCT_ROW_HEIGHT = 12;
const PRODUCT_IMAGE_SIZE = 8;
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
// FONT DOSYASI DOĞRULAMA
// =========================================================
//
// Bozuk/boş/yanlış bir TTF dosyası VFS'e sessizce yazıldığında jsPDF
// glyph tablosunu düzgün gömemeyip metnin yerine dolu kutucuklar
// ("tofu box") basar. Bu kontrol, sorunu sessizce üretime yansıtmak
// yerine açık bir hata olarak baştan yakalar.
// =========================================================

function assertValidTtf(buffer: ArrayBuffer, label: string) {
  if (buffer.byteLength < 1000) {
    throw new Error(
      `${label} dosyası çok küçük (${buffer.byteLength} byte) — muhtemelen bozuk veya yanlış dosya kopyalanmış.`
    );
  }

  const view = new DataView(buffer);
  const magic = view.getUint32(0, false);

  // Geçerli TrueType/OpenType imzaları: 0x00010000 (TTF), 'true', 'OTTO' (OTF), 'ttcf' (koleksiyon)
  const validMagics = [0x00010000, 0x74727565, 0x4f54544f, 0x74746366];

  if (!validMagics.includes(magic)) {
    throw new Error(
      `${label} geçerli bir TTF/OTF dosyası değil (magic: 0x${magic.toString(16)}) — dosya muhtemelen bir HTML/hata sayfası ya da bozuk kopya.`
    );
  }
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

  assertValidTtf(regularBuffer, "Inter-Regular.ttf");
  assertValidTtf(boldBuffer, "Inter-Bold.ttf");

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
// HEADER
// =========================================================

function drawHeader(pdf: jsPDF, pf: Proforma): number {
  const x = MARGIN_LEFT;
  const y = MARGIN_TOP;

  setText(pdf, "PROFORMA", x, y + 10, 26, true);

  drawRightText(
    pdf,
    `Tarih: ${pf.created_date
      ? new Date(pf.created_date)
        .toLocaleString("tr-TR")
        .replace(",", "")
      : ""
    }`,
    PAGE_WIDTH - MARGIN_RIGHT,
    y + 5,
    8.2,
    true
  );

  drawRightText(
    pdf,
    `Geçerlilik: ${pf.validity_date
      ? new Date(pf.validity_date)
        .toLocaleString("tr-TR")
        .replace(",", "")
      : ""
    }`,
    PAGE_WIDTH - MARGIN_RIGHT,
    y + 10,
    8.2,
    true
  );

  drawLine(
    pdf,
    x,
    y + 15,
    PAGE_WIDTH - MARGIN_RIGHT,
    y + 15,
    ORANGE,
    1.1
  );

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
// TEKLİF VERİLEN FİRMA (alıcı + muhattap) + SATICI BİLGİLERİ
// =========================================================

function drawBuyerAndSeller(pdf: jsPDF, pf: Proforma, session: Session, startY: number): number {
  const gap = 5;
  const boxWidth = (CONTENT_WIDTH - gap) / 2;
  const leftX = MARGIN_LEFT;
  const rightX = MARGIN_LEFT + boxWidth + gap;
  const titleHeight = 8;
  const labelColWidth = 26;

  // Alıcı (firma) + muhattap (kişi) bilgileri tek kartta — Muhattap
  // ayrı bir kart olarak kaldırılmıştı ama bu alanlar hâlâ editörde
  // dolduruluyor, o yüzden burada satır olarak geri eklendi.
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

  // NOT: Satıcı (kendi firma) bilgilerinin proformaya değil, hesabın
  // kendisine ait olduğunu varsayarak session'dan okuyoruz — çünkü
  // downloadProformaPdf zaten bir Session parametresi alıyordu ama hiç
  // kullanılmıyordu, ve AccountSettings ekranı tam olarak bu alanları
  // güncelleyip session'a yazıyor. Session tipinizde bu alanlar farklı
  // adlandırıldıysa (ör. seller_email değil sadece email, ya da
  // center_address değil merkez_adres gibi) burayı ona göre güncelleyin.
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

  // Sol kart — Teklif Verilen Firma (alıcı + muhattap)
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
  // Toplam: 12+7+18+38+19+16+17+16+21+22 = 186mm (CONTENT_WIDTH)
  return [
    { key: "image", title: "Görsel", width: 12, align: "center" },
    { key: "no", title: "No", width: 7, align: "center" },
    { key: "kod", title: "Kod", width: 18, align: "left" },
    { key: "isim", title: "İsim", width: 38, align: "left" },
    { key: "gtip", title: "GTİP", width: 19, align: "center" },
    { key: "koliSayisi", title: "Koli\nSayısı", width: 16, align: "center" },
    { key: "koliIciAdet", title: "Koli İçi\nAdet", width: 17, align: "center" },
    { key: "totalAdet", title: "Total\nAdet", width: 16, align: "center" },
    { key: "birim", title: "Birim ₺", width: 21, align: "right" },
    { key: "total", title: "Total ₺", width: 22, align: "right" },
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
// ÜRÜN GÖRSELİNİ BAS — resim yoksa/okunamıyorsa yer tutucu kare çizer
// =========================================================

function addProductImage(pdf: jsPDF, image: string | undefined, x: number, y: number, size: number) {
  if (!image) {
    pdf.setFillColor(...TABLE_HEADER_BG);
    pdf.setDrawColor(...DIVIDER);
    pdf.setLineWidth(0.25);
    pdf.roundedRect(x, y, size, size, 1, 1, "FD");
    return;
  }

  try {
    const format = image.includes("image/jpeg") || image.includes("image/jpg") ? "JPEG" : "PNG";
    pdf.addImage(image, format, x, y, size, size);
  } catch {
    pdf.setFillColor(...TABLE_HEADER_BG);
    pdf.setDrawColor(...DIVIDER);
    pdf.setLineWidth(0.25);
    pdf.roundedRect(x, y, size, size, 1, 1, "FD");
  }
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
  const headerHeight = 10;
  const tableWidth = CONTENT_WIDTH;

  pdf.setFillColor(...TABLE_HEADER_BG);
  pdf.rect(x, y, tableWidth, headerHeight, "F");

  pdf.setFont(FONT, "bold");
  pdf.setFontSize(6.2);
  pdf.setTextColor(...TEXT_SECONDARY);

  let currentX = x;

  for (const column of columns) {
    const lines = column.title.split("\n");
    const lineHeight = 3.2;
    const startLineY =
      y + headerHeight / 2 - ((lines.length - 1) * lineHeight) / 2 + 1.6;

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
// =========================================================
// ÜRÜN SATIRI — artık görsel kolonunu da basıyor
// =========================================================

function drawProductRow(
  pdf: jsPDF,
  row: Proforma["products"][number],
  index: number,
  x: number,
  y: number,
  columns: ProductColumn[],
  alternate: boolean,
  rowHeight: number
): number {
  const tableWidth = CONTENT_WIDTH;

  if (alternate) {
    pdf.setFillColor(...ROW_ALT_BG);
    pdf.rect(x, y, tableWidth, rowHeight, "F");
  }

  let currentX = x;

  for (const column of columns) {
    if (column.key === "image") {
      const size = PRODUCT_IMAGE_SIZE;
      const imgX = currentX + (column.width - size) / 2;
      const imgY = y + (rowHeight - size) / 2;
      addProductImage(pdf, row.image, imgX, imgY, size);
      currentX += column.width;
      continue;
    }

    const value = getProductValue(row, index, column.key);

    pdf.setFont(FONT, column.key === "total" ? "bold" : "normal");
    pdf.setFontSize(6.5);
    pdf.setTextColor(...INK);

    const lines = splitText(pdf, value, column.width - 4);
    const visibleLines = lines.slice(0, 2);
    const lineHeight = 3.4;

    const startYText =
      y + rowHeight / 2 - ((visibleLines.length - 1) * lineHeight) / 2 + 1.6;

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
// =========================================================
// ÜRÜN TABLOSU — gerçek listeyi basıyor, sayfa taşarsa otomatik
// yeni sayfaya devam ediyor ("Ürünler (devam)")
// =========================================================

function drawProductTable(pdf: jsPDF, pf: Proforma, startY: number): number {
  const columns = getProductColumns();
  const tableWidth = CONTENT_WIDTH;
  const titleHeight = 8;
  const rowHeight = PRODUCT_ROW_HEIGHT;
  const products = pf.products || [];

  let chunkStartY = startY + 2;
  let currentY = chunkStartY + titleHeight;
  let headerHeight = drawProductTableHeader(pdf, MARGIN_LEFT, currentY, columns);
  currentY += headerHeight;

  let isFirstChunk = true;
  let index = 0;

  while (index < products.length) {
    // Sayfanın sonuna yaklaşıldıysa: mevcut sayfadaki bölümü kartla
    // kapat, yeni sayfa aç, kolon başlığını tekrar çiz ve devam et.
    if (currentY + rowHeight > PAGE_HEIGHT - MARGIN_BOTTOM - 15) {
      const chunkHeight = currentY - chunkStartY;
      drawCard(pdf, MARGIN_LEFT, chunkStartY, tableWidth, chunkHeight, {
        header: { title: "Ürünler", height: titleHeight },
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

    drawProductRow(pdf, products[index], index, MARGIN_LEFT, currentY, columns, index % 2 === 1, rowHeight);
    currentY += rowHeight;
    index += 1;
  }

  // Son (veya tek) bölümü kartla kapat — ürün hiç yoksa da başlık +
  // kolon başlığından oluşan boş tablo yine kart içinde görünür.
  const chunkHeight = currentY - chunkStartY;
  drawCard(pdf, MARGIN_LEFT, chunkStartY, tableWidth, chunkHeight, {
    header: { title: "Ürünler", height: titleHeight },
    elevated: false,
    fill: false,
  });

  return currentY + 6;
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
// ÖDEME BİLGİLERİ (3/4) + TOPLAMLAR (1/4)
// =========================================================

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

  // SOL KART: ÖDEME BİLGİLERİ — gerçek pf alanları
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

  // SAĞ KART: TOPLAMLAR
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

// =========================================================
// FOOTER
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

async function createProformaPdf(pf: Proforma, session: Session): Promise<jsPDF> {
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
    author: safeString(session.firm),
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

  y = drawBuyerAndSeller(pdf, pf, session, y);

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
  const pdf = await createProformaPdf(pf, session);

  const blob = pdf.output("blob");

  console.log(`PDF boyutu: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);

  pdf.save(`Proforma-${safeString(pf.id)}.pdf`);
}

// =========================================================
// SHARE
// =========================================================

export async function shareProformaPdf(pf: Proforma, session: Session): Promise<void> {
  const pdf = await createProformaPdf(pf, session);

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