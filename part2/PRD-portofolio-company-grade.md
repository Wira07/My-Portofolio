# PRD — Portofolio "Studio-Grade" Wira Sukma Saputra

> Dokumen ini dirancang untuk dieksekusi **multi-agent (swarm)**. Setiap agent punya wilayah file sendiri, kontrak antar-agent sudah didefinisikan, dan ada acceptance criteria yang bisa dicek otomatis. Baca Bagian 12 (Swarm Execution Plan) dulu kalau mau langsung jalan.

---

## 1. Ringkasan Produk

**Nama kerja:** `wira.studio` (domain bisa diganti)
**Tipe:** Website statis (SSG), satu repo, deploy ke Vercel / Netlify / Cloudflare Pages
**Bahasa:** Indonesia (default) + English (toggle)
**Target waktu build swarm:** 1 sesi panjang, ±6 agent paralel

### Satu kalimat
Website portofolio yang **tampil seperti situs perusahaan software/product studio**, bukan halaman CV: ada positioning jelas, capability, case study mendalam, proses kerja, dan jalur engagement yang rapi.

### Kenapa harus beda dari portofolio umum
| Portofolio umum | Portofolio ini |
|---|---|
| "Hi, I'm X, a developer" + grid project | Positioning ala studio: apa yang dikerjakan, untuk siapa, hasilnya apa |
| Kartu project berisi screenshot + stack | Case study: masalah → keputusan arsitektur → hasil → pelajaran |
| Skill bar / persentase | Capability matrix berbasis bukti (setiap capability tertaut ke project) |
| Form kontak generik | Jalur engagement terstruktur (brief wizard, paket kerja, estimasi) |
| Animasi dekoratif | Motion fungsional: menjelaskan struktur, memandu mata, bukan sekadar hiasan |
| Satu halaman scroll | Multi-halaman dengan IA jelas, siap diindeks Google |

---

## 2. Positioning & Narasi Brand

**Identitas:** *Independent Software & Product Studio* — satu orang, standar tim.

**Tagline utama (pilih satu, uji A/B di copy):**
1. "Software yang dibangun seperti produk, bukan proyek."
2. "Dari sensor sampai layar — web, Android, dan IoT dalam satu tangan."
3. "Rekayasa perangkat lunak untuk pasar Indonesia."

**Pilar pesan:**
1. **Full-stack end-to-end** — Web (PHP/Laravel, JavaScript), Android (Kotlin), IoT (MQTT), AI/Computer Vision (Python, YOLO), UI/UX.
2. **Product thinking** — mulai dari PRD, desain, sampai deployment dan dokumentasi.
3. **Konteks lokal** — aplikasi untuk pengguna Indonesia (sekolah, UMKM, logistik, industri).
4. **Transparansi proses** — dokumentasi klien-ready, bukan hanya kode.

**Tone of voice:** tenang, presisi, percaya diri tanpa sombong. Kalimat pendek. Tanpa jargon kosong ("passionate", "ninja", "rockstar" dilarang). Angka dan fakta lebih diutamakan daripada adjektiva.

---

## 3. Target Audiens & Tujuan Konversi

| Audiens | Yang mereka cari | Aksi yang diinginkan |
|---|---|---|
| Klien/UMKM/instansi | Vendor software yang kredibel | Klik "Mulai Proyek" → isi brief |
| Recruiter / hiring manager | Bukti kemampuan teknis & kematangan | Buka case study, unduh CV, kontak |
| Founder/agency | Partner teknis (white-label/subkontrak) | Hubungi via email/WhatsApp |
| Sesama developer/dosen | Kedalaman teknis | Baca Engineering Notes, buka GitHub |

**KPI (diukur lewat analytics privacy-friendly):**
- ≥ 40% pengunjung membuka minimal 1 case study
- ≥ 4% klik CTA "Mulai Proyek"/kontak
- Lighthouse ≥ 95 di semua kategori (mobile)
- LCP < 2.0 s, CLS < 0.05, INP < 200 ms

---

## 4. Information Architecture

```
/                     Beranda (studio overview)
/work                 Indeks case study (filter: Web / Android / IoT / AI / UI-UX)
/work/[slug]          Case study detail (6–8 proyek)
/capabilities         Capability matrix + tautan bukti
/process              Cara kerja (Discovery → Design → Build → Ship → Support)
/notes                Engineering Notes (artikel teknis singkat, MDX)
/notes/[slug]
/about                Profil, pendidikan, sertifikasi, timeline
/engage               Paket kerja + Brief Wizard + kontak
/uses                 (opsional) Stack & tooling yang dipakai
/404                  Halaman 404 bermerek
/sitemap.xml  /robots.txt  /rss.xml  /og/[slug].png (OG image otomatis)
```

**Navigasi global:** logo wordmark kiri, 5 link utama (Work, Capabilities, Process, Notes, About), CTA "Mulai Proyek" kanan, toggle ID/EN, toggle tema. Tersedia **Command Palette** (`Ctrl/⌘ + K`) untuk lompat halaman, buka case study, ganti tema/bahasa, salin email.

---

## 5. Konten & Data (Source of Truth)

Semua konten dipisah dari komponen, disimpan di `src/content/` (Astro Content Collections, validasi Zod). **Agent tidak boleh hard-code teks di komponen.**

### 5.1 Profil
- Nama: Wira Sukma Saputra
- Lokasi: West Java, Indonesia
- Pendidikan: S1 Teknik Informatika, Universitas Kuningan (Sep 2021 – Mei 2025)
- Pengalaman: Freelance Android Developer (Jan 2024 – Apr 2025); Freelance UI/UX Designer (Jan 2023 – Des 2024)
- Program & sertifikasi: Bangkit Academy 2023 (Cloud Computing), beberapa sertifikasi Dicoding
- Bahasa pemrograman/teknologi inti: PHP, Kotlin, JavaScript, Python

### 5.2 Case study seed (urutkan berdasarkan kekuatan cerita)
Tiap case study wajib mengikuti skema di 5.3. Metrik yang belum diketahui ditulis `TODO_METRIC` dan **tidak boleh dikarang** oleh agent.

| Slug | Proyek | Kategori | Sudut cerita |
|---|---|---|---|
| `ag-420-gas-analyzer` | AG-420 ADI Gas Analyzer | Web + IoT | Aplikasi web multi-tenant uji emisi kendaraan (PHP, MQTT, MySQL) — data real-time dari perangkat |
| `smart-attendance-ai` | Smart Attendance AI | Android + AI | Absensi berbasis YOLO11 + face recognition + liveness detection |
| `parent-notifications` | Parent Notifications (SMK Model Patriot IV) | Android | Aplikasi orang tua siswa, login WhatsApp + FCM |
| `kepalqu` | KepalQu | Android | Aplikasi delivery/logistik (Kotlin) |
| `techop-id` | techop.id | Web | Website agensi digital (Laravel Blade + Tailwind) |
| `orion-studio` | ORION Studio | Web / Motion | Landing page Next.js dengan animasi scroll 3D |
| `yolo11-detection` | Sistem Deteksi Objek YOLO11 | AI | Pipeline deteksi + dokumentasi klien |
| `salat-detection` | Deteksi Gerakan Salat (YOLO11 → TFLite) | AI + Android | Model 7 kelas, integrasi Android Kotlin |

> Wira: lengkapi per proyek — peran, durasi, tantangan teknis utama, hasil nyata, tautan (jika publik), dan screenshot/mockup. Tanpa data ini agent memakai placeholder yang diberi label jelas `DRAFT`.

### 5.3 Skema Case Study (frontmatter MDX)
```yaml
title: string
slug: string
summary: string            # maks 160 karakter
category: [web|android|iot|ai|uiux]
role: string
year: number
duration: string
client: string | "Internal" | "Confidential"
stack: string[]
cover: image
metrics: [{ label: string, value: string, note?: string }]   # boleh kosong
links: { live?: url, repo?: url, demo?: url }
architecture: image|mermaid   # diagram sistem
featured: boolean
order: number
```

**Struktur isi wajib:** Konteks → Masalah → Pendekatan & keputusan teknis (dengan trade-off) → Arsitektur (diagram) → Hasil → Pelajaran → Galeri.

### 5.4 Capability Matrix
Kelompok: **Web Engineering**, **Mobile (Android)**, **IoT & Realtime**, **AI / Computer Vision**, **Product Design (UI/UX)**, **Delivery & Documentation**.
Setiap capability = judul + 1 kalimat + daftar teknologi + **tautan ke case study sebagai bukti**. Dilarang pakai persentase/skill bar.

### 5.5 Paket Engagement (halaman /engage)
1. **Landing / Company Profile** — web statis, SEO-ready
2. **Web App Custom** — Laravel/PHP, dashboard, role-based access
3. **Android App** — Kotlin, integrasi API/FCM
4. **IoT + Dashboard** — MQTT, realtime, laporan
5. **AI/Computer Vision PoC** — deteksi, pelatihan model, integrasi

Harga **tidak** ditampilkan; tampilkan "Mulai dari — hubungi" atau rentang yang diisi pemilik. Tiap paket memuat: output, durasi umum, yang dibutuhkan dari klien.

---

## 6. Desain Visual

### 6.1 Arah kreatif: "Editorial Engineering"
Estetika perusahaan teknologi premium: grid ketat, tipografi besar dan tegas, ruang kosong lega, detail teknis (koordinat, nomor versi, label monospace) sebagai elemen dekoratif. Bukan neon-cyberpunk, bukan template SaaS generik.

### 6.2 Design tokens (kontrak — dibuat Agent A, dikonsumsi semua)
File: `src/styles/tokens.css` + `tailwind.config.ts`

**Warna (tema gelap default, tema terang tersedia):**
```
--bg:        #0A0B0D     (terang: #F6F5F1)
--surface:   #111317     (terang: #FFFFFF)
--surface-2: #181B21     (terang: #EDECE7)
--line:      #23272F     (terang: #D9D7D0)
--text:      #ECEAE4     (terang: #101114)
--text-dim:  #9A9DA5     (terang: #5B5E66)
--accent:    #C8FF3D     (lime teknis; terang: #4F7A00)
--accent-2:  #6B8CFF     (biru info)
--danger:    #FF5C5C
```
Kontras teks minimal WCAG AA (4.5:1). Aksen dipakai hemat: CTA, link aktif, highlight angka.

**Tipografi:**
- Display: `Instrument Serif` atau `Fraunces` (judul besar, italic untuk penekanan)
- Sans: `Inter Tight` / `Geist` (UI & body)
- Mono: `JetBrains Mono` / `Geist Mono` (label, metadata, kode)
- Self-host (woff2, `font-display: swap`, subset Latin). Dilarang memuat dari CDN pihak ketiga saat runtime.
- Skala fluid dengan `clamp()`: H1 `clamp(3rem, 8vw, 9rem)`, body 16–18px, line-height 1.55.

**Layout:** grid 12 kolom, gutter 24px (mobile 16px), max-width 1440px, spacing skala 4px. Garis tipis 1px sebagai pemisah antar-seksi (bukan kartu bayangan tebal).

**Radius & elevasi:** radius kecil (2–6px), hampir tanpa shadow; kedalaman dari border dan perbedaan surface.

### 6.3 Komponen kunci
| Komponen | Deskripsi |
|---|---|
| `Wordmark` | Logo teks "wira.studio" dengan titik berwarna aksen |
| `NavBar` | Sticky, blur halus, menyusut saat scroll, indikator halaman aktif |
| `Hero` | Judul besar dengan reveal per baris, subteks, 2 CTA, strip "status" (mis. "Menerima proyek — Jan 2027") |
| `MarqueeStack` | Strip teknologi bergerak pelan, berhenti saat hover/`prefers-reduced-motion` |
| `CaseCard` | Cover besar, nomor urut mono, kategori, tahun; hover = cover bergeser + judul memanjang |
| `CaseHero` / `CaseMeta` | Tabel metadata (peran, durasi, stack, tahun) bergaya spesifikasi teknis |
| `ArchDiagram` | Diagram arsitektur (Mermaid → SVG, di-render saat build) dengan animasi gambar garis |
| `MetricCounter` | Angka hitung naik saat masuk viewport |
| `CapabilityRow` | Baris interaktif; hover memunculkan bukti proyek terkait |
| `ProcessTimeline` | 5 tahap, progres tergambar mengikuti scroll |
| `BriefWizard` | Form bertahap (jenis proyek → skala → timeline → kontak) tanpa backend (kirim ke Formspree/Web3Forms/`mailto` fallback) |
| `CommandPalette` | Pencarian cepat, navigasi keyboard penuh |
| `ThemeToggle`, `LangToggle` | Persisten via `localStorage`, tanpa flash saat load |
| `Footer` | Peta situs, email, sosial, jam lokal WIB (live), versi situs + commit hash |
| `Cursor` (opsional, desktop) | Kursor kustom halus; dinonaktifkan di touch & reduced-motion |

---

## 7. Motion & Interaksi

**Prinsip:** motion harus *menjelaskan* atau *memandu*. Maks 1 efek "wow" per layar. Semua durasi 300–800 ms, easing `cubic-bezier(0.22, 1, 0.36, 1)`.

**Library:** GSAP + ScrollTrigger (animasi), Lenis (smooth scroll), View Transitions API (transisi antar-halaman, fallback fade). Tanpa Three.js di halaman kritis; kalau dipakai (hero), lazy-load dan hanya desktop.

**Spesifikasi per bagian:**
1. **Preloader singkat (≤ 1.2 s, hanya kunjungan pertama):** wordmark tergambar, lalu hero reveal. Dilewati pada kunjungan berikutnya dan saat reduced-motion.
2. **Hero:** judul muncul per baris (mask reveal), garis grid menggambar dari kiri ke kanan, strip status berkedip halus.
3. **Daftar Work (beranda):** pinned horizontal scroll *atau* stacking cards — pilih satu, konsisten. Cover parallax 6–10%.
4. **Transisi halaman:** cover case card "melebar" menjadi hero case study (shared element via View Transitions).
5. **Case study:** diagram arsitektur tergambar saat masuk viewport; metrik menghitung naik; galeri dengan reveal berurutan.
6. **Capabilities:** hover baris → panel bukti slide-in; di mobile berupa accordion.
7. **Process:** garis vertikal terisi sesuai progres scroll; tiap tahap fade+slide.
8. **Micro-interaction:** tombol magnetik (≤ 8px), link dengan garis bawah menggambar, fokus keyboard jelas.

**Wajib:** `prefers-reduced-motion` → semua animasi diganti fade 150 ms atau dimatikan; smooth scroll nonaktif.

---

## 8. Fitur Pembeda ("sekelas perusahaan")

1. **Case study berstruktur + diagram arsitektur** — bukti kedalaman engineering.
2. **Capability → Evidence linking** — klaim selalu punya bukti.
3. **Engineering Notes (MDX)** — 3 artikel awal: (a) arsitektur MQTT untuk dashboard realtime, (b) mengintegrasikan model YOLO11 ke Android via TFLite, (c) alur login WhatsApp + FCM untuk aplikasi orang tua.
4. **Brief Wizard + estimasi kasar** — pengunjung merasa sudah "mulai proyek".
5. **Status strip & jam WIB** — kesan studio aktif (status diatur dari satu file config).
6. **Command Palette** — nuansa produk profesional.
7. **Dokumen unduhan:** CV (PDF), Capability Deck (PDF ringkas), data diambil dari file yang sama dengan situs.
8. **OG image dinamis per halaman** dan metadata terstruktur (JSON-LD `Person`, `ProfessionalService`, `CreativeWork`).
9. **Dwibahasa ID/EN** dengan routing `/en/...` dan `hreflang`.
10. **Halaman `/uses`** dan **footer versi** — detail yang menandakan kerapian.

---

## 9. Tech Stack & Arsitektur

| Lapisan | Pilihan | Alasan |
|---|---|---|
| Framework | **Astro 5** (SSG, islands) | Performa maksimal, JS minimal, konten MDX kuat |
| Bahasa | TypeScript strict | Kontrak antar-agent jelas |
| Styling | Tailwind CSS v4 + CSS variables (tokens) | Cepat dan konsisten |
| Animasi | GSAP, ScrollTrigger, Lenis | Standar industri |
| Interaktif | Svelte atau vanilla TS untuk islands (CommandPalette, BriefWizard) | Ringan |
| Konten | Astro Content Collections + MDX + Zod | Validasi skema saat build |
| Diagram | Mermaid → SVG saat build | Tanpa JS runtime |
| i18n | Astro i18n routing + file `src/i18n/{id,en}.json` | Terstruktur |
| Form | Web3Forms / Formspree (endpoint dikonfigurasi via env) | Tanpa backend |
| Analytics | Plausible / Umami (opsional, via env) | Privacy-friendly |
| Gambar | `astro:assets` (AVIF/WebP, responsive srcset) | LCP baik |
| Lint/Format | ESLint, Prettier, `astro check` | Kualitas |
| Test | Playwright (smoke + a11y via axe), Lighthouse CI | Gerbang kualitas |
| Deploy | Vercel / Netlify / Cloudflare Pages | Statis, gratis tier cukup |

**Struktur repo:**
```
/
├─ src/
│  ├─ content/            # case studies, notes, capabilities, profile (MDX/JSON)   ← Agent C
│  ├─ components/
│  │  ├─ core/            # Wordmark, NavBar, Footer, Button, Section             ← Agent A
│  │  ├─ motion/          # Reveal, Marquee, MagneticButton, Preloader            ← Agent D
│  │  ├─ work/            # CaseCard, CaseHero, CaseMeta, ArchDiagram             ← Agent B
│  │  └─ interactive/     # CommandPalette, BriefWizard, ThemeToggle, LangToggle  ← Agent E
│  ├─ layouts/            # BaseLayout, CaseLayout, NoteLayout                    ← Agent A
│  ├─ pages/              # semua route                                           ← Agent B (work), F (sisanya)
│  ├─ styles/             # tokens.css, global.css, typography.css                ← Agent A
│  ├─ i18n/               # id.json, en.json                                      ← Agent C
│  └─ lib/                # seo.ts, content helpers, og.ts                        ← Agent F
├─ public/                # fonts, favicon, cv.pdf, og defaults
├─ tests/                 # Playwright + axe                                      ← Agent G
├─ docs/                  # CONTRACTS.md, DECISIONS.md, CHECKLIST.md              ← Lead
└─ astro.config.mjs, tailwind.config.ts, tsconfig.json, package.json              ← Lead
```

---

## 10. Non-Functional Requirements

**Performa:** Lighthouse mobile ≥ 95 (Performance, Accessibility, Best Practices, SEO). Total JS halaman beranda ≤ 150 KB gzip (di luar GSAP lazy chunk). Gambar hero ≤ 120 KB. Tidak ada layout shift akibat font/gambar.

**Aksesibilitas (WCAG 2.2 AA):** navigasi keyboard penuh, focus ring terlihat, `alt` bermakna, landmark ARIA benar, skip-to-content, kontras sesuai, `prefers-reduced-motion`, `prefers-color-scheme`.

**SEO:** `title`/`description` unik per halaman, canonical, `hreflang`, sitemap, robots, JSON-LD, OG/Twitter card, heading hierarchy rapi (satu H1).

**Keamanan & privasi:** tanpa cookie pelacak, CSP header via `_headers`, tautan eksternal `rel="noopener noreferrer"`, email di-obfuscate ringan, tidak ada secret di klien.

**Responsif:** breakpoint 360 / 768 / 1024 / 1440 / 1920. Mobile adalah prioritas pertama (mayoritas trafik Indonesia dari mobile).

**Browser:** 2 versi terakhir Chrome, Safari, Firefox, Edge; Safari iOS 16+. Fitur modern dengan fallback.

**Kompatibilitas jaringan Indonesia:** target tetap nyaman di 4G lemah — gambar adaptif, font subset, lazy-load agresif.

---

## 11. Acceptance Criteria (bisa dicek mesin)

- [ ] `npm run build` sukses tanpa error TypeScript/`astro check`
- [ ] Semua 8 case study lolos validasi skema Zod
- [ ] Semua route di Bagian 4 ada dan menghasilkan HTML statis
- [ ] Lighthouse CI mobile ≥ 95 di `/`, `/work`, `/work/ag-420-gas-analyzer`, `/engage`
- [ ] axe: 0 pelanggaran *serious/critical* di semua route
- [ ] Playwright: navigasi, toggle tema/bahasa, Command Palette, Brief Wizard (validasi + submit mock) lulus di Chromium, WebKit, Firefox
- [ ] Mode `prefers-reduced-motion` tidak menjalankan animasi GSAP/Lenis (diuji)
- [ ] Tidak ada teks hard-code di komponen (lint rule/grep check: semua string dari i18n/content)
- [ ] Tidak ada metrik karangan: semua `TODO_METRIC` tampil sebagai "—" atau disembunyikan
- [ ] Tidak ada gambar tanpa `width/height` dan `alt`
- [ ] README berisi cara jalan, cara menambah case study, cara deploy

---

## 12. Swarm Execution Plan

### 12.1 Prinsip koordinasi
1. **Satu pemilik per file/folder** (lihat struktur repo). Agent dilarang mengedit file milik agent lain; kalau butuh perubahan, tulis permintaan di `docs/REQUESTS.md`.
2. **Kontrak dulu, implementasi kemudian.** Phase 0 menghasilkan `docs/CONTRACTS.md` (props komponen, nama token, skema konten, nama key i18n). Phase 1 hanya boleh mengonsumsi kontrak.
3. **Tidak ada dependency tersembunyi.** Komponen hanya import dari `components/core`, `styles`, `lib`, dan content helpers yang tercantum di kontrak.
4. **Gerbang kualitas tiap phase** sebelum lanjut.

### 12.2 Phase 0 — Lead / Architect (serial)
- Inisialisasi proyek Astro + TS + Tailwind, install dependency, konfigurasi lint/format.
- Tulis `docs/CONTRACTS.md`: daftar komponen + props, token CSS, skema Content Collections (Zod), struktur key i18n, konvensi nama file.
- Buat `docs/DECISIONS.md` (keputusan: dark-first, horizontal vs stacking, font final).
- Buat stub kosong semua file yang akan dimiliki agent agar tidak terjadi konflik path.
- **Gerbang:** `npm run build` hijau dengan halaman kosong.

### 12.3 Phase 1 — Paralel (6 agent)

| Agent | Tanggung jawab | Output utama | Bergantung pada |
|---|---|---|---|
| **A — Design System** | tokens, tipografi, tema terang/gelap, komponen core, layout | `styles/*`, `components/core/*`, `layouts/*` | Kontrak |
| **B — Work & Case Study** | halaman `/work`, `/work/[slug]`, CaseCard, CaseHero, ArchDiagram, MetricCounter | `components/work/*`, `pages/work/*` | A (tokens), C (skema) |
| **C — Content & i18n** | seluruh teks ID/EN, 8 case study MDX, capability, notes, skema Zod | `content/*`, `i18n/*` | Kontrak |
| **D — Motion** | Preloader, Reveal, Marquee, Magnetic, Lenis+GSAP setup, View Transitions, fallback reduced-motion | `components/motion/*`, `lib/motion.ts` | A |
| **E — Interactive** | CommandPalette, BriefWizard, Theme/Lang toggle, validasi form | `components/interactive/*` | A, C (key i18n) |
| **F — Pages, SEO & Infra** | `/`, `/capabilities`, `/process`, `/about`, `/engage`, `/notes`, `/uses`, 404; SEO, JSON-LD, sitemap, RSS, OG, `_headers`, deploy config | `pages/*` (selain work), `lib/seo.ts`, `lib/og.ts` | A, C |

**Aturan antar-agent:** A merilis tokens + komponen core **lebih dulu (checkpoint 1)**; B, D, E, F memulai tampilan setelah checkpoint 1, tetapi boleh mengerjakan logika/struktur sebelumnya memakai kontrak.

### 12.4 Phase 2 — Integrasi (Lead)
- Merge semua hasil, selesaikan `docs/REQUESTS.md`.
- Hubungkan View Transitions antar-halaman, uji shared-element Work → Case.
- Jalankan `npm run build`, perbaiki error lintas-agent.

### 12.5 Phase 3 — QA & Polish (paralel, 3 agent)
| Agent | Tugas |
|---|---|
| **G — Test** | Tulis dan jalankan Playwright + axe + Lighthouse CI; laporkan pelanggaran |
| **H — Perf & A11y Fixer** | Perbaiki temuan G: LCP, CLS, JS size, kontras, focus order |
| **I — Content Reviewer** | Cek konsistensi tone, typo ID/EN, tidak ada klaim/metrik karangan, tautan valid |

**Gerbang akhir:** semua centang di Bagian 11 terpenuhi. Lead menulis `README.md` dan `docs/CHECKLIST.md` (hasil final).

### 12.6 Format laporan tiap agent
```
## Agent <huruf> — <nama>
- Selesai: ...
- File dibuat/diubah: ...
- Kontrak yang dipakai/diubah: ...
- Permintaan ke agent lain: ...
- Masalah/ketidakpastian: ...
```

---

## 13. Prompt Siap Pakai untuk Swarm

**Prompt Lead (tempel ke agent utama):**
```
Kamu Lead/Architect untuk membangun website portofolio "Studio-Grade" berdasarkan PRD-portofolio-company-grade.md.

Langkah:
1. Baca PRD sampai habis. Jalankan Phase 0 (Bagian 12.2): init Astro + TS + Tailwind, tulis docs/CONTRACTS.md dan DECISIONS.md, buat stub semua file.
2. Spawn agent A–F secara paralel dengan wilayah file yang tercantum di Bagian 9 dan 12.3. Berikan tiap agent: PRD, CONTRACTS.md, wilayah file miliknya, dan format laporan 12.6.
3. Setelah semua melapor, jalankan Phase 2 (integrasi), lalu Phase 3 (G, H, I).
4. Jangan menyatakan selesai sebelum semua acceptance criteria Bagian 11 terpenuhi dan terbukti lewat output perintah (build, test, lighthouse).

Aturan keras: satu pemilik per file; tidak ada teks hard-code di komponen; jangan mengarang metrik/data klien — pakai TODO_METRIC; hormati prefers-reduced-motion.
```

**Prompt generik untuk agent anggota:**
```
Kamu Agent <X> — <peran>. Baca PRD-portofolio-company-grade.md dan docs/CONTRACTS.md.
Kerjakan HANYA file di wilayahmu: <daftar path>.
Konsumsi kontrak apa adanya; kalau butuh perubahan di file agent lain, tulis di docs/REQUESTS.md.
Selesai → jalankan npm run build dan perbaiki error di wilayahmu, lalu kirim laporan sesuai format 12.6.
```

---

## 14. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Konflik edit antar-agent | Build rusak | Kepemilikan file ketat + CONTRACTS.md + REQUESTS.md |
| Animasi berat di HP kelas menengah | Performa jeblok | GSAP lazy, batasi efek per layar, uji di throttling CPU 4× |
| Konten case study kosong | Situs terlihat kosong | Seed 8 proyek + label `DRAFT`, pemilik melengkapi metrik |
| Klaim/metrik tidak akurat | Merusak kredibilitas | Larangan karangan + Agent I sebagai pemeriksa |
| Over-design, kehilangan fokus konversi | CTA tertutup | Satu CTA utama per layar; ukur klik CTA |
| Font/gambar besar | LCP lambat | Subset font, AVIF/WebP, preload font kritis |

---

## 15. Di Luar Cakupan (v1)
CMS berbasis login, blog dengan komentar, e-commerce, backend kustom, sistem pembayaran, 3D berat di semua halaman.

## 16. Pengembangan Lanjutan (v2)
Case study video singkat, halaman testimoni terverifikasi, kalkulator estimasi proyek interaktif, integrasi kalender booking, mode presentasi (tekan `P` untuk menampilkan case study sebagai slide).

---

## 17. Checklist Input dari Pemilik (isi sebelum swarm dijalankan)
- [ ] Foto profil/mockup layar tiap proyek (minimal 3 per case study)
- [ ] Peran, durasi, hasil nyata, dan metrik tiap proyek
- [ ] Tautan live/repo yang boleh dipublikasikan
- [ ] Email, WhatsApp, GitHub, LinkedIn, Instagram
- [ ] CV terbaru (PDF)
- [ ] Domain final dan penyedia hosting
- [ ] Endpoint form (Web3Forms/Formspree) dan ID analytics (opsional)
- [ ] Pilihan tagline final dari Bagian 2
