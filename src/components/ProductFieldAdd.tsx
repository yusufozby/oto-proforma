import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AppBar, Toolbar, Box, Container, Typography, Button, IconButton, TextField, Grid,
  Select, MenuItem, Checkbox, FormControlLabel, Table, TableHead, TableBody, TableRow,
  TableCell, TableContainer, Paper, Alert, Chip,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import TuneIcon from "@mui/icons-material/Tune";
import { getProductFields, saveProductFields } from "../lib/productFields";
import type { ProductFieldDef, ProductFieldType } from "../types";

const TYPE_LABEL: Record<ProductFieldType, string> = {
  number: "Sayı",
  string: "Metin",
  combobox: "Seçim Listesi (Combobox)",
  file: "Dosya",
};

export default function ProductFieldAdd() {
  const navigate = useNavigate();
  const [fields, setFields] = useState<ProductFieldDef[]>([]);
  const [name, setName] = useState("");
  const [type, setType] = useState<ProductFieldType>("string");
  const [searchable, setSearchable] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => setFields(await getProductFields()))();
  }, []);

  const addField = async () => {
    setError("");
    if (!name.trim()) { setError("Alan adı zorunludur."); return; }
    if (fields.some((f) => f.name.toLowerCase() === name.trim().toLowerCase())) {
      setError("Bu isimde bir alan zaten var.");
      return;
    }
    const next: ProductFieldDef[] = [
      ...fields,
      { id: crypto.randomUUID(), name: name.trim(), type, searchable },
    ];
    setFields(next);
    await saveProductFields(next);
    setName(""); setType("string"); setSearchable(false);
    setMsg("Alan eklendi.");
    setTimeout(() => setMsg(""), 2500);
  };

  const removeField = async (id: string) => {
    const next = fields.filter((f) => f.id !== id);
    setFields(next);
    await saveProductFields(next);
  };

  return (
    <Box sx={{ minHeight: 600 }}>
      <AppBar position="sticky">
        <Toolbar sx={{ maxWidth: 900, width: "100%", mx: "auto" }}>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/dashboard")} color="inherit">Panele Dön</Button>
          <Typography variant="body1" fontWeight={600} sx={{ flexGrow: 1, textAlign: "center" }}>Dinamik Alan Ekle</Typography>
          <Box sx={{ width: 96 }} />
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="info" icon={<TuneIcon fontSize="small" />} sx={{ mb: 3 }}>
          Burada tanımladığınız alanlar ürün şemasına eklenir; ürün tablosunda kullanılabilmesi için
          ayrıca ürün formuna bağlanması gerekir.
        </Alert>

        <Paper variant="outlined" sx={{ p: 3, mb: 4 }}>
          <Typography variant="subtitle2" sx={{ mb: 2 }}>Yeni Alan</Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={5}>
              <TextField label="Alan Adı" fullWidth size="small" value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn. Renk, Ağırlık, Sertifika Dosyası" />
            </Grid>
            <Grid item xs={12} sm={4}>
              <Select fullWidth size="small" value={type} onChange={(e) => setType(e.target.value as ProductFieldType)}>
                <MenuItem value="string">Metin</MenuItem>
                <MenuItem value="number">Sayı</MenuItem>
                <MenuItem value="combobox">Seçim Listesi (Combobox)</MenuItem>
                <MenuItem value="file">Dosya</MenuItem>
              </Select>
            </Grid>
            <Grid item xs={12} sm={3}>
              <FormControlLabel
                control={<Checkbox checked={searchable} onChange={(e) => setSearchable(e.target.checked)} />}
                label="Aranabilir"
              />
            </Grid>
          </Grid>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          {msg && <Alert severity="success" sx={{ mt: 2 }}>{msg}</Alert>}
          <Box sx={{ mt: 2 }}>
            <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={addField}>Alan Ekle</Button>
          </Box>
        </Paper>

        <Typography variant="subtitle2" sx={{ mb: 1.5 }}>Tanımlı Alanlar</Typography>
        {fields.length === 0 ? (
          <Typography variant="body2" color="text.secondary">Henüz özel alan tanımlanmadı.</Typography>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: "#EAE6DA" }}>
                  <TableCell>Alan Adı</TableCell>
                  <TableCell>Tip</TableCell>
                  <TableCell align="center">Aranabilir</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {fields.map((f) => (
                  <TableRow key={f.id} hover>
                    <TableCell>{f.name}</TableCell>
                    <TableCell>{TYPE_LABEL[f.type]}</TableCell>
                    <TableCell align="center">
                      {f.searchable ? <Chip size="small" color="primary" label="Evet" /> : <Chip size="small" label="Hayır" sx={{ bgcolor: "#EAE6DA" }} />}
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => removeField(f.id)} title="Sil">
                        <DeleteOutlineIcon fontSize="small" color="error" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Container>
    </Box>
  );
}
