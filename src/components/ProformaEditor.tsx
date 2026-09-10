
import React, { useEffect, useMemo, useRef, useState } from "react";

import { useNavigate, useParams, Navigate } from "react-router-dom";

import {
  AppBar,
  Toolbar,
  Box,
  Container,
  Typography,
  Button,
  IconButton,
  TextField,
  Grid,
  Tabs,
  Tab,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  Chip,
  Snackbar,
  Divider,
  Stack,
  InputAdornment,
  CircularProgress,
} from "@mui/material";

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SaveIcon from "@mui/icons-material/Save";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import ChecklistIcon from "@mui/icons-material/Checklist";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import AddIcon from "@mui/icons-material/Add";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CloseIcon from "@mui/icons-material/Close";
import LockIcon from "@mui/icons-material/Lock";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import SearchIcon from "@mui/icons-material/Search";

import { calcTotals, tl, structuredCloneLite } from "../lib/helpers";
import { parseExcelToProducts } from "../lib/excelImport";
import { baseApi } from "../lib/storage";

import type { Product, Proforma, Session } from "../types";

interface ProformaEditorProps {
  session: Session;
  isEdit: boolean;
}

type TabKey = "buyer" | "products" | "conditions" | "payment";

const TABS: {
  key: TabKey;
  label: string;
  icon: React.ReactElement;
}[] = [
    {
      key: "buyer",
      label: "Alıcı",
      icon: <PeopleAltIcon fontSize="small" />,
    },
    {
      key: "products",
      label: "Ürünler",
      icon: <Inventory2Icon fontSize="small" />,
    },
    {
      key: "conditions",
      label: "Şartlar",
      icon: <ChecklistIcon fontSize="small" />,
    },
    {
      key: "payment",
      label: "Ödeme",
      icon: <CreditCardIcon fontSize="small" />,
    },
  ];

type ColumnKey =
  | "image"
  | "code"
  | "name"
  | "gtype"
  | "parcel"
  | "parcel_inside"
  | "totalNumber"
  | "unit"
  | "totalPrice";

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
  {
    key: "image",
    label: "Görsel",
    align: "center",
    defaultOpen: true,
    editable: false,
  },
  {
    key: "code",
    label: "Kod",
    align: "left",
    defaultOpen: false,
    mono: true,
    editable: true,
  },
  {
    key: "name",
    label: "İsim",
    align: "left",
    defaultOpen: true,
    editable: true,
  },
  {
    key: "gtype",
    label: "GTİP",
    align: "center",
    defaultOpen: false,
    mono: true,
    editable: true,
  },
  {
    key: "parcel",
    label: "Koli",
    align: "center",
    defaultOpen: true,
    mono: true,
    editable: true,
    numeric: true,
  },
  {
    key: "parcel_inside",
    label: "Koli İçi",
    align: "center",
    defaultOpen: true,
    mono: true,
    editable: true,
    numeric: true,
  },
  {
    key: "totalNumber",
    label: "Toplam",
    align: "center",
    defaultOpen: true,
    mono: true,
    editable: false,
  },
  {
    key: "unit",
    label: "Birim ₺",
    align: "right",
    defaultOpen: false,
    mono: true,
    editable: true,
    numeric: true,
  },
  {
    key: "totalPrice",
    label: "Toplam ₺",
    align: "right",
    defaultOpen: true,
    mono: true,
    editable: false,
  },
];

/**
 * editable = admin bu alanı doğrudan tablodaki TextField'dan değiştirebilir.
 * totalNumber ve totalPrice hesaplanır, edit edilemez.
 */
const FIELD_BY_COLUMN: Partial<
  Record<ColumnKey, keyof Product | "totalNumber" | "totalPrice">
> = {
  code: "code",
  name: "name",
  gtype: "gtype",
  parcel: "parcel",
  parcel_inside: "parcel_inside",
  totalNumber: "totalNumber",
  unit: "unit",
  totalPrice: "totalPrice",
};

function initialColumnState(): Record<ColumnKey, boolean> {
  const s = {} as Record<ColumnKey, boolean>;

  COLUMNS.forEach((c) => {
    s[c.key] = c.defaultOpen;
  });

  return s;
}

export default function ProformaEditor({
  session,
  isEdit,
}: ProformaEditorProps) {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [pf, setPf] = useState<Proforma | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);

  const [tab, setTab] = useState<TabKey>("buyer");

  const [colOpen, setColOpen] = useState<
    Record<ColumnKey, boolean>
  >(initialColumnState());

  const [productFilter, setProductFilter] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const [snack, setSnack] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({
    open: false,
    message: "",
    severity: "success",
  });

  const [discountOpen, setDiscountOpen] = useState(false);

  useEffect(() => {
    if (pf && pf.discount !== 0) {
      setDiscountOpen(true);
    }
  }, [pf?.id]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [imageTargetId, setImageTargetId] = useState<number | null>(
    null
  );

  const handleImageBoxClick = (rowId: number) => {
    setImageTargetId(rowId);
    imageInputRef.current?.click();
  };

  const handleImageFileChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];

    e.target.value = "";

    if (!file || imageTargetId == null) {
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      updateProductField(
        imageTargetId,
        "image",
        reader.result as string,
        false
      );
    };

    reader.readAsDataURL(file);
  };

  /*
   * PROFORMA YÜKLEME
   */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (isEdit) {
        if (!id) {
          if (!cancelled) {
            setNotFound(true);
          }

          return;
        }

        try {
          const response = await fetch(
            `${baseApi}/api/proforma/get/${id}`,
            {
              headers: {
                Authorization: `Bearer ${session.token}`,
              },
            }
          );

          if (!response.ok) {
            if (!cancelled) {
              setNotFound(true);
            }

            return;
          }

          const json = await response.json();

          if (cancelled) {
            return;
          }

          if (!json) {
            setNotFound(true);
            return;
          }

          setPf(json);
        } catch {
          if (!cancelled) {
            setNotFound(true);
          }
        }
      } else {
        /*
         * YENİ PROFORMA
         */
        if (!cancelled) {
          setPf({
            conditions: [],
            discount: 0,
            products: [],
            user_id: session.role === "admin" ? 1 : 2,
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, isEdit, session.username, session.token, session.role]);

  /*
   * PF GÜNCELLEME
   */
  const updatePf = (
    updater: (p: Proforma) => Proforma
  ) => {
    setPf((prev) => {
      if (!prev) {
        return prev;
      }

      return updater(prev);
    });
  };

  /*
   * GENEL FIELD UPDATE
   */
  const update = (
    path: (string | number)[],
    value: unknown
  ) => {
    updatePf((prev) => {
      const next = structuredCloneLite(prev) as unknown as Record<
        string,
        any
      >;

      let ref: Record<string, any> = next;

      for (let i = 0; i < path.length - 1; i++) {
        ref = ref[path[i]];
      }

      ref[path[path.length - 1]] = value;

      return next as unknown as Proforma;
    });
  };

  /*
   * SÜTUNLAR
   */
  const visibleColumns = COLUMNS.filter(
    (c) => colOpen[c.key]
  );

  const hiddenColumns = COLUMNS.filter(
    (c) => !colOpen[c.key]
  );

  const hideColumn = (key: ColumnKey) => {
    setColOpen((s) => ({
      ...s,
      [key]: false,
    }));
  };

  const showColumn = (key: ColumnKey) => {
    setColOpen((s) => ({
      ...s,
      [key]: true,
    }));
  };

  /*
   * BENZERSİZ GEÇİCİ PRODUCT ID
   *
   * Backend'den gelen ürünlerin ID'leri pozitif.
   * Yeni ürünler negatif ID alır.
   *
   * Örnek:
   * 1, 2, 3 -> yeni -1
   * 1, 2, 3, -1 -> yeni -2
   */
  const generateTempProductId = (
    products: Product[]
  ): number => {
    const ids = products
      .map((product) => Number(product.Id))
      .filter((productId) =>
        Number.isFinite(productId)
      );

    const minId =
      ids.length > 0
        ? Math.min(...ids)
        : 0;

    return Math.min(minId, 0) - 1;
  };

  /*
   * ELLE YENİ ÜRÜN EKLE
   */
  const addBlankProduct = () =>
    updatePf((p) => {
      const newId = generateTempProductId(
        p.products
      );

      const newProduct: Product = {
        code: "",
        DynamicValues: [],
        name: "",
        gtype: "",
        parcel: 0,
        parcel_inside: 0,
        unit: 0,
        image: "",
        Id: newId,
        proforma_id: p.id,
      };

      return {
        ...p,
        products: [
          ...p.products,
          newProduct,
        ],
      };
    });

  /*
   * PRODUCT SİL
   */
  const removeProduct = (id: number) =>
    updatePf((p) => ({
      ...p,
      products: p.products.filter(
        (r) => r.Id !== id
      ),
    }));

  /*
   * PRODUCT FIELD UPDATE
   *
   * numeric=true ise:
   * "10" -> 10
   * "25.50" -> 25.5
   * "" -> 0
   */
  const updateProductField = (
    id: number,
    field: keyof Product,
    value: string,
    numeric = false
  ) => {
    updatePf((p) => ({
      ...p,

      products: p.products.map((r) => {
        if (r.Id !== id) {
          return r;
        }

        let newValue: any = value;

        if (numeric) {
          if (value === "") {
            newValue = 0;
          } else {
            newValue = Number(value);

            if (!Number.isFinite(newValue)) {
              newValue = 0;
            }
          }
        }

        return {
          ...r,
          [field]: newValue,
        };
      }),
    }));
  };

  /*
   * ÜRÜN ARAMA
   */
  const filteredProducts = useMemo(() => {
    if (!pf) {
      return [];
    }

    const q = productFilter
      .trim()
      .toLowerCase();

    if (!q) {
      return pf.products;
    }

    return pf.products.filter((r) =>
      String(r.code ?? "")
        .toLowerCase()
        .includes(q) ||
      String(r.name ?? "")
        .toLowerCase()
        .includes(q)
    );
  }, [pf, productFilter]);

  /*
   * EXCEL
   */
  const handleExcelClick = () => {
    fileInputRef.current?.click();
  };

  const processExcelFile = async (
    file: File
  ) => {
    const okExt =
      /\.(xlsx|xls|csv)$/i.test(
        file.name
      );

    if (!okExt) {
      setSnack({
        open: true,
        message:
          "Yalnızca .xlsx, .xls veya .csv dosyaları desteklenir.",
        severity: "error",
      });

      return;
    }

    try {
      const {
        products,
        skipped,
      } = await parseExcelToProducts(file);

      if (products.length === 0) {
        setSnack({
          open: true,
          message:
            "Excel dosyasında geçerli ürün bulunamadı.",
          severity: "error",
        });

        return;
      }

      /*
       * EXCEL ÜRÜNLERİNİN ID'LERİNİ NORMALİZE ET
       *
       * Excel'den gelen ürünlerde Id:
       * - yoksa
       * - null ise
       * - undefined ise
       * - geçersiz ise
       *
       * benzersiz negatif ID oluşturuyoruz.
       */
      updatePf((p) => {
        const existingProducts = [
          ...p.products,
        ];

        const normalizedProducts =
          products.map((product) => {
            const rawId = Number(
              product.Id
            );

            const hasValidId =
              product.Id !== undefined &&
              product.Id !== null &&
              Number.isFinite(rawId);

            if (hasValidId) {
              /*
               * Excel parser aynı ID'yi birden
               * fazla ürüne verdiyse burada da
               * çakışmayı engelle.
               */
              const alreadyExists =
                existingProducts.some(
                  (existing) =>
                    Number(existing.Id) ===
                    rawId
                );

              if (!alreadyExists) {
                const normalized = {
                  ...product,
                  Id: rawId,
                };

                existingProducts.push(
                  normalized
                );

                return normalized;
              }
            }

            /*
             * Yeni benzersiz ID
             */
            const newId =
              generateTempProductId(
                existingProducts
              );

            const normalized = {
              ...product,
              Id: newId,
            };

            existingProducts.push(
              normalized
            );

            return normalized;
          });

        return {
          ...p,
          products: [
            ...p.products,
            ...normalizedProducts,
          ],
        };
      });

      setSnack({
        open: true,
        message: `${products.length} ürün eklendi${skipped
          ? ` (${skipped} satır atlandı)`
          : ""
          }.`,
        severity: "success",
      });
    } catch {
      setSnack({
        open: true,
        message:
          "Excel dosyası okunamadı. Formatı kontrol edin.",
        severity: "error",
      });
    }
  };

  const handleExcelChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file =
      e.target.files?.[0];

    e.target.value = "";

    if (!file) {
      return;
    }

    await processExcelFile(file);
  };

  /*
   * DRAG & DROP
   */
  const handleDragOver = (
    e: React.DragEvent<HTMLDivElement>
  ) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (
    e: React.DragEvent<HTMLDivElement>
  ) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = async (
    e: React.DragEvent<HTMLDivElement>
  ) => {
    e.preventDefault();
    setDragOver(false);

    const file =
      e.dataTransfer.files?.[0];

    if (file) {
      await processExcelFile(file);
    }
  };

  /*
   * CONDITIONS
   */
  const addCondition = () =>
    updatePf((p) => ({
      ...p,
      conditions: [
        ...p.conditions,
        {
          name: "",
          proforma_id: pf?.id,
        },
      ],
    }));

  const updateCondition = (
    i: number,
    value: string
  ) =>
    updatePf((p) => ({
      ...p,
      conditions: p.conditions.map(
        (c, index) => {
          if (index === i) {
            return {
              ...c,
              name: value,
            };
          }

          return c;
        }
      ),
    }));

  const removeCondition = (
    i: number
  ) =>
    updatePf((p) => ({
      ...p,
      conditions:
        p.conditions.filter(
          (_, idx) => idx !== i
        ),
    }));

  /*
   * READ ONLY PRODUCT VALUE
   */
  const readOnlyValue = (
    r: Product,
    key: ColumnKey
  ) => {
    const totalAdet =
      (Number(r.parcel) || 0) *
      (Number(r.parcel_inside) || 0);

    switch (key) {
      case "code":
        return r.code || "—";

      case "name":
        return (
          r.name ||
          "İsimsiz ürün"
        );

      case "gtype":
        return r.gtype || "—";

      case "parcel":
        return String(
          r.parcel ?? 0
        );

      case "parcel_inside":
        return String(
          r.parcel_inside ?? 0
        );

      case "totalNumber":
        return String(totalAdet);

      case "unit":
        return tl(
          Number(r.unit) || 0
        );

      case "totalPrice":
        return tl(
          totalAdet *
          (Number(r.unit) || 0)
        );

      default:
        return "";
    }
  };

  /*
   * KAYDET
   */
  const handleSave = async () => {
    if (!pf) {
      return;
    }

    setSaving(true);

    try {
      const url = isEdit
        ? `${baseApi}/api/proforma/edit/${id}`
        : `${baseApi}/api/proforma/add`;

      const response =
        await fetch(url, {
          method: isEdit
            ? "PUT"
            : "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization: `Bearer ${session.token}`,
          },

          body: JSON.stringify(pf),
        });

      if (!response.ok) {
        setSnack({
          open: true,
          message:
            "Kaydedilemedi. Lütfen tekrar deneyin.",
          severity: "error",
        });

        return;
      }

      navigate("/dashboard");
    } catch {
      setSnack({
        open: true,
        message:
          "Bağlantı hatası. Lütfen tekrar deneyin.",
        severity: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  /*
   * NOT FOUND
   */
  if (notFound) {
    return (
      <Navigate
        to="/dashboard"
        replace
      />
    );
  }

  /*
   * LOADING
   */
  if (!pf) {
    return (
      <Box
        sx={{
          minHeight: 500,
          display: "flex",
          alignItems: "center",
          justifyContent:
            "center",
          gap: 1.5,
        }}
      >
        <CircularProgress
          size={20}
          thickness={5}
        />

        <Typography
          variant="body2"
          color="text.secondary"
        >
          yükleniyor…
        </Typography>
      </Box>
    );
  }

  const {
    araTotal,
    total,
  } = calcTotals(pf);

  return (
    <Box sx={{ minHeight: 600 }}>
      <AppBar position="sticky">
        <Toolbar
          sx={{
            maxWidth: 1200,
            width: "100%",
            mx: "auto",
            gap: 2,
          }}
        >
          <Button
            startIcon={
              <ArrowBackIcon />
            }
            onClick={() =>
              navigate("/dashboard")
            }
            color="inherit"
          >
            Panele Dön
          </Button>

          <Typography
            variant="body2"
            className="mono"
            color="text.secondary"
            sx={{
              flexGrow: 1,
              textAlign: "center",
            }}
          />

          <Button
            variant="contained"
            color="primary"
            startIcon={
              <SaveIcon />
            }
            onClick={handleSave}
            disabled={saving}
          >
            {saving
              ? "Kaydediliyor…"
              : "Kaydet"}
          </Button>
        </Toolbar>
      </AppBar>

      <Container
        maxWidth="lg"
        sx={{ py: 4 }}
      >
        <Paper
          variant="outlined"
          sx={{
            p: 2.5,
            mb: 3,
          }}
        >
          <Grid
            container
            spacing={2}
          >
            <Grid
              item
              xs={12}
              sm={6}
            >
              <TextField
                type="date"
                label="Tarih"
                fullWidth
                size="small"
                value={
                  pf.created_date ??
                  ""
                }
                onChange={(e) =>
                  update(
                    ["created_date"],
                    e.target.value
                  )
                }
                InputLabelProps={{
                  shrink: true,
                }}
              />
            </Grid>

            <Grid
              item
              xs={12}
              sm={6}
            >
              <TextField
                type="date"
                label="Geçerlilik"
                fullWidth
                size="small"
                value={
                  pf.validity_date ??
                  ""
                }
                onChange={(e) =>
                  update(
                    ["validity_date"],
                    e.target.value
                  )
                }
                InputLabelProps={{
                  shrink: true,
                }}
              />
            </Grid>
          </Grid>
        </Paper>

        <Alert
          severity="info"
          icon={
            <LockIcon fontSize="small" />
          }
          sx={{ mb: 3 }}
        >
          Satıcı bilgileri
          hesap ayarlarındaki
          firma profilinden otomatik
          alınır: -
        </Alert>

        <Tabs
          value={tab}
          onChange={(_, v) =>
            setTab(v)
          }
          sx={{
            mb: 2,
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          {TABS.map((t) => (
            <Tab
              key={t.key}
              value={t.key}
              label={t.label}
              icon={t.icon}
              iconPosition="start"
              sx={{
                minHeight: 48,
              }}
            />
          ))}
        </Tabs>

        <Paper
          variant="outlined"
          sx={{ p: 3 }}
        >
          {/*
           * BUYER
           */}
          {tab === "buyer" && (
            <Grid
              container
              spacing={2}
            >
              <Grid
                item
                xs={12}
                sm={6}
              >
                <TextField
                  label="Firma"
                  fullWidth
                  size="small"
                  value={
                    pf.buyer_name ??
                    ""
                  }
                  onChange={(e) =>
                    update(
                      ["buyer_name"],
                      e.target.value
                    )
                  }
                />
              </Grid>

              <Grid
                item
                xs={12}
                sm={6}
              >
                <TextField
                  label="İlçe / İl"
                  fullWidth
                  size="small"
                  value={
                    pf.province ??
                    ""
                  }
                  onChange={(e) =>
                    update(
                      ["province"],
                      e.target.value
                    )
                  }
                />
              </Grid>

              <Grid
                item
                xs={12}
                sm={6}
              >
                <TextField
                  label="Adres"
                  fullWidth
                  size="small"
                  value={
                    pf.address ?? ""
                  }
                  onChange={(e) =>
                    update(
                      ["address"],
                      e.target.value
                    )
                  }
                />
              </Grid>

              <Grid
                item
                xs={12}
                sm={6}
              >
                <TextField
                  label="Telefon"
                  fullWidth
                  size="small"
                  value={
                    pf.phone ?? ""
                  }
                  onChange={(e) =>
                    update(
                      ["phone"],
                      e.target.value
                    )
                  }
                />
              </Grid>

              <Grid
                item
                xs={12}
                sm={6}
              >
                <TextField
                  label="E-mail"
                  fullWidth
                  size="small"
                  value={
                    pf.buyer_email ??
                    ""
                  }
                  onChange={(e) =>
                    update(
                      ["buyer_email"],
                      e.target.value
                    )
                  }
                />
              </Grid>

              <Grid item xs={12}>
                <Divider
                  sx={{ my: 1 }}
                />
              </Grid>

              <Grid
                item
                xs={12}
                sm={6}
              >
                <TextField
                  label="Muhattap İsim"
                  fullWidth
                  size="small"
                  value={
                    pf.interlocuter_name ??
                    ""
                  }
                  onChange={(e) =>
                    update(
                      [
                        "interlocuter_name",
                      ],
                      e.target.value
                    )
                  }
                />
              </Grid>

              <Grid
                item
                xs={12}
                sm={6}
              >
                <TextField
                  label="Muhattap Ünvan"
                  fullWidth
                  size="small"
                  value={
                    pf.interlocuter_title ??
                    ""
                  }
                  onChange={(e) =>
                    update(
                      [
                        "interlocuter_title",
                      ],
                      e.target.value
                    )
                  }
                />
              </Grid>

              <Grid
                item
                xs={12}
                sm={6}
              >
                <TextField
                  label="Muhattap Telefon"
                  fullWidth
                  size="small"
                  value={
                    pf.interlocuter_phone ??
                    ""
                  }
                  onChange={(e) =>
                    update(
                      [
                        "interlocuter_phone",
                      ],
                      e.target.value
                    )
                  }
                />
              </Grid>

              <Grid
                item
                xs={12}
                sm={6}
              >
                <TextField
                  label="Muhattap E-mail"
                  fullWidth
                  size="small"
                  value={
                    pf.interlocuter_email ??
                    ""
                  }
                  onChange={(e) =>
                    update(
                      [
                        "interlocuter_email",
                      ],
                      e.target.value
                    )
                  }
                />
              </Grid>
            </Grid>
          )}

          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={
              handleImageFileChange
            }
          />

          {/*
           * PRODUCTS
           */}
          {tab === "products" && (
            <Box>
              <Paper
                variant="outlined"
                onClick={
                  handleExcelClick
                }
                onDragOver={
                  handleDragOver
                }
                onDragLeave={
                  handleDragLeave
                }
                onDrop={
                  handleDrop
                }
                sx={{
                  mb: 2.5,
                  p: 3,
                  textAlign: "center",
                  cursor: "pointer",
                  borderStyle:
                    "dashed",
                  borderWidth: 2,
                  borderColor:
                    dragOver
                      ? "primary.main"
                      : "divider",
                  bgcolor:
                    dragOver
                      ? "rgba(181,101,29,0.06)"
                      : "#FAF9F5",
                  borderRadius: 2,
                  transition:
                    "all .15s",
                  display: "flex",
                  flexDirection: {
                    xs: "column",
                    sm: "row",
                  },
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                  gap: 1.5,
                }}
              >
                <UploadFileIcon
                  color={
                    dragOver
                      ? "primary"
                      : "action"
                  }
                  sx={{
                    fontSize: 30,
                  }}
                />

                <Box
                  sx={{
                    textAlign: {
                      xs: "center",
                      sm: "left",
                    },
                  }}
                >
                  <Typography
                    fontWeight={600}
                    color={
                      dragOver
                        ? "primary.main"
                        : "text.primary"
                    }
                  >
                    Excel dosyasını
                    buraya sürükleyin
                  </Typography>

                  <Typography
                    variant="caption"
                    color="text.secondary"
                  >
                    veya tıklayarak
                    seçin — .xlsx,
                    .xls, .csv ·
                    sütunlar: Kod,
                    İsim, GTİP, Koli
                    Sayısı, Koli İçi
                    Adet, Birim
                  </Typography>
                </Box>

                <input
                  ref={
                    fileInputRef
                  }
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  hidden
                  onChange={
                    handleExcelChange
                  }
                />
              </Paper>

              <TextField
                size="small"
                fullWidth
                value={
                  productFilter
                }
                onChange={(e) =>
                  setProductFilter(
                    e.target.value
                  )
                }
                placeholder="Kod veya isimde ara…"
                sx={{ mb: 2 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />

              {hiddenColumns.length >
                0 && (
                  <Stack
                    direction="row"
                    spacing={1}
                    flexWrap="wrap"
                    useFlexGap
                    sx={{
                      mb: 1.5,
                    }}
                  >
                    {hiddenColumns.map(
                      (c) => (
                        <Chip
                          key={c.key}
                          label={c.label}
                          size="small"
                          variant="outlined"
                          icon={
                            <VisibilityOutlinedIcon fontSize="small" />
                          }
                          onClick={() =>
                            showColumn(
                              c.key
                            )
                          }
                          sx={{
                            cursor:
                              "pointer",
                          }}
                        />
                      )
                    )}
                  </Stack>
                )}

              <Typography
                variant="overline"
                color="text.secondary"
              >
                {productFilter
                  ? `${filteredProducts.length} / ${pf.products.length}`
                  : pf.products.length}{" "}
                ürün
              </Typography>

              <TableContainer
                component={Paper}
                variant="outlined"
                sx={{
                  overflowX:
                    "auto",
                }}
              >
                <Table
                  size="small"
                  sx={{
                    minWidth: 780,
                  }}
                >
                  <TableHead>
                    <TableRow
                      sx={{
                        bgcolor:
                          "#EAE6DA",
                      }}
                    >
                      {visibleColumns.map(
                        (c) => (
                          <TableCell
                            key={c.key}
                            align={c.align}
                            sx={{
                              whiteSpace:
                                "nowrap",
                            }}
                          >
                            <Stack
                              direction="row"
                              spacing={0.25}
                              alignItems="center"
                              flexWrap="nowrap"
                              justifyContent={
                                c.align ===
                                  "right"
                                  ? "flex-end"
                                  : c.align ===
                                    "center"
                                    ? "center"
                                    : "flex-start"
                              }
                            >
                              <span
                                style={{
                                  whiteSpace:
                                    "nowrap",
                                }}
                              >
                                {c.label}
                              </span>

                              <IconButton
                                size="small"
                                onClick={() =>
                                  hideColumn(
                                    c.key
                                  )
                                }
                                title={`${c.label} alanını gizle`}
                              >
                                <VisibilityOffOutlinedIcon
                                  fontSize="inherit"
                                  sx={{
                                    color:
                                      "text.secondary",
                                  }}
                                />
                              </IconButton>
                            </Stack>
                          </TableCell>
                        )
                      )}

                      <TableCell
                        sx={{
                          whiteSpace:
                            "nowrap",
                        }}
                      />
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {pf.products.length ===
                      0 && (
                        <TableRow>
                          <TableCell
                            colSpan={
                              visibleColumns.length +
                              1
                            }
                            align="center"
                            sx={{
                              py: 5,
                              color:
                                "text.secondary",
                            }}
                          >
                            Henüz ürün
                            eklenmedi.
                          </TableCell>
                        </TableRow>
                      )}

                    {pf.products.length >
                      0 &&
                      filteredProducts.length ===
                      0 && (
                        <TableRow>
                          <TableCell
                            colSpan={
                              visibleColumns.length +
                              1
                            }
                            align="center"
                            sx={{
                              py: 5,
                              color:
                                "text.secondary",
                            }}
                          >
                            Aramanızla
                            eşleşen ürün
                            yok.
                          </TableCell>
                        </TableRow>
                      )}

                    {filteredProducts.map(
                      (r) => (
                        <TableRow
                          key={r.Id}
                          hover
                        >
                          {visibleColumns.map(
                            (c) => {
                              const field =
                                FIELD_BY_COLUMN[
                                c.key
                                ];

                              /*
                               * GÖRSEL
                               */
                              if (
                                c.key ===
                                "image"
                              ) {
                                return (
                                  <TableCell
                                    key={
                                      c.key
                                    }
                                    align="center"
                                  >
                                    <Box
                                      onClick={() =>
                                        handleImageBoxClick(
                                          r.Id
                                        )
                                      }
                                      sx={{
                                        width: 70,
                                        height: 70,
                                        borderRadius: 1.5,
                                        border:
                                          "1px dashed",
                                        borderColor:
                                          "divider",
                                        display:
                                          "flex",
                                        alignItems:
                                          "center",
                                        justifyContent:
                                          "center",
                                        cursor:
                                          "pointer",
                                        overflow:
                                          "hidden",
                                        bgcolor:
                                          "#FAF9F5",
                                        mx: "auto",

                                        backgroundImage:
                                          r.image
                                            ? `url(${r.image})`
                                            : undefined,

                                        backgroundSize:
                                          "cover",

                                        backgroundPosition:
                                          "center",
                                      }}
                                    >
                                      {!r.image && (
                                        <UploadFileIcon
                                          sx={{
                                            color:
                                              "text.secondary",
                                          }}
                                          fontSize="small"
                                        />
                                      )}
                                    </Box>
                                  </TableCell>
                                );
                              }

                              /*
                               * EDİT EDİLEBİLEN ALAN
                               */
                              if (
                                c.editable &&
                                field
                              ) {
                                const currentValue =
                                  r[
                                  field as keyof Product
                                  ];

                                return (
                                  <TableCell
                                    key={
                                      c.key
                                    }
                                    align={
                                      c.align
                                    }
                                    sx={{
                                      minWidth:
                                        c.numeric
                                          ? 90
                                          : 150,
                                      whiteSpace:
                                        "nowrap",
                                    }}
                                  >
                                    <TextField
                                      variant="outlined"
                                      fullWidth
                                      size="small"
                                      type={
                                        c.numeric
                                          ? "number"
                                          : "text"
                                      }

                                      /*
                                       * BURASI ÖNEMLİ
                                       *
                                       * 0 değerini kaybetmemek
                                       * için || yerine ?? kullanıyoruz.
                                       */
                                      value={
                                        currentValue ??
                                        ""
                                      }

                                      onChange={(
                                        e
                                      ) =>
                                        updateProductField(
                                          r.Id,
                                          field as keyof Product,
                                          e.target.value,
                                          c.numeric ===
                                          true
                                        )
                                      }

                                      className={
                                        c.mono
                                          ? "mono"
                                          : undefined
                                      }

                                      inputProps={{
                                        style: {
                                          textAlign:
                                            c.align,
                                        },

                                        ...(c.numeric
                                          ? {
                                            min: 0,
                                            step:
                                              c.key ===
                                                "unit"
                                                ? "0.01"
                                                : "1",
                                          }
                                          : {}),
                                      }}

                                      sx={{
                                        "& .MuiOutlinedInput-root":
                                        {
                                          fontSize: 13,
                                        },

                                        "& .MuiOutlinedInput-input":
                                        {
                                          py: 0.75,
                                          px: 1,
                                        },
                                      }}
                                    />
                                  </TableCell>
                                );
                              }

                              /*
                               * READ ONLY
                               */
                              return (
                                <TableCell
                                  key={
                                    c.key
                                  }
                                  align={
                                    c.align
                                  }
                                  className={
                                    c.mono
                                      ? "mono"
                                      : undefined
                                  }
                                  sx={{
                                    fontWeight:
                                      c.key ===
                                        "totalPrice"
                                        ? 600
                                        : 400,

                                    whiteSpace:
                                      "nowrap",
                                  }}
                                >
                                  {readOnlyValue(
                                    r,
                                    c.key
                                  )}
                                </TableCell>
                              );
                            }
                          )}

                          <TableCell
                            align="right"
                            sx={{
                              whiteSpace:
                                "nowrap",
                            }}
                          >
                            <IconButton
                              size="small"
                              onClick={() =>
                                removeProduct(
                                  r.Id
                                )
                              }
                              title="Sil"
                            >
                              <DeleteOutlineIcon
                                fontSize="small"
                                color="error"
                              />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      )
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{
                  my: 1.5,
                }}
                flexWrap="wrap"
                gap={1}
              >
                <Button
                  size="small"
                  variant="outlined"
                  color="primary"
                  startIcon={
                    <AddIcon />
                  }
                  onClick={
                    addBlankProduct
                  }
                >
                  Elle Ürün Ekle
                </Button>
              </Stack>

              {/*
               * DISCOUNT + TOTAL
               */}
              <Box
                sx={{
                  maxWidth: 300,
                  ml: "auto",
                  mt: 3,
                }}
              >
                <Accordion
                  expanded={
                    discountOpen
                  }
                  onChange={(
                    _,
                    expanded
                  ) => {
                    setDiscountOpen(
                      expanded
                    );

                    if (!expanded) {
                      update(
                        ["discount"],
                        0
                      );
                    }
                  }}
                  disableGutters
                  variant="outlined"
                  sx={{
                    mb: 2,

                    "&:before": {
                      display:
                        "none",
                    },

                    bgcolor:
                      discountOpen
                        ? "background.paper"
                        : "#EAE6DA",

                    borderColor:
                      discountOpen
                        ? "divider"
                        : "#DCD8CC",
                  }}
                >
                  <AccordionSummary
                    expandIcon={
                      <ExpandMoreIcon
                        sx={{
                          color:
                            discountOpen
                              ? "primary.main"
                              : "text.secondary",
                        }}
                      />
                    }
                  >
                    <Stack
                      direction="row"
                      spacing={1.5}
                      alignItems="center"
                      sx={{
                        width:
                          "100%",
                      }}
                    >
                      <Typography
                        fontWeight={
                          600
                        }
                        color={
                          discountOpen
                            ? "text.primary"
                            : "text.secondary"
                        }
                      >
                        İskonto
                      </Typography>

                      <Chip
                        size="small"
                        label={
                          discountOpen
                            ? `%${pf.discount ||
                            0
                            }`
                            : "kapalı"
                        }
                        color={
                          discountOpen
                            ? "primary"
                            : "default"
                        }
                        sx={{
                          ml: "auto",
                        }}
                      />
                    </Stack>
                  </AccordionSummary>

                  <AccordionDetails>
                    <Stack spacing={1.5}>
                      <TextField
                        label="İskonto Yüzdesi (%)"
                        type="number"
                        size="small"
                        fullWidth
                        value={
                          pf.discount ??
                          0
                        }
                        onChange={(e) =>
                          update(
                            ["discount"],
                            Number(
                              e.target
                                .value
                            )
                          )
                        }
                      />

                      <Button
                        size="small"
                        color="error"
                        startIcon={
                          <CloseIcon />
                        }
                        onClick={() => {
                          update(
                            [
                              "discount",
                            ],
                            0
                          );

                          setDiscountOpen(
                            false
                          );
                        }}
                      >
                        Kaldır
                      </Button>
                    </Stack>
                  </AccordionDetails>
                </Accordion>

                <Stack
                  direction="row"
                  justifyContent="space-between"
                  sx={{ mb: 1 }}
                >
                  <Typography
                    variant="body2"
                    color="text.secondary"
                  >
                    Ara Toplam
                  </Typography>

                  <Typography
                    className="mono"
                    fontWeight={600}
                  >
                    {tl(araTotal)}
                  </Typography>
                </Stack>

                <Divider
                  sx={{ mb: 1 }}
                />

                <Stack
                  direction="row"
                  justifyContent="space-between"
                >
                  <Typography variant="h6">
                    Toplam
                  </Typography>

                  <Typography
                    variant="h6"
                    className="mono"
                  >
                    {tl(total)}
                  </Typography>
                </Stack>
              </Box>
            </Box>
          )}

          {/*
           * CONDITIONS
           */}
          {tab === "conditions" && (
            <Stack spacing={1.5}>
              {pf.conditions.map(
                (c, i) => (
                  <Stack
                    key={i}
                    direction="row"
                    spacing={1}
                    alignItems="center"
                  >
                    <Typography
                      variant="body2"
                      className="mono"
                      color="text.secondary"
                      sx={{
                        width: 20,
                      }}
                    >
                      {i + 1}.
                    </Typography>

                    <TextField
                      fullWidth
                      size="small"
                      value={
                        c.name ?? ""
                      }
                      onChange={(e) =>
                        updateCondition(
                          i,
                          e.target
                            .value
                        )
                      }
                    />

                    <IconButton
                      size="small"
                      onClick={() =>
                        removeCondition(
                          i
                        )
                      }
                    >
                      <CloseIcon
                        fontSize="small"
                        color="error"
                      />
                    </IconButton>
                  </Stack>
                )
              )}

              <Box>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={
                    <AddIcon />
                  }
                  onClick={
                    addCondition
                  }
                >
                  Madde Ekle
                </Button>
              </Box>
            </Stack>
          )}

          {/*
           * PAYMENT
           */}
          {tab === "payment" && (
            <Grid
              container
              spacing={2}
            >
              <Grid
                item
                xs={12}
                sm={6}
              >
                <TextField
                  label="Ünvan"
                  fullWidth
                  size="small"
                  value={
                    pf.pay_title ??
                    ""
                  }
                  onChange={(e) =>
                    update(
                      ["pay_title"],
                      e.target.value
                    )
                  }
                />
              </Grid>

              <Grid
                item
                xs={12}
                sm={6}
              >
                <TextField
                  label="Banka"
                  fullWidth
                  size="small"
                  value={
                    pf.bank ?? ""
                  }
                  onChange={(e) =>
                    update(
                      ["bank"],
                      e.target.value
                    )
                  }
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  label="IBAN"
                  fullWidth
                  size="small"
                  className="mono"
                  value={
                    pf.iban ?? ""
                  }
                  onChange={(e) =>
                    update(
                      ["iban"],
                      e.target.value
                    )
                  }
                />
              </Grid>
            </Grid>
          )}
        </Paper>
      </Container>

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() =>
          setSnack((s) => ({
            ...s,
            open: false,
          }))
        }
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "center",
        }}
      >
        <Alert
          severity={
            snack.severity
          }
          onClose={() =>
            setSnack((s) => ({
              ...s,
              open: false,
            }))
          }
          sx={{
            width: "100%",
          }}
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}


