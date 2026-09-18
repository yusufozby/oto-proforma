import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Box, CircularProgress, Typography } from "@mui/material";
import LoginScreen from "./components/LoginScreen";
import Dashboard from "./components/Dashboard";
import ProformaEditor from "./components/ProformaEditor";
import AccountSettings from "./components/AccountSettings";
import ProductFieldAdd from "./components/ProductFieldAdd";
import { storeGet, storeSet } from "./lib/storage";
import type { Proforma, Session, UsersMap } from "./types";
import AppointmentsAdmin from "./components/AppointmentsAdmin";
import AppointmentsCustomer from "./components/AppointmentsCustomer";
import AdminDashboard from "./components/DashboardAdmin";
import VerifyEmailScreen from "./components/VerifyEmailScreen";
import ForgotPasswordScreen from "./components/ForgotPasswordScreen";
import ResetPasswordScreen from "./components/ResetPasswordScreen";
const CURRENT_SESSION_KEY = "session:current";

/**
 * App yalnızca oturumu (kim giriş yapmış) ve rota tablosunu yönetir.
 * Proforma verisi burada TUTULMAZ — her ekran kendi ihtiyacı olan veriyi
 * kendisi yükler/kaydeder: Dashboard listeyi kendisi çeker, ProformaEditor
 * düzenlediği tek proformayı kendisi yükleyip kaydeder. Bu, App.tsx'i
 * sayfa yönlendirmesinden ayrı bir "global proforma deposu" olmaktan çıkarır.
 */
export default function App() {
  const [booted, setBooted] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  // Boot: admin + demo hesaplarının HER ZAMAN var ve doğru şemada olduğundan
  // emin ol (eski/eksik bir "users" kaydını onarır, firma kayıtlarını silmez).
  // Ardından, varsa daha önce giriş yapılmış oturumu geri yükle — böylece
  // /dashboard, /proforma/edit/3 gibi adresler sayfa yenilense bile çalışır.
  useEffect(() => {
    (async () => {

      const seeded: any[] = [];
      let changed = false;





      const saved = await storeGet<Session | null>(CURRENT_SESSION_KEY, null);
      console.log("saved", saved)
      if (saved) {

        setSession(saved);
      }

      setBooted(true);
    })();
  }, []);


  const handleLogout = async () => {
    setSession(null);
    await storeSet(CURRENT_SESSION_KEY, null);
  };

  if (!booted) {
    return (
      <Box sx={{ minHeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 1.5 }}>
        <CircularProgress size={20} thickness={5} />
        <Typography variant="body2" color="text.secondary">yükleniyor…</Typography>
      </Box>
    );
  }
  const handleLogin = async (s: Session) => {
    setSession(s);
    await storeSet(CURRENT_SESSION_KEY, s);
  };
  return (
    <Box sx={{ minHeight: 600, width: "100%" }}>
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={<LoginScreen onLogin={handleLogin} />}

          />

          <Route
            path="/dashboard"
            element={session && session.role === "müşteri" ?
              <Dashboard session={session} onLogout={handleLogout} />
              : session && session.role === "admin" ? <AdminDashboard onLogout={handleLogout} session={session} /> : <Navigate to="/login" replace />}
          />

          <Route
            path="/proforma/add"
            element={session ?
              <ProformaEditor isEdit={false} session={session} />

              : session ? <Navigate to={'/dashboard'} /> : <Navigate to="/login" replace />}
          />

          <Route
            path="/proforma/edit/:id"
            element={session ? <ProformaEditor isEdit={true} session={session} /> : <Navigate to="/login" replace />}
          />

          <Route
            path="/account-settings"
            element={session ? <AccountSettings setSession={setSession} session={session} onSessionUpdate={(s) => setSession(s)} /> : <Navigate to="/login" replace />}
          />

          <Route
            path="/product-field-add"
            element={
              !session ? (
                <Navigate to="/login" replace />
              ) : session.role === "admin" ? (
                <ProductFieldAdd />
              ) : (
                <Navigate to="/dashboard" replace />
              )
            }
          />
          <Route
            path="/appointments"
            element={
              !session ? (
                <Navigate to="/login" replace />
              ) : session.role === "admin" ? (
                <AppointmentsAdmin session={session} onLogout={handleLogout} />
              ) : (
                <Navigate to="/dashboard" replace />
              )
            }
          />
          <Route path="/reset-password" element={<ResetPasswordScreen />} />
          <Route path="/verify-email" element={<VerifyEmailScreen />} />
          <Route path="/forgot-password" element={<ForgotPasswordScreen />} />

          <Route
            path="/my-appointments"
            element={
              !session ? (
                <Navigate to="/login" replace />
              ) : session.role !== "admin" ? (
                <AppointmentsCustomer session={session} onLogout={handleLogout} />
              ) : (
                <Navigate to="/dashboard" replace />
              )
            }
          />
          <Route path="*" element={<Navigate to={session ? "/dashboard" : "/login"} replace />} />
        </Routes>
      </BrowserRouter>
    </Box>
  );
}
