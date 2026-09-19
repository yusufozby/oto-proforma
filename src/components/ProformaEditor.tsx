import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, Navigate } from "react-router-dom";
import {
  AppBar, Toolbar, Box, Container, Typography, Button, IconButton, TextField, Grid,
  Tabs, Tab, Table, TableHead, TableBody, TableRow, TableCell, TableContainer, Paper,
  TablePagination, Alert, Chip, Snackbar, Divider, Stack, InputAdornment, CircularProgress,
  Popper, ClickAwayListener, List, ListItemButton, ListItemAvatar, Avatar, ListItemText,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SaveIcon from "@mui/icons-material/Save";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import ChecklistIcon from "@mui/icons-material/Checklist";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import LockIcon from "@mui/icons-material/Lock";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import SearchIcon from "@mui/icons-material/Search";
import BrokenImageOutlinedIcon from "@mui/icons-material/BrokenImageOutlined";
import SubtitlesIcon from "@mui/icons-material/Subtitles";
import { tl, structuredCloneLite, resolveImageUrl } from "../lib/helpers";
import { baseApi } from "../lib/storage";
import { Proforma, Product, ProductProforma } from "../types";
import CustomPhoneInput from "../customs/masks/CustomPhoneInput";

interface Session {
  token: string;
  username: string;
  role: "admin" | "müşteri";
}

interface ProformaEditorProps {
  session: Session;
  isEdit: boolean;
}

type TabKey = "buyer" | "products" | "conditions" | "payment";

const TABS: { key: TabKey; label: string; icon: React.ReactElement }[] = [
  { key: "buyer", label: "Alıcı", icon: <PeopleAltIcon fontSize="small" /> },
  { key: "products", label: "Ürünler", icon: <Inventory2Icon fontSize="small" /> },
  { key: "conditions", label: "Şartlar", icon: <ChecklistIcon fontSize="small" /> },
  { key: "payment", label: "Ödeme", icon: <CreditCardIcon fontSize="small" /> },
];

type ColumnKey =
  | "image" | "code" | "name" | "gtype" | "parcel" | "parcel_inside"
  | "totalNumber" | "unit" | "totalPrice";

interface ColumnDef {
  key: ColumnKey;
  label: string;
  align: "left" | "center" | "right";
  defaultOpen: boolean;
  mono?: boolean;
  editable: boolean;
  numeric?: boolean;
}

const COLUMNS: ColumnDef[] = [
  { key: "image", label: "Görsel", align: "center", defaultOpen: true, editable: false },
  { key: "code", label: "Kod", align: "left", defaultOpen: false, mono: true, editable: true },
  { key: "name", label: "İsim", align: "left", defaultOpen: true, editable: true },
  { key: "gtype", label: "GTİP", align: "center", defaultOpen: false, mono: true, editable: true },
  { key: "parcel", label: "Koli", align: "center", defaultOpen: true, mono: true, editable: true, numeric: true },
  { key: "parcel_inside", label: "Koli İçi", align: "center", defaultOpen: true, mono: true, editable: true, numeric: true },
  { key: "totalNumber", label: "Toplam", align: "center", defaultOpen: true, mono: true, editable: false },
  { key: "unit", label: "Birim ₺", align: "right", defaultOpen: false, mono: true, editable: true, numeric: true },
  { key: "totalPrice", label: "Toplam ₺", align: "right", defaultOpen: true, mono: true, editable: false },
];

// --- Yardımcı Arama Metotları ---
function normalizeTR(str: string): string {
  return str
    .replace(/İ/g, "i").replace(/I/g, "ı").replace(/Ğ/g, "g").replace(/ğ/g, "g")
    .replace(/Ü/g, "u").replace(/ü/g, "u").replace(/Ş/g, "s").replace(/ş/g, "s")
    .replace(/Ö/g, "o").replace(/ö/g, "o").replace(/Ç/g, "c").replace(/ç/g, "c")
    .toLowerCase()
    .trim();
}

// Damerau-Levenshtein (optimal string alignment) — bitişik iki harfin
// yer değiştirmesini (transposition) TEK işlem olarak sayar. Klasik
// Levenshtein "pirz" -> "priz" için 2 işlem (iki değişiklik) sayarken,
// bu versiyon 1 işlem sayar — kısa kelimelerdeki harf takası
// hatalarında çok daha doğru bir mesafe verir.
function damerauLevenshtein(a: string, b: string): number {
  const al = a.length;
  const bl = b.length;
  const d: number[][] = Array.from({ length: al + 1 }, () => new Array(bl + 1).fill(0));

  for (let i = 0; i <= al; i++) d[i][0] = i;
  for (let j = 0; j <= bl; j++) d[0][j] = j;

  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,       // silme
        d[i][j - 1] + 1,       // ekleme
        d[i - 1][j - 1] + cost // değiştirme
      );
      if (
        i > 1 && j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1); // bitişik harf takası
      }
    }
  }

  return d[al][bl];
}

// Bigram (ikili harf grubu) çıkarır — "toprka" -> ["to","op","pr","rk","ka"]
function bigrams(s: string): string[] {
  const clean = s.replace(/\s+/g, "");
  const grams: string[] = [];
  for (let i = 0; i < clean.length - 1; i++) grams.push(clean.slice(i, i + 2));
  return grams;
}

// İki string arasındaki benzerliği 0–1 arası puanlar (Dice katsayısı).
function diceCoefficient(a: string, b: string): number {
  if (a === b) return 1;
  const bigramsA = bigrams(a);
  const bigramsB = bigrams(b);
  if (bigramsA.length === 0 || bigramsB.length === 0) return 0;

  const mapB = new Map<string, number>();
  for (const bg of bigramsB) mapB.set(bg, (mapB.get(bg) ?? 0) + 1);

  let matches = 0;
  for (const bg of bigramsA) {
    const count = mapB.get(bg) ?? 0;
    if (count > 0) {
      matches++;
      mapB.set(bg, count - 1);
    }
  }
  return (2 * matches) / (bigramsA.length + bigramsB.length);
}

// Karakter çoklu-kümesi (multiset) benzerliği — SIRAYI HİÇ ÖNEMSEMEZ.
function charMultisetSimilarity(a: string, b: string): number {
  if (a.length === 0 || b.length === 0) return 0;
  const countsA = new Map<string, number>();
  for (const ch of a) countsA.set(ch, (countsA.get(ch) ?? 0) + 1);

  let common = 0;
  for (const ch of b) {
    const c = countsA.get(ch) ?? 0;
    if (c > 0) {
      common++;
      countsA.set(ch, c - 1);
    }
  }
  return (2 * common) / (a.length + b.length);
}

/**
 * GENİŞ ARAMA — kasıtlı olarak toleranslı tutulmuştur, daraltılmamalı.
 */
function fuzzySearchProducts(products: Product[], query: string): Product[] {
  const normQuery = normalizeTR(query);
  if (!normQuery) return [];

  const queryTokens = normQuery.split(/\s+/).filter(Boolean);

  function wordScore(query: string, word: string): number {
    if (!word) return 0;
    if (word.includes(query) || query.includes(word)) return 1;

    const dice = diceCoefficient(query, word);
    const multiset = charMultisetSimilarity(query, word);

    const dist = damerauLevenshtein(query, word);
    const maxLen = Math.max(query.length, word.length);
    const damerauSim = maxLen > 0 ? 1 - dist / maxLen : 0;

    return Math.max(dice, multiset, damerauSim);
  }

  const scored = products.map((product) => {
    const normName = normalizeTR(product.name || "");
    const normCode = normalizeTR(product.code || "");
    const nameTokens = normName.split(/\s+/).filter(Boolean);

    let score = 0;

    if (normName.includes(normQuery) || normCode.includes(normQuery)) {
      score = Math.max(score, 100);
    }

    let tokenMatches = 0;
    queryTokens.forEach((token) => {
      if (normName.includes(token) || normCode.includes(token)) tokenMatches++;
    });
    if (tokenMatches > 0) {
      score = Math.max(score, 70 + (tokenMatches / queryTokens.length) * 20);
    }

    let bestWordMatch = 0;
    for (const qToken of queryTokens) {
      for (const nToken of nameTokens) {
        bestWordMatch = Math.max(bestWordMatch, wordScore(qToken, nToken));
      }
      bestWordMatch = Math.max(bestWordMatch, wordScore(qToken, normCode));
    }
    score = Math.max(score, bestWordMatch * 85);

    score = Math.max(score, wordScore(normQuery, normName) * 80);

    return { product, score };
  });

  return scored
    .filter((item) => item.score > 15)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.product);
}

function initialColumnState(): Record<ColumnKey, boolean> {
  const s = {} as Record<ColumnKey, boolean>;
  COLUMNS.forEach((c) => { s[c.key] = c.defaultOpen; });
  return s;
}
// Bileşenin üstünde bir yerde (COLUMNS'un yanı, ya da helpers.ts'e taşıyabilirsin)
function toDateInputValue(value: unknown): string {
  if (!value) return "";
  const str = String(value);
  // "2024-01-15T00:00:00.000Z" -> "2024-01-15"
  // "2024-01-15" zaten olduğu gibi kalır
  return str.slice(0, 10);
}
export default function ProformaEditor({ session, isEdit }: ProformaEditorProps) {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [pf, setPf] = useState<Proforma | null>(null);
  const [dbProducts, setDbProducts] = useState<Product[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);

  const [tab, setTab] = useState<TabKey>("buyer");
  const [colOpen, setColOpen] = useState<Record<ColumnKey, boolean>>(initialColumnState());

  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [productPage, setProductPage] = useState(0);
  const [productRowsPerPage, setProductRowsPerPage] = useState(10);

  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({
    open: false, message: "", severity: "success",
  });
  const [hasIskonto, setHasIskonto] = useState(false)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${baseApi}/api/products/all`, {
          headers: { Authorization: `Bearer ${session.token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setDbProducts(data || []);
        }
      } catch (err) {
        console.error("Ürün listesi alınamadı", err);
      }
    })();
  }, [session.token]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (isEdit) {
        if (!id) {
          if (!cancelled) setNotFound(true);
          return;
        }

        try {
          const response = await fetch(`${baseApi}/api/proforma/get/${id}`, {
            headers: { Authorization: `Bearer ${session.token}` },
          });

          if (!response.ok) {
            if (!cancelled) setNotFound(true);
            return;
          }

          const json = await response.json();
          if (cancelled) return;
          if (!json) { setNotFound(true); return; }

          // Backend "products" (flat) döner, frontend "proformaProducts"
          // (nested Product) bekliyor — burada dönüştürüyoruz.
          const mappedProformaProducts: ProductProforma[] = (json.products ?? []).map((p: any) => ({
            Id: p.id,
            proforma_id: json.id,
            product_id: p.product_id,
            parcel: p.parcel,
            Product: {
              Id: p.product_id,
              name: p.name,
              code: p.code,
              gtype: p.gtype,
              parcel_inside: p.parcel_inside,
              unit: p.unit,
              image: p.image,
              DynamicValues: p.dynamicValues ?? [],
            },
          }));

          setPf({
            ...json,
            conditions: json.conditions ?? [],
            proformaProducts: mappedProformaProducts,
          });
          setHasIskonto(json.discount > 0);
        } catch {
          if (!cancelled) setNotFound(true);
        }
      } else {
        if (!cancelled) {
          setPf({
            conditions: [],
            // discount alanı yok → başlangıçta "İskonto Ekle" butonu görünür
            proformaProducts: [],
            user_id: session.role === "admin" ? 1 : 2,
          });
        }
      }
    })();

    return () => { cancelled = true; };
  }, [id, isEdit, session.username, session.token, session.role]);

  const updatePf = (updater: (p: Proforma) => Proforma) => {
    setPf((prev) => (prev ? updater(prev) : prev));
  };

  const update = (path: (string | number)[], value: unknown) => {
    updatePf((prev) => {
      const next = structuredCloneLite(prev) as unknown as Record<string, any>;
      let ref: Record<string, any> = next;
      for (let i = 0; i < path.length - 1; i++) {
        ref = ref[path[i]];
      }
      ref[path[path.length - 1]] = value;
      return next as unknown as Proforma;
    });
  };

  const visibleColumns = COLUMNS.filter((c) => colOpen[c.key]);
  const hiddenColumns = COLUMNS.filter((c) => !colOpen[c.key]);

  const hideColumn = (key: ColumnKey) => setColOpen((s) => ({ ...s, [key]: false }));
  const showColumn = (key: ColumnKey) => setColOpen((s) => ({ ...s, [key]: true }));

  const searchResults = useMemo(() => {
    const query = searchQuery.trim();
    if (!query) return [];
    return fuzzySearchProducts(dbProducts, query).slice(0, 5);
  }, [searchQuery, dbProducts]);

  const isMenuOpen = searchOpen && searchQuery.trim().length > 0;

  const handleSelectProduct = (product: Product) => {
    updatePf((p) => {
      const exists = p.proformaProducts.some((item) => item.product_id === product.id);
      if (exists) {
        setSnack({ open: true, message: "Bu ürün zaten listede ekli.", severity: "error" });
        return p;
      }

      const tempId = Math.min(0, ...p.proformaProducts.map((pp) => pp.Id ?? 0)) - 1;

      const newProformaProduct: ProductProforma = {
        Id: tempId,
        proforma_id: p.id || 0,
        product_id: product.id,
        parcel: 1,
        Product: product,
      };
      console.log(newProformaProduct);
      return {
        ...p,
        proformaProducts: [...p.proformaProducts, newProformaProduct],
      };
    });

    setSearchQuery("");
    setSearchOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!searchOpen || searchResults.length === 0) return;
    console.log(searchResults);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % searchResults.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + searchResults.length) % searchResults.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (searchResults[selectedIndex]) {
        handleSelectProduct(searchResults[selectedIndex]);
      }
    } else if (e.key === "Escape") {
      setSearchOpen(false);
    }
  };

  const removeProformaProduct = (id: number) =>
    updatePf((p) => ({
      ...p,
      proformaProducts: p.proformaProducts.filter((r) => r.Id !== id),
    }));

  // DÜZELTİLDİ: item.id -> item.Id (önceki bug: alan hiç var olmadığından
  // koşul her zaman true dönüyor, hiçbir satır güncellenmiyordu)
  const updateProductProformaField = (id: number, field: string, value: any) => {
    updatePf((p) => ({
      ...p,
      proformaProducts: p.proformaProducts.map((item) => {
        if (item.Id !== id) return item;
        if (field === "parcel") return { ...item, parcel: Number(value) };
        return {
          ...item,
          Product: { ...item.Product, [field]: value },
        };
      }),
    }));
  };

  const paginatedProformaProducts = useMemo(() => {
    if (!pf) return [];
    const start = productPage * productRowsPerPage;
    return pf.proformaProducts.slice(start, start + productRowsPerPage);
  }, [pf, productPage, productRowsPerPage]);

  const readOnlyValue = (item: ProductProforma, key: ColumnKey) => {
    const p = item.Product;
    const parcelCount = Number(item.parcel) || 0;
    const insideCount = Number(p?.parcel_inside) || 0;
    const totalAdet = parcelCount * insideCount;
    const unitPrice = Number(p?.unit) || 0;

    switch (key) {
      case "code": return p?.code || "—";
      case "name": return p?.name || "İsimsiz ürün";
      case "gtype": return p?.gtype || "—";
      case "parcel": return String(parcelCount);
      case "parcel_inside": return String(insideCount);
      case "totalNumber": return String(totalAdet);
      case "unit": return tl(unitPrice);
      case "totalPrice": return tl(totalAdet * unitPrice);
      default: return "";
    }
  };

  // Toplamlar — ürünler tablosunun altında gösterilecek
  const totals = useMemo(() => {
    if (!pf) return { araTotal: 0, iskontoAmount: 0, total: 0, discountRate: 0, iskontoVar: false };
    const araTotal = pf.proformaProducts.reduce((sum, item) => {
      const p = item.Product;
      const parcelCount = Number(item.parcel) || 0;
      const insideCount = Number(p?.parcel_inside) || 0;
      const unitPrice = Number(p?.unit) || 0;
      return sum + parcelCount * insideCount * unitPrice;
    }, 0);

    // "" veya undefined/null → oran 0 kabul edilir
    const discountRate =
      !pf.discount
        ? 0
        : Number(pf.discount) || 0;

    // ✅ Sadece undefined / null "kapalı"dır. "" ve 0 "açık"tır.
    const iskontoVar = hasIskonto

    const iskontoAmount = araTotal * (discountRate / 100);
    const total = araTotal - iskontoAmount;

    return { araTotal, iskontoAmount, total, discountRate, iskontoVar };
  }, [pf]);

  const handleSave = async () => {
    if (!pf) return;
    setSaving(true);

    try {
      // Frontend "proformaProducts" (nested Product) tutuyor, backend
      // "products" (flat: sadece product_id + parcel) bekliyor.
      const payload: any = {
        ...pf,
        products: pf.proformaProducts.map((pp) => ({
          product_id: pp.product_id,
          parcel: pp.parcel,
        })),
        conditions: pf.conditions?.map((c) => ({ name: c.name })) ?? [],
        // Ödeme bilgileri + iskonto
        pay_title: pf.pay_title ?? "",
        bank: pf.bank ?? "",
        iban: pf.iban ?? "",
        // İskonto: "" veya undefined/null → 0, aksi halde Number
        discount:
          !pf.discount
            ? 0
            : Number(pf.discount) || 0,
      };
      delete payload.proformaProducts;

      const url = isEdit ? `${baseApi}/api/proforma/edit/${id}` : `${baseApi}/api/proforma/add`;
      const response = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        setSnack({ open: true, message: "Kaydedilemedi. Lütfen tekrar deneyin.", severity: "error" });
        return;
      }

      navigate("/dashboard");
    } catch {
      setSnack({ open: true, message: "Bağlantı hatası. Lütfen tekrar deneyin.", severity: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (notFound) return <Navigate to="/dashboard" replace />;

  if (!pf) {
    return (
      <Box sx={{ minHeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 1.5 }}>
        <CircularProgress size={20} thickness={5} />
        <Typography variant="body2" color="text.secondary">Yükleniyor…</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: 600 }}>
      <AppBar position="sticky">
        <Toolbar sx={{ maxWidth: 1200, width: "100%", mx: "auto", gap: 2 }}>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/dashboard")} color="inherit">
            Panele Dön
          </Button>
          <Typography variant="body2" className="mono" color="text.secondary" sx={{ flexGrow: 1, textAlign: "center" }} />
          <Button variant="contained" color="primary" startIcon={<SaveIcon />} onClick={handleSave} disabled={saving}>
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                disabled
                type="date" label="Tarih" fullWidth size="small"
                value={toDateInputValue(pf.created_date)}
                onChange={(e) => update(["created_date"], e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                type="date" label="Geçerlilik" fullWidth size="small"
                value={toDateInputValue(pf.validity_date)}
                onChange={(e) => update(["validity_date"], e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </Paper>

        <Alert severity="info" icon={<LockIcon fontSize="small" />} sx={{ mb: 3 }}>
          Satıcı bilgileri hesap ayarlarındaki firma profilinden otomatik alınır.
        </Alert>

        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}>
          {TABS.map((t) => (
            <Tab key={t.key} value={t.key} label={t.label} icon={t.icon} iconPosition="start" sx={{ minHeight: 48 }} />
          ))}
        </Tabs>

        <Paper variant="outlined" sx={{ p: 3 }}>
          {/* TAB 1: BUYER */}
          {tab === "buyer" && (
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField label="Firma" fullWidth size="small" value={pf.buyer_name ?? ""} onChange={(e) => update(["buyer_name"], e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField label="İlçe / İl" fullWidth size="small" value={pf.province ?? ""} onChange={(e) => update(["province"], e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField label="Adres" fullWidth size="small" value={pf.address ?? ""} onChange={(e) => update(["address"], e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Telefon"
                  fullWidth
                  size="small"
                  value={pf.phone ?? ""}
                  onChange={(e) => update(["phone"], e.target.value)}
                  placeholder="0(5xx) xxx xx xx"
                  InputProps={{
                    inputComponent: CustomPhoneInput as any,
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField label="E-mail" fullWidth size="small" value={pf.buyer_email ?? ""} onChange={(e) => update(["buyer_email"], e.target.value)} />
              </Grid>
              <Grid item xs={12}><Divider sx={{ my: 1 }} /></Grid>
              <Grid item xs={12} sm={6}>
                <TextField label="Muhattap İsim" fullWidth size="small" value={pf.interlocuter_name ?? ""} onChange={(e) => update(["interlocuter_name"], e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField label="Muhattap Ünvan" fullWidth size="small" value={pf.interlocuter_title ?? ""} onChange={(e) => update(["interlocuter_title"], e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Muhattap Telefon"
                  fullWidth
                  size="small"
                  value={pf.interlocuter_phone ?? ""}
                  onChange={(e) => update(["interlocuter_phone"], e.target.value)}
                  placeholder="0(5xx) xxx xx xx"
                  InputProps={{
                    inputComponent: CustomPhoneInput as any,
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField label="Muhattap E-mail" fullWidth size="small" value={pf.interlocuter_email ?? ""} onChange={(e) => update(["interlocuter_email"], e.target.value)} />
              </Grid>
            </Grid>
          )}

          {/* TAB 2: PRODUCTS */}
          {tab === "products" && (
            <Box>
              <ClickAwayListener onClickAway={() => setSearchOpen(false)}>
                <Box sx={{ position: "relative", mb: 3 }}>
                  <TextField
                    ref={searchInputRef}
                    size="medium"
                    fullWidth
                    value={searchQuery}
                    onFocus={() => {
                      if (searchQuery.trim().length > 0) setSearchOpen(true);
                    }}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSearchQuery(val);
                      setSearchOpen(val.trim().length > 0);
                      setSelectedIndex(0);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Ürün adı veya koduna göre arayın"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon fontSize="medium" color="action" />
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        borderRadius: "16px",
                        bgcolor: "#FAF9F5",
                        transition: "all 0.2s ease-in-out",
                        "&.Mui-focused": {
                          bgcolor: "#FFFFFF",
                        },
                      },
                    }}
                  />

                  <Popper
                    open={isMenuOpen}
                    anchorEl={searchInputRef.current}
                    placement="bottom-start"
                    modifiers={[
                      { name: "offset", options: { offset: [0, 8] } },
                      { name: "preventOverflow", options: { boundary: "window" } },
                    ]}
                    style={{
                      width: searchInputRef.current ? searchInputRef.current.clientWidth : "auto",
                      zIndex: 1300,
                    }}
                  >
                    <Paper
                      elevation={8}
                      sx={{
                        borderRadius: "16px",
                        border: "1px solid",
                        borderColor: "divider",
                        overflow: "hidden",
                        bgcolor: "#FFFFFF",
                        boxShadow: "0px 10px 30px rgba(0, 0, 0, 0.12)",
                        display: "flex",
                        flexDirection: "column",
                      }}
                    >
                      <Box sx={{ p: 1, px: 2, bgcolor: "#F5F5F7", borderBottom: "1px solid", borderColor: "divider" }}>
                        <Typography
                          variant="caption"
                          fontWeight={600}
                          color="text.secondary"
                          sx={{ letterSpacing: 0.5, fontSize: 11 }}
                        >
                          ARAMA SONUÇLARI
                        </Typography>
                      </Box>

                      <List disablePadding sx={{ maxHeight: 300, overflowY: "auto" }}>
                        {searchResults.length === 0 ? (
                          <Box sx={{ p: 2, textAlign: "center", color: "text.secondary" }}>
                            <Typography variant="body2" fontSize={13}>Eşleşen ürün bulunamadı.</Typography>
                          </Box>
                        ) : (
                          searchResults.map((prod, idx) => {
                            const isSelected = idx === selectedIndex;
                            return (
                              <ListItemButton
                                key={prod.id}
                                selected={isSelected}
                                onClick={() => handleSelectProduct(prod)}
                                onMouseEnter={() => setSelectedIndex(idx)}
                                sx={{
                                  py: 0.5,
                                  px: 1.5,
                                  transition: "background-color 0.15s ease",
                                  "&.Mui-selected": { bgcolor: "rgba(0, 113, 227, 0.08)" },
                                  "&:hover": { bgcolor: "rgba(0, 0, 0, 0.04)" },
                                }}
                              >
                                <ListItemAvatar sx={{ minWidth: 38 }}>
                                  <Avatar
                                    src={resolveImageUrl(prod.image, baseApi)}
                                    variant="rounded"
                                    sx={{ width: 32, height: 32, bgcolor: "#F2F2F7", borderRadius: "6px" }}
                                  >
                                    <SubtitlesIcon sx={{ fontSize: 18 }} color="action" />
                                  </Avatar>
                                </ListItemAvatar>
                                <ListItemText
                                  sx={{ my: 0 }}
                                  primary={
                                    <Typography variant="body2" fontWeight={600} fontSize={13} color="text.primary">
                                      {prod.name}
                                    </Typography>
                                  }
                                  secondary={
                                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.2 }}>
                                      <Chip label={prod.code} size="small" variant="outlined" sx={{ height: 16, fontSize: 9, px: 0.5 }} />
                                      {prod.unit && (
                                        <Typography variant="caption" fontSize={11} color="text.secondary">
                                          {tl(prod.unit)}
                                        </Typography>
                                      )}
                                    </Stack>
                                  }
                                />
                                <AddIcon sx={{ fontSize: 18 }} color="action" />
                              </ListItemButton>
                            );
                          })
                        )}
                      </List>
                    </Paper>
                  </Popper>
                </Box>
              </ClickAwayListener>

              {hiddenColumns.length > 0 && (
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
                  {hiddenColumns.map((c) => (
                    <Chip
                      key={c.key} label={c.label} size="small" variant="outlined"
                      icon={<VisibilityOutlinedIcon fontSize="small" />}
                      onClick={() => showColumn(c.key)}
                      sx={{ cursor: "pointer" }}
                    />
                  ))}
                </Stack>
              )}

              <Typography variant="overline" color="text.secondary">
                {pf.proformaProducts.length} ürün eklendi
              </Typography>

              <TableContainer component={Paper} variant="outlined" sx={{ overflowX: "auto", borderRadius: 2 }}>
                <Table size="small" sx={{ minWidth: 780 }}>
                  <TableHead>
                    <TableRow sx={{ bgcolor: "#EAE6DA" }}>
                      {visibleColumns.map((c) => (
                        <TableCell key={c.key} align={c.align} sx={{ whiteSpace: "nowrap" }}>
                          <Stack
                            direction="row" spacing={0.25} alignItems="center" flexWrap="nowrap"
                            justifyContent={c.align === "right" ? "flex-end" : c.align === "center" ? "center" : "flex-start"}
                          >
                            <span style={{ whiteSpace: "nowrap" }}>{c.label}</span>
                            <IconButton size="small" onClick={() => hideColumn(c.key)} title={`${c.label} alanını gizle`}>
                              <VisibilityOffOutlinedIcon fontSize="inherit" sx={{ color: "text.secondary" }} />
                            </IconButton>
                          </Stack>
                        </TableCell>
                      ))}
                      <TableCell sx={{ whiteSpace: "nowrap" }} />
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {pf.proformaProducts.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={visibleColumns.length + 1} align="center" sx={{ py: 5, color: "text.secondary" }}>
                          Proformada ürün bulunmuyor. Yukarıdaki arama kısmından ürün ekleyebilirsiniz.
                        </TableCell>
                      </TableRow>
                    )}

                    {paginatedProformaProducts.map((item) => (
                      <TableRow key={item.Id} hover>
                        {visibleColumns.map((c) => {
                          if (c.key === "image") {
                            const imgUrl = resolveImageUrl(item.Product?.image, baseApi);
                            return (
                              <TableCell key={c.key} align="center">
                                <Box
                                  sx={{
                                    width: 50, height: 50, borderRadius: 1.5,
                                    border: "1px solid", borderColor: "divider",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    overflow: "hidden", bgcolor: "#FAF9F5", mx: "auto",
                                  }}
                                >
                                  {imgUrl ? (
                                    <Box component="img" src={imgUrl} alt={item.Product?.name} sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                  ) : (
                                    <BrokenImageOutlinedIcon sx={{ color: "text.secondary" }} fontSize="small" />
                                  )}
                                </Box>
                              </TableCell>
                            );
                          }

                          if (c.key === "parcel") {
                            return (
                              <TableCell key={c.key} align={c.align} sx={{ minWidth: 90 }}>
                                <TextField
                                  type="number" size="small" variant="outlined"
                                  value={item.parcel ?? 0}
                                  onChange={(e) => updateProductProformaField(item.Id!, "parcel", e.target.value)}
                                  inputProps={{ style: { textAlign: "center" }, min: 1 }}
                                  sx={{ "& .MuiOutlinedInput-input": { py: 0.75, px: 1 } }}
                                />
                              </TableCell>
                            );
                          }

                          return (
                            <TableCell
                              key={c.key} align={c.align} className={c.mono ? "mono" : undefined}
                              sx={{ fontWeight: c.key === "totalPrice" ? 600 : 400, whiteSpace: "nowrap" }}
                            >
                              {readOnlyValue(item, c.key)}
                            </TableCell>
                          );
                        })}

                        <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                          <IconButton size="small" onClick={() => removeProformaProduct(item.Id!)} title="Kaldır">
                            <DeleteOutlineIcon fontSize="small" color="error" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {pf.proformaProducts.length > 0 && (
                  <TablePagination
                    component="div"
                    count={pf.proformaProducts.length}
                    page={productPage}
                    onPageChange={(_, newPage) => setProductPage(newPage)}
                    rowsPerPage={productRowsPerPage}
                    onRowsPerPageChange={(e) => {
                      setProductRowsPerPage(parseInt(e.target.value, 10));
                      setProductPage(0);
                    }}
                    rowsPerPageOptions={[5, 10, 25, 50]}
                    labelRowsPerPage="Satır:"
                  />
                )}
              </TableContainer>

              {/* ===== ŞIK TOPLAMLAR KARTI ===== */}
              {pf.proformaProducts.length > 0 && (
                <Box
                  sx={{
                    mt: 4,
                    display: "flex",
                    justifyContent: "flex-end",
                  }}
                >
                  <Paper
                    elevation={0}
                    sx={{
                      position: "relative",
                      minWidth: 400,
                      borderRadius: 3,
                      overflow: "hidden",
                      border: "1px solid",
                      borderColor: "divider",
                      bgcolor: "#FFFFFF",
                      boxShadow: "0 4px 24px rgba(0, 0, 0, 0.06)",
                    }}
                  >
                    {/* Üst gradient accent şerit — primary color tonlarında */}
                    <Box
                      sx={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 4,
                        background: "linear-gradient(90deg, primary.light 0%, primary.main 50%, primary.dark 100%)",
                      }}
                    />

                    <Box sx={{ p: 3, pt: 3.5 }}>
                      <Stack spacing={2}>
                        {/* Ara Toplam */}
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography
                            variant="body2"
                            sx={{
                              color: "text.secondary",
                              fontWeight: 500,
                              letterSpacing: 0.2,
                            }}
                          >
                            Ara Toplam
                          </Typography>
                          <Typography
                            variant="body1"
                            sx={{
                              fontWeight: 600,
                              fontVariantNumeric: "tabular-nums",
                              color: "text.primary",
                            }}
                          >
                            {tl(totals.araTotal)}
                          </Typography>
                        </Stack>

                        {/* İskonto satırı — varsa inline input, yoksa "İskonto Ekle" butonu */}
                        {totals.iskontoVar ? (
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Stack direction="row" alignItems="center" spacing={1}>
                              <Typography
                                variant="body2"
                                sx={{
                                  color: "text.secondary",
                                  fontWeight: 500,
                                  letterSpacing: 0.2,
                                }}
                              >
                                İskonto
                              </Typography>

                              {/* Küçük, şık oran input'u */}
                              <Box
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 0.5,
                                  px: 1,
                                  py: 0.25,
                                  borderRadius: 1.5,
                                  bgcolor: "action.hover",
                                  border: "1px solid",
                                  borderColor: "divider",
                                }}
                              >
                                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>
                                  %
                                </Typography>
                                <TextField
                                  type="number"
                                  variant="standard"
                                  autoFocus
                                  value={
                                    pf.discount === undefined || pf.discount === null
                                      ? ""
                                      : String(pf.discount)
                                  }
                                  onChange={(e) => {
                                    const raw = e.target.value;

                                    // Boş bırakıldı → state'te "" olarak tut (input boş kalır)
                                    if (raw === "") {
                                      update(["discount"], "");
                                      return;
                                    }

                                    let num = Number(raw);
                                    if (!Number.isFinite(num)) return;

                                    // Clamp: 0–100
                                    if (num < 0) num = 0;
                                    if (num > 100) num = 100;

                                    update(["discount"], num);
                                  }}
                                  inputProps={{
                                    min: 0,
                                    max: 100,
                                    step: 0.1,
                                    style: {
                                      textAlign: "center",
                                      padding: 0,
                                      width: 36,
                                      fontSize: 13,
                                      fontWeight: 600,
                                      color: "text.primary",
                                      fontVariantNumeric: "tabular-nums",
                                    },
                                  }}
                                  sx={{
                                    width: 36,
                                    "& .MuiInput-underline:before": { borderBottom: "none" },
                                    "& .MuiInput-underline:hover:before": { borderBottom: "none !important" },
                                    "& .MuiInput-underline:after": { borderBottom: "none" },
                                    "& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button": {
                                      WebkitAppearance: "none",
                                      margin: 0,
                                    },
                                    "& input[type=number]": { MozAppearance: "textfield" },
                                  }}
                                />
                              </Box>

                              <IconButton
                                size="small"
                                onClick={() => {
                                  setHasIskonto(false);
                                  update(["discount"], undefined)
                                }}
                                sx={{ p: 0.5 }}
                                title="İskontoyu kaldır"
                              >
                                <DeleteOutlineIcon sx={{ fontSize: 15, color: "text.secondary" }} />
                              </IconButton>
                            </Stack>
                            <Typography
                              variant="body1"
                              sx={{
                                fontWeight: 600,
                                fontVariantNumeric: "tabular-nums",
                                color: "text.secondary",
                              }}
                            >
                              − {tl(totals.iskontoAmount)}
                            </Typography>
                          </Stack>
                        ) : (
                          <Button
                            size="small"
                            startIcon={<AddIcon sx={{ fontSize: 16 }} />}
                            onClick={() => {
                              setHasIskonto(true);
                              update(["discount"], "")
                            }}
                            sx={{
                              alignSelf: "flex-start",
                              textTransform: "none",
                              fontSize: 12,
                              color: "text.secondary",
                              px: 1.5,
                              py: 0.4,
                              border: "1px dashed",
                              borderColor: "divider",
                              borderRadius: 1.5,
                              "&:hover": {
                                color: "primary.main",
                                borderColor: "primary.main",
                                bgcolor: "action.hover",
                              },
                            }}
                          >
                            İskonto Ekle
                          </Button>
                        )}

                        {/* Ayırıcı */}
                        <Box
                          sx={{
                            height: 1,
                            background: "linear-gradient(90deg, transparent 0%, #E0E0E0 50%, transparent 100%)",
                          }}
                        />

                        {/* Toplam — primary color gradient */}
                        <Box
                          sx={{
                            mt: 1,
                            px: 2,
                            py: 1.5,
                            borderRadius: 1,
                            background: (theme) =>
                              `linear-gradient(135deg, ${theme.palette.primary.light}15 0%, ${theme.palette.primary.main}20 100%)`,
                            border: "1px solid",
                            borderColor: "primary.main",
                          }}
                        >
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography
                              variant="subtitle1"
                              sx={{
                                fontWeight: 700,
                                color: "primary.dark",
                                letterSpacing: 0.3,
                              }}
                            >
                              Toplam
                            </Typography>
                            <Typography
                              variant="h6"
                              sx={{
                                fontWeight: 800,
                                fontVariantNumeric: "tabular-nums",
                                color: "primary.dark",
                                letterSpacing: -0.2,
                              }}
                            >
                              {tl(totals.total)}
                            </Typography>
                          </Stack>
                        </Box>
                      </Stack>
                    </Box>
                  </Paper>
                </Box>
              )}
            </Box>
          )}

          {/* TAB 3: CONDITIONS */}
          {tab === "conditions" && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 2 }}>Teklif Şartları</Typography>
              <Button
                startIcon={<AddIcon />} variant="outlined" size="small" sx={{ mb: 2 }}
                onClick={() => updatePf((p) => ({ ...p, conditions: [...(p.conditions || []), { name: "" }] }))}
              >
                Yeni Şart Ekle
              </Button>
              <Stack spacing={1.5}>
                {pf.conditions?.map((cond, idx) => (
                  <Stack key={idx} direction="row" spacing={1} alignItems="center">
                    <TextField
                      fullWidth size="small" placeholder="Örn: Teslimat süresi 10 gündür."
                      value={cond.name}
                      onChange={(e) => {
                        const val = e.target.value;
                        updatePf((p) => {
                          const nextConds = [...(p.conditions || [])];
                          nextConds[idx] = { ...nextConds[idx], name: val };
                          return { ...p, conditions: nextConds };
                        });
                      }}
                    />
                    <IconButton size="small" onClick={() => updatePf((p) => ({ ...p, conditions: p.conditions?.filter((_, i) => i !== idx) }))}>
                      <DeleteOutlineIcon color="error" fontSize="small" />
                    </IconButton>
                  </Stack>
                ))}
              </Stack>
            </Box>
          )}

          {/* TAB 4: PAYMENT */}
          {tab === "payment" && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography
                  variant="subtitle2"
                  sx={{
                    color: "text.secondary",
                    fontWeight: 600,
                    letterSpacing: 0.3,
                    mb: 0.5,
                  }}
                >
                  Ödeme Bilgileri
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Bu bilgiler PDF çıktısında "Ödeme Detayları" tablosunda görünecek.
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  label="Unvan"
                  fullWidth
                  size="small"
                  value={pf.pay_title ?? ""}
                  onChange={(e) => update(["pay_title"], e.target.value)}
                  placeholder="Örn: ASEL AYDINLATMA MALZEMELERİ SAN. TİC. LTD. ŞTİ."
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  label="Banka"
                  fullWidth
                  size="small"
                  value={pf.bank ?? ""}
                  onChange={(e) => update(["bank"], e.target.value)}
                  placeholder="Örn: Yapı Kredi"
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  label="IBAN"
                  fullWidth
                  size="small"
                  value={pf.iban ?? ""}
                  onChange={(e) => update(["iban"], e.target.value)}
                  placeholder="TR00 0000 0000 0000 0000 0000 00"
                  inputProps={{
                    style: {
                      fontFamily: "monospace",
                      letterSpacing: 0.5,
                    },
                  }}
                />
              </Grid>
            </Grid>
          )}
        </Paper>
      </Container>

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        message={snack.message}
      />
    </Box>
  );
}