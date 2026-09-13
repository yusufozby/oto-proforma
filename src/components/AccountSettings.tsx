import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AppBar, Toolbar, Box, Container, Typography, Button, IconButton, TextField,
  Tabs, Tab, Paper, Alert, Stack, InputAdornment,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SaveIcon from "@mui/icons-material/Save";
import PersonIcon from "@mui/icons-material/Person";
import BusinessIcon from "@mui/icons-material/Business";
import KeyIcon from "@mui/icons-material/VpnKey";
import LinkIcon from "@mui/icons-material/Link";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { baseApi, storeSet } from "../lib/storage";
import type { Session } from "../types";

interface AccountSettingsProps {
  session: Session;
  setSession: React.Dispatch<React.SetStateAction<Session | null>>
  onSessionUpdate: (s: Session) => void;
}

type TabKey = "profile" | "seller" | "links" | "password";

const TABS: { key: TabKey; label: string; icon: React.ReactElement }[] = [
  { key: "profile", label: "Profil", icon: <PersonIcon fontSize="small" /> },
  { key: "seller", label: "Satıcı Bilgileri", icon: <BusinessIcon fontSize="small" /> },
  { key: "links", label: "Bağlantılar", icon: <LinkIcon fontSize="small" /> },
  { key: "password", label: "Şifre", icon: <KeyIcon fontSize="small" /> },
];

// .NET'ten gelen hata gövdesi string / {message} / ValidationProblemDetails
// olarak dönebilir — diğer ekranlardaki ile aynı yardımcı.
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

// Oturumun sayfa yenilendiğinde kaybolmaması için tarayıcı depolamasına
// yazılan anahtar. App.tsx boot sırasında bu anahtarı okuyorsa (bkz.
// CURRENT_SESSION_KEY) aynı anahtarı kullandığından emin olun; farklıysa
// bu string'i App.tsx'teki ile birebir eşleştirin.
const CURRENT_SESSION_KEY = "session:current";

/**
 * Bir güncelleme sonrası hem React state'ini (setSession) hem de kalıcı
 * depolamayı (storeSet) tek bir yerden günceller — böylece her save
 * fonksiyonu bu iki adımı ayrı ayrı tekrarlamak zorunda kalmıyor ve
 * ikisi asla birbirinden geride kalmıyor.
 */
async function persistSession(
  updated: Session,
  setSession: React.Dispatch<React.SetStateAction<Session | null>>,
  onSessionUpdate: (s: Session) => void
) {
  setSession(updated);
  onSessionUpdate(updated);
  await storeSet(CURRENT_SESSION_KEY, updated);
}

export default function AccountSettings({ session, onSessionUpdate, setSession }: AccountSettingsProps) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>("profile");

  const [email, setEmail] = useState(session.email || "");
  const [profileMsg, setProfileMsg] = useState("");
  const [profileErr, setProfileErr] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);

  const [firm, setFirm] = useState(session.firm || "");
  const [centerAddress, setCenterAddress] = useState(session.center_address || "");
  const [fabricAddress, setFabricAddress] = useState(session.fabric_address || "");
  const [sellerPhone, setSellerPhone] = useState(session.phone || "");
  const [sellerEmail, setSellerEmail] = useState(session.seller_email || "");
  const [sellerMsg, setSellerMsg] = useState("");
  const [sellerErr, setSellerErr] = useState("");
  const [sellerBusy, setSellerBusy] = useState(false);

  const [phoneLink, setPhoneLink] = useState(session.phone_link || "");
  const [googleMapLink, setGoogleMapLink] = useState(session.google_map_link || "");
  const [websiteLink, setWebsiteLink] = useState(session.website_link || "");
  const [linksMsg, setLinksMsg] = useState("");
  const [linksErr, setLinksErr] = useState("");
  const [linksBusy, setLinksBusy] = useState(false);

  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pwMsg, setPwMsg] = useState("");
  const [pwErr, setPwErr] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  const saveProfile = async () => {
    setProfileErr(""); setProfileMsg(""); setProfileBusy(true);
    try {
      const response = await fetch(`${baseApi}/api/auth/update`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        setProfileErr(await extractErrorMessage(response, "Profil güncellenemedi."));
        return;
      }

      const data = await response.json();
      await persistSession({ ...session, email: data.email }, setSession, onSessionUpdate);
      setProfileMsg("Profil güncellendi.");
      setTimeout(() => setProfileMsg(""), 2500);
    } catch {
      setProfileErr("Sunucuya bağlanılamadı.");
    } finally {
      setProfileBusy(false);
    }
  };

  const saveSeller = async () => {
    setSellerErr(""); setSellerMsg(""); setSellerBusy(true);
    try {
      const response = await fetch(`${baseApi}/api/auth/update`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({
          firm,
          centerAddress,
          fabricAddress,
          phone: sellerPhone,
          sellerEmail,
        }),
      });

      if (!response.ok) {
        setSellerErr(await extractErrorMessage(response, "Satıcı bilgileri güncellenemedi."));
        return;
      }

      const data = await response.json();
      await persistSession(
        {
          ...session,
          firm: data.firm,
          center_address: data.centerAddress,
          fabric_address: data.fabricAddress,
          phone: data.phone,
          seller_email: data.sellerEmail,
        },
        setSession,
        onSessionUpdate
      );
      setSellerMsg("Satıcı bilgileri güncellendi. Yeni oluşturulan proformalarda otomatik kullanılacak.");
      setTimeout(() => setSellerMsg(""), 3500);
    } catch {
      setSellerErr("Sunucuya bağlanılamadı.");
    } finally {
      setSellerBusy(false);
    }
  };

  const saveLinks = async () => {
    setLinksErr(""); setLinksMsg(""); setLinksBusy(true);
    try {
      const response = await fetch(`${baseApi}/api/auth/update`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({
          phoneLink,
          googleMapLink,
          websiteLink,
        }),
      });

      if (!response.ok) {
        setLinksErr(await extractErrorMessage(response, "Bağlantı bilgileri güncellenemedi."));
        return;
      }

      const data = await response.json();
      await persistSession(
        {
          ...session,
          phone_link: data.phoneLink,
          google_map_link: data.googleMapLink,
          website_link: data.websiteLink,
        },
        setSession,
        onSessionUpdate
      );
      setLinksMsg("Bağlantı bilgileri başarıyla güncellendi.");
      setTimeout(() => setLinksMsg(""), 3500);
    } catch {
      setLinksErr("Sunucuya bağlanılamadı.");
    } finally {
      setLinksBusy(false);
    }
  };

  const changePassword = async () => {
    setPwErr(""); setPwMsg("");

    if (!oldPw || !newPw) {
      setPwErr("Mevcut ve yeni şifre zorunludur.");
      return;
    }
    if (newPw !== newPw2) {
      setPwErr("Yeni şifreler eşleşmiyor.");
      return;
    }

    setPwBusy(true);
    try {
      const response = await fetch(`${baseApi}/api/auth/change-password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ oldPassword: oldPw, newPassword: newPw }),
      });

      if (!response.ok) {
        setPwErr(await extractErrorMessage(response, "Şifre değiştirilemedi."));
        return;
      }

      // Şifre değişse de session'ın kendisinde bir alan değişmiyor,
      // ama kalıcı depolamadaki kopyanın tutarlı kalması için yine de
      // storeSet ile mevcut session'ı yeniden yazıyoruz.
      await persistSession(session, setSession, onSessionUpdate);

      setOldPw(""); setNewPw(""); setNewPw2("");
      setPwMsg("Şifre başarıyla değiştirildi.");
      setTimeout(() => setPwMsg(""), 2500);
    } catch {
      setPwErr("Sunucuya bağlanılamadı.");
    } finally {
      setPwBusy(false);
    }
  };

  return (
    <Box sx={{ minHeight: 600 }}>
      <AppBar position="sticky">
        <Toolbar sx={{ maxWidth: 900, width: "100%", mx: "auto" }}>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/dashboard")} color="inherit">Panele Dön</Button>
          <Typography variant="body1" fontWeight={600} sx={{ flexGrow: 1, textAlign: "center" }}>Hesap Ayarları</Typography>
          <Box sx={{ width: 96 }} />
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ py: 4 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}>
          {TABS.map((t) => <Tab key={t.key} value={t.key} label={t.label} icon={t.icon} iconPosition="start" sx={{ minHeight: 48 }} />)}
        </Tabs>

        <Paper variant="outlined" sx={{ p: 3 }}>
          {tab === "profile" && (
            <Stack spacing={2.5} sx={{ maxWidth: 420 }}>
              <TextField label="E-mail" fullWidth value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ornek@firma.com" />
              {profileErr && <Alert severity="error">{profileErr}</Alert>}
              {profileMsg && <Alert severity="success">{profileMsg}</Alert>}
              <Box><Button variant="contained" startIcon={<SaveIcon />} onClick={saveProfile} disabled={profileBusy}>Kaydet</Button></Box>
            </Stack>
          )}

          {tab === "seller" && (
            <Stack spacing={2.5} sx={{ maxWidth: 480 }}>
              <Typography variant="caption" color="text.secondary">Bu bilgiler her yeni proformada satıcı olarak otomatik kullanılır.</Typography>
              <TextField label="Firma" fullWidth value={firm} onChange={(e) => setFirm(e.target.value)} />
              <TextField label="Merkez Adres" fullWidth value={centerAddress} onChange={(e) => setCenterAddress(e.target.value)} />
              <TextField label="Fabrika Adres" fullWidth value={fabricAddress} onChange={(e) => setFabricAddress(e.target.value)} />
              <TextField label="Telefon" fullWidth value={sellerPhone} onChange={(e) => setSellerPhone(e.target.value)} />
              <TextField label="E-mail" fullWidth value={sellerEmail} onChange={(e) => setSellerEmail(e.target.value)} />
              {sellerErr && <Alert severity="error">{sellerErr}</Alert>}
              {sellerMsg && <Alert severity="success">{sellerMsg}</Alert>}
              <Box><Button variant="contained" startIcon={<SaveIcon />} onClick={saveSeller} disabled={sellerBusy}>Kaydet</Button></Box>
            </Stack>
          )}

          {tab === "links" && (
            <Stack spacing={2.5} sx={{ maxWidth: 480 }}>
              <Typography variant="caption" color="text.secondary">İletişim ve konum bağlantı bilgilerinizi buradan yönetebilirsiniz.</Typography>
              <TextField label="GSM" fullWidth value={phoneLink} onChange={(e) => setPhoneLink(e.target.value)} placeholder="+90 5XX XXX XX XX" />
              <TextField label="Google Maps Linki" fullWidth value={googleMapLink} onChange={(e) => setGoogleMapLink(e.target.value)} placeholder="https://maps.google.com/..." />
              <TextField label="Website Linki" fullWidth value={websiteLink} onChange={(e) => setWebsiteLink(e.target.value)} placeholder="https://www.ornek.com" />
              {linksErr && <Alert severity="error">{linksErr}</Alert>}
              {linksMsg && <Alert severity="success">{linksMsg}</Alert>}
              <Box><Button variant="contained" startIcon={<SaveIcon />} onClick={saveLinks} disabled={linksBusy}>Kaydet</Button></Box>
            </Stack>
          )}

          {tab === "password" && (
            <Stack spacing={2.5} sx={{ maxWidth: 420 }}>
              <TextField
                label="Mevcut Şifre" type={showPw ? "text" : "password"} fullWidth value={oldPw} onChange={(e) => setOldPw(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" onClick={() => setShowPw((s) => !s)}>{showPw ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}</IconButton></InputAdornment> }}
              />
              <TextField label="Yeni Şifre" type={showPw ? "text" : "password"} fullWidth value={newPw} onChange={(e) => setNewPw(e.target.value)} />
              <TextField label="Yeni Şifre (Tekrar)" type={showPw ? "text" : "password"} fullWidth value={newPw2} onChange={(e) => setNewPw2(e.target.value)} />
              {pwErr && <Alert severity="error">{pwErr}</Alert>}
              {pwMsg && <Alert severity="success">{pwMsg}</Alert>}
              <Box><Button variant="contained" startIcon={<SaveIcon />} onClick={changePassword} disabled={pwBusy}>Şifreyi Değiştir</Button></Box>
            </Stack>
          )}
        </Paper>
      </Container>
    </Box>
  );
}