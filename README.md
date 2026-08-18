# Oto Proforma

Otomatik proforma oluşturma paneli — TypeScript + Vite + React + **MUI (Material UI)**.

## Kurulum

```bash
npm install
npm run dev
```

`http://localhost:5173` adresini açın.

**Giriş bilgileri**
- Firma girişi: `demo` / `demo123`
- Admin girişi: `admin` / `admin123`

## Bu güncellemede değişenler

- **Claude/artifact'a özel depolama tamamen kaldırıldı.** `src/lib/storage.ts`
  artık yalnızca `localStorage` kullanıyor, `window.storage` kontrolü ve
  `shared` parametresi gitti — proje artık herhangi bir tarayıcıda / herhangi
  bir hosting'de, Claude ortamına bağımlı olmadan çalışıyor.
- **Mimari düzeltmesi: proforma verisi artık App.tsx'te değil, ait olduğu
  yerde tutuluyor.** Önceden `proformas` state'i App.tsx'te tutulup alt
  bileşenlere prop olarak geçiriliyordu; bu hem gereksiz prop-drilling
  yaratıyordu hem de App.tsx'i bir "global veri deposu" haline getiriyordu.
  Artık:
  - **Dashboard** proforma listesini kendisi yükler (`storeGet` ile mount
    olduğunda) ve silme işlemini kendisi yapar.
  - **ProformaEditor** düzenlediği TEK proformayı `useParams()` ile aldığı
    `:id`'ye göre kendisi yükler (yoksa `/proforma/add` için boş bir taslak
    oluşturur) ve "Kaydet"e basınca doğrudan storage'a yazıp `/dashboard`'a
    yönlendirir.
  - **App.tsx artık yalnızca oturumu ve rota tablosunu** yönetiyor — çok
    daha ince ve tek sorumluluğu olan bir üst bileşen.

## Önceki güncelleme (rotalar)

- **react-router-dom eklendi, gerçek URL rotaları var**:
  - `/login` — giriş ekranı
  - `/dashboard` — proforma listesi
  - `/proforma/add` — yeni proforma oluşturma
  - `/proforma/edit/:id` — mevcut proformayı düzenleme (ör. `/proforma/edit/PF-123`)
  - `/account-settings` — hesap ayarları
  - `/product-field-add` — **admin özel**, dinamik ürün alanı tanımlama
  
  Oturum açık değilken korumalı rotalara gidilirse `/login`'e, admin
  olmayan biri `/product-field-add`'e gitmeye çalışırsa `/dashboard`'a
  yönlendirilir. Sayfa yenilense veya doğrudan bir bağlantıya
  gidilse bile oturum korunur (bkz. "Önemli notlar").
- **`/product-field-add` (yeni ekran, admin)**: Alan Adı, Alan Tipi (Sayı,
  Metin, Seçim Listesi/Combobox, Dosya) ve Aranabilir (checkbox) ile ürün
  şemasına özel alan tanımlanabiliyor; tanımlı alanlar bir tabloda listelenip
  silinebiliyor (`src/lib/productFields.ts`, `src/components/ProductFieldAdd.tsx`).
  Not: Bu ekran alan **tanımlarını** yönetir — tanımlanan alanların ürün
  formunda/tablosunda fiilen görünmesi ayrı bir entegrasyon adımıdır, bir
  sonraki istekte onu da bağlayabilirim.
- Dashboard'daki dişli (Ayarlar) ikonunun yanına, yalnızca admin için
  `/product-field-add`'e giden bir "Tune" ikonu eklendi.

## Önceki güncellemeler

- **Ürünleri artık firma rolü de düzenleyebiliyor**, yalnızca admin değil —
  Ürünler sekmesindeki elle ekleme, Excel'den yükleme, satır düzenleme ve
  silme herkese açık.
- **Tablo hizalama + yatay kaydırma**: Başlık ve gövde hücreleri artık
  `whiteSpace: nowrap` ile tek satırda kalıyor (ör. "Toplam ₺" iki satıra
  bölünüp kaymıyor); tablo minimum genişliği içeriğe göre ayarlı, sığmazsa
  `TableContainer` otomatik yatay kaydırma çubuğu gösteriyor.
- **"Dışa Aktar" butonu proforma ekranından kaldırıldı.** Panel artık
  proformaları kart yerine **tablo** olarak listeliyor: Kod, Müşteri,
  Oluşturulduğu Tarih, Toplam Fiyat, İskonto sütunları ve satır sonunda
  İndir (PDF) / Düzenle / Sil ikonları. İndir butonu proformayı doğrudan o
  satırdan, editörü açmadan PDF olarak indiriyor.
- **Ürün tablosundaki textfield'lar artık outlined (kutu) stilinde ve
  kompakt** — önceki alt-çizgili (underline) görünüm kaldırıldı, yükseklik
  küçültüldü. Diğer formlardaki (Alıcı, Ödeme, Tarih) alanlar da tutarlılık
  için küçük boy yapıldı.
- **Giriş ekranında admin girişi artık göze çarpmıyor**: Büyük "Firma
  Girişi / Admin Girişi" seçici kaldırıldı; sağ üstte küçük, sade bir
  "Yönetici girişi" bağlantısı var — tıklanınca sade bir admin formuna
  geçiyor, "Firma girişine dön" ile geri dönülüyor.

## Önceki güncellemeler

- **PDF çıktı boyutu 1MB'ın altında tutuluyor**: `src/lib/pdfExport.ts` artık
  PNG yerine JPEG kullanıyor ve gerektiğinde kaliteyi kademeli düşürerek
  (0.85 → aşağı) dosyayı otomatik olarak ~950KB altına indiriyor; görünüm
  aynı kalıyor, sadece sıkıştırma oranı ayarlanıyor.
- **Kod / İsim'de filtreleme**: Ürünler sekmesinde arama kutusu artık ürün
  listesini Kod veya İsim'e göre anlık filtreliyor.
- **Tüm alanlar doğrudan textfield ile düzenleniyor**: Kalem/modal tabanlı
  düzenleme kaldırıldı — admin, Kod/İsim/GTİP/Koli/Koli İçi/Birim alanlarını
  artık doğrudan tablo hücresindeki textfield'dan değiştirebiliyor.
- **Sütunlar tamamen gizlenebiliyor**: Bir başlıktaki göz simgesine
  basıldığında o alan (başlık + tüm ürünlerin değeri) tablodan tamamen
  kayboluyor; tablonun üzerinde o alan için küçük bir kutucuk (chip) beliriyor,
  ona tıklanınca alan geri geliyor.
- **İskonto artık toplamların hemen üzerinde, sağdan başlayan aynı dar
  kutuda**; kapalıyken gri/soluk renkte gösteriliyor.

## Daha eski güncellemeler (2)

- **Tüm arayüz React MUI (Material UI) bileşenleriyle yeniden yazıldı**
  (AppBar, Tabs, Table, Accordion, Dialog, Snackbar, TextField, vb.). Tailwind
  kaldırıldı.
- **Kendi paletimiz** (`src/theme.ts`): MUI'nin varsayılan mavisi yerine
  bakır (`#B5651D`) birincil, petrol yeşili (`#1F5C57`) ikincil renk; başlıklar
  Space Grotesk, gövde metni Inter, kod/rakamlar JetBrains Mono.
- **Admin girişi düzeltildi**: Uygulama artık her açılışta `admin` ve `demo`
  hesaplarının var ve doğru şemada olduğunu kontrol edip gerekirse onarıyor —
  önceki bir sürümden kalma eksik/bozuk bir `users` kaydı bu sorunun asıl
  nedeniydi. Sorun hâlâ sürüyorsa tarayıcıda bu sitenin **Local Storage**
  verisini bir kez temizlemeniz yeterli (DevTools → Application → Local
  Storage → siteyi seçip Clear).
- **Excel'den ürün ekleme (yalnızca admin)**: Ürünler sekmesinde "Excel'den
  Yükle" butonuyla `.xlsx/.xls/.csv` dosyası yükleyip ürünleri toplu olarak
  ekleyebilirsiniz (`src/lib/excelImport.ts`, SheetJS/`xlsx` paketiyle).
  Beklenen sütun başlıkları: **Kod, İsim, GTİP, Koli Sayısı, Koli İçi Adet,
  Birim** (Türkçe/İngilizce ve boşluk varyasyonlarına toleranslı).

## Daha eski güncellemeler (3)

- **Her sütunun kendi kulakçığı var**: Ürün tablosundaki TÜM başlıklar (Kod,
  İsim, GTİP, Koli, Koli İçi, Toplam, Birim ₺, Toplam ₺) her zaman görünür ve
  her birinin yanında bir ok simgesi (kulakçık) bulunur. Bir başlığa
  basıldığında o sütun **tüm ürünler için birlikte** açılır/kapanır — satır
  satır değil, sütun bazında. Başlangıçta Kod, GTİP ve Birim kapalıdır
  (değerleri "•••" ile maskelenir), diğerleri açıktır; hepsi bağımsız olarak
  açılıp kapatılabilir.
- **Dışa Aktar artık gerçek bir PDF dosyası indiriyor** (html değil):
  `src/lib/pdfExport.ts`, görünümü ekran dışında oluşturup `html2canvas` ile
  görüntüye çevirir, ardından `jsPDF` ile A4 sayfalarına yerleştirip
  `Proforma-PF-xxxx.pdf` olarak doğrudan indirir. Yazdırma penceresi açılmaz;
  içerik bir sayfadan uzunsa otomatik olarak birden fazla sayfaya bölünür.
- **Ürün ekleme/düzenleme yalnızca admin**, satır düzenleme modal üzerinden.
- **Satıcı bilgileri Hesap Ayarları → Satıcı Bilgileri** sekmesinde, her yeni
  proformaya otomatik uygulanıyor.
- **2 ayrı giriş**: Firma Girişi / Admin Girişi.
- **İskonto akordeon** olarak açılıp kapanabiliyor; kapalıyken toplama katılmıyor.

## Klasör yapısı

```
src/
  App.tsx                     → react-router-dom route tanımları + oturum/veri durumu
  main.tsx                    → giriş noktası (MUI ThemeProvider)
  theme.ts / index.css        → MUI teması (özel palet) + font importu
  types.ts                    → tüm tip tanımları
  lib/
    storage.ts                  → kalıcı depolama (localStorage)
    helpers.ts                  → bulanık arama, toplam hesaplama, TL format
    seedData.ts                  → varsayılan/örnek veriler, admin+firma demo hesapları
    pdfExport.ts                  → html2canvas + jsPDF ile ~1MB altı .pdf üretip indirir
    excelImport.ts                → Excel/CSV'den ürün satırı ayrıştırma (SheetJS)
    productFields.ts               → admin'in tanımladığı dinamik ürün alanlarının depolanması
  components/
    LoginScreen.tsx                → /login — firma / (göze çarpmayan) admin girişi
    Dashboard.tsx                   → /dashboard — proforma tablosu, arama, indir/düzenle/sil
    ProformaEditor.tsx               → /proforma/add, /proforma/edit/:id — Alıcı/Ürünler/Şartlar/Ödeme
    AccountSettings.tsx               → /account-settings — Profil/Satıcı Bilgileri/Şifre/Kullanıcılar
    ProductFieldAdd.tsx                → /product-field-add — admin'e özel dinamik alan tanımlama
```

## Önemli notlar

- **Depolama**: `src/lib/storage.ts` yalnızca tarayıcının `localStorage`'ını
  kullanır (tüm veri o tarayıcıda kalır). Gerçek çoklu kullanıcı / sunucu
  tabanlı bir mimari için bu dosyanın içini kendi backend'inize (REST API,
  Firebase, Google Drive API vb.) bağlamanız yeterli — dışa açılan
  `storeGet`/`storeSet` imzası aynı kaldığı sürece çağıran kodun (App.tsx,
  Dashboard.tsx, ProformaEditor.tsx...) hiçbir satırını değiştirmenize gerek yok.
- **Rol modeli**: `UserRole = "admin" | "firma"`. Admin her şeyi yönetebilir (ürün
  ekleme/düzenleme, kullanıcı yönetimi); firma yalnızca kendi proformalarını
  oluşturup görüntüler.
- **Oturum kalıcılığı**: Giriş yapınca kullanıcı adı `session:current` anahtarıyla
  saklanır; sayfa yenilendiğinde veya `/proforma/edit/3` gibi bir bağlantıya
  doğrudan gidildiğinde oturum otomatik geri yüklenir. Çıkış yapınca bu kayıt silinir.
- **Statik hosting**: `react-router-dom` `BrowserRouter` (temiz URL'ler) kullanıyor.
  `vite dev` bunu otomatik destekler; canlıya alırken (Netlify/Vercel/Nginx vb.)
  bilinmeyen tüm yolları `index.html`'e yönlendiren bir "SPA fallback / history
  API" kuralı eklemeniz gerekir, yoksa `/dashboard` gibi bir adrese doğrudan
  girildiğinde 404 alınır.
