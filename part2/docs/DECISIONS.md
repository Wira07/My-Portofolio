# DECISIONS — Arsitektur & Desain `wira.studio`

1. **Arah Visual "Editorial Engineering"**:
   - Mengutamakan keterbacaan, struktur grid 12 kolom dengan garis tipis 1px (`--line`), tipografi kontras antara *display serif* (`Instrument Serif`) dan *technical monospace* (`JetBrains Mono`), serta penghindaran elemen SaaS generik.
2. **Dark-First dengan Tema Terang Terkalibrasi**:
   - `#0A0B0D` sebagai default latar tema gelap dengan aksen `#C8FF3D`, dan `#F6F5F1` pada tema terang dengan aksen `#4F7A00` agar kontras teks dan tombol primer memenuhi WCAG 2.2 AA (≥ 4.5:1).
3. **Self-Hosted Web Fonts (`.woff2`)**:
   - Seluruh font (`Instrument Serif`, `Inter Tight`, `JetBrains Mono`) disimpan lokal di `public/fonts/*.woff2` dengan `font-display: swap`. Zero external CDN calls saat runtime.
4. **Build-Time SVG Architecture Diagrams (`ArchDiagram.astro`)**:
   - Diagram arsitektur pada setiap case study dirender langsung menjadi SVG presisi saat build tanpa runtime Mermaid JS, dilengkapi toggle sumber kode Mermaid asli agar tetap dapat diaudit secara teknis.
5. **Integritas Data & Metrik (`TODO_METRIC`)**:
   - Metrik yang belum terkonfirmasi klien disimpan sebagai `TODO_METRIC` di MDX frontmatter dan diformat oleh `MetricCounter.astro` menjadi `"—"` disertai catatan transparan, sehingga tidak ada metrik karangan maupun string debug yang bocor ke tampilan publik.
6. **Showcase Beranda: Stacking Case Cards + Horizontal Scroll Fallback**:
   - Menggunakan susunan *stacking editorial cards* berindeks `01`–`04` untuk proyek unggulan di `/`, dengan *parallax subtle* pada cover gambar yang otomatis nonaktif pada `prefers-reduced-motion: reduce`.
7. **Dwibahasa Statis (`/..` untuk ID dan `/en/..` untuk EN)**:
   - Seluruh UI string berada di `src/i18n/id.json` & `src/i18n/en.json`, sementara seluruh studi kasus dan catatan teknis berada di `src/content/{work,notes}/{id,en}/*.mdx`.
8. **Native Node + Satori Build-Time OG PNG Generation**:
   - Endpoint `/og/[slug].png` menghasilkan gambar PNG statis saat build untuk `default` serta seluruh case studies dan notes.

