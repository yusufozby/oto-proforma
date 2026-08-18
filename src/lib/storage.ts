/**
 * Kalıcı depolama yardımcıları — tarayıcının localStorage'ını kullanır.
 *
 * Bunlar async fonksiyonlar olarak tanımlı (Promise döndürüyor), çünkü bu
 * arayüzü değiştirmeden gerçek bir backend'e (kendi REST servisiniz,
 * Firebase, Google Drive API vb.) bağlamak isterseniz sadece bu dosyanın
 * içini değiştirmeniz yeterli olsun diye — çağıran kodun (App.tsx,
 * Dashboard.tsx, ProformaEditor.tsx...) hiçbir satırını değiştirmenize
 * gerek kalmaz.
 */

export async function storeGet<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function storeSet<T>(key: string, value: T): Promise<void> {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("storage error", e);
  }
}
