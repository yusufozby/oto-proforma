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

// --- Model Tanımlamaları ---
export interface Product {
  Id: number;
  name: string;
  code: string;
  gtype?: string;
  parcel_inside?: number;
  image?: string;
  unit?: number;
  DynamicValues?: any[];
}

export interface ProductProforma {
  Id: number;
  proforma_id: number;
  product_id: number;
  parcel?: number;
  Product: Product;
}

export interface Proforma {
  id?: number;
  user_id?: number;
  buyer_name?: string;
  province?: string;
  address?: string;
  phone?: string;
  buyer_email?: string;
  interlocuter_name?: string;
  interlocuter_title?: string;
  interlocuter_phone?: string;
  interlocuter_email?: string;
  created_date?: string;
  validity_date?: string;
  discount?: number;
  conditions?: { id?: number; name: string; proforma_id?: number }[];
  proformaProducts: ProductProforma[];
}

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

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function fuzzySearchProducts(products: Product[], query: string): Product[] {
  const normQuery = normalizeTR(query);
  if (!normQuery) return [];

  const queryTokens = normQuery.split(/\s+/).filter(Boolean);

  const scored = products.map((product) => {
    const normName = normalizeTR(product.name || "");
    const normCode = normalizeTR(product.code || "");

    if (normCode.includes(normQuery) || normName.includes(normQuery)) {
      return { product, score: 100 };
    }

    let tokenMatches = 0;
    queryTokens.forEach((token) => {
      if (normName.includes(token) || normCode.includes(token)) tokenMatches++;
    });

    if (tokenMatches > 0) {
      return { product, score: 70 + (tokenMatches / queryTokens.length) * 20 };
    }

    const distName = levenshteinDistance(normQuery, normName.slice(0, normQuery.length + 3));
    if (distName <= 2) {
      return { product, score: 50 - distName * 5 };
    }

    return { product, score: 0 };
  });

  return scored
    .filter((item) => item.score > 25)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.product);
}

function initialColumnState(): Record<ColumnKey, boolean> {
  const s = {} as Record<ColumnKey, boolean>;
  COLUMNS.forEach((c) => { s[c.key] = c.defaultOpen; });
  return s;
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

          setPf({ ...json, proformaProducts: json.proformaProducts ?? [] });
        } catch {
          if (!cancelled) setNotFound(true);
        }
      } else {
        if (!cancelled) {
          setPf({
            conditions: [],
            discount: 0,
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

  // Arama sonucunun sadece harf girildiğinde tetiklenmesi
  const searchResults = useMemo(() => {
    const query = searchQuery.trim();
    if (!query) return []; // Harf yoksa boş dizi döner
    return fuzzySearchProducts(dbProducts, query).slice(0, 10);
  }, [searchQuery, dbProducts]);

  // Menünün açılma koşulu: searchOpen true olmalı VE arama metni 0'dan büyük olmalı
  const isMenuOpen = searchOpen && searchQuery.trim().length > 0;

  const handleSelectProduct = (product: Product) => {
    updatePf((p) => {
      const exists = p.proformaProducts.some((item) => item.product_id === product.Id);
      if (exists) {
        setSnack({ open: true, message: "Bu ürün zaten listede ekli.", severity: "error" });
        return p;
      }

      const tempId = Math.min(0, ...p.proformaProducts.map((pp) => pp.Id)) - 1;
      const newProformaProduct: ProductProforma = {
        Id: tempId,
        proforma_id: p.id || 0,
        product_id: product.Id,
        parcel: 1,
        Product: product,
      };

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

  const handleSave = async () => {
    if (!pf) return;
    setSaving(true);

    try {
      const url = isEdit ? `${baseApi}/api/proforma/edit/${id}` : `${baseApi}/api/proforma/add`;
      const response = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` },
        body: JSON.stringify(pf),
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
                type="date" label="Tarih" fullWidth size="small"
                value={pf.created_date ?? ""}
                onChange={(e) => update(["created_date"], e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                type="date" label="Geçerlilik" fullWidth size="small"
                value={pf.validity_date ?? ""}
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
                <TextField label="Telefon" fullWidth size="small" value={pf.phone ?? ""} onChange={(e) => update(["phone"], e.target.value)} />
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
                <TextField label="Muhattap Telefon" fullWidth size="small" value={pf.interlocuter_phone ?? ""} onChange={(e) => update(["interlocuter_phone"], e.target.value)} />
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
                    inputRef={searchInputRef}
                    size="medium"
                    fullWidth
                    value={searchQuery}
                    onFocus={() => {
                      // Tıklandığında sadece metin varsa menüyü aç
                      if (searchQuery.trim().length > 0) setSearchOpen(true);
                    }}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSearchQuery(val);
                      // Sadece en az 1 karakter yazıldığında menüyü aç
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
                        borderRadius: "16px", // Sabit köşe kavisleri
                        bgcolor: "#FAF9F5",
                        transition: "all 0.2s ease-in-out",
                        "&.Mui-focused": {
                          bgcolor: "#FFFFFF",
                        },
                      },
                    }}
                  />

                  <Popper
                    open={isMenuOpen} // Sadece harf/kelime girildiğinde açık olur
                    anchorEl={searchInputRef.current}
                    placement="bottom-start"
                    modifiers={[
                      {
                        name: "offset",
                        options: {
                          offset: [0, 8], // Input ile menü arasına 8px boşluk
                        },
                      },
                    ]}
                    style={{
                      width: searchInputRef.current?.clientWidth,
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
                      }}
                    >
                      <Box sx={{ p: 1.5, px: 2, bgcolor: "#F5F5F7" }}>
                        <Typography
                          variant="caption"
                          fontWeight={600}
                          color="text.secondary"
                          sx={{ letterSpacing: 0.5 }}
                        >
                          ARAMA SONUÇLARI
                        </Typography>
                      </Box>

                      <List disablePadding sx={{ maxHeight: 360, overflowY: "auto" }}>
                        {searchResults.length === 0 ? (
                          <Box sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>
                            <Typography variant="body2">Eşleşen ürün bulunamadı.</Typography>
                          </Box>
                        ) : (
                          searchResults.map((prod, idx) => {
                            const isSelected = idx === selectedIndex;
                            return (
                              <ListItemButton
                                key={prod.Id}
                                selected={isSelected}
                                onClick={() => handleSelectProduct(prod)}
                                onMouseEnter={() => setSelectedIndex(idx)}
                                sx={{
                                  py: 1.2,
                                  px: 2,
                                  transition: "background-color 0.15s ease",
                                  "&.Mui-selected": { bgcolor: "rgba(0, 113, 227, 0.08)" },
                                  "&:hover": { bgcolor: "rgba(0, 0, 0, 0.04)" },
                                }}
                              >
                                <ListItemAvatar>
                                  <Avatar
                                    src={resolveImageUrl(prod.image, baseApi)}
                                    variant="rounded"
                                    sx={{ width: 44, height: 44, bgcolor: "#F2F2F7", borderRadius: "8px" }}
                                  >
                                    <SubtitlesIcon color="action" />
                                  </Avatar>
                                </ListItemAvatar>
                                <ListItemText
                                  primary={
                                    <Typography variant="body2" fontWeight={600} color="text.primary">
                                      {prod.name}
                                    </Typography>
                                  }
                                  secondary={
                                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                                      <Chip label={prod.code} size="small" variant="outlined" sx={{ height: 18, fontSize: 10 }} />
                                      {prod.unit && (
                                        <Typography variant="caption" color="text.secondary">
                                          {tl(prod.unit)}
                                        </Typography>
                                      )}
                                    </Stack>
                                  }
                                />
                                <AddIcon fontSize="small" color="action" />
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
                                  onChange={(e) => updateProductProformaField(item.Id, "parcel", e.target.value)}
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
                          <IconButton size="small" onClick={() => removeProformaProduct(item.Id)} title="Kaldır">
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
              <Grid item xs={12} sm={6}>
                <TextField
                  label="İndirim Oranı (%)" type="number" fullWidth size="small"
                  value={pf.discount ?? 0}
                  onChange={(e) => update(["discount"], Number(e.target.value))}
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