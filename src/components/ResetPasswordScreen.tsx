// src/screens/ResetPasswordScreen.tsx
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
    IconButton,
    InputAdornment,
    LinearProgress,
    Divider,
} from "@mui/material";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import LockResetIcon from "@mui/icons-material/LockReset";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { baseApi } from "../lib/storage";

interface LocationState {
    email?: string;
}

export default function ResetPasswordScreen() {
    const navigate = useNavigate();
    const location = useLocation();
    const state = (location.state as LocationState) || {};

    const [email, setEmail] = useState(state.email || "");
    const [code, setCode] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [showPw, setShowPw] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [busy, setBusy] = useState(false);
    const [expired, setExpired] = useState(false);

    // Kod alanına otomatik odak
    const codeInputRef = useRef<HTMLInputElement>(null);
    const pwInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        codeInputRef.current?.focus();
    }, []);

    // --------------------------------------------------------
    // ŞİFRE GÜCÜ HESABI (5 kriter)
    // --------------------------------------------------------
    const pwStrength = (() => {
        const p = newPassword;
        if (!p) return 0;
        let s = 0;
        if (p.length >= 8) s++;
        if (/[A-Z]/.test(p)) s++;
        if (/[a-z]/.test(p)) s++;
        if (/\d/.test(p)) s++;
        if (/[^A-Za-z0-9]/.test(p)) s++;
        return s; // 0 - 5
    })();

    const strengthColor: "error" | "warning" | "success" =
        pwStrength <= 2 ? "error" : pwStrength <= 3 ? "warning" : "success";

    const strengthLabel =
        pwStrength === 0
            ? ""
            : pwStrength <= 2
                ? "Zayıf"
                : pwStrength === 3
                    ? "Orta"
                    : pwStrength === 4
                        ? "İyi"
                        : "Güçlü";

    // --------------------------------------------------------
    // FORM GÖNDERİMİ
    // --------------------------------------------------------
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSuccess("");
        setExpired(false);

        // Validasyonlar
        if (!email.trim()) {
            setError("E-posta adresi zorunludur.");
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
        if (pwStrength < 4) {
            setError(
                "Şifre en az 8 karakter; bir büyük harf, bir küçük harf, bir rakam ve bir özel karakter içermelidir."
            );
            return;
        }

        setBusy(true);
        try {
            const response = await fetch(`${baseApi}/api/Auth/reset-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: email.trim(),
                    code: code.trim(),
                    newPassword: newPassword,
                }),
            });

            if (!response.ok) {
                const raw = await response.text();
                try {
                    const data = JSON.parse(raw);

                    // Süresi dolmuş kod senaryosu
                    if (
                        data?.message?.toLowerCase().includes("süresi dolmuş") ||
                        data?.expired
                    ) {
                        setExpired(true);
                        setError(
                            data?.message ||
                            "Şifre sıfırlama kodunun süresi dolmuş. Lütfen yeni kod talep edin."
                        );
                        return;
                    }

                    setError(data?.message || "Şifre sıfırlanamadı.");
                } catch {
                    setError(raw || "Şifre sıfırlanamadı.");
                }
                return;
            }

            setSuccess(
                "Şifreniz başarıyla değiştirildi! Giriş sayfasına yönlendiriliyorsunuz..."
            );

            setTimeout(() => {
                navigate("/login");
            }, 2000);
        } catch {
            setError("Sunucuya bağlanılamadı. Lütfen internet bağlantınızı kontrol edin.");
        } finally {
            setBusy(false);
        }
    };

    // --------------------------------------------------------
    // YENİ KOD TALEP ET (süresi dolduysa)
    // --------------------------------------------------------
    const handleRequestNewCode = () => {
        navigate("/forgot-password", { state: { email: email.trim() } });
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
                sx={{ p: { xs: 3, sm: 4 }, width: "100%", maxWidth: 460 }}
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
                        <LockOpenIcon sx={{ fontSize: 44, color: "primary.main" }} />
                    </Box>

                    {/* Başlık */}
                    <Typography variant="h5" fontWeight="bold" textAlign="center">
                        Yeni Şifre Belirle
                    </Typography>

                    {/* Açıklama */}
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        textAlign="center"
                        sx={{ maxWidth: 360 }}
                    >
                        E-postanıza gelen <b>4 haneli kodu</b> ve yeni şifrenizi girin.
                        Kod <b>10 dakika</b> geçerlidir.
                    </Typography>

                    {/* Form */}
                    <Box
                        component="form"
                        onSubmit={handleSubmit}
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
                                        ? "Şifre sıfırlama talebinde kullandığınız e-posta"
                                        : undefined
                                }
                            />

                            {/* Doğrulama Kodu */}
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
                                        fontSize: 28,
                                        letterSpacing: 10,
                                        textAlign: "center",
                                        fontWeight: "bold",
                                        padding: "12px 0",
                                    },
                                }}
                            />

                            {/* Yeni Şifre */}
                            <TextField
                                inputRef={pwInputRef}
                                label="Yeni Şifre"
                                type={showPw ? "text" : "password"}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                onCopy={(e) => e.preventDefault()}
                                onPaste={(e) => e.preventDefault()}
                                fullWidth
                                required
                                autoComplete="new-password"
                                InputProps={{
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton
                                                onClick={() => setShowPw((s) => !s)}
                                                edge="end"
                                                size="small"
                                            >
                                                {showPw ? (
                                                    <VisibilityOff fontSize="small" />
                                                ) : (
                                                    <Visibility fontSize="small" />
                                                )}
                                            </IconButton>
                                        </InputAdornment>
                                    ),
                                }}
                            />

                            {/* Şifre Gücü Göstergesi */}
                            {newPassword && (
                                <Box>
                                    <LinearProgress
                                        variant="determinate"
                                        value={(pwStrength / 5) * 100}
                                        color={strengthColor}
                                        sx={{ height: 6, borderRadius: 3 }}
                                    />
                                    <Stack
                                        direction="row"
                                        justifyContent="space-between"
                                        sx={{ mt: 0.5 }}
                                    >
                                        <Typography
                                            variant="caption"
                                            color={`${strengthColor}.main`}
                                            fontWeight="bold"
                                        >
                                            Şifre gücü: {strengthLabel}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {pwStrength}/5
                                        </Typography>
                                    </Stack>

                                    {/* Kriter listesi */}
                                    <Stack spacing={0.25} sx={{ mt: 1 }}>
                                        <Criterion
                                            ok={newPassword.length >= 8}
                                            text="En az 8 karakter"
                                        />
                                        <Criterion
                                            ok={/[A-Z]/.test(newPassword)}
                                            text="En az 1 büyük harf"
                                        />
                                        <Criterion
                                            ok={/[a-z]/.test(newPassword)}
                                            text="En az 1 küçük harf"
                                        />
                                        <Criterion
                                            ok={/\d/.test(newPassword)}
                                            text="En az 1 rakam"
                                        />
                                        <Criterion
                                            ok={/[^A-Za-z0-9]/.test(newPassword)}
                                            text="En az 1 özel karakter"
                                        />
                                    </Stack>
                                </Box>
                            )}

                            {/* Mesajlar */}
                            {error && (
                                <Alert
                                    severity="error"
                                    onClose={() => setError("")}
                                    action={
                                        expired ? (
                                            <Button
                                                color="inherit"
                                                size="small"
                                                onClick={handleRequestNewCode}
                                            >
                                                YENİ KOD
                                            </Button>
                                        ) : undefined
                                    }
                                >
                                    {error}
                                </Alert>
                            )}
                            {success && (
                                <Alert severity="success" onClose={() => setSuccess("")}>
                                    {success}
                                </Alert>
                            )}

                            {/* Gönder Butonu */}
                            <Button
                                type="submit"
                                variant="contained"
                                size="large"
                                disabled={busy || pwStrength < 4 || code.length !== 4}
                                startIcon={<LockResetIcon />}
                            >
                                {busy ? "Kaydediliyor..." : "Şifreyi Sıfırla"}
                            </Button>

                            <Divider sx={{ my: 0.5 }} />

                            {/* Alt Butonlar */}
                            {expired && (
                                <Button
                                    type="button"
                                    variant="outlined"
                                    color="warning"
                                    onClick={handleRequestNewCode}
                                >
                                    Yeni Kod Talep Et
                                </Button>
                            )}

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

// ------------------------------------------------------------
// KÜÇÜK YARDIMCI: Şifre kriteri satırı
// ------------------------------------------------------------
function Criterion({ ok, text }: { ok: boolean; text: string }) {
    return (
        <Stack direction="row" spacing={0.5} alignItems="center">
            <CheckCircleIcon
                sx={{
                    fontSize: 14,
                    color: ok ? "success.main" : "text.disabled",
                }}
            />
            <Typography
                variant="caption"
                color={ok ? "success.main" : "text.disabled"}
            >
                {text}
            </Typography>
        </Stack>
    );
}