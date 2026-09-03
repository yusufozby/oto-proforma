import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box, Typography, TextField, Button, ToggleButtonGroup, ToggleButton,
  IconButton, InputAdornment, Alert, Stack,
} from "@mui/material";
import ElectricBoltIcon from "@mui/icons-material/ElectricBolt";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import LoginIcon from "@mui/icons-material/Login";
import PersonAddIcon from "@mui/icons-material/PersonAdd";

import type { UsersMap, UserRole, Session } from "../types";
import { baseApi } from "../lib/storage";

interface LoginScreenProps {
  onLogin: (session: Session) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const navigate = useNavigate();
  const [roleTab, setRoleTab] = useState<UserRole>("firma");
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

  const switchRoleTab = (r: UserRole | null) => {
    if (!r) return;
    setRoleTab(r);
    setMode("login");
    setError("");
    setSuccess("");
  };
  // .NET'ten gelen hata gövdesi 3 farklı şekilde gelebilir:
  //  1) BadRequest("düz string")            -> data bir string
  //  2) Unauthorized(new { message = "…" })  -> data.message
  //  3) [ApiController] otomatik model hatası -> data.errors / data.title
   // .NET'ten gelen hata gövdesi birkaç farklı şekilde gelebilir:
  //  1) BadRequest("mesaj") -> çoğu zaman text/plain, JSON.parse edilemez
  //  2) BadRequest(new { message = "…" }) veya Unauthorized(new {...}) -> JSON obje
  //  3) [ApiController] otomatik model hatası -> ValidationProblemDetails (data.errors)
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
      // JSON değil — muhtemelen text/plain dönen düz .NET mesajı, olduğu gibi göster
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
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: username.trim(),
            password: password,
            roleId: roleTab === "admin" ? 1 : 2,
          }),
        });

        if (!response.ok) {
          setError(await extractErrorMessage(response, "Kullanıcı adı veya şifre hatalı."));
          return;
        }

        const data = await response.json();
        console.log("Login response data:", data);

        onLogin({ username: username.trim(), token: data.token, firm: data.firm, fullname: data.fullname, role: data.role, userId: data.userId });
        navigate("/dashboard");
      } else {
        // REGISTER — email, username ve password zorunlu
        if (!username.trim() || !password || !email.trim()) {
          setError("Lütfen kullanıcı adı, e-posta ve şifreyi doldurun.");
          return;
        }

        const response = await fetch(
          `${baseApi}/api/Auth/register`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              username: username.trim(),
              password: password,
              email: email.trim(),
              phone: phone.trim(),
              firm: company.trim(),
              roleId: 2,
            }),
          }
        );

        if (!response.ok) {
          setError(await extractErrorMessage(response, "Kayıt sırasında bir hata oluştu."));
          return;
        }

        setSuccess("Başarıyla kullanıcı oluşturuldu. Şimdi giriş yapabilirsiniz.");
        setMode("login");
        setPassword("");
        setEmail("");
        setPhone("");
        setCompany("");
      }
    } catch (error) {
      console.error(error);
      setError("Sunucuya bağlanılamadı.");
    } finally {
      setBusy(false);
    }
  };
           const formatPhoneTR = (raw: string) => {
    // sadece rakamları al, en fazla 10 hane (başındaki 0 hariç, örn: 5xx xxx xx xx)
    let digits = raw.replace(/\D/g, "");
    if (digits.startsWith("0")) digits = digits.slice(1);
    digits = digits.slice(0, 10);

    if (digits.length === 0) return "";

    let out = "0(" + digits.slice(0, 3);
    if (digits.length >= 3) out += ")";
    if (digits.length > 3) out += " " + digits.slice(3, 6);
    if (digits.length > 6) out += " " + digits.slice(6, 8);
    if (digits.length > 8) out += " " + digits.slice(8, 10);
    return out;
  };
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhoneTR(e.target.value));
  
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

          <Stack direction="row" justifyContent="flex-end" sx={{ mb: roleTab === "admin" ? 1 : 1.5 }}>
            <Button
              size="small"
              variant="text"
              onClick={() => switchRoleTab(roleTab === "admin" ? "firma" : "admin")}
              startIcon={roleTab === "admin" ? <ArrowBackIcon sx={{ fontSize: 14 }} /> : <AdminPanelSettingsIcon sx={{ fontSize: 14 }} />}
              sx={{ color: "text.secondary", textTransform: "none", fontSize: 12, minWidth: 0, px: 1, py: 0.25 }}
            >
              {roleTab === "admin" ? "Firma girişine dön" : "Yönetici girişi"}
            </Button>
          </Stack>

          {roleTab === "firma" ? (
            <ToggleButtonGroup
              value={mode}
              exclusive
              onChange={(_, v) => { if (v) { setMode(v); setError(""); setSuccess(""); } }}
              fullWidth
              color="secondary"
              sx={{ mb: 3 }}
            >
              <ToggleButton value="login" sx={{ gap: 1 }}><LoginIcon fontSize="small" /> Giriş Yap</ToggleButton>
              <ToggleButton value="register" sx={{ gap: 1 }}><PersonAddIcon fontSize="small" /> Kayıt Ol</ToggleButton>
            </ToggleButtonGroup>
          ) : (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 3 }}>
              Yönetici hesapları güvenlik nedeniyle buradan kayıt edilemez; önceden tanımlı bilgilerle giriş yapın.
            </Typography>
          )}

          <Box component="form" onSubmit={submit}>
            <Stack spacing={2.5}>
              {mode === "register" && roleTab === "firma" && (
                <>
                  <TextField label="E-posta" type="email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth required placeholder="ornek@firma.com" />
                                   <TextField
                    label="Telefon"
                    value={phone}
                    onChange={handlePhoneChange}
                    fullWidth
                    placeholder="0(5xx) xxx xx xx"
                    inputProps={{ inputMode: "numeric", maxLength: 16 }}
                  />
                  <TextField label="Firma Adı" value={company} onChange={(e) => setCompany(e.target.value)} fullWidth placeholder="Firma Ltd. Şti." />
                </>
              )}
              <TextField
                label="Kullanıcı Adı"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                fullWidth
                required
                placeholder={roleTab === "admin" ? "admin" : "demo"}
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

              {error && <Alert severity="error">{error}</Alert>}
              {success && <Alert severity="success">{success}</Alert>}

              <Button type="submit" variant="contained" color="primary" size="large" disabled={busy} endIcon={<LoginIcon />}>
                {mode === "login" ? "Panele Gir" : "Hesap Oluştur"}
              </Button>
            </Stack>
          </Box>

          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 3, textAlign: "center" }} className="mono">
            demo: <b>demo</b> / <b>demo123</b>
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}