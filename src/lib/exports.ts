import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import type { Proforma } from "../types";
import { calcTotals, tl } from "./helpers";

function esc(s: string): string {
  return (s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function productRow(n: number, r: Proforma["products"][number]): string {
  const totalAdet = (Number(r.koliSayisi) || 0) * (Number(r.koliIciAdet) || 0);
  const totalTutar = totalAdet * (Number(r.birim) || 0);
  return `
    <tr>
      <td class="c">${n}</td>
      <td class="mono">${esc(r.kod)}</td>
      <td>${esc(r.isim)}</td>
      <td class="mono c">${esc(r.gtip)}</td>
      <td class="c">${r.koliSayisi}</td>
      <td class="c">${r.koliIciAdet}</td>
      <td class="c">${totalAdet}</td>
      <td class="r mono">${tl(r.birim)}</td>
      <td class="r mono strong">${tl(totalTutar)}</td>
    </tr>`;
}

/**
 * Proformanın yüklenen örnek PDF'e çok benzeyen (turuncu başlıklar, aynı alan
 * grupları) görünümünü, ekran dışında bir konteynerde oluşturmak için kullanılan
 * kendi kendine yeten bir HTML parçası (fragment) döndürür. Doküman etiketleri
 * (html/head/body) içermez — doğrudan bir <div> içine enjekte edilmek üzere
 * tasarlanmıştır, böylece html2canvas ile PDF'e dönüştürülebilir.
 */
function buildProformaFragment(pf: Proforma): string {
  const { araTotal, total } = calcTotals(pf);
  const effectiveIskonto = pf.iskontoEtkin ? pf.iskonto || 0 : 0;
  const productRows = pf.products.map((r, i) => productRow(i + 1, r)).join("");
  const conditionItems = pf.conditions.map((c) => `<li>${esc(c)}</li>`).join("");

  return `
<style>
  .pdf-doc, .pdf-doc * { box-sizing: border-box; }
  .pdf-doc { width: 794px; padding: 40px; background: #fff; font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; }
  .pdf-doc .head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
  .pdf-doc .head h1 { font-size: 40px; font-weight: 800; letter-spacing: .5px; margin: 0; }
  .pdf-doc .head .id { text-align: right; font-size: 12px; }
  .pdf-doc .head .id b { display: block; }
  .pdf-doc table.kv { border-collapse: collapse; font-size: 11.5px; margin-bottom: 16px; width: 100%; }
  .pdf-doc table.kv td { padding: 2px 6px 2px 0; vertical-align: top; }
  .pdf-doc table.kv td.k { font-weight: 700; width: 90px; }
  .pdf-doc .section-title { background: #F0982E; color: #fff; font-size: 11px; font-weight: 700; letter-spacing: .04em; padding: 6px 10px; text-transform: uppercase; }
  .pdf-doc .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-bottom: 16px; }
  .pdf-doc .box { border: 1px solid #333; }
  .pdf-doc .box .body { padding: 8px 10px; font-size: 11.5px; }
  .pdf-doc .box .body table { width: 100%; border-collapse: collapse; }
  .pdf-doc .box .body td.k { font-weight: 700; width: 85px; padding: 2px 4px 2px 0; vertical-align: top; }
  .pdf-doc .box .body td.v { padding: 2px 0; }
  .pdf-doc table.products { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 11px; }
  .pdf-doc table.products thead th { background: #F0982E; color: #fff; font-size: 9.5px; text-transform: uppercase; padding: 7px 5px; text-align: left; border: 1px solid #F0982E; }
  .pdf-doc table.products tbody td { padding: 6px 5px; border: 1px solid #ccc; }
  .pdf-doc .c { text-align: center; } .pdf-doc .r { text-align: right; }
  .pdf-doc .mono { font-family: 'Courier New', monospace; }
  .pdf-doc .strong { font-weight: 700; }
  .pdf-doc .bottom { display: flex; justify-content: space-between; gap: 20px; margin-bottom: 20px; }
  .pdf-doc .conditions { border: 1px solid #333; flex: 1; max-width: 62%; }
  .pdf-doc .conditions .body { padding: 8px 10px; font-size: 11px; }
  .pdf-doc .conditions ul { margin: 4px 0 0 16px; padding: 0; }
  .pdf-doc .conditions li { margin-bottom: 4px; }
  .pdf-doc .totals { min-width: 210px; font-size: 12px; }
  .pdf-doc .totals table { width: 100%; border-collapse: collapse; }
  .pdf-doc .totals td { border: 1px solid #333; padding: 6px 8px; }
  .pdf-doc .totals td.lbl { background: #F0982E; color: #fff; font-weight: 700; font-size: 10.5px; text-transform: uppercase; }
  .pdf-doc .totals td.val { text-align: right; font-family: 'Courier New', monospace; }
  .pdf-doc .totals tr.total td { font-size: 14px; font-weight: 800; }
  .pdf-doc .payment { border: 1px solid #333; margin-bottom: 18px; }
  .pdf-doc .payment table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
  .pdf-doc .payment td { border: 1px solid #333; padding: 7px 10px; }
  .pdf-doc .payment td.k { background: #F0982E; color: #fff; font-weight: 700; width: 130px; text-transform: uppercase; font-size: 10.5px; }
  .pdf-doc .footer { text-align: center; font-size: 12px; font-style: italic; font-weight: 700; margin-top: 22px; }
</style>
<div class="pdf-doc">
  <div class="head">
    <h1>PROFORMA</h1>
    <div class="id">
      <b>Tarih: ${esc(pf.tarih)}</b>
      <b>Geçerlilik: ${esc(pf.gecerlilik)}</b>
    </div>
  </div>

  <table class="kv">
    <tr><td class="k">FİRMA</td><td>${esc(pf.seller.firma)}</td></tr>
    <tr><td class="k">MERKEZ</td><td>${esc(pf.seller.merkez)}</td></tr>
    <tr><td class="k">FABRİKA</td><td>${esc(pf.seller.fabrika)}</td></tr>
    <tr><td class="k">TELEFON</td><td>${esc(pf.seller.telefon)}</td></tr>
    <tr><td class="k">E-MAİL</td><td>${esc(pf.seller.email)}</td></tr>
  </table>

  <div class="grid2">
    <div class="box">
      <div class="section-title">Teklif Verilen Firma</div>
      <div class="body">
        <table>
          <tr><td class="k">FİRMA</td><td class="v">${esc(pf.buyer.firma)}</td></tr>
          <tr><td class="k">ADRES</td><td class="v">${esc(pf.buyer.adres)}</td></tr>
          <tr><td class="k">İLÇE / İL</td><td class="v">${esc(pf.buyer.ilce)}</td></tr>
          <tr><td class="k">TELEFON</td><td class="v">${esc(pf.buyer.telefon)}</td></tr>
          <tr><td class="k">E-MAİL</td><td class="v">${esc(pf.buyer.email)}</td></tr>
        </table>
      </div>
    </div>
    <div class="box">
      <div class="section-title">Muhattap</div>
      <div class="body">
        <table>
          <tr><td class="k">İSİM</td><td class="v">${esc(pf.buyer.isim)}</td></tr>
          <tr><td class="k">ÜNVAN</td><td class="v">${esc(pf.buyer.unvan)}</td></tr>
          <tr><td class="k">TELEFON</td><td class="v">${esc(pf.buyer.muhattapTelefon)}</td></tr>
          <tr><td class="k">E-MAİL</td><td class="v">${esc(pf.buyer.muhattapEmail)}</td></tr>
        </table>
      </div>
    </div>
  </div>

  <table class="products">
    <thead>
      <tr>
        <th>No</th><th>Kod</th><th>İsim</th><th>GTİP</th><th>Koli Sayısı</th><th>Koli İçi Adet</th><th>Total Adet</th><th>Birim ₺</th><th>Total ₺</th>
      </tr>
    </thead>
    <tbody>${productRows}</tbody>
  </table>

  <div class="bottom">
    <div class="conditions">
      <div class="section-title">Şartlar ve Koşullar</div>
      <div class="body"><ul>${conditionItems}</ul></div>
    </div>
    <div class="totals">
      <table>
        <tr><td class="lbl">Ara Total</td><td class="val">${tl(araTotal)}</td></tr>
        <tr><td class="lbl">İskonto</td><td class="val">%${effectiveIskonto}</td></tr>
        <tr class="total"><td class="lbl">Total</td><td class="val">${tl(total)}</td></tr>
      </table>
    </div>
  </div>

  <div class="payment">
    <div class="section-title">Ödeme Bilgileri</div>
    <table>
      <tr><td class="k">Unvan</td><td>${esc(pf.payment.unvan)}</td><td class="k">Banka</td><td>${esc(pf.payment.banka)}</td></tr>
      <tr><td class="k">IBAN</td><td colspan="3" class="mono">${esc(pf.payment.iban)}</td></tr>
    </table>
  </div>

  <div class="footer">Teklifimizi bilginize sunar, iş birliğimizin verimli ve uzun soluklu olmasını temenni ederiz.</div>
</div>`;
}

/**
 * Proformayı gerçek bir PDF dosyası olarak doğrudan indirir (yazdırma
 * penceresi açmaz). Görünümü, ekran dışında bir konteynerde oluşturup
 * html2canvas ile görüntüye çevirir, ardından jsPDF ile A4 sayfalarına
 * yerleştirir — içerik bir sayfadan uzunsa otomatik olarak sayfalara böler.
 */
export async function shareProformaPdf(pf: Proforma): Promise<void> {
  const wrapper = document.createElement("div");
  wrapper.style.cssText =
    "position:fixed;left:-9999px;top:0;background:#fff;";
  wrapper.innerHTML = buildProformaFragment(pf);
  document.body.appendChild(wrapper);

  await new Promise((resolve) => setTimeout(resolve, 60));

  try {
    const canvas = await html2canvas(wrapper, {
      scale: 1.5,
      useCORS: true,
      backgroundColor: "#ffffff",
    });

    const MAX_BYTES = 950_000;

    let quality = 0.85;
    let pdf = buildPdfFromCanvas(canvas, pageDims(), quality);
    let sizeBytes = pdf.output("arraybuffer").byteLength;

    let attempts = 0;

    while (sizeBytes > MAX_BYTES && quality > 0.3 && attempts < 6) {
      quality -= 0.12;

      pdf = buildPdfFromCanvas(canvas, pageDims(), quality);
      sizeBytes = pdf.output("arraybuffer").byteLength;

      attempts++;
    }

    // PDF -> Blob
    const blob = pdf.output("blob");

    const file = new File(
      [blob],
      `Proforma-${pf.id}.pdf`,
      {
        type: "application/pdf",
      }
    );

    // Web Share API destekleniyor mu?
    if (!navigator.share || !navigator.canShare?.({ files: [file] })) {
      throw new Error("Bu cihaz PDF dosyası paylaşmayı desteklemiyor.");
    }

    await navigator.share({
      title: `Proforma-${pf.id}`,
      text: "Proforma PDF",
      files: [file],
    });
  } finally {
    document.body.removeChild(wrapper);
  }
}


export async function downloadProformaPdf(pf: Proforma): Promise<void> {
  const wrapper = document.createElement("div");
  wrapper.style.cssText = "position:fixed;left:-9999px;top:0;background:#fff;";
  wrapper.innerHTML = buildProformaFragment(pf);
  document.body.appendChild(wrapper);

  // Yazı tiplerinin / düzenin oturması için bir tık bekle.
  await new Promise((resolve) => setTimeout(resolve, 60));

  try {
    const canvas = await html2canvas(wrapper, {
      scale: 1.5,
      useCORS: true,
      backgroundColor: "#ffffff",
    });

    const MAX_BYTES = 950_000; // 1MB'ın altında güvenli pay
    const pdf = buildPdfFromCanvas(canvas, pageDims(), 0.85);
    let sizeBytes = pdf.output("arraybuffer").byteLength;

    // Görünümü olabildiğince koruyarak JPEG kalitesini kademeli düşürüp
    // dosyayı 1MB sınırının altına indir.
    let finalPdf = pdf;
    let quality = 0.85;
    let attempts = 0;
    while (sizeBytes > MAX_BYTES && quality > 0.3 && attempts < 6) {
      quality -= 0.12;
      finalPdf = buildPdfFromCanvas(canvas, pageDims(), quality);
      sizeBytes = finalPdf.output("arraybuffer").byteLength;
      attempts++;
    }

    finalPdf.save(`Proforma-${pf.id}.pdf`);
  } finally {
    document.body.removeChild(wrapper);
  }
}

function pageDims() {
  const probe = new jsPDF({ unit: "pt", format: "a4" });
  return { width: probe.internal.pageSize.getWidth(), height: probe.internal.pageSize.getHeight() };
}

/** Verilen kalitede JPEG'e sıkıştırıp A4 sayfalarına yerleştirilmiş bir jsPDF üretir. */
function buildPdfFromCanvas(canvas: HTMLCanvasElement, page: { width: number; height: number }, quality: number): jsPDF {
  const pdf = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const imgWidth = page.width;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  const imgData = canvas.toDataURL("image/jpeg", quality);

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight, undefined, "MEDIUM");
  heightLeft -= page.height;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight, undefined, "MEDIUM");
    heightLeft -= page.height;
  }

  return pdf;
}
