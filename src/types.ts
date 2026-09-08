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

export interface Proforma {
  id: number;
  code?: string;
  user_id: number;
  created_date?: string;
  validity_date?: string;

  customer_name?: string;
  buyer_name?: string;
  province?: string;
  state?: string;
  address?: string;
  phone?: string;
  buyer_email?: string;

  interlocuter_name?: string;
  interlocuter_phone?: string;
  interlocuter_email?: string;
  interlocuter_title?: string;

  pay_title?: string;
  bank?: string;
  iban?: string;

  discount: number;

  google_map_link?: string;
  phone_link?: string;
  website_link?: string;

  products: Product[];
  conditions: Condition[];
}
export type AppointmentStatus = "Beklemede" | "Onaylandı" | "Reddedildi";

export interface Appointment {
  id: number;
  appointment_date: string; // ISO datetime string
  description: string;
  user_id: number;
  status: AppointmentStatus;
  refuse_description?: string | null;
  // Admin ekranında listelerken backend join edip döndürebilir:
  firm?: string;
  username?: string;
}
export interface Product {
  Id: number;
  name: string;
  gtype?: string;
  parcel?: number;
  code: string;
  parcel_inside?: number;
  unit?: number;
  proforma_id: number;
  Proforma: Proforma;
  DynamicValues: DynamicValue[];
}


export interface Condition {
  Id: number;
  name: string;
  proforma_id: number;
  Proforma: Proforma;
}

export interface DynamicValue {
  Id: number;
  name: string;
  product_id: number;
  Product: Product;
  dynamic_field_id: number;
  DynamicField: DynamicField;
}

export interface DynamicField {
  Id: number;
  name: string;
  dynamic_type_id: number;
  DynamicType: DynamicType;
  DynamicValueComboBoxes: DynamicValueComboBox[];
  DynamicValues: DynamicValue[];
}

export interface DynamicType {
  Id: number;
  name: string;
  DynamicFields: DynamicField[];
}

export interface Role {
  Id: number;

  name: string;
}

export interface DynamicValueComboBox {
  Id: number;
  value: string;
  dynamic_field_id: number;
  DynamicField: DynamicField;
}
/** İki rol: admin (her şeyi yönetir) ve firma (kendi proformalarını oluşturur, ürün ekleyip düzenleyemez). */
export type UserRole = "admin" | "firma";

export interface UserAccount {
  password: string;
  fullname: string;
  email?: string;
  role: string;
  firm: string;
  userId: number;
  /** Hesap ayarlarında tutulan satıcı bilgileri — proformalarda otomatik kullanılır. */
  seller: SellerInfo;
}

export interface Session {
  username: string;
  token: string;
  role: string;
  phone?: string;
  fullname?: string;
  userId: number;
  seller?: string;
  email?: string;
  firm: string;
  center_address?: string;
  fabric_address?: string;
  seller_email?: string;

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
