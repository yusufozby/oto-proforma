import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    AppBar, Toolbar, Box, Typography, IconButton, Button, Container, Card,
    Chip, Stack, CircularProgress, Table, TableHead, TableBody, TableRow,
    TableCell, TableContainer, Paper, Dialog, DialogTitle, DialogContent,
    DialogActions, TextField, Alert,
} from "@mui/material";
import ElectricBoltIcon from "@mui/icons-material/ElectricBolt";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import { baseApi } from "../lib/storage";
import type { Appointment, Session } from "../types";

interface AppointmentsAdminProps {
    session: Session;
    onLogout: () => void;
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

function statusColor(status: string): "warning" | "success" | "error" | "default" {
    if (status === "Onaylandı") return "success";
    if (status === "Reddedildi") return "error";
    if (status === "Beklemede") return "warning";
    return "default";
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
        <Box sx={{ minHeight: 600 }}>
            <AppBar
                position="sticky"
                elevation={0}
                sx={{ bgcolor: "background.paper", borderBottom: "1px solid", borderColor: "divider" }}
            >
                <Toolbar sx={{ maxWidth: 1400, width: "100%", mx: "auto", gap: 2 }}>
                    <IconButton onClick={() => navigate("/dashboard")}>
                        <ArrowBackIcon />
                    </IconButton>
                    <ElectricBoltIcon color="primary" />
                    <Typography variant="h6" fontWeight={700} sx={{ flexGrow: 1 }}>
                        Randevular
                    </Typography>
                    <Chip
                        icon={<EventAvailableIcon sx={{ fontSize: 16 }} />}
                        label={`${pendingCount} bekleyen`}
                        color="warning"
                        size="small"
                    />
                </Toolbar>
            </AppBar>

            <Container maxWidth="lg" sx={{ py: 4 }}>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                {loading ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
                        <CircularProgress size={22} thickness={5} />
                    </Box>
                ) : appointments.length === 0 ? (
                    <Card variant="outlined" sx={{ py: 8, textAlign: "center" }}>
                        <EventAvailableIcon sx={{ fontSize: 32, color: "text.secondary", mb: 1 }} />
                        <Typography fontWeight={600}>Henüz randevu talebi yok</Typography>
                    </Card>
                ) : (
                    <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                            <TableHead>
                                <TableRow sx={{ bgcolor: "#EAE6DA" }}>
                                    <TableCell>Müşteri</TableCell>
                                    <TableCell>Tarih</TableCell>
                                    <TableCell>Açıklama</TableCell>
                                    <TableCell align="center">Durum</TableCell>
                                    <TableCell align="right">İşlemler</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {appointments.map((a) => (
                                    <TableRow key={a.id} hover>
                                        <TableCell>{a.firm || a.username || `#${a.user_id}`}</TableCell>
                                        <TableCell className="mono">
                                            {new Date(a.appointment_date).toLocaleString("tr-TR")}
                                        </TableCell>
                                        <TableCell sx={{ maxWidth: 280 }}>{a.description}</TableCell>
                                        <TableCell align="center">
                                            <Chip size="small" color={statusColor(a.status)} label={a.status} />
                                            {a.status === "Reddedildi" && a.refuse_description && (
                                                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                                                    {a.refuse_description}
                                                </Typography>
                                            )}
                                        </TableCell>
                                        <TableCell align="right">
                                            {a.status === "Beklemede" ? (
                                                <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                                    <IconButton
                                                        size="small"
                                                        color="success"
                                                        disabled={busyId === a.id}
                                                        onClick={() => handleApprove(a)}
                                                        title="Onayla"
                                                    >
                                                        <CheckCircleOutlineIcon fontSize="small" />
                                                    </IconButton>
                                                    <IconButton
                                                        size="small"
                                                        color="error"
                                                        disabled={busyId === a.id}
                                                        onClick={() => openRefuseDialog(a)}
                                                        title="Reddet"
                                                    >
                                                        <CancelOutlinedIcon fontSize="small" />
                                                    </IconButton>
                                                </Stack>
                                            ) : (
                                                <Typography variant="caption" color="text.secondary">—</Typography>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Container>

            <Dialog open={!!refuseTarget} onClose={() => setRefuseTarget(null)} fullWidth maxWidth="xs">
                <DialogTitle>Randevuyu Reddet</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        fullWidth
                        multiline
                        minRows={3}
                        label="Reddetme açıklaması"
                        value={refuseReason}
                        onChange={(e) => setRefuseReason(e.target.value)}
                        sx={{ mt: 1 }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRefuseTarget(null)}>Vazgeç</Button>
                    <Button variant="contained" color="error" onClick={handleRefuse} disabled={busyId === refuseTarget?.id}>
                        Reddet
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}