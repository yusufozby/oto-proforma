import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AppBar, Toolbar, Box, Typography, IconButton, Button, TextField, InputAdornment,
  Container, Card, Chip, Alert, Stack, CircularProgress,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer, Paper,
} from "@mui/material";
import ElectricBoltIcon from "@mui/icons-material/ElectricBolt";
import SettingsIcon from "@mui/icons-material/Settings";
import LogoutIcon from "@mui/icons-material/Logout";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DownloadIcon from "@mui/icons-material/Download";
import ShareIcon from "@mui/icons-material/Share";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import ChecklistIcon from "@mui/icons-material/Checklist";
import TuneIcon from "@mui/icons-material/Tune";
import { detectTripleTrigger, calcTotals, tl } from "../lib/helpers";
import { downloadProformaPdf, shareProformaPdf } from "../lib/exports";
import { storeGet, storeSet } from "../lib/storage";
import type { Proforma, Session } from "../types";

interface DashboardProps {
  session: Session;
  onLogout: () => void;
}

export default function Dashboard({ session, onLogout }: DashboardProps) {
  const navigate = useNavigate();
  const [proformas, setProformas] = useState<Proforma[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const showTripleSuggestion = detectTripleTrigger(query);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Proforma listesi App.tsx'ten gelmiyor — Dashboard kendi verisini kendisi yükler.
  // Her mount'ta (ör. /proforma/add'den geri dönünce) taze veri çekilmiş olur.
  useEffect(() => {
    (async () => {
      const list = await storeGet<Proforma[]>(`proformas:${session.username}`, []);
      setProformas(list);
      setLoading(false);
    })();
  }, [session.username]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return proformas;
    return proformas.filter((p) => {
      const inBuyer = p.buyer?.firma?.toLowerCase().includes(q);
      const inId = p.id.toLowerCase().includes(q);
      const inProducts = p.products?.some(
        (pr) => pr.isim.toLowerCase().includes(q) || pr.kod.toLowerCase().includes(q)
      );
      return inBuyer || inId || inProducts;
    });
  }, [proformas, query]);

  const handleDownload = async (p: Proforma) => {
    setDownloadingId(p.id);
    try {
      await downloadProformaPdf(p);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    const next = proformas.filter((p) => p.id !== id);
    setProformas(next);
    await storeSet(`proformas:${session.username}`, next);
  };

  return (
    <Box sx={{ minHeight: 600 }}>
      <AppBar position="sticky">
        <Toolbar sx={{ maxWidth: 1200, width: "100%", mx: "auto" }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexGrow: 1 }}>
            <ElectricBoltIcon color="primary" />
            <Typography variant="h6">Oto Proforma</Typography>
          </Stack>
          <Box sx={{ textAlign: "right", display: { xs: "none", sm: "block" }, mr: 1.5 }}>
            <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
              <Typography variant="body2" fontWeight={600}>{session.name}</Typography>
              {session.role === "admin" && (
                <Chip size="small" color="primary" icon={<AdminPanelSettingsIcon sx={{ fontSize: 14 }} />} label="Admin" />
              )}
            </Stack>
            <Typography variant="caption" color="text.secondary">{session.seller.firma}</Typography>
          </Box>
          <IconButton onClick={() => navigate("/account-settings")} title="Hesap Ayarları"><SettingsIcon /></IconButton>
          {session.role === "admin" && (
            <IconButton onClick={() => navigate("/product-field-add")} title="Dinamik Alan Ekle"><TuneIcon /></IconButton>
          )}
          <IconButton onClick={onLogout} title="Çıkış Yap"><LogoutIcon /></IconButton>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={2} sx={{ mb: 3 }}>
          <Box>
            <Typography variant="h4">Proformalar</Typography>
            <Typography variant="body2" color="text.secondary">{proformas.length} kayıt · panelinize hoş geldiniz</Typography>
          </Box>
          <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={() => navigate("/proforma/add")}>
            Yeni Proforma
          </Button>
        </Stack>

        <TextField
          fullWidth
          size="small"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Proforma, ürün veya firma ara…"
          sx={{ mb: 1.5 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        />

        {showTripleSuggestion && (
          <Alert
            icon={<AutoAwesomeIcon fontSize="small" />}
            severity="warning"
            sx={{ mb: 3 }}
            action={
              <Button size="small" variant="contained" color="secondary" onClick={() => setQuery("3'lü Beyaz Fiş")}>
                Bununla ara
              </Button>
            }
          >
            Bunu mu demek istediniz: <b>3'lü Beyaz Fiş</b>
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
            <CircularProgress size={22} thickness={5} />
          </Box>
        ) : filtered.length === 0 ? (
          <Card variant="outlined" sx={{ py: 8, textAlign: "center" }}>
            <ChecklistIcon sx={{ fontSize: 32, color: "text.secondary", mb: 1 }} />
            <Typography fontWeight={600}>{proformas.length === 0 ? "Henüz proforma yok" : "Sonuç bulunamadı"}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {proformas.length === 0 ? "İlk proformanızı oluşturarak başlayın." : "Farklı bir arama deneyin."}
            </Typography>
            {proformas.length === 0 && (
              <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={() => navigate("/proforma/add")}>Yeni Proforma</Button>
            )}
          </Card>
        ) : (
          <TableContainer component={Paper} variant="outlined" sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 720 }}>
              <TableHead>
                <TableRow sx={{ bgcolor: "#EAE6DA" }}>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>Kod</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>Müşteri</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>Oluşturulduğu Tarih</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>Toplam Fiyat</TableCell>
                  <TableCell align="center" sx={{ whiteSpace: "nowrap" }}>İskonto</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>İşlemler</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((p) => {
                  const { total } = calcTotals(p);
                  return (
                    <TableRow key={p.id} hover>
                      <TableCell className="mono" sx={{ whiteSpace: "nowrap" }}>{p.id}</TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>{p.buyer?.firma || "İsimsiz Alıcı"}</TableCell>
                      <TableCell className="mono" sx={{ whiteSpace: "nowrap" }}>{p.tarih}</TableCell>
                      <TableCell align="right" className="mono" sx={{ whiteSpace: "nowrap", fontWeight: 600 }}>{tl(total)}</TableCell>
                      <TableCell align="center" sx={{ whiteSpace: "nowrap" }}>
                        {p.iskontoEtkin ? (
                          <Chip size="small" color="primary" label={`%${p.iskonto || 0}`} />
                        ) : (
                          <Chip size="small" label="—" sx={{ bgcolor: "#EAE6DA", color: "text.secondary" }} />
                        )}
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                        <IconButton size="small" onClick={() => handleDownload(p)} disabled={downloadingId === p.id} title="PDF indir">
                          <DownloadIcon fontSize="small" color="primary" />
                        </IconButton>
                        <IconButton size="small" onClick={() => navigate(`/proforma/edit/${p.id}`)} title="Düzenle">
                          <EditOutlinedIcon fontSize="small" color="secondary" />
                        </IconButton>
                        <IconButton size="small" onClick={() => shareProformaPdf(p)} title="Paylaş">
                          <ShareIcon fontSize="small" color="primary" />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleDelete(p.id)} title="Sil">
                          <DeleteOutlineIcon fontSize="small" color="error" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Container>
    </Box>
  );
}
