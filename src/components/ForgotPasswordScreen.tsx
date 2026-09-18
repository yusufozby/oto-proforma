// src/screens/ForgotPasswordScreen.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Box, Typography, TextField, Button, Stack, Alert, Paper,
} from "@mui/material";
import LockResetIcon from "@mui/icons-material/LockReset";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { baseApi } from "../lib/storage";

export default function ForgotPasswordScreen() {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [busy, setBusy] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSuccess("");

        if (!email.trim()) {
            setError("Lütfen e-posta adresinizi girin.");
            return;
        }

        setBusy(true);
        try {
            const response = await fetch(`${baseApi}/api/Auth/forgot-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email.trim() }),
            });

            if (!response.ok) {
                const raw = await response.text();
                try {
                    const data = JSON.parse(raw);
                    setError(data?.message || "Şifre sıfırlama kodu gönderilemedi.");
                } catch {
                    setError(raw || "Şifre sıfırlama kodu gönderilemedi.");
                }
                return;
            }

            setSuccess("Şifre sıfırlama kodu e-posta adresinize gönderildi. Yönlendiriliyorsunuz...");

            // Kod girme ekranına yönlendir
            setTimeout(() => {
                navigate("/reset-password", { state: { email: email.trim() } });
            }, 1500);
        } catch {
            setError("Sunucuya bağlanılamadı.");
        } finally {
            setBusy(false);
        }
    };

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
            <Paper elevation={3} sx={{ p: 4, width: "100%", maxWidth: 420 }}>
                <Stack spacing={2.5} alignItems="center">
                    <LockResetIcon color="primary" sx={{ fontSize: 56 }} />

                    <Typography variant="h5" fontWeight="bold" textAlign="center">
                        Şifremi Unuttum
                    </Typography>

                    <Typography variant="body2" color="text.secondary" textAlign="center">
                        Kayıtlı e-posta adresinizi girin. Size <b>4 haneli</b> bir sıfırlama kodu gönderelim.
                    </Typography>

                    <Box component="form" onSubmit={handleSubmit} sx={{ width: "100%" }}>
                        <Stack spacing={2}>
                            <TextField
                                label="E-posta"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                fullWidth
                                required
                                autoFocus
                                placeholder="ornek@firma.com"
                            />

                            {error && <Alert severity="error">{error}</Alert>}
                            {success && <Alert severity="success">{success}</Alert>}

                            <Button
                                type="submit"
                                variant="contained"
                                size="large"
                                disabled={busy}
                            >
                                {busy ? "Gönderiliyor..." : "Sıfırlama Kodu Gönder"}
                            </Button>

                            <Button
                                type="button"
                                variant="text"
                                startIcon={<ArrowBackIcon />}
                                onClick={() => navigate("/login")}
                                sx={{ textTransform: "none" }}
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