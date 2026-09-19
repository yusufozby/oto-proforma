import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    AppBar, Toolbar, Box, Typography, IconButton, Button, Container, Card,
    Chip, Stack, CircularProgress, Table, TableHead, TableBody, TableRow,
    TableCell, TableContainer, Paper, Dialog, DialogTitle, DialogContent,
    DialogActions, TextField, Alert, Avatar, Divider, Tooltip,
} from "@mui/material";
import ElectricBoltIcon from "@mui/icons-material/ElectricBolt";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import EventBusyOutlinedIcon from "@mui/icons-material/EventBusyOutlined";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import { baseApi } from "../lib/storage";
import type { Appointment, Session } from "../types";

interface AppointmentsAdminProps {
    session: Session;
    onLogout: () => void;
}

// Uygulama her zaman Türkiye saatine göre çalışıyor; tarayıcının kendi
// saat dilimi ne olursa olsun tarihleri hep Europe/Istanbul'a göre
// gösteriyoruz. Türkiye artık yaz saati uygulamadığı için sabit +03:00.
const ISTANBUL_TZ = "Europe/Istanbul";

// Backend'den gelen UTC ISO string'i ("...Z" ile biten) İstanbul saatine
// çevirip okunabilir formatta döndürür.
function formatIstanbul(iso: string) {
    if (!iso) return "";
    return new Date(iso).toLocaleString("tr-TR", { timeZone: ISTANBUL_TZ });
}

// .NET'ten gelen hata gövdesi string / {message} / ValidationProblemDetails
// olarak dönebilir — LoginScreen'deki ile aynı yardımcı.
async function extractErrorMessage(response: Response, fallback: string) {
    const raw = await response.text();
    if (!raw) return fallback;
    try {
        const data = JSON.parse(raw);
        if (typeof data === "string") return data;
        if (data?.message) return data.message;
        if (data?.errors) {
            const firstField = Object.values(data.errors)[0];
            if (Array.isArray(firstField) && firstField.length > 0) return firstField[0];
        }
        if (data?.title) return data.title;
        return fallback;
    } catch {
        return raw;
    }
}

const STATUS_STYLES: Record<string, { color: "warning" | "success" | "error" | "default"; dot: string }> = {
    "Onaylandı": { color: "success", dot: "#2E7D32" },
    "Reddedildi": { color: "error", dot: "#C62828" },
    "Beklemede": { color: "warning", dot: "#B26A00" },
};

function statusColor(status: string): "warning" | "success" | "error" | "default" {
    return STATUS_STYLES[status]?.color ?? "default";
}

// Küçük renkli nokta + etiket şeklinde durum rozeti — sade Chip'ten daha
// az "kurumsal form" hissi verir, göz taramasını kolaylaştırır.
function StatusBadge({ status }: { status: string }) {
    const style = STATUS_STYLES[status];
    return (
        <Chip
            size="small"
            label={status}
            color={statusColor(status)}
            icon={
                <Box
                    component="span"
                    sx={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        bgcolor: style?.dot ?? "text.disabled",
                        ml: "8px !important",
                    }}
                />
            }
            sx={{
                fontWeight: 600,
                borderRadius: "8px",
                "& .MuiChip-icon": { order: -1 },
            }}
        />
    );
}

// Firma/kullanıcı isminden baş harf çıkarıp yuvarlak avatar üretir —
// tablodaki her satırın kime ait olduğunu bir bakışta ayırt etmeyi
// kolaylaştırır.
function initialsFor(label: string) {
    const clean = label.trim();
    if (!clean) return "?";
    const parts = clean.split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
}

const AVATAR_PALETTE = ["#5B7FBA", "#B2724A", "#5E9B7A", "#9163A8", "#C4713E", "#4C8C9E"];
function avatarColorFor(label: string) {
    let hash = 0;
    for (let i = 0; i < label.length; i++) hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
    return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

export default function AppointmentsAdmin({ session, onLogout }: AppointmentsAdminProps) {
    const navigate = useNavigate();

    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [refuseTarget, setRefuseTarget] = useState<Appointment | null>(null);
    const [refuseReason, setRefuseReason] = useState("");
    const [busyId, setBusyId] = useState<number | null>(null);

    const loadAppointments = async () => {
        setLoading(true);
        setError("");
        try {
            // NOT: backend'de tüm randevuları dönen admin endpoint'i bu isimde
            // değilse (ör. /api/Appointment/get-all) burayı güncelle.
            const response = await fetch(`${baseApi}/api/Appointment/get-all`, {
                headers: { Authorization: `Bearer ${session.token}` },
            });
            if (!response.ok) {
                setError(await extractErrorMessage(response, "Randevular yüklenemedi."));
                return;
            }
            const data = await response.json();
            setAppointments(data);
        } catch (err) {
            console.error(err);
            setError("Sunucuya bağlanılamadı.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAppointments();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const pendingCount = useMemo(
        () => appointments.filter((a) => a.status === "Beklemede").length,
        [appointments]
    );

    const handleApprove = async (a: Appointment) => {
        setBusyId(a.id);
        setError("");
        try {
            // NOT: onay endpoint'i backend'de farklı bir path/method ise güncelle.
            const response = await fetch(`${baseApi}/api/Appointment/approve/${a.id}`, {
                method: "POST",
                headers: { Authorization: `Bearer ${session.token}` },
            });
            if (!response.ok) {
                setError(await extractErrorMessage(response, "Onaylama sırasında hata oluştu."));
                return;
            }
            setAppointments((prev) =>
                prev.map((x) => (x.id === a.id ? { ...x, status: "Onaylandı", refuse_description: null } : x))
            );
        } catch (err) {
            console.error(err);
            setError("Sunucuya bağlanılamadı.");
        } finally {
            setBusyId(null);
        }
    };

    const openRefuseDialog = (a: Appointment) => {
        setRefuseTarget(a);
        setRefuseReason("");
    };

    const handleRefuse = async () => {
        if (!refuseTarget) return;
        if (!refuseReason.trim()) {
            setError("Reddetme açıklaması zorunludur.");
            return;
        }
        setBusyId(refuseTarget.id);
        setError("");
        try {
            const response = await fetch(`${baseApi}/api/Appointment/refuse/${refuseTarget.id}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session.token}`,
                },
                body: JSON.stringify({ refuseDescription: refuseReason.trim() }),
            });
            if (!response.ok) {
                setError(await extractErrorMessage(response, "Reddetme sırasında hata oluştu."));
                return;
            }
            setAppointments((prev) =>
                prev.map((x) =>
                    x.id === refuseTarget.id
                        ? { ...x, status: "Reddedildi", refuse_description: refuseReason.trim() }
                        : x
                )
            );
            setRefuseTarget(null);
        } catch (err) {
            console.error(err);
            setError("Sunucuya bağlanılamadı.");
        } finally {
            setBusyId(null);
        }
    };

    return (
        <Box sx={{ minHeight: 600, bgcolor: "#FBFAF7" }}>
            <AppBar
                position="sticky"
                elevation={0}
                sx={{ bgcolor: "background.paper", borderBottom: "1px solid", borderColor: "divider" }}
            >
                <Toolbar sx={{ maxWidth: 1400, width: "100%", mx: "auto", gap: 1.5 }}>
                    <IconButton onClick={() => navigate("/dashboard")}>
                        <ArrowBackIcon />
                    </IconButton>
                    <ElectricBoltIcon color="primary" />
                    <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="h6" fontWeight={700} lineHeight={1.2}>
                            Randevular
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {appointments.length} kayıt
                        </Typography>
                    </Box>
                    <Chip
                        icon={<EventAvailableIcon sx={{ fontSize: 16 }} />}
                        label={`${pendingCount} bekleyen`}
                        color={pendingCount > 0 ? "warning" : "default"}
                        size="small"
                        sx={{ fontWeight: 600, borderRadius: "8px" }}
                    />
                </Toolbar>
            </AppBar>

            <Container maxWidth="lg" sx={{ py: 4 }}>
                {error && (
                    <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }} onClose={() => setError("")}>
                        {error}
                    </Alert>
                )}

                {loading ? (
                    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5, py: 10 }}>
                        <CircularProgress size={26} thickness={4.5} />
                        <Typography variant="body2" color="text.secondary">Randevular yükleniyor…</Typography>
                    </Box>
                ) : appointments.length === 0 ? (
                    <Card
                        variant="outlined"
                        sx={{
                            py: 8, textAlign: "center", borderStyle: "dashed", borderRadius: 3,
                            bgcolor: "#FFFFFF",
                        }}
                    >
                        <EventBusyOutlinedIcon sx={{ fontSize: 36, color: "text.disabled", mb: 1.5 }} />
                        <Typography fontWeight={700}>Henüz randevu talebi yok</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            Müşteriler randevu oluşturduğunda burada listelenecek.
                        </Typography>
                    </Card>
                ) : (
                    <TableContainer
                        component={Paper}
                        variant="outlined"
                        sx={{ borderRadius: 3, overflow: "hidden" }}
                    >
                        <Table size="small">
                            <TableHead>
                                <TableRow sx={{ bgcolor: "#EAE6DA" }}>
                                    <TableCell sx={{ fontWeight: 700, py: 1.5 }}>Müşteri</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Tarih</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Açıklama</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 700 }}>Durum</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 700 }}>İşlemler</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {appointments.map((a) => {
                                    const label = a.firm || a.username || `#${a.user_id}`;
                                    return (
                                        <TableRow
                                            key={a.id}
                                            hover
                                            sx={{
                                                borderLeft: "3px solid",
                                                borderLeftColor: STATUS_STYLES[a.status]?.dot ?? "transparent",
                                                transition: "background-color 0.15s ease",
                                            }}
                                        >
                                            <TableCell>
                                                <Stack direction="row" spacing={1.25} alignItems="center">
                                                    <Avatar
                                                        sx={{
                                                            width: 32, height: 32, fontSize: 13, fontWeight: 700,
                                                            bgcolor: avatarColorFor(label),
                                                        }}
                                                    >
                                                        {initialsFor(label)}
                                                    </Avatar>
                                                    <Typography variant="body2" fontWeight={600}>{label}</Typography>
                                                </Stack>
                                            </TableCell>
                                            <TableCell className="mono" sx={{ whiteSpace: "nowrap" }}>
                                                {formatIstanbul(a.appointment_date)}
                                            </TableCell>
                                            <TableCell sx={{ maxWidth: 280, color: "text.secondary" }}>
                                                {a.description}
                                            </TableCell>
                                            <TableCell align="center">
                                                <StatusBadge status={a.status} />
                                                {a.status === "Reddedildi" && a.refuse_description && (
                                                    <Typography
                                                        variant="caption" color="text.secondary" display="block"
                                                        sx={{ mt: 0.5, maxWidth: 180, mx: "auto" }}
                                                    >
                                                        {a.refuse_description}
                                                    </Typography>
                                                )}
                                            </TableCell>
                                            <TableCell align="right">
                                                {a.status === "Beklemede" ? (
                                                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                                        <Tooltip title="Onayla">
                                                            <span>
                                                                <IconButton
                                                                    size="small"
                                                                    color="success"
                                                                    disabled={busyId === a.id}
                                                                    onClick={() => handleApprove(a)}
                                                                    sx={{ bgcolor: "success.50", "&:hover": { bgcolor: "success.100" } }}
                                                                >
                                                                    <CheckCircleOutlineIcon fontSize="small" />
                                                                </IconButton>
                                                            </span>
                                                        </Tooltip>
                                                        <Tooltip title="Reddet">
                                                            <span>
                                                                <IconButton
                                                                    size="small"
                                                                    color="error"
                                                                    disabled={busyId === a.id}
                                                                    onClick={() => openRefuseDialog(a)}
                                                                    sx={{ bgcolor: "error.50", "&:hover": { bgcolor: "error.100" } }}
                                                                >
                                                                    <CancelOutlinedIcon fontSize="small" />
                                                                </IconButton>
                                                            </span>
                                                        </Tooltip>
                                                    </Stack>
                                                ) : (
                                                    <Typography variant="caption" color="text.disabled">—</Typography>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Container>

            <Dialog
                open={!!refuseTarget}
                onClose={() => setRefuseTarget(null)}
                fullWidth
                maxWidth="xs"
                PaperProps={{ sx: { borderRadius: 3 } }}
            >
                <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, pb: 1 }}>
                    <BlockOutlinedIcon color="error" fontSize="small" />
                    Randevuyu Reddet
                </DialogTitle>
                <Divider />
                <DialogContent sx={{ pt: 2.5 }}>
                    {refuseTarget && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            <b>{refuseTarget.firm || refuseTarget.username || `#${refuseTarget.user_id}`}</b>{" "}
                            için {formatIstanbul(refuseTarget.appointment_date)} tarihli randevu reddedilecek.
                        </Typography>
                    )}
                    <TextField
                        autoFocus
                        fullWidth
                        multiline
                        minRows={3}
                        label="Reddetme açıklaması"
                        placeholder="Müşteriye gösterilecek kısa bir açıklama yazın"
                        value={refuseReason}
                        onChange={(e) => setRefuseReason(e.target.value)}
                        helperText={`${refuseReason.trim().length} karakter`}
                    />
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2.5 }}>
                    <Button onClick={() => setRefuseTarget(null)} color="inherit">Vazgeç</Button>
                    <Button
                        variant="contained"
                        color="error"
                        onClick={handleRefuse}
                        disabled={busyId === refuseTarget?.id || !refuseReason.trim()}
                        sx={{ borderRadius: 2 }}
                    >
                        Reddet
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}