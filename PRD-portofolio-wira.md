# PRD — Website Portofolio "Wira Sukma Saputra"

| Item | Isi |
|---|---|
| Versi | 1.0 (draft siap build) |
| Tanggal | 26 Oktober 2026 |
| Owner | Wira Sukma Saputra |
| Tipe | Situs statis, single-page, full animasi (scroll-driven + WebGL) |
| Builder | OpenCode (dokumen ini dipakai sebagai spec utama) |
| Sumber konten | CV Wira (Android Developer & UI/UX Designer, Freelance) |
| Bahasa situs | Bahasa Indonesia (default), English (opsional, fase 2) |

---

## 1. Ringkasan

Website portofolio pribadi yang **menjual dua hal sekaligus**: kemampuan teknis (Android Kotlin/Jetpack Compose + Web) dan rasa desain (UI/UX). Karena Wira adalah desainer sekaligus developer, **situs ini sendiri adalah bukti kemampuannya**: animasinya harus halus, cepat, rapi, dan tetap aksesibel.

Pengunjung harus paham dalam 5 detik pertama: *siapa Wira, apa keahliannya, dan bagaimana menghubunginya.*

## 2. Tujuan & Metrik Keberhasilan

| Tujuan | Metrik | Target |
|---|---|---|
| Menarik klien freelance & recruiter | Klik tombol "Hubungi" / WhatsApp / Email | ≥ 5% dari total pengunjung |
| Kesan "wow" tanpa mengorbankan kecepatan | Lighthouse Performance (desktop / mobile) | ≥ 90 / ≥ 80 |
| Pengalaman halus | Frame rate animasi | ≥ 55 fps di laptop menengah |
| Pengunjung menjelajah | Scroll depth hingga section Kontak | ≥ 40% |
| Aksesibel | Lighthouse Accessibility | ≥ 95 |
| Mudah ditemukan | Lighthouse SEO | 100 |

## 3. Target Pengguna

1. **Recruiter / HR / Tech lead** — scan cepat: skill, pengalaman, sertifikat, tombol unduh CV.
2. **Klien freelance (UMKM, instansi, startup lokal)** — ingin lihat hasil kerja nyata dan cara menghubungi dengan mudah (WhatsApp).
3. **Sesama developer / desainer** — menilai kualitas implementasi animasi dan kerapian kode.

## 4. Ruang Lingkup

**Masuk (In-scope)**
- Single-page dengan 9 section (lihat bagian 6)
- Preloader, smooth scroll, custom cursor, animasi scroll-triggered, hero WebGL (Three.js)
- Dark/Light mode, responsif penuh (mobile → desktop 4K)
- Tombol unduh CV (PDF), link WhatsApp / Email / GitHub / LinkedIn
- SEO dasar + Open Graph + JSON-LD
- Mode `prefers-reduced-motion` dan fallback tanpa WebGL

**Tidak masuk (Out-of-scope)**
- Backend / database / CMS (konten di file `content.js`)
- Blog, login, e-commerce
- Form kontak dengan server sendiri (pakai `mailto:` + WhatsApp; Formspree opsional)

## 5. Konten dari CV (Single Source of Truth)

### 5.1 Identitas
- **Nama:** Wira Sukma Saputra
- **Title:** Android Developer · UI/UX Designer · Freelancer
  *(catatan: di CV tertulis "Freelencer" → typo, di web ditulis "Freelancer")*
- **Pendidikan singkat:** BSc Teknik Informatika, Universitas Kuningan
- **Kontak:** wiralodrasaputra07@gmail.com · WhatsApp 0812-1919-5308 (`https://wa.me/6281219195308`)
- **Foto:** dari CV (latar merah) **tidak dipakai langsung**; siapkan foto cutout (PNG transparan) atau foto dengan latar netral → lihat bagian 14.

### 5.2 Hero tagline (usulan)
> **Merancang & membangun aplikasi yang terasa mulus.**
> Android Developer & UI/UX Designer — Kotlin, Jetpack Compose, dan web modern.

Teks rotasi di bawah nama (efek ketik/slide): `Android Developer` → `UI/UX Designer` → `Full-Stack Web` → `Firebase & REST API`

### 5.3 Tentang (dari Summary CV, dirapikan)
> Desainer & pengembang full-stack yang adaptif dengan kemahiran kuat di pengembangan Android dan web. Terbiasa membangun aplikasi berpusat pada pengguna dengan Kotlin, Jetpack Compose, dan teknologi web modern — dengan UI/UX yang bersih dan back-end yang andal. Aktif di proyek tim maupun lepas, dengan pola pikir bertumbuh yang dibentuk lewat program seperti Bangkit 2023. Fokus pada solusi digital yang terukur, aman, dan mudah dipelihara di berbagai platform.

### 5.4 Angka (untuk counter animasi)
| Angka | Label | Sumber CV |
|---|---|---|
| `2+` | Tahun pengalaman freelance | Jan 2023 – Apr 2025 |
| `30%` | Peningkatan efisiensi baterai & responsivitas | Poin optimasi performa |
| `10` | Sertifikasi & program | Bagian sertifikat |
| `2` | Peran: Android Dev & UI/UX Designer | Work experience |

### 5.5 Skill (dikelompokkan)
| Grup | Item |
|---|---|
| **Android** | Kotlin, Jetpack Compose, MVVM, LiveData, Navigation, ViewModel, Profiling & optimasi |
| **Web** | HTML, CSS, JavaScript, PHP, MySQL |
| **UI/UX** | Figma, Adobe XD, Zeplin, Wireframe & Prototype, Usability Testing, Design System, WCAG |
| **Backend & Cloud** | Firebase (Auth, Firestore, Cloud Messaging, App Distribution), REST API, AWS Cloud Practitioner |
| **Workflow** | Git, GitHub, Open-Source Contribution, Team Collaboration |

### 5.6 Pengalaman
**Android Developer — Freelance · Jan 2024 – Apr 2025**
- Mengembangkan aplikasi Android dengan Kotlin dan Jetpack Compose, fokus pada UI/UX modern dan interaksi mulus.
- Integrasi Firebase: Authentication, Firestore, Cloud Messaging (notifikasi push).
- Menerapkan arsitektur MVVM + Jetpack (LiveData, Navigation, ViewModel) agar kode skalabel dan mudah dipelihara.
- Optimasi performa dan memori dengan profiling → responsivitas & efisiensi baterai naik hingga 30%.
- Kolaborasi via Git/GitHub, rutin berkontribusi di proyek open-source.
- Distribusi versi beta via Firebase App Distribution untuk siklus perbaikan iteratif.

**UI/UX Designer — Freelance · Jan 2023 – Des 2024**
- Merancang antarmuka mobile & web berpusat pada pengguna (Figma, Adobe XD) yang konsisten lintas perangkat.
- Riset pengguna, persona, wireframe, mockup, dan prototipe interaktif.
- Hand-off ke developer via Zeplin dan Dev Mode Figma.
- Uji kegunaan & iterasi untuk meningkatkan keberhasilan tugas dan kepuasan pengguna.
- Menerapkan design system dan standar aksesibilitas WCAG.
- Menyediakan UI kit fidelitas tinggi dan style guide.

### 5.7 Pendidikan
**Bachelor of Informatics Engineering — Universitas Kuningan · Sep 2021 – Mei 2025**
- Fokus Android (Kotlin, Jetpack Compose) dan Web (HTML, CSS, JavaScript, PHP).
- Proyek akhir: aplikasi pembelajaran mobile modern untuk mendukung belajar mandiri.
- Lulus dengan predikat pujian.
  *(Jangan tampilkan "3,61–4,00" sebagai IPK; itu rentang predikat, bukan nilai IPK.)*

### 5.8 Sertifikasi & Program (10 item)
1. Bangkit Academy 2023 — Cloud Computing Cohort (Google, Gojek, Tokopedia, Traveloka)
2. Dicoding — Android Developer Learning Path
3. Dicoding — Kotlin Language Programming
4. Dicoding — Jetpack Compose for Native Android UI
5. Dicoding — Cloud Practitioner Essentials (AWS)
6. Dicoding — Back-End Developer (PHP & MySQL)
7. Dicoding — Web Front-End Development (HTML, CSS, JS)
8. Figma Camp Batch 2 — UI/UX Design Fundamentals & Prototyping
9. Certiport — Microsoft Office Specialist (Word & Excel)
10. BuildWithAngga — Android App Development Figma to XML Food App

### 5.9 Proyek (kartu proyek)
CV belum memuat nama proyek, jadi bagian ini memakai **skema kartu** yang diisi Wira. Kandidat awal (konfirmasi dulu mana yang boleh dipublikasikan, terutama proyek klien):

| Kandidat | Kategori | Stack |
|---|---|---|
| KepalQu | Android — delivery/logistik | Kotlin |
| Parent Notifications (SMK Model Patriot IV) | Android — aplikasi orang tua siswa | Kotlin, Firebase FCM |
| ORION Studio | Web — landing page 3D scroll animation | Next.js |
| techop.id | Web — company profile digital agency | Laravel, Tailwind |

Skema tiap kartu: `title`, `category`, `year`, `summary` (1–2 kalimat), `role`, `stack[]`, `cover` (gambar/video 16:10), `links { live, github, playstore }`, `highlight` (1 angka/hasil jika ada).

---

## 6. Struktur Halaman & Spesifikasi Section

Urutan: **Preloader → Nav → Hero → Tentang → Skill → Perjalanan (Pengalaman) → Proyek → Sertifikasi → Kontak/Footer**

### 6.0 Preloader
- Counter 0 → 100 yang sinkron dengan loading aset nyata (font, gambar hero, Three.js) dengan batas maksimum 2,2 detik.
- Nama "WIRA" muncul huruf per huruf, lalu **curtain wipe** naik (clip-path) membuka hero.
- Dilewati jika sudah pernah dilihat di sesi yang sama (`sessionStorage`) atau `prefers-reduced-motion`.

### 6.1 Navigasi
- Fixed, logo monogram "WS" kiri; link: Tentang, Skill, Perjalanan, Proyek, Sertifikat, Kontak; tombol toggle tema; tombol "Unduh CV".
- Auto-hide saat scroll turun, muncul saat scroll naik.
- Link aktif ditandai oleh ScrollTrigger (garis bawah bergeser mulus).
- Mobile: tombol hamburger → menu fullscreen dengan **clip-path circle reveal**, link masuk berurutan (stagger).
- Progress bar scroll tipis di atas (gradien hijau → biru).

### 6.2 Hero
- **Latar WebGL (Three.js):** medan partikel (±3.000 desktop / 1.200 mobile) membentuk bola/galaksi yang berputar pelan, berwarna gradien hijau Android → biru. Partikel **menjauh dari kursor** (repel) dan **menyebar saat scroll** keluar hero.
- Judul besar nama dengan **split-text per karakter**: masuk dari bawah (y 110% → 0, rotasi kecil, stagger 0.03s).
- Baris peran berganti otomatis (slide vertikal, interval 2,5 dtk).
- Dua CTA magnetic: **Lihat Proyek** (utama) dan **Hubungi via WhatsApp** (sekunder).
- Indikator "scroll" bergerak (garis turun looping).
- Foto/cutout Wira melayang halus dengan parallax mengikuti mouse (opsional jika foto tersedia).
- Fallback tanpa WebGL: mesh gradient CSS beranimasi.

### 6.3 Tentang
- Layout 2 kolom: foto (mask reveal dari bawah + parallax) dan teks.
- Paragraf summary muncul **kata per kata** terisi warna (scrub mengikuti scroll: teks abu → putih).
- Baris counter 4 angka (bagian 5.4) menghitung naik saat masuk viewport, dengan easing `power2.out`.
- Chip info: lokasi (Kuningan/Jawa Barat), status "Open for freelance".

### 6.4 Skill
- **Marquee dua baris** berlawanan arah (kecepatan mengikuti kecepatan scroll, membalik arah saat scroll naik).
- Di bawahnya grid kartu per grup (5 grup, bagian 5.5): kartu **3D tilt** mengikuti kursor dengan glare/spotlight; chip skill muncul stagger saat masuk viewport.
- Hover chip: naik 4px + glow aksen.

### 6.5 Perjalanan (Pengalaman + Pendidikan)
- **Timeline vertikal** dengan garis SVG yang tergambar mengikuti scroll (`stroke-dashoffset` scrub).
- Node milestone: Sep 2021 (mulai kuliah) → Jan 2023 (UI/UX Designer) → 2023 (Bangkit) → Jan 2024 (Android Developer) → Mei 2025 (lulus).
- Kartu pengalaman: judul + periode + bullet. Bullet muncul stagger; angka "30%" disorot dengan highlight beranimasi (garis bawah menyapu).
- Desktop: kartu bergantian kiri/kanan; Mobile: satu kolom, garis di kiri.

### 6.6 Proyek
- Daftar proyek besar (gaya editorial): nomor besar, judul, kategori, tahun.
- **Hover:** gambar preview mengikuti kursor (reveal clip-path + sedikit rotasi), judul bergeser, panah berputar.
- **Klik:** halaman detail dibuka sebagai **modal fullscreen** dengan transisi shared-element (cover mengembang), berisi deskripsi, peran, stack, galeri, tautan; tutup dengan `Esc`.
- Filter kategori (Semua / Android / Web / UI-UX) dengan animasi reorder (FLIP).
- Mobile: kartu vertikal dengan swipe galeri; tanpa preview kursor.

### 6.7 Sertifikasi
- 10 kartu sertifikat dalam **horizontal scroll pinned** (desktop) atau carousel swipe (mobile).
- Tiap kartu: logo/ikon penyelenggara, judul, badge penyelenggara (Dicoding, Bangkit, Figma Camp, Certiport, BuildWithAngga).
- Kartu aktif membesar sedikit, kartu lain meredup; progress bar horizontal.

### 6.8 Kontak & Footer
- Teks raksasa **"Ayo bikin sesuatu yang keren."** dengan reveal per baris.
- Tombol magnetic: **WhatsApp**, **Email** (tombol salin email dengan micro-feedback "Tersalin ✓"), **Unduh CV**.
- Link sosial: GitHub, LinkedIn (isi saat siap).
- Footer: jam lokal Asia/Jakarta berjalan, tombol "Kembali ke atas" (scroll mulus), © tahun berjalan.
- Teks raksasa nama di footer dengan efek parallax tipis.

---

## 7. Design System

### 7.1 Arah visual
Gelap, premium, bersih, dengan aksen hijau Android sebagai penanda dan biru sebagai pendamping (selaras dengan warna judul di CV). Tipografi besar dan tegas, banyak ruang kosong, grain halus untuk kedalaman.

### 7.2 Warna (CSS custom properties)
```css
:root {
  /* Dark (default) */
  --bg: #0A0B10;
  --bg-elev: #12141C;
  --text: #F2F3F5;
  --text-dim: #8A8F9C;
  --line: rgba(255,255,255,.10);
  --accent: #3DDC84;       /* hijau Android */
  --accent-2: #2F6BFF;     /* biru */
  --grad: linear-gradient(90deg, var(--accent), var(--accent-2));
}
[data-theme="light"] {
  --bg: #F6F6F2;
  --bg-elev: #FFFFFF;
  --text: #0E1016;
  --text-dim: #5B6170;
  --line: rgba(0,0,0,.10);
  --accent: #0F9D58;
  --accent-2: #1E4FD8;
}
```
Rasio kontras teks utama ke latar harus ≥ 4.5:1 di kedua tema.

### 7.3 Tipografi
| Peran | Font | Catatan |
|---|---|---|
| Display / judul | **Space Grotesk** 600–700 | ukuran fluid `clamp(3rem, 9vw, 9rem)` |
| Body | **Inter** 400–500 | 16–18px, line-height 1.65 |
| Mono / label | **JetBrains Mono** 400 | label kecil, nomor, tanggal |

Muat via Google Fonts dengan `display=swap` + `preconnect`.

### 7.4 Spacing & grid
- Grid 12 kolom, max-width 1280px, gutter 24px (mobile 16px).
- Skala spasi: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96 / 128.
- Radius: 12px (kartu), 999px (chip/tombol).

### 7.5 Motion tokens
```js
export const motion = {
  ease:   { out: "expo.out", inOut: "power3.inOut", soft: "power2.out" },
  dur:    { xs: 0.2, sm: 0.4, md: 0.8, lg: 1.2, xl: 1.6 },
  stagger:{ chars: 0.03, words: 0.06, items: 0.08 },
  scroll: { start: "top 85%", scrub: 0.6 }
};
```
Aturan: animasi masuk 0.6–1.2 dtk, micro-interaction 0.2–0.4 dtk; **hanya animasikan `transform` dan `opacity`** (plus `clip-path`); jangan animasikan `width/height/top/left`.

---

## 8. Katalog Animasi

| # | Animasi | Trigger | Teknik / Library | Durasi | Catatan |
|---|---|---|---|---|---|
| A1 | Preloader counter + curtain wipe | Page load | GSAP timeline | ≤ 2.2s | Skip jika sudah pernah / reduced-motion |
| A2 | Hero partikel 3D | Load, mouse, scroll | Three.js + shader/Points | loop | Repel kursor, menyebar saat scroll |
| A3 | Split-text judul | Setelah preloader | GSAP SplitText (atau split manual) | 1.0s | stagger 0.03 |
| A4 | Rotasi peran | Interval | GSAP | 0.5s/ganti | |
| A5 | Smooth scroll | Global | Lenis + sinkron ScrollTrigger | – | Nonaktif di reduced-motion |
| A6 | Custom cursor + magnetic button | Mouse (desktop saja) | GSAP quickTo | 0.3s | Membesar di atas link/proyek |
| A7 | Progress scroll bar | Scroll | ScrollTrigger scrub | – | |
| A8 | Reveal teks per baris/kata | Masuk viewport | ScrollTrigger + SplitText | 0.8s | |
| A9 | Teks terisi mengikuti scroll | Scroll | ScrollTrigger scrub | – | Paragraf Tentang |
| A10 | Counter angka | Masuk viewport | GSAP tween number | 1.6s | Format `30%`, `2+`, `10` |
| A11 | Image mask reveal + parallax | Masuk viewport + scroll | clip-path + y parallax | 1.2s | |
| A12 | Marquee skill reaktif scroll | Scroll | GSAP ticker + velocity | loop | Arah membalik saat scroll naik |
| A13 | Kartu 3D tilt + spotlight | Hover | JS pointer events | 0.3s | Nonaktif di touch |
| A14 | Timeline SVG draw | Scroll | stroke-dashoffset scrub | – | |
| A15 | Highlight sweep "30%" | Masuk viewport | scaleX background | 0.8s | |
| A16 | Preview gambar mengikuti kursor | Hover list proyek | GSAP quickTo + clip-path | 0.4s | Desktop saja |
| A17 | Modal shared-element proyek | Klik | GSAP Flip | 0.9s | Fokus dikunci, `Esc` menutup |
| A18 | Filter proyek (reorder) | Klik filter | GSAP Flip | 0.6s | |
| A19 | Sertifikat horizontal pinned | Scroll | ScrollTrigger pin + scrub | – | Mobile: swipe carousel |
| A20 | Menu mobile circle reveal | Klik hamburger | clip-path | 0.7s | |
| A21 | Toggle tema | Klik | View Transitions API (fallback fade) | 0.5s | Simpan di `localStorage` |
| A22 | Salin email micro-feedback | Klik | GSAP | 0.4s | Teks → "Tersalin ✓" |
| A23 | Grain overlay halus | Global | CSS/canvas noise | loop | Opacity 3–5%, bisa dimatikan |

---

## 9. Tech Stack & Struktur Proyek

### 9.1 Stack (tanpa framework, tanpa backend)
- **HTML5 semantik + CSS modern** (custom properties, `clamp()`, container queries, `:has()`).
- **JavaScript ES Modules** (vanilla).
- **GSAP 3** (+ ScrollTrigger, SplitText, Flip) — pin versi via CDN, sediakan salinan lokal di `/vendor`.
- **Lenis** untuk smooth scroll.
- **Three.js** untuk hero (dimuat **lazy** setelah first paint, via dynamic `import()`).
- Hosting: GitHub Pages / Netlify / Vercel (statis).
- Aset: gambar WebP/AVIF, video MP4/WebM kecil, SVG untuk ikon.

### 9.2 Struktur folder
```
portofolio/
├── index.html
├── css/
│   ├── tokens.css        # warna, tipografi, spacing
│   ├── base.css          # reset, tipografi, utilitas
│   ├── components.css    # nav, tombol, kartu, chip
│   └── sections.css      # hero, about, skills, dst.
├── js/
│   ├── main.js           # bootstrap: preloader → init semua modul
│   ├── motion.js         # token animasi + helper
│   ├── preloader.js
│   ├── smooth-scroll.js  # Lenis + ScrollTrigger sync
│   ├── cursor.js
│   ├── nav.js
│   ├── hero-webgl.js     # Three.js (lazy)
│   ├── sections/
│   │   ├── about.js
│   │   ├── skills.js
│   │   ├── journey.js
│   │   ├── projects.js
│   │   ├── certs.js
│   │   └── contact.js
│   └── theme.js
├── data/
│   └── content.js        # semua konten (lihat Lampiran A)
├── assets/
│   ├── img/  ├── video/  ├── fonts/  └── Wira-Sukma-Saputra-CV.pdf
├── vendor/               # salinan lokal gsap, lenis, three
├── favicon.svg  og-image.jpg  robots.txt  sitemap.xml
└── README.md
```

### 9.3 Prinsip kode
- Render section dari `content.js` (tidak hardcode teks di JS animasi).
- Setiap modul animasi mengekspor `init()` dan `destroy()` (bersihkan ScrollTrigger/listener).
- Gunakan `gsap.matchMedia()` untuk memisahkan perilaku desktop / mobile / reduced-motion.
- Hindari layout thrashing; gunakan `will-change` hanya saat animasi berjalan.

---

## 10. Persyaratan Non-Fungsional

### 10.1 Performa
- LCP < 2.5 dtk, CLS < 0.1, INP < 200 ms (jaringan 4G, perangkat menengah).
- Bobot awal (di luar Three.js) ≤ 350 KB gzip; Three.js dimuat lazy.
- Gambar: `srcset`, `loading="lazy"` (kecuali hero), dimensi eksplisit.
- Font: subset Latin, `font-display: swap`.
- Pause render WebGL saat hero tidak terlihat (IntersectionObserver) dan saat tab tidak aktif.

### 10.2 Aksesibilitas
- Mematuhi **WCAG 2.2 AA** (sejalan dengan skill WCAG di CV).
- `prefers-reduced-motion: reduce` → matikan preloader, smooth scroll, parallax, partikel (ganti gradien statis), pin horizontal; konten tampil langsung.
- Navigasi keyboard penuh, fokus terlihat jelas, *skip link* "Lewati ke konten".
- Teks hasil split harus tetap terbaca screen reader (`aria-label` pada elemen induk, potongan karakter `aria-hidden`).
- Modal proyek: focus trap, `role="dialog"`, `aria-modal`.
- Tidak ada konten berkedip > 3 kali/detik.

### 10.3 Responsif
Breakpoint: 360 / 768 / 1024 / 1440 / 1920. Mobile-first. Cursor kustom, tilt, dan preview hover **hanya untuk perangkat `hover: hover` & `pointer: fine`**.

### 10.4 Browser
Chrome, Edge, Firefox, Safari (2 versi terakhir), Chrome Android, Safari iOS. Fitur yang belum didukung (View Transitions) memakai fallback.

### 10.5 SEO & Metadata
- `<title>`: "Wira Sukma Saputra — Android Developer & UI/UX Designer"
- Meta description 150–160 karakter, canonical, Open Graph + Twitter Card (`og-image.jpg` 1200×630).
- JSON-LD `Person` (nama, jobTitle, alumniOf: Universitas Kuningan, sameAs: GitHub/LinkedIn).
- `sitemap.xml`, `robots.txt`, `lang="id"`.

### 10.6 Privasi
- Usia **tidak ditampilkan** di web (ada di CV, tapi tidak perlu dipublikasi).
- Nomor telepon tidak ditulis polos; hanya lewat tombol WhatsApp.
- Email boleh tampil karena dibutuhkan untuk kontak; pertimbangkan obfuscation ringan agar tidak mudah di-scrape.

---

## 11. Fallback & Mode Hemat

| Kondisi | Perilaku |
|---|---|
| Reduced motion | Konten statis, transisi hanya fade 0.2s |
| Tanpa WebGL | Mesh gradient CSS menggantikan partikel |
| Perangkat lemah / `navigator.hardwareConcurrency ≤ 4` | Partikel dikurangi 60%, grain dimatikan |
| Mobile | Tanpa cursor/tilt/preview hover; partikel 1.200; pin horizontal diganti carousel |
| JS dimatikan | Konten tetap terbaca (progressive enhancement), tombol CV & kontak berfungsi |

---

## 12. Acceptance Criteria

- [ ] Semua 9 section tampil lengkap dan sesuai konten bagian 5.
- [ ] Semua animasi A1–A23 berfungsi di desktop; yang relevan berfungsi di mobile sesuai bagian 11.
- [ ] Preloader tidak lebih dari 2,2 detik dan hanya sekali per sesi.
- [ ] Skor Lighthouse memenuhi target bagian 2 (diuji pada build produksi).
- [ ] Tidak ada error/warning di console; tidak ada layout shift saat animasi masuk.
- [ ] `prefers-reduced-motion` diuji dan konten tetap lengkap.
- [ ] Navigasi keyboard menjangkau semua elemen interaktif; modal bisa ditutup dengan `Esc`.
- [ ] Tombol WhatsApp membuka `wa.me/6281219195308`; tombol salin email berfungsi; PDF CV terunduh.
- [ ] Toggle tema tersimpan antar kunjungan; tidak ada flash tema salah saat load.
- [ ] Diuji di Chrome, Firefox, Safari, dan minimal 1 HP Android.
- [ ] Tidak ada teks usang: typo "Freelencer" sudah diperbaiki, IPK tidak salah tampil.

---

## 13. Urutan Pengerjaan (untuk OpenCode)

| Fase | Isi | Hasil |
|---|---|---|
| 1. Fondasi | Struktur folder, `tokens.css`, `base.css`, `content.js`, HTML semantik semua section tanpa animasi | Situs statis lengkap, sudah responsif |
| 2. Inti motion | GSAP + Lenis + ScrollTrigger sync, nav, progress bar, preloader, reveal teks (A1, A3–A8) | Pengalaman scroll halus |
| 3. Section interaktif | About counter/teks scrub, skill marquee + tilt, timeline SVG (A9–A15) | Section Tentang–Perjalanan hidup |
| 4. Proyek & sertifikat | Preview hover, modal Flip, filter, pin horizontal (A16–A19) | Proyek & sertifikat final |
| 5. Hero WebGL | Three.js partikel + interaksi + fallback (A2) | Hero "wow" |
| 6. Polish | Cursor/magnetic, tema, menu mobile, grain, micro-interaction (A6, A20–A23) | Detail akhir |
| 7. QA & rilis | Reduced-motion, a11y, Lighthouse, SEO, deploy | Siap publish |

**Prompt awal untuk OpenCode:**
> Baca `PRD-portofolio-wira.md`. Kerjakan **Fase 1** saja dulu: buat struktur folder sesuai bagian 9.2, isi `data/content.js` dari Lampiran A, dan bangun HTML + CSS semua section tanpa animasi, responsif mobile-first, memakai token dari bagian 7. Setelah selesai, jelaskan apa yang dibuat lalu tunggu instruksi untuk fase berikutnya.

---

## 14. Data yang Perlu Dilengkapi & Keputusan Terbuka

**Perlu dari Wira**
1. Foto baru (cutout PNG transparan atau latar netral, min. 1200px); foto CV berlatar merah kurang cocok dengan tema.
2. Daftar proyek final (judul, deskripsi, screenshot/video, link) dan izin publikasi untuk proyek klien.
3. Link GitHub, LinkedIn (dan Play Store jika ada).
4. File CV PDF versi terbaru (typo "Freelencer" diperbaiki).
5. Logo/ikon penyelenggara sertifikat (Dicoding, Bangkit, Figma Camp, Certiport, BuildWithAngga) atau link kredensial.
6. Domain (mis. `wirasukma.dev` atau subdomain gratis).

**Keputusan yang diasumsikan di PRD ini (bisa diubah)**
- Gelap sebagai tema default, aksen hijau Android + biru.
- Situs satu halaman, tanpa framework, CDN dengan salinan lokal.
- Bahasa Indonesia dulu; versi English di fase 2.
- Usia dan nomor telepon polos tidak dipublikasikan.

---

## Lampiran A — `data/content.js` (siap pakai)

```js
export const content = {
  meta: {
    name: "Wira Sukma Saputra",
    shortName: "Wira",
    title: "Android Developer & UI/UX Designer",
    roles: ["Android Developer", "UI/UX Designer", "Full-Stack Web", "Firebase & REST API"],
    tagline: "Merancang & membangun aplikasi yang terasa mulus.",
    subtitle: "Android Developer & UI/UX Designer — Kotlin, Jetpack Compose, dan web modern.",
    status: "Open for freelance",
    email: "wiralodrasaputra07@gmail.com",
    whatsapp: "https://wa.me/6281219195308",
    cv: "assets/Wira-Sukma-Saputra-CV.pdf",
    social: { github: "", linkedin: "" } // isi saat siap
  },

  about: {
    summary:
      "Desainer & pengembang full-stack yang adaptif dengan kemahiran kuat di pengembangan Android dan web. Terbiasa membangun aplikasi berpusat pada pengguna dengan Kotlin, Jetpack Compose, dan teknologi web modern — dengan UI/UX yang bersih dan back-end yang andal. Aktif di proyek tim maupun lepas, dengan pola pikir bertumbuh yang dibentuk lewat program seperti Bangkit 2023. Fokus pada solusi digital yang terukur, aman, dan mudah dipelihara di berbagai platform.",
    stats: [
      { value: 2,  suffix: "+", label: "Tahun pengalaman freelance" },
      { value: 30, suffix: "%", label: "Peningkatan efisiensi baterai & responsivitas" },
      { value: 10, suffix: "",  label: "Sertifikasi & program" },
      { value: 2,  suffix: "",  label: "Peran: Android Dev & UI/UX" }
    ]
  },

  skills: [
    { group: "Android", items: ["Kotlin", "Jetpack Compose", "MVVM", "LiveData", "Navigation", "ViewModel", "Profiling & Optimasi"] },
    { group: "Web", items: ["HTML", "CSS", "JavaScript", "PHP", "MySQL"] },
    { group: "UI/UX", items: ["Figma", "Adobe XD", "Zeplin", "Wireframe & Prototype", "Usability Testing", "Design System", "WCAG"] },
    { group: "Backend & Cloud", items: ["Firebase Auth", "Firestore", "Cloud Messaging", "App Distribution", "REST API", "AWS Cloud Practitioner"] },
    { group: "Workflow", items: ["Git", "GitHub", "Open Source", "Team Collaboration"] }
  ],

  journey: [
    { date: "Sep 2021", type: "education", title: "Mulai kuliah Teknik Informatika", org: "Universitas Kuningan" },
    {
      date: "Jan 2023 – Des 2024", type: "work",
      title: "UI/UX Designer", org: "Freelance",
      points: [
        "Merancang antarmuka mobile & web berpusat pada pengguna (Figma, Adobe XD) yang konsisten lintas perangkat.",
        "Riset pengguna, persona, wireframe, mockup, dan prototipe interaktif.",
        "Hand-off ke developer via Zeplin dan Dev Mode Figma.",
        "Uji kegunaan & iterasi untuk meningkatkan keberhasilan tugas dan kepuasan pengguna.",
        "Menerapkan design system dan standar aksesibilitas WCAG.",
        "Menyediakan UI kit fidelitas tinggi dan style guide."
      ]
    },
    { date: "2023", type: "program", title: "Bangkit Academy — Cloud Computing", org: "Google, Gojek, Tokopedia, Traveloka" },
    {
      date: "Jan 2024 – Apr 2025", type: "work",
      title: "Android Developer", org: "Freelance",
      points: [
        "Mengembangkan aplikasi Android dengan Kotlin dan Jetpack Compose, fokus pada UI/UX modern dan interaksi mulus.",
        "Integrasi Firebase: Authentication, Firestore, Cloud Messaging (notifikasi push).",
        "Arsitektur MVVM + Jetpack (LiveData, Navigation, ViewModel) agar kode skalabel dan mudah dipelihara.",
        "Optimasi performa & memori dengan profiling → responsivitas dan efisiensi baterai naik hingga 30%.",
        "Kolaborasi via Git/GitHub, rutin berkontribusi di proyek open-source.",
        "Distribusi beta via Firebase App Distribution untuk siklus perbaikan iteratif."
      ],
      highlight: "30%"
    },
    {
      date: "Mei 2025", type: "education", title: "Lulus S1 Teknik Informatika — predikat pujian", org: "Universitas Kuningan",
      points: [
        "Fokus Android (Kotlin, Jetpack Compose) dan Web (HTML, CSS, JavaScript, PHP).",
        "Proyek akhir: aplikasi pembelajaran mobile modern untuk belajar mandiri."
      ]
    }
  ],

  projects: [
    // Isi/konfirmasi. Skema:
    // { id, title, category: "android"|"web"|"uiux", year, summary, role, stack: [], cover, gallery: [], links: { live, github, playstore }, highlight }
    { id: "kepalqu", title: "KepalQu", category: "android", year: 2025, summary: "Aplikasi Android untuk delivery/logistik.", role: "Android Developer", stack: ["Kotlin"], cover: "assets/img/kepalqu.webp", gallery: [], links: {}, highlight: "" },
    { id: "parent-notifications", title: "Parent Notifications", category: "android", year: 2025, summary: "Aplikasi untuk orang tua siswa SMK Model Patriot IV dengan notifikasi dan login berbasis WhatsApp.", role: "Android Developer", stack: ["Kotlin", "Firebase FCM"], cover: "assets/img/parent-notifications.webp", gallery: [], links: {}, highlight: "" },
    { id: "orion-studio", title: "ORION Studio", category: "web", year: 2026, summary: "Landing page 3D dengan animasi scroll.", role: "Designer & Developer", stack: ["Next.js", "Three.js"], cover: "assets/img/orion.webp", gallery: [], links: {}, highlight: "" },
    { id: "techop-id", title: "techop.id", category: "web", year: 2026, summary: "Company profile digital agency.", role: "Designer & Developer", stack: ["Laravel", "Tailwind"], cover: "assets/img/techop.webp", gallery: [], links: {}, highlight: "" }
  ],

  certs: [
    { org: "Bangkit Academy", title: "Cloud Computing Cohort 2023 (Google, Gojek, Tokopedia, Traveloka)" },
    { org: "Dicoding", title: "Android Developer Learning Path" },
    { org: "Dicoding", title: "Kotlin Language Programming" },
    { org: "Dicoding", title: "Jetpack Compose for Native Android UI" },
    { org: "Dicoding", title: "Cloud Practitioner Essentials (AWS)" },
    { org: "Dicoding", title: "Back-End Developer (PHP & MySQL)" },
    { org: "Dicoding", title: "Web Front-End Development (HTML, CSS, JS)" },
    { org: "Figma Camp Batch 2", title: "UI/UX Design Fundamentals & Prototyping" },
    { org: "Certiport", title: "Microsoft Office Specialist (Word & Excel)" },
    { org: "BuildWithAngga", title: "Android App Development: Figma to XML Food App" }
  ],

  contact: {
    headline: "Ayo bikin sesuatu yang keren.",
    sub: "Punya ide aplikasi atau website? Cerita aja, saya bantu dari desain sampai rilis."
  }
};
```
