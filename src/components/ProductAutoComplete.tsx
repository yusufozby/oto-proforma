import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, Paper, TextField, InputAdornment, Typography, CircularProgress } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ImageNotSupportedOutlinedIcon from "@mui/icons-material/ImageNotSupportedOutlined";
import { productSearchScore, resolveImageUrl, tl } from "../lib/helpers";
import { baseApi } from "../lib/storage";

// Katalogdaki ham ürün — henüz bir proformaya eklenmemiş, sadece arama
// sonucu olarak listelenen satır.
export interface CatalogProduct {
    Id: number;
    name: string;
    code: string;
    gtype?: string | null;
    parcel_inside?: number | null;
    image?: string | null;
    unit?: number | null;
}

interface ProductAutocompleteProps {
    catalog: CatalogProduct[];
    loading?: boolean;
    excludeIds?: Set<number>; // zaten eklenmiş ürünler tekrar önerilmesin diye
    onSelect: (product: CatalogProduct) => void;
    placeholder?: string;
}

const MAX_RESULTS = 8;
const SCORE_THRESHOLD = 0.28;

export default function ProductAutocomplete({
    catalog,
    loading,
    excludeIds,
    onSelect,
    placeholder = "Ürün adı veya kodu ile ara…",
}: ProductAutocompleteProps) {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function onDocClick(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", onDocClick);
        return () => document.removeEventListener("mousedown", onDocClick);
    }, []);

    // ARAMA GENİŞLİĞİ BURADA BELİRLENİR: eşik (SCORE_THRESHOLD) düşük
    // tutuluyor ve puanlama hem alt-dize hem bulanık benzerlik kullanıyor
    // — kasıtlı olarak toleranslı, daraltılmamalı.
    const results = useMemo(() => {
        const q = query.trim();
        if (!q) return [];

        return catalog
            .filter((p) => !excludeIds?.has(p.Id))
            .map((p) => ({ product: p, score: productSearchScore(q, p.code, p.name) }))
            .filter((x) => x.score >= SCORE_THRESHOLD)
            .sort((a, b) => b.score - a.score)
            .slice(0, MAX_RESULTS)
            .map((x) => x.product);
    }, [query, catalog, excludeIds]);

    useEffect(() => {
        setActiveIndex(0);
    }, [results.length, query]);

    const handleSelect = (product: CatalogProduct) => {
        onSelect(product);
        setQuery("");
        setOpen(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!open || results.length === 0) return;

        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((i) => Math.min(i + 1, results.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, 0));
        } else if (e.key === "Enter") {
            e.preventDefault();
            const chosen = results[activeIndex];
            if (chosen) handleSelect(chosen);
        } else if (e.key === "Escape") {
            setOpen(false);
        }
    };

    return (
        <Box ref={containerRef} sx={{ position: "relative" }}>
            <TextField
                fullWidth
                value={query}
                onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
                onFocus={() => query && setOpen(true)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                autoComplete="off"
                InputProps={{
                    startAdornment: (
                        <InputAdornment position="start">
                            <SearchIcon fontSize="small" sx={{ color: "text.secondary" }} />
                        </InputAdornment>
                    ),
                    endAdornment: loading ? (
                        <InputAdornment position="end"><CircularProgress size={16} /></InputAdornment>
                    ) : undefined,
                }}
                sx={{
                    "& .MuiOutlinedInput-root": {
                        borderRadius: 3,
                        bgcolor: "#fff",
                        fontSize: 16,
                    },
                }}
            />

            {open && query.trim().length > 0 && (
                <Paper
                    elevation={8}
                    sx={{
                        position: "absolute",
                        top: "calc(100% + 6px)",
                        left: 0,
                        right: 0,
                        zIndex: 20,
                        maxHeight: 420,
                        overflowY: "auto",
                        borderRadius: 2,
                    }}
                >
                    {results.length === 0 ? (
                        <Box sx={{ p: 3, textAlign: "center" }}>
                            <Typography variant="body2" color="text.secondary">
                                "{query}" için sonuç bulunamadı.
                            </Typography>
                        </Box>
                    ) : (
                        results.map((product, index) => {
                            const isActive = index === activeIndex;
                            const imgUrl = product.image ? resolveImageUrl(product.image, baseApi) : "";

                            return (
                                <Box
                                    key={product.Id}
                                    onMouseDown={(e) => { e.preventDefault(); handleSelect(product); }}
                                    onMouseEnter={() => setActiveIndex(index)}
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1.5,
                                        px: 2,
                                        py: 1.25,
                                        cursor: "pointer",
                                        bgcolor: isActive ? "action.selected" : "transparent",
                                        borderBottom: "1px solid",
                                        borderColor: "divider",
                                        "&:last-of-type": { borderBottom: "none" },
                                    }}
                                >
                                    <Box
                                        sx={{
                                            width: 44, height: 44, borderRadius: 1.5, flexShrink: 0,
                                            bgcolor: "#FAF9F5", border: "1px solid", borderColor: "divider",
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            overflow: "hidden",
                                        }}
                                    >
                                        {imgUrl ? (
                                            <Box component="img" src={imgUrl} alt={product.name} sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                        ) : (
                                            <ImageNotSupportedOutlinedIcon fontSize="small" sx={{ color: "text.secondary" }} />
                                        )}
                                    </Box>

                                    <Box sx={{ minWidth: 0, flex: 1 }}>
                                        <Typography variant="body2" fontWeight={600} noWrap>{product.name || "İsimsiz ürün"}</Typography>
                                        <Typography variant="caption" color="text.secondary" className="mono">{product.code || "—"}</Typography>
                                    </Box>

                                    {typeof product.unit === "number" && (
                                        <Typography variant="body2" className="mono" color="text.secondary" sx={{ flexShrink: 0 }}>
                                            {tl(product.unit)}
                                        </Typography>
                                    )}
                                </Box>
                            );
                        })
                    )}
                </Paper>
            )}
        </Box>
    );
}