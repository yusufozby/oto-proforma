export interface SellerInfo {
  firma: string;
  merkez: string;
  fabrika: string;
  telefon: string;
  email: string;
}

export interface BuyerInfo {
  firma: string;
  adres: string;
  ilce: string;
  telefon: string;
  email: string;
  isim: string;
  unvan: string;
  muhattapTelefon: string;
  muhattapEmail: string;
}

export interface PaymentInfo {
  unvan: string;
  banka: string;
  iban: string;
}

export interface ProductRow {
  id: string;
  kod: string;
  isim: string;
  gtip: string;
  koliSayisi: number;
  koliIciAdet: number;
  birim: number;
}

export interface Proforma {
  id: string;
  tarih: string;
  gecerlilik: string;
  seller: SellerInfo;
  buyer: BuyerInfo;
  products: ProductRow[];
  conditions: string[];
  payment: PaymentInfo;
  iskonto: number;
  /** İskonto akordeonu açık mı (kapalıysa iskonto toplam hesaba katılmaz). */
  iskontoEtkin: boolean;
}

/** İki rol: admin (her şeyi yönetir) ve firma (kendi proformalarını oluşturur, ürün ekleyip düzenleyemez). */
export type UserRole = "admin" | "firma";

export interface UserAccount {
  password: string;
  name: string;
  email?: string;
  role: UserRole;
  /** Hesap ayarlarında tutulan satıcı bilgileri — proformalarda otomatik kullanılır. */
  seller: SellerInfo;
}

export interface Session {
  username: string;
  name: string;
  role: UserRole;
  email?: string;
  seller: SellerInfo;
}

export type UsersMap = Record<string, UserAccount>;

/** Admin'in /product-field-add ekranından tanımladığı özel ürün alanı. */
export type ProductFieldType = "number" | "string" | "combobox" | "file";

export interface ProductFieldDef {
  id: string;
  name: string;
  type: ProductFieldType;
  searchable: boolean;
}
