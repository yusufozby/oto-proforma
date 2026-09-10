import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AppBar, Toolbar, Box, Typography, IconButton, Button, TextField, InputAdornment,
  Container, Card, Chip, Alert, Stack, CircularProgress,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer, Paper,
  Avatar, Divider,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions
} from "@mui/material";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import EventNoteIcon from "@mui/icons-material/EventNote";
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
import { baseApi, storeGet, storeSet } from "../lib/storage";
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
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  // Silme Onay Modalı İçin State'ler
  const [deleteTarget, setDeleteTarget] = useState<Proforma | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch(`${baseApi}/api/Proforma/get`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.token}`,
            'Content-Type': 'application/json'
          }
        });

        const json = await response.json();
        setProformas(json);
      } catch (error) {
        console.error("Proformalar yüklenirken hata oluştu:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, [session.username, session.token]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return proformas;
    return proformas.filter((p) => {
      const inBuyer = p.buyer_name!.toLowerCase().includes(q);
      const inId = p.code!.toLowerCase().includes(q);
      const inProducts = p.products?.some(
        (pr) => pr.name.toLowerCase().includes(q) || pr.code.toLowerCase().includes(q)
      );
      return inBuyer || inId || inProducts;
    });
  }, [proformas, query]);

  const handleDownload = async (p: Proforma) => {
    setDownloadingId(p.id!);
    try {
      await downloadProformaPdf(p, session);
    } finally {
      setDownloadingId(null);
    }
  };

  // Modaldaki Sil butonuna basılınca çalışır
  const confirmDelete = async () => {
    if (!deleteTarget || !deleteTarget.id) return;

    setDeleting(true);
    try {
      const response = await fetch(`${baseApi}/api/proforma/delete/${deleteTarget.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const next = proformas.filter((p) => p.id !== deleteTarget.id);
        setProformas(next);
        await storeSet(`proformas:${session.username}`, next);
      } else {
        console.error("Silme başarısız oldu.");
      }
    } catch (error) {
      console.error("Silme hatası:", error);
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <Box sx={{ minHeight: 600 }}>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: 'background.paper',
          borderBottom: '1px solid',
          borderColor: 'divider',
          backdropFilter: 'blur(20px)',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
        }}
      >
        <Toolbar sx={{ maxWidth: 1400, width: "100%", mx: "auto", px: { xs: 2, md: 3 }, gap: 2 }}>
          {/* Logo ve Başlık */}
          <Stack
            direction="row"
            spacing={1.5}
            alignItems="center"
            sx={{
              flexGrow: 1,
              cursor: 'pointer',
              '&:hover': { opacity: 0.8 },
              transition: 'opacity 0.2s'
            }}
            onClick={() => navigate("/")}
          >
            <Box sx={{
              p: 1,
              borderRadius: 2,
              bgcolor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform 0.2s',
              '&:hover': { transform: 'scale(1.05)' }
            }}>
              <ElectricBoltIcon sx={{ color: 'white', fontSize: 28 }} />
            </Box>
            <Typography variant="h6" fontWeight={700} sx={{
              color: 'text.primary',
              letterSpacing: -0.5,
              display: { xs: 'none', sm: 'block' }
            }}>
              Oto Proforma
            </Typography>
            <Chip
              label="v2.0"
              size="small"
              sx={{
                height: 20,
                bgcolor: 'primary.light',
                color: 'primary.dark',
                fontWeight: 600,
                fontSize: '0.55rem',
                display: { xs: 'none', md: 'flex' },
                '& .MuiChip-label': { px: 1 }
              }}
            />
          </Stack>

          {/* Kullanıcı Bilgileri - Modern Kart */}
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            px: 2,
            py: 0.75,
            borderRadius: 3,
            bgcolor: 'action.hover',
            border: '1px solid transparent',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              bgcolor: 'action.selected',
              borderColor: 'primary.light',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            }
          }}>
            <Avatar
              sx={{
                width: 38,
                height: 38,
                bgcolor: session.role === "admin" ? 'secondary.main' : 'primary.main',
                fontWeight: 600,
                fontSize: 15,
                color: 'white',
                border: '2px solid',
                borderColor: 'background.paper',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                transition: 'transform 0.2s',
                '&:hover': { transform: 'scale(1.05)' }
              }}
            >
              {session.firm?.charAt(0).toUpperCase()}
            </Avatar>

            <Box sx={{ minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: 250 }}>
                  {session.firm}
                </Typography>
                {session.role === "admin" && (
                  <Chip
                    size="small"
                    color="primary"
                    icon={<AdminPanelSettingsIcon sx={{ fontSize: 13 }} />}
                    label="Admin"
                    sx={{
                      height: 20,
                      '& .MuiChip-label': { fontSize: '0.6rem', fontWeight: 600, px: 1 },
                      borderRadius: 1,
                      bgcolor: 'primary.main',
                      color: 'white',
                      '& .MuiChip-icon': { color: 'white !important' }
                    }}
                  />
                )}
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                '&::before': {
                  content: '""',
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  bgcolor: 'success.main',
                  display: 'inline-block'
                }
              }}>
                {session.username}
              </Typography>
            </Box>
          </Box>

          {/* Action Butonları */}
          <Stack direction="row" spacing={0.5} alignItems="center">
            <IconButton
              onClick={() => navigate("/account-settings")}
              title="Hesap Ayarları"
              sx={{
                color: 'text.secondary',
                '&:hover': {
                  bgcolor: 'action.hover',
                  color: 'primary.main',
                  transform: 'rotate(90deg)'
                },
                transition: 'all 0.3s'
              }}
            >
              <SettingsIcon fontSize="small" />
            </IconButton>

            {session.role === "admin" && (
              <IconButton
                onClick={() => navigate("/product-field-add")}
                title="Dinamik Alan Ekle"
                sx={{
                  color: 'text.secondary',
                  '&:hover': {
                    bgcolor: 'action.hover',
                    color: 'secondary.main'
                  },
                  transition: 'all 0.3s'
                }}
              >
                <TuneIcon fontSize="small" />
              </IconButton>
            )}

            <Divider orientation="vertical" flexItem sx={{ mx: 0.5, height: 30 }} />

            <IconButton
              onClick={onLogout}
              title="Çıkış Yap"
              sx={{
                color: 'text.secondary',
                '&:hover': {
                  bgcolor: 'error.light',
                  color: 'error.main'
                },
                transition: 'all 0.3s'
              }}
            >
              <LogoutIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={2} sx={{ mb: 3 }}>
          <Box>
            <Typography variant="h4">Proformalar</Typography>
            <Typography variant="body2" color="text.secondary">{proformas.length} kayıt · panelinize hoş geldiniz</Typography>
          </Box>
          <Stack direction="row" spacing={1.5}>
            {session.role === "admin" ? (
              <Button
                variant="contained"
                color="secondary"
                startIcon={<EventAvailableIcon />}
                onClick={() => navigate("/appointments")}
              >
                Randevular
              </Button>
            ) : (
              <Button
                variant="contained"
                color="warning"
                startIcon={<EventNoteIcon />}
                onClick={() => navigate("/my-appointments")}
              >
                Randevularım
              </Button>
            )}
            {session.can_add_proforma && <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={() => navigate("/proforma/add")}>
              Yeni Proforma
            </Button>}
          </Stack>
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
                      <TableCell className="mono" sx={{ whiteSpace: "nowrap" }}>{p.code}</TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>{p.buyer_name || "İsimsiz Alıcı"}</TableCell>
                      <TableCell className="mono" sx={{ whiteSpace: "nowrap" }}>{p.created_date ? new Date(p.created_date).toLocaleDateString("tr-TR") : ""}</TableCell>
                      <TableCell align="right" className="mono" sx={{ whiteSpace: "nowrap", fontWeight: 600 }}>{tl(total)}</TableCell>
                      <TableCell align="center" sx={{ whiteSpace: "nowrap" }}>
                        {p.discount !== 0 ? (
                          <Chip size="small" color="primary" label={`%${p.discount || 0}`} />
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
                        <IconButton size="small" onClick={() => shareProformaPdf(p, session)} title="Paylaş">
                          <ShareIcon fontSize="small" color="primary" />
                        </IconButton>
                        <IconButton size="small" onClick={() => setDeleteTarget(p)} title="Sil">
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

      {/* Silme Onay Modalı */}
      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => !deleting && setDeleteTarget(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Proforma Silinecek</DialogTitle>
        <DialogContent>
          <DialogContentText>
            <b>{deleteTarget?.code}</b> kodlu ve <b>{deleteTarget?.buyer_name || "İsimsiz Alıcı"}</b> müşterisine ait proformayı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting} color="inherit">
            Vazgeç
          </Button>
          <Button
            onClick={confirmDelete}
            color="error"
            variant="contained"
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} color="inherit" /> : <DeleteOutlineIcon />}
          >
            {deleting ? "Siliniyor..." : "Sil"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}