import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    AppBar, Toolbar, Box, Typography, IconButton, Button, Container, Card,
    Chip, Stack, CircularProgress, Alert, Dialog, DialogTitle, DialogContent,
    DialogActions, TextField, Grid, Divider,
} from "@mui/material";
import ElectricBoltIcon from "@mui/icons-material/ElectricBolt";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EventNoteIcon from "@mui/icons-material/EventNote";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import { baseApi } from "../lib/storage";
import type { Appointment, Session } from "../types";

interface AppointmentsCustomerProps {
    session: Session;
    onLogout: () => void;
}

// Uygulama her zaman Türkiye saatine göre çalışıyor; tarayıcının kendi
// saat dilimi ne olursa olsun tarihleri hep Europe/Istanbul'a göre
// gösteriyor ve öyle kaydediyoruz. Türkiye artık yaz saati uygulamadığı
// için sabit +03:00 offset kullanmak güvenli.
const ISTANBUL_TZ = "Europe/Istanbul";
const ISTANBUL_OFFSET = "+03:00";

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
            sx={{ fontWeight: 600, borderRadius: "8px", "& .MuiChip-icon": { order: -1 } }}
        />
    );
}

// Backend'den gelen UTC ISO string'i ("...Z" ile biten) İstanbul saatine
// çevirip okunabilir formatta döndürür.
function formatIstanbul(iso: string) {
    if (!iso) return "";
    return new Date(iso).toLocaleString("tr-TR", { timeZone: ISTANBUL_TZ });
}

// UTC ISO -> <input type="datetime-local"> value'su, İstanbul saatine göre
// ("YYYY-MM-DDTHH:mm"). Tarayıcının kendi saat dilimine bakmaksızın her
// zaman İstanbul saatini üretir.
function isoToIstanbulLocalInput(iso: string) {
    if (!iso) return "";
    const date = new Date(iso);
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: ISTANBUL_TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).formatToParts(date);

    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
    return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

// <input type="datetime-local"> değeri ("YYYY-MM-DDTHH:mm", İstanbul saati
// olarak girildiği varsayılır) -> gerçek UTC ISO string.
function istanbulLocalInputToIso(value: string) {
    if (!value) return "";
    return new Date(`${value}:00${ISTANBUL_OFFSET}`).toISOString();
}

export default function AppointmentsCustomer({ session, onLogout }: AppointmentsCustomerProps) {
    const navigate = useNavigate();

    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<Appointment | null>(null);
    const [formDate, setFormDate] = useState("");
    const [formDescription, setFormDescription] = useState("");

    const loadAppointments = async () => {
        setLoading(true);
        setError("");
        try {
            // NOT: kullanıcının kendi randevularını dönen endpoint bu isimde
            // değilse (ör. /api/Appointment/my) burayı güncelle. Token'dan
            // kullanıcıyı backend zaten çözebiliyorsa query param gerekmez.
            const response = await fetch(`${baseApi}/api/Appointment/get`, {
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

    const openCreateDialog = () => {
        setEditing(null);
        setFormDate("");
        setFormDescription("");
        setDialogOpen(true);
    };

    const openEditDialog = (a: Appointment) => {
        setEditing(a);
        setFormDate(isoToIstanbulLocalInput(a.appointment_date));
        setFormDescription(a.description);
        setDialogOpen(true);
    };

    const handleSubmit = async () => {
        if (!formDate || !formDescription.trim()) {
            setError("Tarih ve açıklama zorunludur.");
            return;
        }
        setBusy(true);
        setError("");
        try {
            const body = JSON.stringify({
                appointment_date: istanbulLocalInputToIso(formDate),
                description: formDescription.trim(),
            });

            const response = editing
                ? await fetch(`${baseApi}/api/Appointment/update/${editing.id}`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${session.token}`,
                    },
                    body,
                })
                : await fetch(`${baseApi}/api/Appointment/create`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${session.token}`,
                    },
                    body,
                });

            if (!response.ok) {
                setError(await extractErrorMessage(response, "Kaydetme sırasında hata oluştu."));
                return;
            }

            setDialogOpen(false);
            await loadAppointments();
        } catch (err) {
            console.error(err);
            setError("Sunucuya bağlanılamadı.");
        } finally {
            setBusy(false);
        }
    };

    const handleDelete = async (a: Appointment) => {
        setBusy(true);
        setError("");
        try {
            const response = await fetch(`${baseApi}/api/Appointment/delete/${a.id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${session.token}` },
            });
            if (!response.ok) {
                setError(await extractErrorMessage(response, "Silme sırasında hata oluştu."));
                return;
            }
            setAppointments((prev) => prev.filter((x) => x.id !== a.id));
        } catch (err) {
            console.error(err);
            setError("Sunucuya bağlanılamadı.");
        } finally {
            setBusy(false);
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
                            Randevularım
                        </Typography>
                        {appointments.length > 0 && (
                            <Typography variant="caption" color="text.secondary">
                                {appointments.length} kayıt
                            </Typography>
                        )}
                    </Box>
                    <Button
                        variant="contained" color="warning" startIcon={<AddIcon />}
                        onClick={openCreateDialog}
                        sx={{ borderRadius: 2, boxShadow: "none" }}
                    >
                        Yeni Randevu
                    </Button>
                </Toolbar>
            </AppBar>

            <Container maxWidth="md" sx={{ py: 4 }}>
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
                        sx={{ py: 8, textAlign: "center", borderStyle: "dashed", borderRadius: 3, bgcolor: "#FFFFFF" }}
                    >
                        <EventNoteIcon sx={{ fontSize: 36, color: "text.disabled", mb: 1.5 }} />
                        <Typography fontWeight={700}>Henüz randevunuz yok</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                            İlk randevunuzu oluşturarak başlayın.
                        </Typography>
                        <Button
                            variant="contained" color="warning" startIcon={<AddIcon />}
                            onClick={openCreateDialog}
                            sx={{ borderRadius: 2, boxShadow: "none" }}
                        >
                            Yeni Randevu
                        </Button>
                    </Card>
                ) : (
                    <Stack spacing={1.5}>
                        {appointments.map((a) => (
                            <Card
                                key={a.id}
                                variant="outlined"
                                sx={{
                                    p: 2, borderRadius: 3,
                                    borderLeft: "4px solid",
                                    borderLeftColor: STATUS_STYLES[a.status]?.dot ?? "divider",
                                    transition: "box-shadow 0.15s ease",
                                    "&:hover": { boxShadow: "0 2px 10px rgba(0,0,0,0.06)" },
                                }}
                            >
                                <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1.5}>
                                    <Box sx={{ minWidth: 0 }}>
                                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                                            <CalendarMonthOutlinedIcon sx={{ fontSize: 17, color: "text.secondary" }} />
                                            <Typography fontWeight={700} className="mono">
                                                {formatIstanbul(a.appointment_date)}
                                            </Typography>
                                            <StatusBadge status={a.status} />
                                        </Stack>
                                        <Typography variant="body2" color="text.secondary" sx={{ pl: 3.25 }}>
                                            {a.description}
                                        </Typography>
                                        {a.status === "Reddedildi" && a.refuse_description && (
                                            <Typography
                                                variant="caption" color="error.main" display="block"
                                                sx={{ mt: 0.75, pl: 3.25 }}
                                            >
                                                Red sebebi: {a.refuse_description}
                                            </Typography>
                                        )}
                                    </Box>

                                    {a.status === "Beklemede" && (
                                        <Stack direction="row" spacing={0.5} sx={{ alignSelf: { xs: "flex-end", sm: "center" } }}>
                                            <IconButton
                                                size="small" color="secondary" onClick={() => openEditDialog(a)} title="Düzenle"
                                                sx={{ bgcolor: "action.hover" }}
                                            >
                                                <EditOutlinedIcon fontSize="small" />
                                            </IconButton>
                                            <IconButton
                                                size="small" color="error" onClick={() => handleDelete(a)} title="Sil" disabled={busy}
                                                sx={{ bgcolor: "error.50", "&:hover": { bgcolor: "error.100" } }}
                                            >
                                                <DeleteOutlineIcon fontSize="small" />
                                            </IconButton>
                                        </Stack>
                                    )}
                                </Stack>
                            </Card>
                        ))}
                    </Stack>
                )}
            </Container>

            <Dialog
                open={dialogOpen}
                onClose={() => setDialogOpen(false)}
                fullWidth
                maxWidth="xs"
                PaperProps={{ sx: { borderRadius: 3 } }}
            >
                <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, pb: 1 }}>
                    {editing ? <EditOutlinedIcon color="warning" fontSize="small" /> : <AddIcon color="warning" fontSize="small" />}
                    {editing ? "Randevuyu Düzenle" : "Yeni Randevu"}
                </DialogTitle>
                <Divider />
                <DialogContent sx={{ pt: 2.5 }}>
                    <Grid container spacing={2}>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                type="datetime-local"
                                label="Tarih ve saat"
                                value={formDate}
                                onChange={(e) => setFormDate(e.target.value)}
                                InputLabelProps={{ shrink: true }}
                                helperText="İstanbul saatine göre girilir"
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                multiline
                                minRows={3}
                                label="Açıklama"
                                placeholder="Randevu ile ilgili kısa bir not ekleyin"
                                value={formDescription}
                                onChange={(e) => setFormDescription(e.target.value)}
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2.5 }}>
                    <Button onClick={() => setDialogOpen(false)} color="inherit">Vazgeç</Button>
                    <Button
                        variant="contained" color="warning" onClick={handleSubmit} disabled={busy}
                        sx={{ borderRadius: 2, boxShadow: "none" }}
                    >
                        {editing ? "Güncelle" : "Oluştur"}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}