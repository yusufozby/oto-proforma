import { createTheme } from "@mui/material/styles";

/**
 * Kendi paletimiz: elektrik/aydınlatma temalı bakır + petrol yeşili.
 * MUI'nin varsayılan mavisi yerine markaya özgü, sıcak ve endüstriyel bir
 * görünüm hedeflendi.
 */
const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#B5651D", // bakır
      light: "#D98F52",
      dark: "#7A4213",
      contrastText: "#FFFFFF",
    },
    secondary: {
      main: "#1F5C57", // petrol yeşili
      light: "#3E7A75",
      dark: "#123936",
      contrastText: "#FFFFFF",
    },
    error: { main: "#B3432C" },
    warning: { main: "#E8A33D" },
    success: { main: "#3E7A5B" },
    background: {
      default: "#F3F1EB",
      paper: "#FFFFFF",
    },
    text: {
      primary: "#181D21",
      secondary: "#6B6459",
    },
    divider: "#DCD8CC",
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: "'Inter', sans-serif",
    h1: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700 },
    h2: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700 },
    h3: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600 },
    h4: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600 },
    h5: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600 },
    h6: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600 },
    button: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, textTransform: "none" },
  },
  components: {
    MuiPaper: {
      styleOverrides: { root: { backgroundImage: "none" } },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: "#FFFFFF",
          color: "#181D21",
          boxShadow: "none",
          borderBottom: "1px solid #DCD8CC",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 8 },
      },
    },
    MuiChip: {
      styleOverrides: { root: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600 } },
    },
    MuiTableCell: {
      styleOverrides: { head: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: "#6B6459" } },
    },
  },
});

export default theme;
