// src/screens/VerifyEmailScreen.tsx
import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
    Box,
    Typography,
    TextField,
    Button,
    Stack,
    Alert,
    Paper,
    CircularProgress,
    Divider,
} from "@mui/material";
import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import RefreshIcon from "@mui/icons-material/Refresh";
import { baseApi } from "../lib/storage";

interface LocationState {
    email?: string;
    username?: string;
}

export default function VerifyEmailScreen() {
    const navigate = useNavigate();
    const location = useLocation();
    const state = (location.state as LocationState) || {};

    const [email, setEmail] = useState(state.email || "");
    const [username] = useState(state.username || "");
    const [code, setCode] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [busy, setBusy] = useState(false);
    const [resending, setResending] = useState(false);

    // "Kodu tekrar gönder" için geri sayım (saniye)
    const [cooldown, setCooldown] = useState(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Kod alanına otomatik odaklanma
    const codeInputRef = useRef<HTMLInputElement>(null);

    // Cooldown sayacı
    useEffect(() => {
        if (cooldown > 0) {
            timerRef.current = setInterval(() => {
                setCooldown((prev) => {
                    if (prev <= 1) {
                        if (timerRef.current) clearInterval(timerRef.current);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [cooldown]);

    // Sayfa açıldığında kod input'una odaklan
    useEffect(() => {
        codeInputRef.current?.focus();
    }, []);

    // --------------------------------------------------------
    // DOĞRULAMA
    // --------------------------------------------------------
    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSuccess("");

        if (!email.trim()) {
            setError("Lütfen e-posta adresinizi girin.");
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            setError("Geçerli bir e-posta adresi girin.");
            return;
        }
        if (code.length !== 4 || !/^\d+$/.test(code)) {
            setError("Doğrulama kodu 4 haneli olmalıdır.");
            return;
        }

        setBusy(true);
        try {
            const response = await fetch(`${baseApi}/api/Auth/verify-email`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: email.trim(),
                    code: code.trim(),
                }),
            });

            if (!response.ok) {
                const raw = await response.text();
                try {
                    const data = JSON.parse(raw);

                    // Süresi dolmuş kod
                    if (data?.expired) {
                        setError(
                            data?.message ||
                            "Doğrulama kodunun süresi dolmuş. Lütfen yeni kod talep edin."
                        );
                        // Cooldown'u sıfırla ki kullanıcı hemen yeni kod isteyebilsin
                        setCooldown(0);
                        return;
                    }

                    setError(data?.message || "Doğrulama başarısız.");
                } catch {
                    setError(raw || "Doğrulama başarısız.");
                }
                return;
            }

            setSuccess(
                "E-posta adresiniz başarıyla doğrulandı! Giriş sayfasına yönlendiriliyorsunuz..."
            );


            navigate("/dashboard");

        } catch {
            setError("Sunucuya bağlanılamadı. Lütfen internet bağlantınızı kontrol edin.");
        } finally {
            setBusy(false);
        }
    };

    // --------------------------------------------------------
    // KODU TEKRAR GÖNDER
    // --------------------------------------------------------
    const handleResend = async () => {
        setError("");
        setSuccess("");

        if (!email.trim()) {
            setError("Yeni kod istemek için önce e-posta adresinizi girin.");
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            setError("Geçerli bir e-posta adresi girin.");
            return;
        }
        if (cooldown > 0) {
            setError(`Yeni kod için ${cooldown} saniye bekleyin.`);
            return;
        }

        setResending(true);
        try {
            const response = await fetch(
                `${baseApi}/api/Auth/resend-verification`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: email.trim() }),
                }
            );

            if (!response.ok) {
                const raw = await response.text();
                try {
                    const data = JSON.parse(raw);
                    setError(data?.message || "Kod gönderilemedi.");
                } catch {
                    setError(raw || "Kod gönderilemedi.");
                }
                return;
            }

            setSuccess("Yeni doğrulama kodu e-posta adresinize gönderildi.");
            setCode(""); // Kodu temizle
            setCooldown(30); // 30 saniye bekle
            codeInputRef.current?.focus();
        } catch {
            setError("Sunucuya bağlanılamadı.");
        } finally {
            setResending(false);
        }
    };

    // --------------------------------------------------------
    // RENDER
    // --------------------------------------------------------
    return (
        <Box
            sx={{
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "background.default",
                p: 2,
            }}
        >
            <Paper
                elevation={3}
                sx={{ p: { xs: 3, sm: 4 }, width: "100%", maxWidth: 440 }}
            >
                <Stack spacing={2.5} alignItems="center">
                    {/* İkon */}
                    <Box
                        sx={{
                            width: 80,
                            height: 80,
                            borderRadius: "50%",
                            bgcolor: "primary.light",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            mb: 1,
                        }}
                    >
                        <MarkEmailReadIcon sx={{ fontSize: 48, color: "primary.main" }} />
                    </Box>

                    {/* Başlık */}
                    <Typography variant="h5" fontWeight="bold" textAlign="center">
                        E-posta Doğrulama
                    </Typography>

                    {/* Açıklama */}
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        textAlign="center"
                        sx={{ maxWidth: 340 }}
                    >
                        {username ? `Merhaba ${username}, ` : ""}
                        E-posta adresinize gönderilen <b>4 haneli kodu</b> girerek
                        hesabınızı doğrulayın. Kod <b>10 dakika</b> geçerlidir.
                    </Typography>

                    {/* Form */}
                    <Box
                        component="form"
                        onSubmit={handleVerify}
                        sx={{ width: "100%", mt: 1 }}
                    >
                        <Stack spacing={2.5}>
                            {/* E-posta */}
                            <TextField
                                label="E-posta"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                fullWidth
                                required
                                disabled={!!state.email}
                                helperText={
                                    state.email
                                        ? "Kayıt sırasında verdiğiniz e-posta adresi"
                                        : undefined
                                }
                            />

                            {/* Kod */}
                            <TextField
                                inputRef={codeInputRef}
                                label="Doğrulama Kodu"
                                value={code}
                                onChange={(e) =>
                                    setCode(e.target.value.replace(/\D/g, "").slice(0, 4))
                                }
                                fullWidth
                                required
                                placeholder="0000"
                                inputProps={{
                                    inputMode: "numeric",
                                    maxLength: 4,
                                    style: {
                                        fontSize: 32,
                                        letterSpacing: 12,
                                        textAlign: "center",
                                        fontWeight: "bold",
                                        padding: "14px 0",
                                    },
                                }}
                            />

                            {/* Mesajlar */}
                            {error && (
                                <Alert severity="error" onClose={() => setError("")}>
                                    {error}
                                </Alert>
                            )}
                            {success && (
                                <Alert severity="success" onClose={() => setSuccess("")}>
                                    {success}
                                </Alert>
                            )}

                            {/* Doğrula Butonu */}
                            <Button
                                type="submit"
                                variant="contained"
                                size="large"
                                disabled={busy || code.length !== 4}
                                startIcon={
                                    busy ? <CircularProgress size={20} color="inherit" /> : null
                                }
                            >
                                {busy ? "Doğrulanıyor..." : "Doğrula"}
                            </Button>

                            <Divider sx={{ my: 0.5 }}>
                                <Typography variant="caption" color="text.secondary">
                                    veya
                                </Typography>
                            </Divider>

                            {/* Kodu Tekrar Gönder */}
                            <Button
                                type="button"
                                variant="outlined"
                                size="large"
                                onClick={handleResend}
                                disabled={resending || cooldown > 0}
                                startIcon={
                                    resending ? (
                                        <CircularProgress size={18} color="inherit" />
                                    ) : (
                                        <RefreshIcon />
                                    )
                                }
                            >
                                {resending
                                    ? "Gönderiliyor..."
                                    : cooldown > 0
                                        ? `Tekrar gönder (${cooldown}s)`
                                        : "Kodu tekrar gönder"}
                            </Button>

                            {/* Giriş Sayfasına Dön */}
                            <Button
                                type="button"
                                variant="text"
                                startIcon={<ArrowBackIcon />}
                                onClick={() => navigate("/login")}
                                sx={{ textTransform: "none", color: "text.secondary" }}
                            >
                                Giriş sayfasına dön
                            </Button>
                        </Stack>
                    </Box>
                </Stack>
            </Paper>
        </Box>
    );
}