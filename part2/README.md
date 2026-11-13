# wira.studio — Studio-Grade Portfolio

Website portofolio independen berstandar Product & Software Studio untuk **Wira Sukma Saputra** (dibangun di atas Astro 5, TypeScript strict, Tailwind CSS v4, GSAP, Lenis, MDX, dan Zod).

---

## Cara Menjalankan Secara Lokal

```bash
npm install
npm run dev
```

Buka `http://localhost:4321` di browser.

---

## Perintah Build & Verifikasi Kualitas

```bash
# Pemeriksaan TypeScript + Astro check + Static build ke dist/
npm run build

# Validasi otomatis Acceptance Criteria (route, OG PNG, atribut img, zero TODO_METRIC bocor)
npm run check:content

# Uji E2E & Audit Aksesibilitas axe-core di browser Chrome
npm test
```

---

## Cara Menambah Case Study Baru

1. Tambahkan berkas `.mdx` versi Bahasa Indonesia di `src/content/work/id/<slug>.mdx` dan versi Bahasa Inggris di `src/content/work/en/<slug>.mdx`.
2. Ikuti seluruh skema frontmatter Zod di `src/content.config.ts` (`summary` maksimal 160 karakter, wajib memiliki `architecture` dengan daftar `nodes`, `edges`, serta sumber `mermaid`).
3. Simpan aset cover di `public/images/work/<slug>.png` dengan ukuran eksplisit `1280×800`.
4. Jika ada metrik klien yang belum terverifikasi, isi nilai `"TODO_METRIC"` — UI akan menampilkannya secara jujur sebagai `"—"`.
5. Jalankan `npm run build && npm run check:content` untuk memastikan seluruh halaman statis dan gambar OG `/og/<slug>.png` terbentuk sempurna.

---

## Cara Deploy (Vercel / Netlify / Cloudflare Pages)

- **Build command:** `npm run build`
- **Output directory:** `dist`
- Header keamanan CSP & Cache-Control sudah dikonfigurasi di `public/_headers`.
- Opsional: atur variabel lingkungan `PUBLIC_FORM_ENDPOINT` (Web3Forms / Formspree) bila ingin Brief Wizard mengirim payload ke endpoint form selain jalur cepat email & WhatsApp.

