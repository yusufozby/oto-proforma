import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AppBar, Toolbar, Box, Container, Typography, Button, IconButton, TextField, Grid,
  Tabs, Tab, Table, TableHead, TableBody, TableRow, TableCell, TableContainer, Paper,
  Select, MenuItem, Alert, Divider, Stack, InputAdornment,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SaveIcon from "@mui/icons-material/Save";
import PersonIcon from "@mui/icons-material/Person";
import BusinessIcon from "@mui/icons-material/Business";
import KeyIcon from "@mui/icons-material/VpnKey";
import GroupIcon from "@mui/icons-material/Group";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import { storeGet, storeSet } from "../lib/storage";

import type { Session, UsersMap, UserRole, SellerInfo } from "../types";

interface AccountSettingsProps {
  session: Session;
  onSessionUpdate: (s: Session) => void;
}

type TabKey = "profile" | "seller" | "password" | "users";

export default function AccountSettings({ session, onSessionUpdate }: AccountSettingsProps) {
  const navigate = useNavigate();
  const isAdmin = session.role === "admin";
  const [tab, setTab] = useState<TabKey>("profile");

  const TABS: { key: TabKey; label: string; icon: React.ReactElement }[] = [
    { key: "profile", label: "Profil", icon: <PersonIcon fontSize="small" /> },
    { key: "seller", label: "Satıcı Bilgileri", icon: <BusinessIcon fontSize="small" /> },
    { key: "password", label: "Şifre", icon: <KeyIcon fontSize="small" /> },
    ...(isAdmin ? [{ key: "users" as TabKey, label: "Kullanıcılar", icon: <GroupIcon fontSize="small" /> }] : []),
  ];


  const [email, setEmail] = useState(session.email || "");
  const [profileMsg, setProfileMsg] = useState("");

  const [seller, setSeller] = useState<Session>(session);
  const [sellerMsg, setSellerMsg] = useState("");

  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pwMsg, setPwMsg] = useState("");
  const [pwErr, setPwErr] = useState("");

  const [users, setUsers] = useState<UsersMap>({});
  const [newUser, setNewUser] = useState({ username: "", password: "", name: "", firma: "", role: "firma" as UserRole });
  const [userMsg, setUserMsg] = useState("");

  useEffect(() => {
    if (isAdmin) (async () => setUsers(await storeGet<UsersMap>("users", {})))();
  }, [isAdmin]);

  const saveProfile = async () => {
    const usersMap = await storeGet<UsersMap>("users", {});
    const current = usersMap[session.username];
    if (!current) return;
    // const updated: UsersMap = { ...usersMap, [session.username]: { ...current, fullname: name, email } };
    // await storeSet("users", updated);
    onSessionUpdate({ ...session, seller_email:email });
    setProfileMsg("Profil güncellendi.");
    setTimeout(() => setProfileMsg(""), 2500);
  };

  const saveSeller = async () => {
    const usersMap = await storeGet<UsersMap>("users", {});
    const current = usersMap[session.username];
    if (!current) return;
    // const updated: UsersMap = { ...usersMap, [session.username]: { ...current, seller } };
    // await storeSet("users", updated);
    onSessionUpdate({ ...session });
    setSellerMsg("Satıcı bilgileri güncellendi. Yeni oluşturulan proformalarda otomatik kullanılacak.");
    setTimeout(() => setSellerMsg(""), 3500);
  };

  const changePassword = async () => {
    setPwErr(""); setPwMsg("");
    const usersMap = await storeGet<UsersMap>("users", {});
    const current = usersMap[session.username];
    if (!current || current.password !== oldPw) { setPwErr("Mevcut şifre hatalı."); return; }
    if (!newPw || newPw.length < 4) { setPwErr("Yeni şifre en az 4 karakter olmalı."); return; }
    if (newPw !== newPw2) { setPwErr("Yeni şifreler eşleşmiyor."); return; }
    const updated: UsersMap = { ...usersMap, [session.username]: { ...current, password: newPw } };
    await storeSet("users", updated);
    setOldPw(""); setNewPw(""); setNewPw2("");
    setPwMsg("Şifre başarıyla değiştirildi.");
    setTimeout(() => setPwMsg(""), 2500);
  };

  const refreshUsers = async () => setUsers(await storeGet<UsersMap>("users", {}));

  const changeUserRole = async (username: string, role: UserRole) => {
    const usersMap = await storeGet<UsersMap>("users", {});
    if (!usersMap[username]) return;
    await storeSet("users", { ...usersMap, [username]: { ...usersMap[username], role } });
    await refreshUsers();
  };

  const deleteUser = async (username: string) => {
    if (username === session.username) return;
    const usersMap = await storeGet<UsersMap>("users", {});
    const { [username]: _removed, ...rest } = usersMap;
    await storeSet("users", rest);
    await refreshUsers();
  };

  const addUser = async () => {
    setUserMsg("");
    if (!newUser.username || !newUser.password || !newUser.firma) { setUserMsg("Kullanıcı adı, şifre ve firma zorunludur."); return; }
    const usersMap = await storeGet<UsersMap>("users", {});
    if (usersMap[newUser.username]) { setUserMsg("Bu kullanıcı adı zaten var."); return; }
    // const updated: UsersMap = {
    //   ...usersMap,
    //   [newUser.username]: { password: newUser.password, fullname: newUser.name || newUser.username, role: newUser.role },
    // };
    // await storeSet("users", updated);
    await storeSet(`proformas:${newUser.username}`, []);
    setNewUser({ username: "", password: "", name: "", firma: "", role: "firma" });
    await refreshUsers();
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
              {profileMsg && <Alert severity="success">{profileMsg}</Alert>}
              <Box><Button variant="contained" startIcon={<SaveIcon />} onClick={saveProfile}>Kaydet</Button></Box>
            </Stack>
          )}

          {tab === "seller" && (
            <Stack spacing={2.5} sx={{ maxWidth: 480 }}>
              <Typography variant="caption" color="text.secondary">Bu bilgiler her yeni proformada satıcı olarak otomatik kullanılır.</Typography>
              <TextField label="Firma" fullWidth value={seller.firm} onChange={(e) => setSeller({ ...seller, firm: e.target.value })} />
              <TextField label="Merkez Adres" fullWidth value={seller.center_address} onChange={(e) => setSeller({ ...seller, center_address: e.target.value })} />
              <TextField label="Fabrika Adres" fullWidth value={seller.fabric_address} onChange={(e) => setSeller({ ...seller, fabric_address: e.target.value })} />
              <TextField label="Telefon" fullWidth value={seller.phone} onChange={(e) => setSeller({ ...seller, phone: e.target.value })} />
              <TextField label="E-mail" fullWidth value={seller.seller_email} onChange={(e) => setSeller({ ...seller, seller_email: e.target.value })} />
              {sellerMsg && <Alert severity="success">{sellerMsg}</Alert>}
              <Box><Button variant="contained" startIcon={<SaveIcon />} onClick={saveSeller}>Kaydet</Button></Box>
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
              <Box><Button variant="contained" startIcon={<SaveIcon />} onClick={changePassword}>Şifreyi Değiştir</Button></Box>
            </Stack>
          )}

          {tab === "users" && isAdmin && (
            <Stack spacing={4}>
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1.5 }}>Kayıtlı Kullanıcılar</Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: "#EAE6DA" }}>
                        <TableCell>Kullanıcı Adı</TableCell>
                        <TableCell>Ad</TableCell>
                        <TableCell>Firma</TableCell>
                        <TableCell>Rol</TableCell>
                        <TableCell />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Object.entries(users).map(([uname, u]) => (
                        <TableRow key={uname} hover>
                          <TableCell className="mono">{uname}</TableCell>
                          <TableCell>{u.fullname}</TableCell>
                          <TableCell>{u.seller?.firma}</TableCell>
                          <TableCell>
                            <Select
                              size="small"
                              value={u.role}
                              disabled={uname === session.username}
                              onChange={(e) => changeUserRole(uname, e.target.value as UserRole)}
                            >
                              <MenuItem value="firma">Firma</MenuItem>
                              <MenuItem value="admin">Admin</MenuItem>
                            </Select>
                          </TableCell>
                          <TableCell align="right">
                            {uname !== session.username && (
                              <IconButton size="small" onClick={() => deleteUser(uname)} title="Kullanıcıyı sil">
                                <DeleteOutlineIcon fontSize="small" color="error" />
                              </IconButton>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>

              <Divider />

              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1.5, display: "flex", alignItems: "center", gap: 0.5 }}>
                  <AddIcon fontSize="small" /> Yeni Kullanıcı Ekle
                </Typography>
                <Grid container spacing={2} sx={{ maxWidth: 560 }}>
                  <Grid item xs={12} sm={6}><TextField label="Kullanıcı Adı" fullWidth value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} /></Grid>
                  <Grid item xs={12} sm={6}><TextField label="Şifre" fullWidth value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} /></Grid>
                  <Grid item xs={12} sm={6}><TextField label="Ad Soyad" fullWidth value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} /></Grid>
                  <Grid item xs={12} sm={6}><TextField label="Firma" fullWidth value={newUser.firma} onChange={(e) => setNewUser({ ...newUser, firma: e.target.value })} /></Grid>
                  <Grid item xs={12} sm={6}>
                    <Select fullWidth value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value as UserRole })}>
                      <MenuItem value="firma">Firma</MenuItem>
                      <MenuItem value="admin">Admin</MenuItem>
                    </Select>
                  </Grid>
                </Grid>
                {userMsg && <Alert severity="error" sx={{ mt: 2, maxWidth: 560 }}>{userMsg}</Alert>}
                <Box sx={{ mt: 2 }}>
                  <Button variant="contained" startIcon={<AdminPanelSettingsIcon />} onClick={addUser}>Kullanıcı Oluştur</Button>
                </Box>
              </Box>
            </Stack>
          )}
        </Paper>
      </Container>
    </Box>
  );
}
