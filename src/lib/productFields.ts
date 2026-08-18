import { storeGet, storeSet } from "./storage";
import type { ProductFieldDef } from "../types";

const KEY = "productFieldDefs";

/**
 * Admin'in /product-field-add ekranında tanımladığı özel ürün alanları.
 */
export async function getProductFields(): Promise<ProductFieldDef[]> {
  return storeGet<ProductFieldDef[]>(KEY, []);
}

export async function saveProductFields(fields: ProductFieldDef[]): Promise<void> {
  await storeSet<ProductFieldDef[]>(KEY, fields);
}
