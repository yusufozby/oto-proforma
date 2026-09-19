import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    AppBar, Toolbar, Box, Typography, IconButton, Button,
    Container, Card, Chip, Alert, Stack, CircularProgress,
    Table, TableHead, TableBody, TableRow, TableCell, TableContainer, Paper,
    Avatar, Divider, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
} from "@mui/material";
import ElectricBoltIcon from "@mui/icons-material/ElectricBolt";
import SettingsIcon from "@mui/icons-material/Settings";
import LogoutIcon from "@mui/icons-material/Logout";
import GroupsIcon from "@mui/icons-material/Groups";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DownloadIcon from "@mui/icons-material/Download";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import FolderZipIcon from "@mui/icons-material/FolderZip";
import ImageIcon from "@mui/icons-material/Image";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import { baseApi } from "../lib/storage";
import type { Session } from "../types";

interface AdminDashboardProps {
    session: Session;
    onLogout: () => void;
}

interface Customer {
    id: number;
    firm: string;
    email: string;
    username: string;
    phone?: string;
    proformaCount: number;
    totalAmount: number;
}

interface ExcelStatus {
    hasFile: boolean;
    fileName: string | null;
    uploadedAt?: string;
}

async function extractErrorMessage(response: Response, fallback: string) {
    const raw = await response.text();
    if (!raw) return fallback;
    try {
        const data = JSON.parse(raw);
        if (typeof data === "string") return data;
        if (data?.message) return data.message;
        return fallback;
    } catch {
        return raw;
    }
}

const safeNumber = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

function DonutChart({ data }: { data: { label: string; value: number }[] }) {
    const size = 260;
    const strokeWidth = 42;
    const radius = (size - strokeWidth) / 2;
    const center = size / 2;
    const circumference = 2 * Math.PI * radius;

    const COLORS = [
        "#E8871E", "#F5A623", "#D0021B", "#4A4A4A",
        "#8A867C", "#2E7D32", "#1976D2", "#9C27B0",
    ];

    const total = data.reduce((sum, d) => sum + safeNumber(d.value), 0);

    if (data.length === 0 || total === 0) {
        return (
            <Box sx={{ py: 4, textAlign: "center", color: "text.secondary" }}>
                <Typography variant="body2">Henüz proforma verisi yok.</Typography>
            </Box>
        );
    }

    let currentOffset = 0;
    const slices = data.map((d, i) => {
        const percentage = d.value / total;
        const dashArray = `${percentage * circumference} ${circumference}`;
        const dashOffset = -currentOffset;
        currentOffset += percentage * circumference;

        return {
            ...d,
            color: COLORS[i % COLORS.length],
            dashArray,
            dashOffset,
            percentage: (percentage * 100).toFixed(1),
        };
    });

    return (
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
            <Box sx={{ position: "relative", width: size, height: size }}>
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                    <circle cx={center} cy={center} r={radius} fill="transparent" stroke="#EAE6DA" strokeWidth={strokeWidth} />
                    <g transform={`rotate(-90 ${center} ${center})`}>
                        {slices.map((slice, i) => (
                            <circle
                                key={i}
                                cx={center}
                                cy={center}
                                r={radius}
                                fill="transparent"
                                stroke={slice.color}
                                strokeWidth={strokeWidth}
                                strokeDasharray={slice.dashArray}
                                strokeDashoffset={slice.dashOffset}
                                style={{ transition: "stroke-dashoffset 0.5s ease" }}
                            />
                        ))}
                    </g>
                </svg>

                <Box
                    sx={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        pointerEvents: "none",
                    }}
                >
                    <Typography variant="caption" color="text.secondary">Toplam Ciro</Typography>
                    <Typography variant="h6" fontWeight={800} color="primary.main">
                        {total.toLocaleString("tr-TR")} ₺
                    </Typography>
                </Box>
            </Box>

            <Stack direction="row" flexWrap="wrap" justifyContent="center" spacing={2} sx={{ mt: 3, maxWidth: 720, gap: 1 }}>
                {slices.map((slice, i) => (
                    <Stack key={i} direction="row" alignItems="center" spacing={0.5}>
                        <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: slice.color }} />
                        <Typography variant="caption" fontWeight={600}>
                            {slice.label.length > 14 ? slice.label.slice(0, 13) + "…" : slice.label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">({slice.percentage}%)</Typography>
                    </Stack>
                ))}
            </Stack>
        </Box>
    );
}

export default function AdminDashboard({ session, onLogout }: AdminDashboardProps) {
    const navigate = useNavigate();

    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [excelStatus, setExcelStatus] = useState<ExcelStatus>({ hasFile: false, fileName: null });
    const [excelBusy, setExcelBusy] = useState(false);
    const [excelMsg, setExcelMsg] = useState("");
    const [excelErr, setExcelErr] = useState("");
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

    // GÖRSEL ARŞİVİ STATE'LERİ
    const [imageBusy, setImageBusy] = useState(false);
    const [imageMsg, setImageMsg] = useState("");
    const [imageErr, setImageErr] = useState("");
    const [imageDeleteConfirmOpen, setImageDeleteConfirmOpen] = useState(false);

    const loadCustomers = async () => {
        setLoading(true);
        setError("");
        try {
            const response = await fetch(`${baseApi}/api/Users/customers`, {
                headers: { Authorization: `Bearer ${session.token}` },
            });
            if (!response.ok) {
                setError(await extractErrorMessage(response, "Müşteriler yüklenemedi."));
                return;
            }
            const data = await response.json();
            const normalized: Customer[] = Array.isArray(data)
                ? data.map((c: any) => ({
                    id: c.id,
                    firm: c.firm ?? "",
                    email: c.email ?? "",
                    username: c.username ?? "",
                    phone: c.phone ?? "",
                    proformaCount: safeNumber(c.proformaCount),
                    totalAmount: safeNumber(c.totalAmount),
                }))
                : [];
            setCustomers(normalized);
        } catch {
            setError("Sunucuya bağlanılamadı.");
        } finally {
            setLoading(false);
        }
    };

    // GÜNCELLENDİ: hata durumları daha net, 401 kontrolü var
    const loadExcelStatus = async () => {
        try {
            const response = await fetch(`${baseApi}/api/Excel/current`, {
                headers: { Authorization: `Bearer ${session.token}` },
            });

            if (!response.ok) {
                if (response.status === 401) {
                    setExcelErr("Oturum süresi dolmuş, tekrar giriş yapın.");
                    return;
                }
                console.warn("Excel status alınamadı:", response.status);
                setExcelStatus({ hasFile: false, fileName: null });
                return;
            }

            const data = await response.json();
            setExcelStatus({
                hasFile: Boolean(data.hasFile),
                fileName: data.fileName ?? null,
                uploadedAt: data.uploadedAt ?? undefined,
            });
        } catch (err) {
            console.warn("Excel status isteği başarısız:", err);
            setExcelStatus({ hasFile: false, fileName: null });
        }
    };

    useEffect(() => {
        loadCustomers();
        loadExcelStatus();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;

        setExcelBusy(true);
        setExcelErr(""); setExcelMsg("");
        try {
            const formData = new FormData();
            formData.append("file", file);

            const response = await fetch(`${baseApi}/api/Excel/upload`, {
                method: "POST",
                headers: { Authorization: `Bearer ${session.token}` },
                body: formData,
            });

            if (!response.ok) {
                setExcelErr(await extractErrorMessage(response, "Excel yüklenemedi."));
                return;
            }

            const data = await response.json();
            setExcelMsg(`${data.productCount ?? 0} ürün başarıyla yüklendi.`);
            await loadExcelStatus();
        } catch {
            setExcelErr("Sunucuya bağlanılamadı.");
        } finally {
            setExcelBusy(false);
        }
    };

    const handleExcelDownload = async () => {
        setExcelErr("");
        try {
            const response = await fetch(`${baseApi}/api/Excel/download`, {
                headers: { Authorization: `Bearer ${session.token}` },
            });
            if (!response.ok) {
                setExcelErr(await extractErrorMessage(response, "Excel indirilemedi."));
                return;
            }
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = excelStatus.fileName || "urunler.xlsx";
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch {
            setExcelErr("Sunucuya bağlanılamadı.");
        }
    };

    const handleExcelDelete = async () => {
        setExcelBusy(true);
        setExcelErr(""); setExcelMsg("");
        try {
            const response = await fetch(`${baseApi}/api/Excel/delete`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${session.token}` },
            });
            if (!response.ok) {
                setExcelErr(await extractErrorMessage(response, "Excel silinemedi."));
                return;
            }
            setExcelMsg("Excel dosyası ve tüm ürünler silindi.");
            await loadExcelStatus();
        } catch {
            setExcelErr("Sunucuya bağlanılamadı.");
        } finally {
            setExcelBusy(false);
            setDeleteConfirmOpen(false);
        }
    };

    // GÖRSEL ARŞİVİ YÜKLEME
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;

        const lower = file.name.toLowerCase();
        if (!lower.endsWith(".zip") && !lower.endsWith(".rar")) {
            setImageErr("Sadece .zip veya .rar dosyaları yükleyebilirsiniz.");
            setImageMsg("");
            return;
        }

        setImageBusy(true);
        setImageErr("");
        setImageMsg("");
        try {
            const formData = new FormData();
            formData.append("file", file);

            const response = await fetch(`${baseApi}/api/Image/upload`, {
                method: "POST",
                headers: { Authorization: `Bearer ${session.token}` },
                body: formData,
            });

            if (!response.ok) {
                setImageErr(await extractErrorMessage(response, "Arşiv yüklenemedi."));
                return;
            }

            setImageMsg("Arşiv başarıyla çıkarıldı ");
        } catch {
            setImageErr("Sunucuya bağlanılamadı.");
        } finally {
            setImageBusy(false);
        }
    };

    // GÖRSEL ARŞİVİ TEMİZLEME
    const handleImageDelete = async () => {
        setImageBusy(true);
        setImageErr("");
        setImageMsg("");
        try {
            const response = await fetch(`${baseApi}/api/Image/clear`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${session.token}` },
            });

            if (!response.ok) {
                setImageErr(await extractErrorMessage(response, "Görseller silinemedi."));
                return;
            }

            setImageMsg(" Tüm görseller veritabanından silindi.");
        } catch {
            setImageErr("Sunucuya bağlanılamadı.");
        } finally {
            setImageBusy(false);
            setImageDeleteConfirmOpen(false);
        }
    };

    const chartData = useMemo(
        () =>
            [...customers]
                .map((c) => ({ label: c.firm || c.username, value: safeNumber(c.totalAmount) }))
                .filter((d) => d.value > 0)
                .sort((a, b) => b.value - a.value)
                .slice(0, 8),
        [customers]
    );

    const totalProformas = useMemo(
        () => customers.reduce((sum, c) => sum + safeNumber(c.proformaCount), 0),
        [customers]
    );

    const totalRevenue = useMemo(
        () => customers.reduce((sum, c) => sum + safeNumber(c.totalAmount), 0),
        [customers]
    );

    return (
        <Box sx={{ minHeight: 600 }}>
            <AppBar
                position="sticky"
                elevation={0}
                sx={{
                    bgcolor: "background.paper",
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    backdropFilter: "blur(20px)",
                    backgroundColor: "rgba(255, 255, 255, 0.9)",
                }}
            >
                <Toolbar sx={{ maxWidth: 1400, width: "100%", mx: "auto", px: { xs: 2, md: 3 }, gap: 2 }}>
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexGrow: 1 }}>
                        <Box sx={{ p: 1, borderRadius: 2, bgcolor: "primary.main", display: "flex" }}>
                            <ElectricBoltIcon sx={{ color: "white", fontSize: 28 }} />
                        </Box>
                        <Typography variant="h6" fontWeight={700}>Oto Proforma — Admin</Typography>
                    </Stack>

                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mr: 2 }}>
                        <Avatar sx={{ width: 32, height: 32, bgcolor: "secondary.main", fontSize: 13 }}>
                            {session.firm?.charAt(0).toUpperCase()}
                        </Avatar>
                        <Typography variant="body2" fontWeight={600}>{session.firm}</Typography>
                        <Chip
                            size="small" color="primary" icon={<AdminPanelSettingsIcon sx={{ fontSize: 13 }} />}
                            label="Admin" sx={{ height: 20 }}
                        />
                    </Stack>

                    {/* YENİ: Randevularım butonu */}
                    <Button
                        variant="outlined"
                        size="small"
                        startIcon={<CalendarMonthIcon />}
                        onClick={() => navigate("/appointments")}
                        sx={{ textTransform: "none", fontWeight: 600 }}
                    >
                        Randevularım
                    </Button>

                    <IconButton onClick={() => navigate("/account-settings")} title="Hesap Ayarları" sx={{ color: "text.secondary" }}>
                        <SettingsIcon fontSize="small" />
                    </IconButton>
                    <Divider orientation="vertical" flexItem sx={{ mx: 0.5, height: 30 }} />
                    <IconButton onClick={onLogout} title="Çıkış Yap" sx={{ color: "text.secondary" }}>
                        <LogoutIcon fontSize="small" />
                    </IconButton>
                </Toolbar>
            </AppBar>

            <Container maxWidth="lg" sx={{ py: 4 }}>

                {/* EXCEL YÜKLEME KARTI */}
                <Card variant="outlined" sx={{ p: 2.5, mb: 3 }}>
                    <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
                        Ürün Kataloğu (Excel)
                    </Typography>

                    {excelErr && <Alert severity="error" sx={{ mb: 1.5 }}>{excelErr}</Alert>}
                    {excelMsg && <Alert severity="success" sx={{ mb: 1.5 }}>{excelMsg}</Alert>}

                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                        <Button component="label" variant="contained" startIcon={<UploadFileIcon />} disabled={excelBusy}>
                            Excel Yükle
                            <input type="file" accept=".xlsx,.xls" hidden onChange={handleExcelUpload} />
                        </Button>

                        <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleExcelDownload} disabled={!excelStatus.hasFile || excelBusy}>
                            İndir
                        </Button>

                        <Button variant="outlined" color="error" startIcon={<DeleteOutlineIcon />} onClick={() => setDeleteConfirmOpen(true)} disabled={!excelStatus.hasFile || excelBusy}>
                            Sil
                        </Button>
                    </Stack>

                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
                        Yeni bir Excel yüklediğinizde önceki dosya otomatik olarak değiştirilir. Sistemde her zaman tek bir aktif ürün kataloğu bulunur.
                    </Typography>
                </Card>

                {/* GÖRSEL ARŞİVİ KARTI */}
                <Card variant="outlined" sx={{ p: 2.5, mb: 3 }}>
                    <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1.5 }}>
                        <Box
                            sx={{
                                width: 34, height: 34, borderRadius: 1.5,
                                bgcolor: "primary.light",
                                display: "flex", alignItems: "center", justifyContent: "center",
                            }}
                        >
                            <ImageIcon fontSize="small" color="primary" />
                        </Box>
                        <Box>
                            <Typography variant="subtitle1" fontWeight={700}>
                                Görseller (Arşiv)
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                .zip veya .rar yükleyin — içeriği
                            </Typography>
                        </Box>
                    </Stack>

                    {imageErr && <Alert severity="error" sx={{ mb: 1.5 }}>{imageErr}</Alert>}
                    {imageMsg && <Alert severity="success" sx={{ mb: 1.5 }}>{imageMsg}</Alert>}

                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                        <Button
                            component="label"
                            variant="contained"
                            startIcon={imageBusy ? <CircularProgress size={16} color="inherit" /> : <FolderZipIcon />}
                            disabled={imageBusy}
                        >
                            {imageBusy ? "İşleniyor..." : "Arşiv Yükle"}
                            <input
                                type="file"
                                accept=".zip,.rar"
                                hidden
                                onChange={handleImageUpload}
                            />
                        </Button>

                        <Button
                            variant="outlined"
                            color="error"
                            startIcon={<DeleteSweepIcon />}
                            onClick={() => setImageDeleteConfirmOpen(true)}
                            disabled={imageBusy}
                        >
                            Tüm Görselleri Sil
                        </Button>
                    </Stack>

                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
                        Aynı isimde bir dosya daha önce yüklenmişse otomatik olarak yenisiyle değiştirilir.
                    </Typography>
                </Card>

                {/* MÜŞTERİLER TABLOSU */}
                <Card variant="outlined" sx={{ p: 0, mb: 3 }}>
                    <Box sx={{ p: 2.5, pb: 1.5 }}>
                        <Typography variant="subtitle1" fontWeight={700}>Müşteriler</Typography>
                        <Typography variant="body2" color="text.secondary">{customers.length} kayıt</Typography>
                    </Box>

                    {loading ? (
                        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
                            <CircularProgress size={22} thickness={5} />
                        </Box>
                    ) : error ? (
                        <Alert severity="error" sx={{ m: 2.5 }}>{error}</Alert>
                    ) : customers.length === 0 ? (
                        <Box sx={{ py: 6, textAlign: "center", color: "text.secondary" }}>
                            <GroupsIcon sx={{ fontSize: 30, mb: 1, opacity: 0.5 }} />
                            <Typography>Henüz kayıtlı müşteri yok.</Typography>
                        </Box>
                    ) : (
                        <TableContainer component={Paper} variant="outlined" sx={{ borderLeft: 0, borderRight: 0, borderBottom: 0 }}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow sx={{ bgcolor: "#EAE6DA" }}>
                                        <TableCell>Firma</TableCell>
                                        <TableCell>Kullanıcı Adı</TableCell>
                                        <TableCell>E-mail</TableCell>
                                        <TableCell>Telefon</TableCell>
                                        <TableCell align="right">Proforma</TableCell>
                                        <TableCell align="right">Toplam Tutar</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {customers.map((c) => (
                                        <TableRow key={c.id} hover>
                                            <TableCell sx={{ fontWeight: 600 }}>{c.firm || "—"}</TableCell>
                                            <TableCell className="mono">{c.username}</TableCell>
                                            <TableCell>{c.email || "—"}</TableCell>
                                            <TableCell className="mono">{c.phone || "—"}</TableCell>
                                            <TableCell align="right">
                                                <Chip size="small" label={c.proformaCount} color={c.proformaCount > 0 ? "primary" : "default"} />
                                            </TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 700, color: "primary.main", whiteSpace: "nowrap" }}>
                                                {safeNumber(c.totalAmount).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </Card>

                {/* ÖZET KARTLAR */}
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3 }}>
                    <Card variant="outlined" sx={{ p: 2.5, flex: 1, display: "flex", alignItems: "center", gap: 2 }}>
                        <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: "primary.light", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <GroupsIcon color="primary" />
                        </Box>
                        <Box>
                            <Typography variant="h5" fontWeight={800}>{customers.length}</Typography>
                            <Typography variant="body2" color="text.secondary">Kayıtlı müşteri</Typography>
                        </Box>
                    </Card>

                    <Card variant="outlined" sx={{ p: 2.5, flex: 1, display: "flex", alignItems: "center", gap: 2 }}>
                        <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: "#EAE6DA", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <DescriptionOutlinedIcon sx={{ color: "#8A6D3B" }} />
                        </Box>
                        <Box>
                            <Typography variant="h5" fontWeight={800}>{totalProformas}</Typography>
                            <Typography variant="body2" color="text.secondary">Toplam proforma</Typography>
                        </Box>
                    </Card>

                    <Card variant="outlined" sx={{ p: 2.5, flex: 1, display: "flex", alignItems: "center", gap: 2 }}>
                        <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: "success.light", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Typography sx={{ color: "success.dark", fontWeight: 800 }}>₺</Typography>
                        </Box>
                        <Box>
                            <Typography variant="h5" fontWeight={800}>
                                {totalRevenue.toLocaleString("tr-TR")} ₺
                            </Typography>
                            <Typography variant="body2" color="text.secondary">Toplam ciro</Typography>
                        </Box>
                    </Card>

                    <Card variant="outlined" sx={{ p: 2.5, flex: 1, display: "flex", alignItems: "center", gap: 2 }}>
                        <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: excelStatus.hasFile ? "success.light" : "#EAE6DA", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <InsertDriveFileOutlinedIcon sx={{ color: excelStatus.hasFile ? "success.dark" : "text.secondary" }} />
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" fontWeight={700} noWrap>
                                {excelStatus.hasFile ? excelStatus.fileName : "Excel yüklenmedi"}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">Ürün kataloğu</Typography>
                        </Box>
                    </Card>
                </Stack>

                {/* DONUT GRAFİK */}
                <Card variant="outlined" sx={{ p: 2.5, display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
                        Müşteri Başına Proforma Tutarı
                    </Typography>
                    <DonutChart data={chartData} />
                </Card>
            </Container>

            <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Excel Kataloğu Silinecek</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        <b>{excelStatus.fileName}</b> dosyasını ve bu kataloğa bağlı TÜM ürünleri silmek istediğinize emin misiniz? Bu işlem, ürünleri kullanan proformalardaki ürün bağlantılarını da kaldırır ve geri alınamaz.
                    </DialogContentText>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setDeleteConfirmOpen(false)} disabled={excelBusy} color="inherit">Vazgeç</Button>
                    <Button
                        onClick={handleExcelDelete} color="error" variant="contained" disabled={excelBusy}
                        startIcon={excelBusy ? <CircularProgress size={16} color="inherit" /> : <DeleteOutlineIcon />}
                    >
                        {excelBusy ? "Siliniyor..." : "Sil"}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* GÖRSEL SİLME ONAY DİYALOĞU */}
            <Dialog
                open={imageDeleteConfirmOpen}
                onClose={() => setImageDeleteConfirmOpen(false)}
                maxWidth="xs"
                fullWidth
            >
                <DialogTitle>Görseller Silinecek</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        klasörünün tamamı ve içindeki <b>tüm görseller</b> kalıcı olarak silinecek. Bu işlem geri alınamaz. Devam etmek istiyor musunuz?
                    </DialogContentText>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button
                        onClick={() => setImageDeleteConfirmOpen(false)}
                        disabled={imageBusy}
                        color="inherit"
                    >
                        Vazgeç
                    </Button>
                    <Button
                        onClick={handleImageDelete}
                        color="error"
                        variant="contained"
                        disabled={imageBusy}
                        startIcon={
                            imageBusy
                                ? <CircularProgress size={16} color="inherit" />
                                : <DeleteSweepIcon />
                        }
                    >
                        {imageBusy ? "Siliniyor..." : "Sil"}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}