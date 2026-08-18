import type { SellerInfo, BuyerInfo, PaymentInfo, ProductRow, Proforma, UsersMap } from "../types";

export function emptySeller(): SellerInfo {
  return { firma: "", merkez: "", fabrika: "", telefon: "", email: "" };
}

export function emptyBuyer(): BuyerInfo {
  return {
    firma: "",
    adres: "",
    ilce: "",
    telefon: "",
    email: "",
    isim: "",
    unvan: "",
    muhattapTelefon: "",
    muhattapEmail: "",
  };
}

export function emptyPayment(): PaymentInfo {
  return { unvan: "", banka: "", iban: "" };
}

export function newProductRow(): ProductRow {
  return {
    id: crypto.randomUUID(),
    kod: "",
    isim: "",
    gtip: "",
    koliSayisi: 1,
    koliIciAdet: 1,
    birim: 0,
  };
}

/** Yeni bir proforma iskeleti — satıcı bilgisi hesap ayarlarındaki firma bilgisinden gelir. */
export function seedEmptyProforma(seller: SellerInfo): Proforma {
  return {
    id: "PF-" + Date.now(),
    tarih: new Date().toISOString().slice(0, 10),
    gecerlilik: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    seller,
    buyer: emptyBuyer(),
    products: [],
    conditions: [
      "İşbu teklif / proforma verildiği tarihten itibaren 7 gün boyunca geçerlidir.",
      "Tüm ödemeler aşağıda belirtilen hesaba yapılacaktır.",
    ],
    payment: emptyPayment(),
    iskonto: 0,
    iskontoEtkin: false,
  };
}

export function seedDemoProforma(seller: SellerInfo): Proforma {
  const rows: ProductRow[] = [
    { kod: "ASL-100-0101", isim: "2'li Topraklı Grup Priz (Klemensli)", gtip: "853669900018", koliSayisi: 1, koliIciAdet: 75, birim: 172 },
    { kod: "ASL-100-0102", isim: "2'li Topraklı Grup Priz 2 Metre", gtip: "853669900018", koliSayisi: 1, koliIciAdet: 25, birim: 382 },
    { kod: "ASL-200-0202", isim: "2'li Anahtarlı Topraklı Grup Priz 2 Metre", gtip: "853669900018", koliSayisi: 1, koliIciAdet: 25, birim: 474 },
    { kod: "ASL-100-0120", isim: "8'li Topraklı Grup Priz (Klemensli)", gtip: "853669900018", koliSayisi: 1, koliIciAdet: 20, birim: 539 },
  ].map((r) => ({ ...r, id: crypto.randomUUID() }));

  return {
    id: "PF-" + Date.now(),
    tarih: new Date().toISOString().slice(0, 10),
    gecerlilik: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    seller,
    buyer: {
      firma: "GEBA İnşaat LTD ŞTİ",
      adres: "Osman Yılmaz, Şht. Numan Dede Cd. No:602, 41400",
      ilce: "Gebze / Kocaeli",
      telefon: "(216) 255 25 25",
      email: "info@gebainsaat.com.tr",
      isim: "Mehmet Kara",
      unvan: "Satın Alma",
      muhattapTelefon: "(535) 250 32 32",
      muhattapEmail: "mehmet.karaca@gebainsaatcilar.com.tr",
    },
    products: rows,
    conditions: [
      "İşbu teklif / proforma verildiği tarihten itibaren 7 gün boyunca geçerlidir.",
      "Tüm ödemeler aşağıda belirtilen hesaba yapılacaktır.",
    ],
    payment: {
      unvan: "ASEL AYDINLATMA MALZEMELERİ SAN. TİC. LTD.ŞTİ.",
      banka: "Yapı Kredi",
      iban: "TR19 0006 7010 0000 0056 0727 40",
    },
    iskonto: 50,
    iskontoEtkin: true,
  };
}

export function seedUsers(): UsersMap {
  const aselSeller: SellerInfo = {
    firma: "ASEL AYDINLATMA MALZEMELERİ SAN. TİC. LTD.ŞTİ.",
    merkez: "Mahmutbey, İSTOÇ 3. Ada No: 31-33, 34218 Bağcılar/İstanbul",
    fabrika: "Yaylaköyü Jandarma Konağı, Mevkii Sk. No:1 Sultangazi/İstanbul",
    telefon: "(212) 659 04 22",
    email: "info@aselticaret.com",
  };
  return {
    admin: {
      password: "admin123",
      name: "Sistem Yöneticisi",
      role: "admin",
      seller: aselSeller,
    },
    demo: {
      password: "demo123",
      name: "Mehmet Kara",
      role: "firma",
      seller: aselSeller,
    },
  };
}
