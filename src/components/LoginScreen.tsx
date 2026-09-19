import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Box, Typography, TextField, Button, ToggleButtonGroup, ToggleButton,
  IconButton, InputAdornment, Alert, Stack,
} from "@mui/material";
import ElectricBoltIcon from "@mui/icons-material/ElectricBolt";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import LoginIcon from "@mui/icons-material/Login";
import PersonAddIcon from "@mui/icons-material/PersonAdd";

import type { Session } from "../types";
import { baseApi } from "../lib/storage";
import CustomPhoneInput from "../customs/masks/CustomPhoneInput";

interface LoginScreenProps {
  onLogin: (session: Session) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  const extractErrorMessage = async (response: Response, fallback: string) => {
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
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setBusy(true);

    try {
      if (mode === "login") {
        const response = await fetch(`${baseApi}/api/Auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: username.trim(),
            password: password,
          }),
        });

        if (!response.ok) {
          // Eğer email doğrulanmamışsa (401 + requiresVerification) doğrulama sayfasına yönlendir
          try {
            const clone = response.clone();
            const errorData = await clone.json();

            if (errorData.requiresVerification) {
              // API artık email ve username'i de dönüyor
              navigate("/verify-email", {
                state: {
                  email: errorData.email || email || username,
                  username: errorData.username || username,
                },
              });
              return;
            }
          } catch (err) {
            // JSON parse hatası olursa normal hata akışına devam et
          }

          setError(await extractErrorMessage(response, "Kullanıcı adı veya şifre hatalı."));
          return;
        }

        const data = await response.json();
        console.log("Login response data:", data);

        // API'den dönen role'e göre otomatik atama yapılıyor
        onLogin({
          google_map_link: data.google_map_link,
          phone_link: data.phone_link,
          website_link: data.website_link,
          center_address: data.center_address,
          fabric_address: data.fabric_address,
          email: data.email,
          seller_email: data.seller_email,
          username: username.trim(),
          token: data.token,
          firm: data.firm,
          fullname: data.fullname,
          role: data.role,
          userId: data.userId,
          can_add_proforma: data.can_add_proforma,
          phone: data.phone,
        });

        // Role göre yönlendirme (istersen ayrı dashboard'lar kullan)
        if (data.role === "admin") {
          navigate("/admin/dashboard");
        } else {
          navigate("/dashboard");
        }
      } else {
        // REGISTER
        if (!username.trim() || !password || !email.trim()) {
          setError("Lütfen kullanıcı adı, e-posta ve şifreyi doldurun.");
          return;
        }

        const response = await fetch(`${baseApi}/api/Auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: username.trim(),
            password: password,
            email: email.trim(),
            phone: phone.trim(),
            firm: company.trim(),
            roleId: 2, // Herkes müşteri olarak kayıt olur
          }),
        });

        if (!response.ok) {
          setError(await extractErrorMessage(response, "Kayıt sırasında bir hata oluştu."));
          return;
        }

        // Kayıt başarılı - API email doğrulama kodu gönderdi
        // Kullanıcıyı doğrulama ekranına yönlendir
        navigate("/verify-email", {
          state: { email: email.trim(), username: username.trim() },
        });
      }
    } catch (error) {
      console.error(error);
      setError("Sunucuya bağlanılamadı.");
    } finally {
      setBusy(false);
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Sadece rakamları al
    let value = e.target.value.replace(/\D/g, "");

    // Maksimum 11 hane (0 ile birlikte)
    value = value.substring(0, 11);

    // Format: 0 5xx xxx xx xx
    let formatted = value;
    if (value.length > 0) {
      formatted = value.substring(0, 1); // 0
      if (value.length > 1) formatted += ` ${value.substring(1, 4)}`; // 5xx
      if (value.length > 4) formatted += ` ${value.substring(4, 7)}`; // xxx
      if (value.length > 7) formatted += ` ${value.substring(7, 9)}`; // xx
      if (value.length > 9) formatted += ` ${value.substring(9, 11)}`; // xx
    }

    setPhone(formatted);
  };
  return (
    <Box sx={{ minHeight: 600, width: "100%", display: "flex" }}>
      {/* sol marka paneli */}
      <Box
        sx={{
          display: { xs: "none", md: "flex" },
          width: "42%",
          flexDirection: "column",
          justifyContent: "space-between",
          p: 5,
          bgcolor: "secondary.dark",
          color: "#F5F3EC",
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <ElectricBoltIcon sx={{ color: "warning.main" }} />
          <Typography variant="h5">Oto Proforma</Typography>
        </Stack>

        <Box>
          <Typography variant="h3" sx={{ mb: 2, lineHeight: 1.2 }}>
            Teklifleriniz,
            <br />
            tek panelden
            <br />
            otomatik hazır.
          </Typography>
          <Typography variant="body2" sx={{ maxWidth: 320, color: "#CFE3E0" }}>
            Alıcı, ürün listesi, şartlar ve ödeme bilgilerinizi tanımlayın —
            saniyeler içinde proforma üretin.
          </Typography>
        </Box>

        <Stack direction="row" spacing={2}>
          {Array.from({ length: 8 }).map((_, i) => (
            <Stack key={i} alignItems="center" spacing={0.5}>
              <Box sx={{ width: 9, height: 9, borderRadius: "50%", background: "linear-gradient(135deg,#9a9a9a,#4a4a4a)" }} />
              <Box sx={{ width: 24, height: 32, borderRadius: "2px", bgcolor: "rgba(232,163,61,.18)", border: "1px solid rgba(232,163,61,.35)" }} />
            </Stack>
          ))}
        </Stack>
      </Box>

      {/* sağ form */}
      <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", p: { xs: 3, md: 5 } }}>
        <Box sx={{ width: "100%", maxWidth: 380 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 4, display: { xs: "flex", md: "none" } }}>
            <ElectricBoltIcon color="primary" />
            <Typography variant="h6">Oto Proforma</Typography>
          </Stack>

          <ToggleButtonGroup
            value={mode}
            exclusive
            onChange={(_, v) => {
              if (v) {
                setMode(v);
                setError("");
                setSuccess("");
              }
            }}
            fullWidth
            color="secondary"
            sx={{ mb: 3 }}
          >
            <ToggleButton value="login" sx={{ gap: 1 }}>
              <LoginIcon fontSize="small" /> Giriş Yap
            </ToggleButton>
            <ToggleButton value="register" sx={{ gap: 1 }}>
              <PersonAddIcon fontSize="small" /> Kayıt Ol
            </ToggleButton>
          </ToggleButtonGroup>

          <Box component="form" onSubmit={submit}>
            <Stack spacing={2.5}>
              {mode === "register" && (
                <>
                  <TextField
                    label="E-posta"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    fullWidth
                    required
                    placeholder="ornek@firma.com"
                  />
                  <TextField
                    label="Telefon"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)} // State güncellemesi burada yapılıyor
                    fullWidth
                    placeholder="0(5xx) xxx xx xx"
                    InputProps={{
                      inputComponent: CustomPhoneInput as any,
                    }}
                  // inputProps'u kaldırdık çünkü IMask kendi içinde yönetiyor
                  />
                  <TextField
                    label="Firma Adı"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    fullWidth
                    placeholder="Firma Ltd. Şti."
                  />
                </>
              )}

              <TextField
                label="Kullanıcı Adı"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                fullWidth
                required
                placeholder="kullanici_adi"
                autoComplete="username"
              />

              <TextField
                label="Şifre"
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                fullWidth
                required
                autoComplete="current-password"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPw((s) => !s)} edge="end" size="small">
                        {showPw ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              {/* Şifremi Unuttum Linki */}
              {mode === "login" && (
                <Box sx={{ textAlign: "right", mt: -1 }}>
                  <Link to="/forgot-password" style={{ textDecoration: "none" }}>
                    <Typography variant="caption" color="primary" sx={{ "&:hover": { textDecoration: "underline" } }}>
                      Şifremi Unuttum
                    </Typography>
                  </Link>
                </Box>
              )}

              {error && <Alert severity="error">{error}</Alert>}
              {success && <Alert severity="success">{success}</Alert>}

              <Button
                type="submit"
                variant="contained"
                color="primary"
                size="large"
                disabled={busy}
                endIcon={<LoginIcon />}
              >
                {mode === "login" ? "Panele Gir" : "Hesap Oluştur"}
              </Button>
            </Stack>
          </Box>

          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mt: 3, textAlign: "center" }}
            className="mono"
          >
            demo: <b>demo</b> / <b>demo123</b>
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}