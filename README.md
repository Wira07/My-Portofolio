# Portofolio — Wira Sukma Saputra

Situs statis single-page (HTML + CSS + JavaScript ES Modules), tanpa framework dan tanpa backend.
Spesifikasi lengkap: [PRD-portofolio-wira.md](PRD-portofolio-wira.md).

## Menjalankan

Modul ES butuh server HTTP (tidak bisa dibuka lewat `file://`).

- **Laragon**: buka `http://localhost/my_portofolio/` (atau `http://my_portofolio.test`).
- **Alternatif**: `npx serve .` atau `python -m http.server 8080` di folder ini.

## Struktur

```
index.html
css/        tokens, base, components, sections
js/         main.js (bootstrap), motion.js (token), render.js, hero.js, hero-webgl.js,
            preloader.js, smooth-scroll.js, cursor.js, nav.js, theme.js, sections/*
data/       content.js  ← SEMUA konten diedit di sini
assets/     img/ (cover proyek), fonts/, Wira-Sukma-Saputra-CV.pdf  ← TAMBAHKAN file CV
vendor/     salinan lokal GSAP 3.13 (+ScrollTrigger, SplitText, Flip), Lenis, Three.js r160
```

## Yang sudah siap & yang bisa disesuaikan (PRD bagian 14)

1. **CV PDF** → sudah tersedia di `assets/Wira-Sukma-Saputra-CV.pdf` (typo metadata sudah diperbaiki menjadi `Freelancer`).
2. **Link GitHub / LinkedIn** → sudah terisi di `data/content.js` (`meta.social`) dan JSON-LD `index.html`.
3. **Proyek (`content.projects`)**: gambar sampul sudah dioptimasi ke format `.webp` (`assets/img/*.webp` + fallback `.jpg`). Silakan tambah `gallery` atau `links` (`live`, `github`, `playstore`) di `data/content.js` bila diperlukan.
4. **Foto**: panel monogram "WS" di section Tentang sudah siap; dapat diganti foto cutout kapan saja.
5. **Domain**: ubah `https://wirasukma.dev/` di `index.html`, `robots.txt`, dan `sitemap.xml` sesuai domain produksi.

## Catatan teknis

- Hanya `transform`, `opacity`, dan `clip-path` yang dianimasikan.
- `prefers-reduced-motion`: tanpa preloader, smooth scroll, parallax, partikel (diganti gradien statis), dan pin horizontal.
- Tanpa WebGL → mesh gradient CSS. Perangkat `hardwareConcurrency ≤ 4` → partikel −60% dan grain mati.
- Preloader hanya sekali per sesi (`sessionStorage`).
