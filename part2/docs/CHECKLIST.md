# CHECKLIST — Verifikasi Acceptance Criteria `wira.studio`

Dokumen ini mencatat hasil verifikasi aktual setelah build final dan pengujian otomatis di `c:\laragon\www\my_portofolio\part2`.

---

## Status Acceptance Criteria (Bagian 11 PRD)

- [x] **`npm run build` sukses tanpa error TypeScript/`astro check`**:
  - Lulus: `Result (67 files): 0 errors, 0 warnings, 0 hints`.
  - Menghasilkan 39 halaman statis + 12 gambar OG PNG (`dist/og/*.png`) + `sitemap.xml` + `robots.txt` + `rss.xml`.
  - Total client bundle gzipped: `ClientRouter` (`5.28 kB`) + `BaseLayout` (`51.93 kB`).
- [x] **Semua 8 case study lolos validasi skema Zod**:
  - Ke-8 studi kasus (`ag-420-gas-analyzer`, `smart-attendance-ai`, `parent-notifications`, `kepalqu`, `techop-id`, `orion-studio`, `yolo11-detection`, `salat-detection`) dan 3 Engineering Notes (`mqtt-realtime-dashboard`, `yolo11-android-tflite`, `whatsapp-login-fcm-parent-app`) tersedia lengkap dalam versi `id` dan `en` serta lolos `astro check`.
- [x] **Semua route Bagian 4 ada dan menghasilkan HTML statis**:
  - Terverifikasi lewat `npm run check:content`: `/`, `/work`, `/work/[slug]`, `/capabilities`, `/process`, `/notes`, `/notes/[slug]`, `/about`, `/engage`, `/uses`, `/404.html`, padanan `/en/*`, `/sitemap.xml`, `/robots.txt`, `/rss.xml`, dan `/og/[slug].png` (57 artifak terverifikasi).
- [x] **axe: 0 pelanggaran *serious/critical* di semua route uji (Dark & Light)**:
  - Terverifikasi oleh Playwright `@axe-core/playwright` (`npm test`) pada `/`, `/work`, `/work/ag-420-gas-analyzer`, dan `/engage` dalam mode gelap dan terang (`0` pelanggaran serious/critical).
- [x] **Playwright E2E lulus (`7 passed`)**:
  - Navigasi antar rute & render `<h1>` bersih.
  - Toggle tema gelap/terang persisten lewat `localStorage` & toggle bahasa ID ↔ EN.
  - Filter kategori studi kasus di `/work` (`All`, `Web`, `Android`, `IoT`, `AI`, `UI/UX`).
  - Command Palette (`Ctrl+K`) filter cepat dan navigasi keyboard.
  - Brief Wizard 4 tahap (kalkulasi estimasi, validasi input, ringkasan, fallback `mailto:` dan WhatsApp).
  - Mode `prefers-reduced-motion: reduce` menonaktifkan GSAP & Lenis (`data-motion-disabled="true"`).
- [x] **Zero hard-code teks di komponen & zero metrik karangan (`TODO_METRIC` -> `"—"`):**
  - Diverifikasi oleh `scripts/verify-criteria.mjs`: 0 kebocoran literal `TODO_METRIC` di `dist/**/*.html` dan 0 prose hard-code di `src/components/**/*.astro`.
- [x] **Seluruh `<img>` memiliki `width`, `height`, dan `alt`:**
  - Diverifikasi oleh `scripts/verify-criteria.mjs`: 62 elemen `<img>` across 39 HTML files valid tanpa missing attribute.
- [x] **README tersedia (`README.md`):**
  - Berisi cara jalan lokal, verifikasi, panduan menambah case study, dan cara deploy.
- [ ] **Lighthouse CI mobile & multi-engine (`WebKit`/`Firefox`)**:
  - Belum dijalankan terpisah di sesi ini; Playwright baru diverifikasi pada browser Chrome lokal (`channel: "chrome"`).

