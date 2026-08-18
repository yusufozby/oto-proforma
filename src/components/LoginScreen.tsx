import React, { useState } from "react";
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
import { storeGet, storeSet } from "../lib/storage";
import { emptySeller } from "../lib/seedData";
import type { UsersMap, UserRole, Session } from "../types";

interface LoginScreenProps {
  onLogin: (session: Session) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [roleTab, setRoleTab] = useState<UserRole>("firma");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const switchRoleTab = (r: UserRole | null) => {
    if (!r) return;
    setRoleTab(r);
    setMode("login");
    setError("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const users = await storeGet<UsersMap>("users", {});

    if (mode === "login") {
      const u = users[username.trim()];
      if (!u || u.password !== password) {
        setError("Kullanıcı adı veya şifre hatalı.");
        setBusy(false);
        return;
      }
      if (u.role !== roleTab) {
        setError(
          roleTab === "admin"
            ? "Bu hesap yönetici değil. Firma girişini deneyin."
            : "Bu hesap yönetici hesabı. Admin girişini deneyin."
        );
        setBusy(false);
        return;
      }
      onLogin({ username: username.trim(), name: u.name, role: u.role, email: u.email, seller: u.seller });
    } else {
      if (!username || !password || !company) {
        setError("Lütfen tüm alanları doldurun.");
        setBusy(false);
        return;
      }
      if (users[username]) {
        setError("Bu kullanıcı adı zaten kayıtlı.");
        setBusy(false);
        return;
      }
      const seller = { ...emptySeller(), firma: company };
      const nextUsers: UsersMap = {
        ...users,
        [username]: { password, name: name || username, role: "firma", seller },
      };
      await storeSet("users", nextUsers);
      await storeSet(`proformas:${username}`, []);
      onLogin({ username, name: name || username, role: "firma", seller });
    }
    setBusy(false);
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
              onChange={(_, v) => { if (v) { setMode(v); setError(""); } }}
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
                  <TextField label="Yetkili Adı" value={name} onChange={(e) => setName(e.target.value)} fullWidth placeholder="Mehmet Kara" />
                  <TextField label="Firma Adı" value={company} onChange={(e) => setCompany(e.target.value)} fullWidth placeholder="Firma Ltd. Şti." />
                </>
              )}
              <TextField
                label="Kullanıcı Adı"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                fullWidth
                placeholder={roleTab === "admin" ? "admin" : "demo"}
                autoComplete="username"
              />
              <TextField
                label="Şifre"
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                fullWidth
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
