# PRD — RAJAWALI ROYALE
### Game 3D First/Third-Person Battle Royale — Single File `index.html`

| Item | Nilai |
|---|---|
| Versi dokumen | 1.0 |
| Tanggal | 14 November 2026 |
| Jenis produk | Game browser 3D (singleplayer vs bot AI), satu file `index.html` |
| Genre | Tactical shooter / Battle Royale |
| Engine | Three.js (pinned version, via CDN) + kode kustom (fisika, AI, audio, UI) |
| Target platform | Desktop (Chrome/Edge/Firefox terbaru), keyboard + mouse, gamepad opsional |
| Bahasa UI | Bahasa Indonesia (default), English (opsional) |
| Nama kode | `RAJAWALI` |

> **Catatan jujur soal ekspektasi.** PUBG dibuat tim ratusan orang dengan aset foto-realistis berukuran puluhan GB. Satu file `index.html` tidak akan menyamai itu pixel per pixel. Yang realistis dan *tetap meyakinkan*: pencahayaan sinematik, material PBR, model senjata procedural yang detail dan beranimasi bagus, balistik sungguhan, suara yang dipadatkan berlapis, AI bot yang masuk akal, dan HUD yang rapi. PRD ini mengatur **cara mencapai kesan "nyata" itu tanpa tampilan murahan (slop)**. Lihat Bab 3 (Anti-Slop) dan Bab 25 (Batasan & Opsi Fidelity).

---

## DAFTAR ISI
1. Ringkasan Produk
2. Tujuan, Non-Tujuan, Metrik Sukses
3. **Standar Anti-Slop (WAJIB)**
4. Constraint Teknis & Arsitektur Single-File
5. Game Flow (dari Menu sampai Hasil Akhir)
6. Kontrol & Input
7. Karakter Pemain & Fisika Gerak
8. Kamera, Viewmodel, & Animasi Senjata
9. Sistem Senjata (Katalog & Stat)
10. Balistik, Damage, Hit Detection
11. Modeling Procedural Senjata (Spesifikasi Detail)
12. Attachment
13. Armor, Health, Item Pemulihan, Throwables
14. Inventori & Loot
15. Dunia / Peta Pulau
16. Rendering & Visual
17. Audio
18. AI Bot
19. Zone (Blue Zone), Airdrop, Pesawat, Parasut
20. Efek (Partikel, Decal, Ragdoll, Smoke)
21. HUD & UI
22. Performa & Budget
23. Struktur Kode & Milestone Pembangunan
24. QA, Testing, Definition of Done
25. Batasan, Risiko, Opsi Fidelity Tambahan, Legal
26. Lampiran (Config, Tabel, Prompt Eksekusi)

---

## 1. RINGKASAN PRODUK

**RAJAWALI ROYALE** adalah game battle royale 3D di browser. Pemain bersama 39 bot AI (bisa diatur 19/39/59) diterjunkan dari pesawat ke **Pulau Rajawali** (peta ±1600 × 1600 m), mencari senjata, armor, dan item, bertahan dari zona aman yang terus menyempit, lalu jadi **orang terakhir yang hidup**.

Pengalaman inti:
1. Terjun dari pesawat, free-fall, buka parasut, pilih titik mendarat.
2. Looting di bangunan yang bisa dimasuki (rumah, pabrik, pangkalan militer, apartemen).
3. Baku tembak dengan balistik nyata (peluru punya kecepatan, gravitasi, dan drag), recoil pattern, dan suara yang spasial.
4. Rotasi mengikuti zona, manfaatkan kendaraan (stretch goal) dan medan.
5. Menang atau mati, lalu lihat statistik.

Semua aset (model, tekstur, suara) dihasilkan **procedural di dalam kode**. Tidak ada file eksternal selain library Three.js dari CDN.

---

## 2. TUJUAN, NON-TUJUAN, METRIK SUKSES

### 2.1 Tujuan
- G1. Kesan visual "game AAA kecil": cahaya, bayangan, material logam/kayu/polimer yang meyakinkan.
- G2. Gunplay terasa: recoil, sway, ADS, reload beranimasi, suara dan efek tembakan berlapis.
- G3. Siklus match lengkap 15–25 menit dengan zona, loot, AI, dan kondisi menang/kalah.
- G4. Berjalan ≥ 60 FPS di laptop menengah (iGPU modern) pada preset Medium.
- G5. Zero error console, zero tombol mati, zero teks placeholder.

### 2.2 Non-Tujuan (v1)
- Multiplayer online / netcode.
- Mobile / touch (hanya desktop).
- Aset berhak cipta (logo, skin, nama PUBG, model senjata berlisensi).
- Cheat-proofing, akun, leaderboard server.
- Mode squad/duo (hanya Solo; struktur kode disiapkan agar bisa ditambah).

### 2.3 Metrik Sukses (terukur)
| Metrik | Target |
|---|---|
| FPS rata-rata (Medium, 1080p, iGPU Intel Xe/Apple M1 setara) | ≥ 60, 1% low ≥ 40 |
| FPS (High, GPU diskrit mid-range) | ≥ 90 |
| Waktu muat sampai menu | ≤ 8 detik (koneksi biasa, Three.js CDN ter-cache) |
| Waktu generate dunia setelah klik "Mulai" | ≤ 12 detik (progress bar nyata) |
| Error console selama 1 match penuh | 0 |
| Memori | ≤ 1.2 GB heap+GPU |
| Match bisa diselesaikan | 100% (tidak ada softlock, bot stuck > 10 detik harus ter-recover) |

---

## 3. STANDAR ANTI-SLOP (WAJIB)

"Slop" = hasil generik, asal jadi, terlihat seperti demo AI. Daftar ini adalah **aturan keras**, dan tiap poin menjadi item QA.

### 3.1 Dilarang
| # | Larangan |
|---|---|
| S1 | Senjata dari kotak/silinder polos tanpa detail. Setiap senjata punya silhouette yang dikenali dari samping. |
| S2 | Warna solid polos tanpa tekstur/normal/roughness (kecuali kaca, UI). |
| S3 | Tanah datar hijau seragam, pohon kerucut identik, bangunan kotak tanpa interior. |
| S4 | Gradient ungu-biru, glow neon, font generik, emoji sebagai ikon HUD. |
| S5 | Teks "Lorem ipsum", "TODO", "Coming soon", "Test", tombol yang tidak berfungsi. |
| S6 | Tembakan tanpa efek (flash, asap, selongsong, tracer, impact, decal) atau tanpa suara. |
| S7 | Animasi teleport (reload/ganti senjata tanpa transisi). |
| S8 | Bot yang berdiri diam, berjalan menembus dinding, atau menembak tanpa melihat target. |
| S9 | Hitscan instan untuk semua senjata (harus pakai balistik proyektil). |
| S10 | Pop-in kasar: objek muncul tiba-tiba di jarak dekat; tekstur berkedip; z-fighting. |
| S11 | Magic number tersebar. Semua konstanta ada di satu `CONFIG`. |
| S12 | Kode copy-paste per senjata. Senjata didefinisikan data-driven. |
| S13 | `console.log` tertinggal di build akhir (kecuali lewat `DEBUG` flag). |
| S14 | Menu seadanya (tombol HTML default browser). UI harus bergaya konsisten. |

### 3.2 Wajib
| # | Kewajiban |
|---|---|
| W1 | Satu **bahasa visual** konsisten: militer-taktis, palet netral tanah/hijau zaitun/abu, aksen oranye-kuning untuk info penting. |
| W2 | Material PBR (metalness/roughness/normal) dengan tekstur procedural beresolusi cukup (512–2048). |
| W3 | Detail kecil: baut, ulir, rail slot, engsel pintu, noda, karat, goresan, bekas pakai. |
| W4 | Skala nyata (1 unit = 1 m). Pintu 2.0 m, anak tangga 0.18 m, senjata sesuai panjang asli. |
| W5 | Tiap interaksi punya feedback tiga arah: visual + audio + HUD. |
| W6 | Semua pengaturan di menu Settings benar-benar mempengaruhi game dan tersimpan. |
| W7 | Loading screen berisi progres nyata (bukan animasi palsu). |
| W8 | Penanganan error: WebGL2 tidak ada / CDN gagal / pointer lock ditolak → layar penjelasan yang ramah. |
| W9 | Seluruh teks ke dalam Bahasa Indonesia yang natural, konsisten, tanpa typo. |
| W10 | Reuse vektor/objek di hot loop; tidak ada alokasi per-frame yang memicu GC spike. |

### 3.3 "Smell test" sebelum rilis
Ambil 10 screenshot acak dari match. Jika ada yang terlihat seperti demo three.js default (kubus, lantai datar, langit gradient polos), build **ditolak**.

---

## 4. CONSTRAINT TEKNIS & ARSITEKTUR SINGLE-FILE

### 4.1 Aturan file
- Output: **satu file `index.html`** (HTML + CSS + JS di dalamnya).
- Dependensi eksternal **hanya** Three.js (versi dipin, contoh `0.160.0`) dan addon resmi (EffectComposer, RenderPass, UnrealBloomPass, OutputPass, Sky, CSM atau shadow custom, BufferGeometryUtils, RoundedBoxGeometry) lewat **import map** dari `cdn.jsdelivr.net` atau `unpkg.com`.
- Tidak ada gambar, audio, font, atau model eksternal. Semua procedural (canvas 2D, noise, WebAudio synthesis).
- Font: stack sistem (`"Bahnschrift","Segoe UI Variable","SF Pro Display","Roboto Condensed",system-ui,sans-serif`) + `font-variant-numeric: tabular-nums` untuk angka HUD.
- `<script type="module">` dengan struktur modul internal (objek/kelas) dan banner komentar `// ═══ SECTION ═══`.

### 4.2 Pipeline waktu
- **Fixed timestep simulasi 60 Hz** (accumulator), render dengan interpolasi. Maksimal 5 substep per frame untuk mencegah spiral of death.
- Bot AI: tick 10 Hz (persepsi 5 Hz, steering 30 Hz), dibagi bergilir antar-frame (budget ≤ 1.5 ms/frame).
- Balistik: substep 120 Hz untuk peluru aktif.

### 4.3 Modul internal (namespace)
```
CONFIG        // semua konstanta (Lampiran A)
Util          // math, PRNG seed (mulberry32), noise (simplex), pool, event bus
Input         // keyboard/mouse/gamepad, keybind, pointer lock
Assets        // generator tekstur/material procedural, cache
World         // heightmap, terrain chunk, flora, bangunan, collision grid
Physics       // character controller, raycast statis, proyektil, ragdoll
Weapons       // data senjata, viewmodel builder, atachment, animasi
Ballistics    // proyektil, damage, penetrasi
Entities      // Player, Bot, Loot, Vehicle (stretch), Throwable
AI            // behavior tree, persepsi, navigasi
Zone          // fase zona, damage, airdrop, pesawat
FX            // partikel, decal, tracer, smoke, ledakan
Audio         // WebAudio engine, mixer, reverb, spasialisasi
Render        // renderer, composer, shadow, LOD, culling
UI            // HUD, minimap, peta besar, inventori, menu, settings
Game          // state machine, match controller, loop
Debug         // overlay F3, self-test, profiler
```

### 4.4 Browser & fallback
- Wajib WebGL2, Pointer Lock API, WebAudio, `OffscreenCanvas` (opsional untuk generate tekstur di Worker).
- Jika WebGL2 tidak tersedia → layar error informatif.
- Jika CDN Three.js gagal → layar error dengan tombol "Coba lagi" (reload).
- Opsi (jika ingin 100% offline): embed Three.js minified ke dalam file (menambah ±700 KB). Ditandai sebagai opsi build.

### 4.5 Penyimpanan
`localStorage`: pengaturan (sens, FOV, keybind, kualitas, volume), statistik karier (match, win, kill, best placement, jam main), seed terakhir. Semua akses dibungkus try/catch.

---

## 5. GAME FLOW

```
BOOT → MAIN MENU → (Settings / Cara Bermain / Statistik)
     → MATCH SETUP (seed, jumlah bot, kesulitan, waktu hari, mode kamera)
     → GENERATING WORLD (progress bar nyata)
     → LOBBY ISLAND (area tunggu 20 dtk, bisa uji senjata dummy)
     → PLANE (terbang melintasi peta)
     → FREE-FALL → PARACHUTE → LANDING
     → MATCH (loot, tembak-menembak, zona, airdrop)
     → DEATH → SPECTATE (ikuti pembunuh / bot lain) → RESULT
     → atau VICTORY ("WINNER WINNER" → ganti: "JUARA PULAU RAJAWALI") → RESULT
     → kembali ke MAIN MENU / Main lagi (seed baru)
```

### 5.1 Main menu
- Latar: pemandangan 3D hidup (pulau dari udara, kamera orbit lambat, senjata dipamerkan di atas meja dengan lighting studio).
- Tombol: **Main**, **Latihan** (range tembak tanpa zona), **Pengaturan**, **Cara Bermain**, **Statistik**, **Keluar** (konfirmasi).
- Nama pemain bisa diubah (disimpan).

### 5.2 Match setup
| Opsi | Pilihan |
|---|---|
| Jumlah peserta | 20 / 40 / 60 |
| Kesulitan bot | Rookie / Regular / Veteran |
| Waktu hari | Pagi / Siang / Senja / Malam (malam: ada senter & NVG-tidak, murni gelap + bulan) |
| Cuaca | Cerah / Berawan / Kabut / Hujan |
| Seed peta | Acak atau input angka |
| Kamera | FPP saja / TPP saja / Boleh ganti (V) |

### 5.3 Fase match
| Fase | Durasi | Keterangan |
|---|---|---|
| Lobby | 20 dtk | Pulau kecil tempat start, tembak dummy, countdown. |
| Pesawat | ± 45 dtk | Lintasan acak melintasi pulau, bot melompat di titik berbeda. |
| Free-fall + parasut | 20–40 dtk | Arah dikendalikan, lihat marker pemain lain. |
| Early game | Fase zona 1–2 | Looting. |
| Mid game | Fase 3–5 | Rotasi, baku tembak. |
| End game | Fase 6–8 | Zona kecil, tekanan tinggi. |

### 5.4 Kondisi akhir
- **Menang**: pemain hidup terakhir.
- **Kalah**: HP 0 (mati langsung, mode solo tanpa knock).
- Layar hasil: peringkat (#N/40), kill, damage, jarak tempuh, waktu bertahan, akurasi, headshot %, senjata favorit, kill-cam ringkas (5 detik terakhir dari sudut pembunuh), tombol Main Lagi / Menu.

---

## 6. KONTROL & INPUT

### 6.1 Keyboard + Mouse (default, bisa diremap)
| Aksi | Tombol |
|---|---|
| Maju/mundur/kiri/kanan | W / S / A / D |
| Sprint | Shift (tahan) |
| Jalan pelan | Alt (tahan) atau Caps toggle |
| Lompat / Vault | Space |
| Jongkok | C (tahan/toggle sesuai pengaturan) |
| Tiarap | Z (tahan/toggle) |
| Lean kiri/kanan | Q / E |
| Tembak | Klik kiri |
| ADS (bidik) | Klik kanan (tahan/toggle) |
| Ganti mode tembak | B (auto / burst / single) |
| Reload | R |
| Ganti senjata | 1 / 2 / 3 / 4 / 5 atau scroll |
| Interaksi (ambil, buka pintu, pakai) | F (tahan untuk item bertahap) |
| Inventori | Tab |
| Peta besar | M |
| Ganti FPP/TPP | V |
| Lempar granat | G (tahan untuk cook, lepas untuk lempar) |
| Heal cepat | 7 (bandage), 8 (first aid), 9 (med kit), 0 (booster) |
| Pasang/lepas scope zoom (variabel) | Scroll saat ADS |
| Bidik bebas (free look) | Alt tahan (tanpa menggeser arah badan) |
| Jeda / menu | Esc |
| Debug overlay | F3 |
| Ping/marker peta | Klik tengah di peta |

### 6.2 Gamepad (opsional, Gamepad API)
Layout standar Xbox: stik kiri gerak, kanan lihat, RT tembak, LT ADS, A lompat, B jongkok/tiarap (tahan), X reload, Y ganti senjata, LB/RB granat/heal, Start pause. Dead zone 0.12, kurva respons, aim assist **tidak ada**.

### 6.3 Sensitivitas
- Sensitivitas umum: 0.05–2.0 (default 0.4), slider dengan nilai numerik.
- Sensitivitas ADS multiplier terpisah: tiap tingkat scope (1x/2x/3x/4x/6x/8x/15x) default 1.0; skala berdasarkan FOV.
- Invert Y opsional.
- Raw input: `pointerLockOptions: {unadjustedMovement:true}` bila didukung.

---

## 7. KARAKTER PEMAIN & FISIKA GERAK

### 7.1 Dimensi
| Stance | Tinggi kapsul | Tinggi mata | Radius |
|---|---|---|---|
| Berdiri | 1.80 m | 1.65 m | 0.35 m |
| Jongkok | 1.30 m | 1.15 m | 0.35 m |
| Tiarap | 0.60 m | 0.45 m | 0.35 m |

Transisi stance: interpolasi 0.18 dtk (ease-out). Tidak boleh berdiri jika kepala akan menabrak langit-langit (cek ruang di atas).

### 7.2 Kecepatan (m/s, di tanah datar)
| Gerak | Kecepatan |
|---|---|
| Sprint | 6.8 |
| Jogging | 5.0 |
| Jalan pelan | 2.8 |
| Jongkok jalan | 2.0 |
| Merayap (tiarap) | 0.9 |
| Mundur | ×0.8 |
| Menyamping (strafe) | ×0.9 |
| ADS | ×0.6 |
| Membawa senjata berat (SR/LMG) | ×0.95 |
| Sedang heal/reload | tidak berpengaruh, sprint dibatalkan |

Akselerasi: ground accel 45 m/s², decel 55 m/s², air control 0.15 dari ground. Sprint hanya saat bergerak ke depan (±55°), putus saat menembak/ADS.

### 7.3 Melompat, vault, jatuh
- Gravitasi pemain 18 m/s². Kecepatan lompat 5.6 m/s (tinggi ≈ 0.87 m). Cooldown mendarat 0.15 dtk.
- **Vault**: rintangan ≤ 1.2 m, lebar bebas ≥ 0.5 m, animasi 0.55 dtk (kamera naik-maju). Climb rintangan ≤ 1.9 m (jendela/dinding rendah) 1.1 dtk.
- **Fall damage**: mulai dari tinggi jatuh > 3.5 m. `damage = (h − 3.5) × 12`, minimal 0, maksimum fatal > 12 m. Mendarat dengan parasut: tidak ada damage.
- Slope limit 50°, di atas itu meluncur turun. Step-up otomatis ≤ 0.45 m.

### 7.4 Collision
- Character controller kapsul custom: sweep-and-slide terhadap (a) AABB/OBB bangunan, (b) heightmap terrain (query analitik bilinear), (c) objek flora (silinder batang pohon, bounding batu).
- Static colliders disimpan di **spatial hash grid 8 × 8 m**, query hanya sel sekitar.
- Pintu: pivot dengan engsel, buka/tutup animasi 0.35 dtk, collision AABB berputar (OBB), bot bisa membuka.
- Tangga: collider berupa ramp tersembunyi (slope 35°) agar mulus.
- Air: kedalaman ≤ 0.8 m bisa diarungi (×0.6 speed), > 1.4 m berenang (×0.4 speed, tidak bisa menembak), sound & efek percikan.

### 7.5 Lean & peek
Lean ±15° rotasi roll kamera + 0.25 m offset lateral dengan cek collision bahu. Kecepatan lean 0.12 dtk.

### 7.6 Stamina & sprint
Tidak ada bar stamina. Jika sprint > 6 dtk berturut-turun, ada efek napas (audio + vignette ringan) tanpa penalti kecepatan. (Tujuan: realisme tanpa frustasi.)

---

## 8. KAMERA, VIEWMODEL, & ANIMASI SENJATA

### 8.1 Kamera
| Parameter | Nilai |
|---|---|
| FOV dasar (vertikal) | 75° default, slider 60–110 |
| FOV ADS | tergantung optik (lihat 12.1) |
| Near/Far | 0.05 / 1500 (far disesuaikan preset) |
| TPP | Kamera di belakang bahu kanan (offset 0.45 m kanan, 0.25 m atas, 2.2 m belakang), spring-arm dengan collision (raycast mundur), bisa pindah bahu dengan tombol, crosshair di tengah |
| FPP | Kamera di mata, kepala pemain disembunyikan di FPP (layer terpisah) |
| Head bob | Amplitudo y 0.02 m, x 0.012 m, frekuensi mengikuti kecepatan (1.7 Hz jalan, 2.6 Hz lari), nonaktif saat ADS (dikurangi 85%) |
| Efek landing | Dip 0.06–0.18 m sesuai kecepatan jatuh |
| Efek damage | Kamera tersentak (flinch) 1.5° ke arah datang tembakan, vignette merah, suara dengung |
| Efek sprint | FOV +4°, motion blur ringan (opsional via composer) |

### 8.2 Viewmodel (senjata first-person)
- Dirender dengan **kamera + scene terpisah** yang digambar setelah dunia dengan depth buffer di-clear, FOV tetap 58° (tidak mengikuti FOV dunia → senjata tidak melar).
- Senjata punya pencahayaan sendiri (directional dari arah matahari + hemisphere + environment map dunia) agar konsisten dengan lingkungan.
- **Weapon lower near wall**: raycast pendek (0.9 m) ke depan; jika kena, senjata diturunkan/dimiringkan (animasi 0.12 dtk) dan tembakan diblok.
- Tangan & lengan: model procedural (lengan bawah berbaju lengan panjang, sarung tangan dengan jari yang dipose) yang mengikuti posisi pegangan senjata (grip points didefinisikan di data senjata).

### 8.3 Sistem animasi procedural
Berbasis **spring-damper** + keyframe kurva (cubic bezier). Tidak memakai file animasi.

| Layer | Komponen | Parameter |
|---|---|---|
| Idle sway | Gerakan napas, sinus 0.25 Hz | amp 0.004 m / 0.15° |
| Move sway | Bob ikuti langkah | amp naik dengan kecepatan |
| Look sway | Lag rotasi (senjata tertinggal saat kamera berputar) | spring k=90, c=12 |
| Recoil | Spring terpisah untuk translasi (kick mundur) dan rotasi (naik + sedikit lateral) | per senjata |
| ADS | Interpolasi posisi senjata dari hip → mata sejajar sight | waktu ADS per senjata (0.14–0.35 dtk) |
| Sprint pose | Senjata miring ke bawah-kanan | transisi 0.2 dtk |
| Reload | Keyframe multi-tahap | lihat 8.4 |
| Draw/holster | Senjata naik dari bawah / turun | 0.45 / 0.3 dtk |
| Inspect | Memutar senjata (tahan Y/ tombol H) | 2.5 dtk |
| Melee | Ayunan pan | 0.6 dtk |
| Bolt cycle | Bolt ditarik-dorong (SR) | animasi mekanik + tangan |
| Throw | Tarik tangan ke belakang → lempar | 0.5 dtk |
| Vault/climb | Senjata menurun, tangan menggapai | sync dengan kamera |
| Heal | Item dipegang, animasi sesuai (balut, suntik) | durasi item |

### 8.4 Keyframe reload (contoh AR magazine, total 2.4–2.9 dtk)
1. 0.00–0.25 — senjata miring ke kanan, tangan kiri bergerak ke magazine.
2. 0.25–0.45 — tekan tombol rilis, magazine lepas (jatuh, fisika, suara).
3. 0.45–1.10 — tangan kiri ambil magazine baru dari rig dada (model magazine visible).
4. 1.10–1.50 — masukkan magazine (rock-in), bunyi klik.
5. 1.50–1.80 — senjata kembali horizontal.
6. 1.80–2.10 — tarik charging handle (hanya jika magazine kosong → "tactical reload" 1.9 dtk vs "empty reload" 2.7 dtk).
7. Selesai — ammo dihitung (mag baru + 1 peluru di chamber jika tactical).

Reload per senjata: shotgun per peluru (0.5 dtk per shell, bisa dibatalkan menembak), bolt-action per klip/peluru, pistol, SMG.

### 8.5 Tembakan: urutan frame
1. Peluru keluar: spawn proyektil dari ujung laras (muzzle node), bukan dari kamera, namun arah dikoreksi agar mengenai titik bidik kamera pada jarak konvergensi (default 80 m; dalam ruangan, ikut raycast ke target terdekat).
2. Flash + cahaya titik 0.05 dtk (PointLight pooled), asap muzzle, selongsong terlempar (fisika sederhana + bunyi jatuh sesuai permukaan).
3. Recoil spring + kamera naik (lihat 10.4).
4. Tracer tiap N peluru.
5. Bolt/slide bergerak di model.
6. Audio: lapisan gunshot (12.3).

---

## 9. SISTEM SENJATA (KATALOG & STAT)

Semua senjata fiktif-generik terinspirasi senjata dunia nyata (nama umum: AKM, M416, dll. dipakai sebagai deskriptor generik; tidak ada merek/logo). Angka di bawah adalah **desain game**, bukan data balistik resmi.

### 9.1 Slot
| Slot | Isi |
|---|---|
| 1 | Primer (AR/SMG/DMR/SG/SR) |
| 2 | Primer kedua |
| 3 | Pistol |
| 4 | Melee (pan) |
| 5 | Throwable (granat/smoke/flash) |

### 9.2 Katalog senjata utama
| Senjata | Kelas | Ammo | Damage | RPM | Kecepatan peluru (m/s) | Mag | Reload tact/empty (dtk) | Mode | Range efektif | Catatan |
|---|---|---|---|---|---|---|---|---|---|---|
| **AKM** | AR | 7.62 | 47 | 600 | 715 | 30 (40 ext) | 2.9 / 3.6 | Auto, Single | 200 m | Recoil besar, damage tinggi |
| **M416** | AR | 5.56 | 40 | 670 | 780 | 30 (40 ext) | 2.3 / 3.0 | Auto, Single | 250 m | Paling stabil, banyak attachment |
| **SCAR-L** | AR | 5.56 | 41 | 630 | 870 | 30 (40 ext) | 2.2 / 2.9 | Auto, Single | 250 m | Recoil horizontal rendah |
| **UMP45** | SMG | .45 | 39 | 670 | 400 | 25 (35 ext) | 2.1 / 2.8 | Auto, Burst, Single | 80 m | Jarak dekat |
| **Vector** | SMG | .45 | 31 | 1090 | 300 | 19 (33 ext) | 2.0 / 2.7 | Auto, Single | 60 m | Cepat, recoil kecil, mag kecil |
| **SKS** | DMR | 7.62 | 53 | 330 (semi) | 800 | 10 (20 ext) | 2.9 / 3.4 | Single | 350 m | Menembak semi |
| **Kar98k** | SR | 7.62 | 79 | bolt 1.9 dtk | 760 | 5 | per peluru 0.6 | Bolt | 500 m+ | Headshot helm L2 mematikan L1 |
| **M24** | SR | 7.62 | 83 | bolt 2.2 dtk | 790 | 5 (+ext) | per peluru 0.6 | Bolt | 600 m+ | Presisi, scope wajib |
| **S12K** | SG | 12 ga | 9 peluru × 12 | 250 | 400 | 5 (8 ext) | 0.5 per shell | Semi | 25 m | Spread, falloff curam |
| **P92** | Pistol | 9mm | 34 | 480 (semi) | 380 | 15 (20 ext) | 1.5 / 2.0 | Semi | 50 m | Cadangan |
| **Pan** | Melee | — | 80 (kepala 120) | — | — | — | — | — | 1.4 m | Bisa menahan peluru depan (opsional stretch) |

### 9.3 Throwable
| Item | Efek |
|---|---|
| Granat frag | Fuse 5 dtk (cook sampai 3 dtk), damage radius: 100 @ 0–2 m, linear turun ke 0 @ 8 m, perlu line-of-sight sebagian (raycast ke pusat massa korban) |
| Smoke | Fuse 2 dtk, asap 45 dtk radius 7 m, memblok pandangan manusia dan bot |
| Flashbang | Fuse 2 dtk, buta (layar putih + tinnitus) 0.5–5 dtk tergantung jarak dan arah pandang |

### 9.4 Mode tembak & spread
- Aim cone (spread) dipengaruhi: stance (tiarap −45%, jongkok −25%, bergerak +60%, lompat +150%), ADS −55%, jumlah peluru beruntun, attachment.
- Pola recoil: **vertikal + horizontal pattern deterministik dengan jitter** (lihat 10.4).
- Pelacakan `ammoInMag`, `ammoReserve`, `chamber` (peluru di chamber +1).

### 9.5 Ammo
| Tipe | Berat per peluru | Maks stack awal tas |
|---|---|---|
| 5.56 | 0.55 | 180 |
| 7.62 | 0.75 | 150 |
| .45 | 0.45 | 150 |
| 9mm | 0.35 | 150 |
| 12 ga | 1.0 | 40 |

---

## 10. BALISTIK, DAMAGE, HIT DETECTION

### 10.1 Model proyektil
Setiap peluru adalah partikel dengan:
```
pos, vel, ammoType, ownerId, weaponId, bornTime, travelled
```
Setiap substep (dt = 1/120 s):
```
vel.y -= g * dt                  // g = 9.81
vel   *= (1 - dragCoeff * dt)    // drag per ammoType (lihat tabel)
seg    = pos → pos + vel * dt
hit    = raycast(seg, statics + dynamicHitboxes)
```
Peluru dihapus setelah 3 detik / jarak > 1200 m / mengenai target.

| Ammo | Drag coeff | Catatan |
|---|---|---|
| 5.56 | 0.0009 | |
| 7.62 | 0.0007 | |
| .45 | 0.0022 | Turun cepat |
| 9mm | 0.0020 | |
| 12 ga pellet | 0.0040 | |

**Zeroing**: scope 4x–8x memiliki zeroing 100–800 m (tombol PageUp/PageDown) yang menaikkan sudut tembak agar kompensasi drop. Hip-fire/iron sight zero default 100 m.

### 10.2 Hitbox
Setiap karakter punya hitbox kapsul/box per bagian (selaras skeleton):
| Bagian | Pengali damage |
|---|---|
| Kepala | ×2.35 (AR/SMG), ×2.5 (SR/DMR), ×1.5 (pistol) |
| Leher | ×1.6 |
| Dada atas | ×1.0 |
| Perut | ×0.95 |
| Lengan | ×0.9 |
| Tungkai | ×0.8 |

### 10.3 Damage, falloff, armor
```
dmg = baseDamage * hitboxMult * rangeFalloff(distance) * penetrationFactor
```
- Falloff: kurva piecewise per senjata (mis. M416: 100% ≤ 50 m, 94% @ 150 m, 86% @ 300 m). SMG/SG turun lebih curam.
- **Armor**: bagian dilindungi (helm: kepala; vest: dada + perut + lengan atas). Armor menyerap `r × dmg`, durability berkurang sebesar damage yang diserap.

| Level | Helm absorb | Helm durability | Vest absorb | Vest durability |
|---|---|---|---|---|
| L1 | 30% | 80 | 30% | 200 |
| L2 | 40% | 150 | 40% | 220 |
| L3 | 55% | 230 | 55% | 250 |

Jika durability 0, armor tidak mengurangi damage lagi (visual helm retak / vest sobek).

- **Penetrasi**: peluru bisa menembus material tipis (kayu ≤ 0.1 m, drywall, kaca) dengan pengurangan damage 35–60% dan deflection kecil; logam tebal dan beton menghentikan. Tiap material punya `penetrationResistance`.
- **Ricochet**: sudut kena < 15° pada logam/batu → ricochet dengan desing suara dan percikan (sekali pantul, damage ×0.3).

### 10.4 Recoil & spread
Per senjata ditentukan array **pola recoil** 30 titik (yaw°, pitch° per peluru) + faktor acak ±12%.
- Contoh M416 (pitch awal 0.55°/peluru, naik ke 0.35°; yaw acak ±0.18°). AKM: pitch 0.85°, yaw ±0.35°.
- Recoil kembali (recovery) halus 6°/s setelah berhenti menembak, tidak mengembalikan 100% kecuali sedang ADS dan tidak menembak 0.4 dtk.
- Kamera **ikut naik** (recoil aktif) dan senjata visual naik lebih banyak (visual recoil) agar terasa.
- Efek lain: `muzzleClimb` + `shake` kecil acak.

### 10.5 Feedback hit
| Kejadian | Feedback |
|---|---|
| Kena musuh | Hit marker putih (4 garis), kill: merah + ikon tengkorak kecil (SVG inline), bunyi tik/tok berbeda |
| Headshot | Marker merah, bunyi "thock" tajam |
| Kena armor | Bunyi logam, percikan (bukan darah) |
| Pemain kena | Indikator arah merah di tepi layar (3 arah ×8 sektor), vignette, flinch, bunyi grunt |
| Kill | Kill feed + angka "+1 Kill" + info senjata, jarak |

---

## 11. MODELING PROCEDURAL SENJATA (SPESIFIKASI DETAIL)

Tujuan: senjata terlihat seperti senjata sungguhan dari dekat saat viewmodel. **Kotak dan silinder polos dilarang.**

### 11.1 Teknik geometri
| Teknik | Dipakai untuk |
|---|---|
| `ExtrudeGeometry` dari `Shape` profil samping (dengan lubang dan bevel) | Receiver, dust cover, handguard, magazine, stock, grip |
| `LatheGeometry` | Laras, muzzle brake, flash hider, suppressor, silinder gas, baut |
| `RoundedBoxGeometry` | Blok kecil beradius (tombol, rail cover) |
| `TubeGeometry` | Pegas, sling, kabel |
| Instancing mikro | Slot rail Picatinny (±22 slot), ulir, ribs magazine |
| Boolean pseudo (potongan dengan shape hole) | Port ejeksi, lubang ventilasi, slot handguard |
| Normal map procedural | Tekstur permukaan (knurling, griprib) |

Segmen melengkung ≥ 16 untuk silinder kecil, ≥ 32 untuk laras. Rata-rata tiap senjata **8.000–25.000 segitiga** (viewmodel LOD0), LOD1 (3rd person) 1.500–4.000, LOD2 (kejauhan) 300.

### 11.2 Material senjata
| Material | Parameter | Tekstur procedural |
|---|---|---|
| Baja blued | metalness 0.92, roughness 0.32–0.5 | Noise goresan arah, edge wear, noda minyak |
| Baja phosphate (kasar) | metalness 0.85, rough 0.6 | Grain halus |
| Polimer hitam | metalness 0.0, rough 0.55–0.7 | Stipple/pebble normal map |
| Kayu (AKM) | metalness 0.0, rough 0.45 | Serat kayu procedural (noise anisotropik), poles, vernis |
| Alumunium anodized | metalness 0.8, rough 0.4 | Warna abu gelap, sedikit garis |
| Karet (pad, grip) | rough 0.9 | Pola kotak |
| Kaca optik | transmission 0.9, IOR 1.5, coating tint biru-hijau | Reflection env |
| Kuningan (selongsong) | metalness 1.0, rough 0.3 | Sedikit noda |

Wear map: generate dari curvature approx (vertex normal delta) + noise untuk menggosok tepi tajam; lakukan sekali saat build.

### 11.3 Detail AKM (acuan kedalaman detail; senjata lain mengikuti tingkat yang sama)
Panjang total 880 mm, laras 415 mm, tinggi 245 mm (dengan magazine), berat 3.3 kg.
Bagian wajib ada:
- Receiver (stamped) dengan lengkung khas, rivet kecil, penampang dust cover bergaris
- Dust cover + rear sight leaf (bisa diatur) + notch
- Front sight post dalam tabung sight-hood, **gas block**, **gas tube** melengkung atas laras, tutup cleaning rod
- Handguard atas dan bawah **kayu** dengan bentuk ergonomis, ujung bawah ada slot rod
- Laras dengan **muzzle brake slant** (potongan miring) + nut
- Pistol grip kayu/polimer dengan cekungan jari
- Magazine **melengkung (banana)** berusuk (ribbed), 7 usuk, base plate
- Stock kayu dengan butt plate logam, sling swivel
- Selector lever (kanan receiver) bergerak, charging handle bergerak saat tembak
- Trigger guard + trigger + hammer (terlihat samping)
- Port ejeksi dengan **bolt carrier** yang meluncur saat menembak (animasi reciprocating)

Senjata lain wajib punya daftar komponen setara (≥ 30 part): M416 (quad rail, magwell, stock telescoping, rail slot terpahat, KeyMod/M-Lok), SCAR-L (receiver polimer-aluminium, folding charging handle), UMP45 (polymer body, folding stock, ejection port), Vector (blok depan, magazine well di grip, foregrip), SKS, Kar98k (kayu, bolt, bolt knob, stripper-clip guide), M24 (stock bedding-block, bipod mount, optik), S12K (drum/mag box, vent rib), P92 (slide serrations, hammer, trigger guard).

### 11.4 Animasi mekanik tiap senjata
- Bolt/slide bergerak saat tembak (3–5 mm dengan kurva).
- Selector berubah posisi saat B.
- Magazine lepas/masuk dengan model terpisah + fisika saat jatuh.
- Hammer/striker terlihat bergerak untuk pistol dan bolt.
- Trigger bergerak saat ditekan.

### 11.5 Level of detail
LOD otomatis berdasar jarak dan kamera: viewmodel selalu LOD0; third-person bot LOD0 < 15 m, LOD1 15–80 m, LOD2 > 80 m, imposter silhouette > 200 m (untuk bot; senjata dibuang).

### 11.6 Perlengkapan tubuh (rig)
Magazine rig di dada pemain (3 magazine terlihat), holster pistol di paha, ransel di punggung (ukuran sesuai level), helm (3 model: topi, helm taktis, helm balistik).

---

## 12. ATTACHMENT

### 12.1 Optik
| Optik | Zoom | FOV ADS (vertikal) | Reticle | Cara render |
|---|---|---|---|---|
| Iron sight | 1x | 55° | Mekanik | Model (notch + post) |
| Red dot | 1x | 50° | Titik merah 2 MOA | Overlay shader di lensa |
| Holographic | 1x | 50° | Lingkaran + titik | Overlay shader |
| 2x | 2x | 38° | Crosshair | Zoom FOV + overlay |
| 3x | 3x | 25° | Tipis BDC | Zoom FOV + overlay |
| 4x ACOG | 4x | 17° | Chevron | Zoom FOV + overlay |
| 6x | 6x | 12° | Mil-dot | Zoom FOV + overlay |
| 8x | 8x | 8.5° | Mil-dot | Zoom FOV + overlay |
| 15x | 15x | 4.5° | Mil-dot | Zoom FOV + overlay |

Teknik: saat ADS pada optik berpembesaran, FOV kamera dunia diturunkan dan overlay lensa (vignette bundar, reticle SVG/canvas) digambar. Reticle tidak dipengaruhi shake. Efek: **scope sway** saat tahan napas (Shift menstabilkan 3 dtk, lalu napas berat).

### 12.2 Muzzle
| Item | Efek |
|---|---|
| Compensator | Recoil vertikal −18%, flash lebih lebar |
| Flash hider | Flash tersembunyi −60% |
| Suppressor | Suara berkurang 85%, tracer & flash hilang, jangkauan deteksi bot −70%, velocity −8% |
| Choke (shotgun) | Spread −25% |

### 12.3 Lainnya
| Slot | Pilihan | Efek |
|---|---|---|
| Grip | Vertical, Angled, Half | Recoil V/H berbeda, ADS time |
| Magazine | Extended, Quickdraw, Ext+Quickdraw | Kapasitas, reload −25% |
| Stock | Tactical stock, Cheek pad | Stabilitas, recovery recoil |
| Laser (stretch) | — | Hip-fire spread −12% |
Tiap attachment mengubah **model 3D** senjata (bukan hanya angka).

---

## 13. ARMOR, HEALTH, ITEM PEMULIHAN, THROWABLES

### 13.1 Health
- HP 0–100 (regen lambat hanya lewat booster). Bar sekunder **Boost** 0–100.
- Heal items:

| Item | Cast time | Efek | Batas |
|---|---|---|---|
| Bandage | 4 dtk | +10 HP | sampai 75% |
| First Aid Kit | 6 dtk | +75 HP | sampai 75% |
| Med Kit | 8 dtk | +100 HP | sampai 100% |
| Energy Drink | 4 dtk | +40 Boost | |
| Painkiller | 6 dtk | +60 Boost | |
| Adrenaline | 6 dtk | +100 Boost | |

- Boost tier: 1–29 → +0.4 HP/dtk; 30–59 → +0.6; 60–89 → +0.8 & +4% speed; 90–100 → +1.0 & +8% speed. Boost menurun 0.5/dtk (nilai efek disesuaikan).
- Cast dibatalkan oleh tembak, lompat, sprint, atau terkena damage (bandage lanjut jika damage kecil < 6).

### 13.2 Armor & ransel
- Helm L1–L3, Vest L1–L3, Ransel L1–L3 (kapasitas +50/+100/+150 kg-unit).
- Pasang/ganti lewat F atau drag di inventori; model karakter berubah.

### 13.3 Mati
Bot/pemain yang mati menjatuhkan **Death Crate** (peti kayu/duffel) berisi semua barangnya, bisa dilooting dalam 10 dtk (ragdoll tetap sampai fade).

---

## 14. INVENTORI & LOOT

### 14.1 Inventori (UI Tab)
- Panel kiri: karakter (paperdoll: kepala, torso, ransel), slot senjata + attachment.
- Panel tengah: ground items (item di sekitar 3 m).
- Panel kanan: tas (grid daftar, kapasitas berat `X/Y`).
- Interaksi: klik untuk pakai, drag-drop ke slot, klik kanan menu (Gunakan, Jatuhkan, Pasang ke senjata), shift-klik pindah cepat.
- Auto-pickup opsional (peluru, attachment yang cocok); senjata butuh F.

### 14.2 Berat item
| Item | Berat |
|---|---|
| Bandage | 1 |
| First aid | 4 |
| Med kit | 8 |
| Energy drink | 3 |
| Painkiller | 4 |
| Adrenaline | 5 |
| Frag | 6 |
| Smoke | 5 |
| Flash | 5 |
| Attachment | 2–6 |
Kapasitas dasar 50, ransel L1 +50 (total 100), L2 +100 (150), L3 +150 (200).

### 14.3 Spawn loot
- Titik loot didefinisikan di tiap bangunan (furniture: meja, rak, kotak). Total target ±900 loot point pada peta.
- Tabel peluang per tier lokasi:

| Kategori | Tier 1 (rumah/kebun) | Tier 2 (kota/pabrik) | Tier 3 (militer/pelabuhan) |
|---|---|---|---|
| Senjata AR | 8% | 14% | 22% |
| SMG | 10% | 8% | 6% |
| DMR/SR | 2% | 5% | 10% |
| Shotgun | 6% | 5% | 4% |
| Pistol | 8% | 5% | 3% |
| Ammo | 22% | 18% | 15% |
| Attachment | 12% | 14% | 16% |
| Armor/helm | 6% | 9% | 12% |
| Heal/boost | 18% | 16% | 8% |
| Throwable | 8% | 6% | 4% |

- Rarity warna: Umum (putih), Langka (biru), Epik (ungu muda hanya untuk label kecil, bukan UI utama), Legendaris (emas; hanya airdrop).
- Item spawn dengan **model 3D** di tempat (senjata tergeletak di meja dengan orientasi acak, outline glow lembut saat dekat 3 m).
- Respawn loot: tidak ada (kecuali airdrop dan death crate).

### 14.4 Airdrop
Lihat 19.4.

---

## 15. DUNIA / PETA PULAU RAJAWALI

### 15.1 Skala & struktur
- Peta: **1600 × 1600 m** (area daratan ±1.6 km²), dikelilingi laut dalam 400 m ke segala arah (tidak bisa mendarat di laut → dilarang di plane drop).
- Terrain chunk 100 × 100 m (16 × 16 = 256 chunk), 4 LOD (65 / 33 / 17 / 9 vertex per sisi), skirt untuk menutup celah LOD.
- Seed menentukan layout; **POI posisi tetap** agar peta konsisten antar seed namun hutan/batu/lembah bervariasi (dengan opsi "peta acak penuh").

### 15.2 Terrain
- Height = `islandMask * (fbm(simplex, 6 octave) * 55 + ridged(3 octave) * 40) + carve(sungai, danau) + stamp(POI flatten)`; ketinggian maks ±95 m.
- Pantai berpasir (slope < 6°, elevasi < 3 m), laut dengan shader ombak sederhana, buih tepi.
- Biome via splat map: pasir, rumput, rumput kering, tanah, batu, salju tidak digunakan.
- **Material terrain**: `MeshStandardMaterial` + `onBeforeCompile` splat 4 tekstur tiling procedural (grass, dirt, rock, sand), triplanar untuk lereng curam, detail normal pada jarak dekat, fade ke warna jauh. Resolusi tekstur 1024 per layer.
- Query tinggi analitik + normal untuk fisika (cache per sel 1 m).

### 15.3 Titik Menarik (POI)
| POI | Ukuran | Isi | Tier loot |
|---|---|---|---|
| **Pelabuhan Karang** | 260 × 200 m | Dermaga, kontainer bertumpuk (3 level, bisa dimasuki), 3 gudang, crane, kapal kargo kandas, kantor syahbandar | 3 |
| **Desa Sukamaju** | 220 × 220 m | 26 rumah (6 tipe), masjid kecil, warung, sekolah dasar, lapangan | 1–2 |
| **Pabrik Tua** | 200 × 180 m | Hall 2 lantai, cerobong, tangki, ruang boiler, katwalk, gudang atap | 2–3 |
| **Pangkalan Elang** | 300 × 300 m | Barak, hangar, helipad, bunker bawah tanah, menara pengawas, pagar kawat, gerbang | 3 |
| **Kota Mini Bayu** | 260 × 260 m | 14 gedung 2–5 lantai (apartemen, ruko, rumah sakit kecil), jalan beraspal, SPBU | 2 |
| **Bukit Pinus** | 200 × 200 m | 8 kabin kayu, hutan pinus lebat, pondok pemburu | 1 |
| **Menara Radio** | 120 × 120 m | Menara besi (tangga, platform sniper), bunker, bukit | 2 |
| **Ladang Tengah** | 280 × 220 m | Lumbung, silo, rumah petani, traktor, ladang jagung/padi | 1–2 |
Tambahan: 30–40 bangunan sporadis (gubuk, ruin, pompa bensin, jembatan, dermaga kecil), 2 danau, 1 sungai ±6 m, jalan tanah/aspal menghubungkan POI.

### 15.4 Bangunan (procedural dengan interior nyata)
Setiap bangunan dibangun dari **modul**: pondasi, dinding berlubang (pintu/jendela), lantai, atap, tangga, balkon.
- Pintu bisa dibuka (animasi), jendela bisa dilewati (vault) kecuali berkaca (bisa dipecahkan peluru, opsional).
- Interior berisi furniture (meja, kursi, lemari, kasur, rak, kompor, kamar mandi), sampah, grafiti, kerusakan acak.
- Tekstur dinding: bata, beton, plester, kayu, seng, keramik, lantai parket/ubin (procedural, 512–1024).
- Lampu interior (emissive + beberapa point light statis dicampur ambient probe) di malam hari.
- Nav: tiap bangunan memiliki **graph node** (pintu, tangga, sudut) untuk AI.
- Collision: AABB/OBB per dinding; tangga ramp tersembunyi.

### 15.5 Vegetasi & dekor
| Elemen | Teknik | Jumlah (High) |
|---|---|---|
| Pohon (5 spesies: pinus, jati, kelapa, mangga, semak besar) | Batang `TubeGeometry` bercabang + kanopi kartu daun (alpha) / `InstancedMesh`; 3 LOD + billboard | 28.000 |
| Semak | InstancedMesh | 20.000 |
| Rumput | Shader instancing (kartu silang + vertex wind), radius 40–80 m | ±400.000 helai efektif (di-cull) |
| Batu | 6 model displacement noise, instancing | 6.000 |
| Bunga/tanah | Decal instanced | 10.000 |
| Pagar, tiang listrik, kabel (curve), tong, mobil rusak | Instancing + model | 1.500 |
Angin: gerak vertex dengan noise waktu, kekuatan menyesuaikan cuaca.

### 15.6 Kendaraan (STRETCH GOAL M11)
| Kendaraan | Kapasitas | Kecepatan maks | Catatan |
|---|---|---|---|
| Jip (4x4) | 1 (solo) + penumpang bot optional | 28 m/s | Suspensi raycast 4 roda, HP 1000, bisa meledak |
| Motor | 1 | 34 m/s | Rawan jatuh |
| Buggy | 1 | 24 m/s | Lincah di off-road |
Model procedural detail + suara mesin (synth granular), bahan bakar, tabrakan damage. Bot menggunakan kendaraan hanya di stretch.

### 15.7 Minimap & penanda
- Peta besar digambar ke canvas dari heightmap + jaringan jalan + bangunan (render sekali, di-cache). Label POI, grid 100 m, skala, kompas, panah pemain, lingkaran zona, rute pesawat, marker pemain.
- Minimap: 200 × 200 px, rotasi mengikuti arah, zoom 3 level.

---

## 16. RENDERING & VISUAL

### 16.1 Pipeline
- `WebGLRenderer({antialias:false, powerPreference:'high-performance'})`, `outputColorSpace = SRGBColorSpace`, `toneMapping = ACESFilmicToneMapping`, exposure 0.9–1.1 adaptif ringan.
- Pasca: `RenderPass → (SSAO opsional, GTAO jika kuat) → UnrealBloomPass (halus) → ColorGrade (LUT procedural) → FXAA/SMAA → OutputPass`. Vignette & film grain halus (0.02).
- Resolution scale dinamis 0.6–1.0 untuk menjaga FPS target.

### 16.2 Pencahayaan
- Langit: `Sky` addon (Preetham/Hosek) + matahari directional dengan posisi sesuai waktu hari (elevation/azimuth) + hemisphere light + **environment map** hasil `PMREMGenerator` dari sky (di-update saat waktu hari berubah, tiap 30 detik game).
- **Bayangan**: Cascaded Shadow Maps 3 cascade (jarak 20/80/300 m), resolusi 2048/1536/1024 (High), PCF soft. Preset Low: 1 cascade 1024. Bayangan bot & flora dilempar secara terpisah (distance-cull).
- Light probe sederhana: nilai ambient interior (bangunan = ambient lebih gelap).
- Tembakan: PointLight pooled (6) intensitas puncak 80, decay 0.05 dtk.
- Malam: bulan + bintang (Points), senter di senjata (stretch), interior diterangi lampu emissive.

### 16.3 Efek atmosfer
- Fog eksponensial dengan warna tergantung langit, density cuaca; kabut tipis tanah (shader height fog).
- Hujan: partikel garis instanced + splash di tanah + wet material (roughness turun 30%).
- Awan: layer bergerak (noise-texture di dome) + bayangan awan di terrain (opsional).
- Debu terbang / serbuk sari di sinar matahari (partikel halus).

### 16.4 Material & tekstur procedural
Generator kanvas 2D untuk: beton, bata, plester, kayu, logam berkarat, karat, aspal, tanah, rumput, batu, kain, kulit, kardus, kaca retak. Setiap tekstur menghasilkan `map`, `normalMap` (via Sobel dari heightmap), `roughnessMap`, `aoMap` opsional. Resolusi sesuai preset. **Seamless tiling wajib.** Cache & mipmap + anisotropic 8×.

### 16.5 Karakter (bot & pemain TPP)
- Rangka humanoid 17 tulang (hips, spine ×2, neck, head, upper/lower arm ×2, hand ×2, upper/lower leg ×2, foot ×2).
- `SkinnedMesh` dengan weight dihitung dari kapsul; topologi sekitar 6.000 tri LOD0.
- Pakaian: jaket, celana kargo, boots, sarung tangan, helm, vest, ransel, masker/balaclava, warna bervariasi (10 palet), kain bertekstur normal.
- Animasi procedural + **IK dua tulang** untuk kaki (menyesuaikan tanah) dan tangan (memegang senjata).
- Proporsi nyata (kepala 1/7.5 tinggi), bobot bahu, postur dinamis.
- Ragdoll (verlet, 14 titik) saat mati, bisa tersangkut di lereng.

### 16.6 Preset kualitas
| Setelan | Low | Medium | High | Ultra |
|---|---|---|---|---|
| Jarak render | 350 m | 550 m | 800 m | 1100 m |
| Bayangan | 1 cascade 1024 | 2 × 1536 | 3 × 2048 | 4 × 2048 |
| Rumput | Off | 40 m | 70 m | 100 m |
| Pohon (instance) | 8k | 18k | 28k | 38k |
| Pasca | Off | Bloom + FXAA | + SSAO | + SSR/GTAO |
| Partikel max | 200 | 600 | 1200 | 2000 |
| Tekstur max | 512 | 1024 | 2048 | 2048 |
| Resolusi dinamis | Aktif | Aktif | Opsional | Off |
| Anisotropic | 2× | 4× | 8× | 16× |

Preset otomatis di-deteksi dari benchmark 3 detik di loading (opsional) dan bisa diubah manual.

---

## 17. AUDIO

Semua suara dibuat dengan **WebAudio synthesis + noise buffers + convolver reverb procedural**, tidak ada file audio.

### 17.1 Mixer
| Bus | Isi | Default |
|---|---|---|
| Master | | 0.8 |
| SFX | Senjata, langkah, dunia | 1.0 |
| Ambient | Angin, burung, serangga, hujan | 0.6 |
| UI | Klik, hit marker | 0.6 |
| Musik | Menu theme (synth ambient) + sting kemenangan/kekalahan | 0.4 |
Kompresor global (threshold −12 dB, ratio 3), limiter di master.

### 17.2 Spasialisasi
- `PannerNode` HRTF, `distanceModel: 'inverse'`, `refDistance 2`, `rolloffFactor` per jenis suara; tembakan terdengar sampai 800 m (AR), 500 m (SMG), 1200 m (SR), 120 m (suppressed).
- Delay propagasi suara: `delay = distance / 343 m/s` (efek petir-kilat untuk tembakan jauh).
- **Occlusion**: raycast ke sumber suara; jika terhalang, low-pass 800–2500 Hz + gain −6 s/d −12 dB. Dalam ruangan vs luar ruangan memicu reverb berbeda (ruang kecil/hall/outdoor).

### 17.3 Layer suara tembakan (per senjata)
1. **Crack/transient** (noise burst highpass 2–6 kHz, 8–15 ms).
2. **Body** (noise + oscillator turun tajam, bandpass sesuai kaliber).
3. **Low thump** (sine 55–90 Hz, envelope cepat).
4. **Mechanical** (bolt, slide, click di domain berbeda).
5. **Tail/echo** (convolver impulse procedural untuk outdoor/indoor, diatur delay & gain).
6. **Distant tail** versi jauh (low-pass, lebih lambat).
Variasi: pitch ±3%, gain ±1 dB, 4 variasi buffer pre-generated per senjata agar tidak berulang.

### 17.4 Efek suara lain
| Kategori | Detail |
|---|---|
| Langkah | Per material (tanah, rumput, kayu, beton, logam, air, kerikil), per stance, kecepatan, sepatu |
| Gerakan | Gesekan kain, ransel, tali, napas lelah, lompat/mendarat |
| Senjata | Reload tiap tahap, bolt, switch fire mode, empty click, draw/holster |
| Impact | Peluru kena beton, logam, kayu, tanah, air, kaca; ricochet desing; flesh/armor thud |
| Throwable | Pin, lempar, memantul, ledakan (low-pass + reverb), smoke hiss, flash ring |
| Dunia | Angin, burung, jangkrik (malam), ombak, hujan, kapal, pesawat, siren zona, supply drop pesawat |
| UI | Klik, hover, ping peta, notifikasi zona (voice-synth "Zona akan menyempit"? gunakan beep + teks, bukan TTS) |

### 17.5 Mix dinamis
Saat ledakan/flash: ducking SFX lain, tinnitus (sine 4 kHz fade 3 dtk). Saat kena damage: low-pass sementara. Saat sangat sehat/tidak, heartbeat HP < 25 (synth).

---

## 18. AI BOT

### 18.1 Tujuan
Bot harus **terasa seperti pemain**: mendarat, loot, bergerak dengan tujuan, mendengar, melacak, mundur, heal, kadang salah.

### 18.2 Arsitektur
**Behavior Tree** + **Utility scoring** untuk memilih goal tingkat atas.

State utama:
| State | Deskripsi |
|---|---|
| `Skydive` | Pilih titik mendarat (bobot POI + kebijakan), kontrol arah, buka parasut |
| `Loot` | Cari loot terdekat berbobot nilai, masuk bangunan, ambil/pasang item terbaik |
| `Rotate` | Bergerak ke dalam zona, jalur menghindari area terbuka bila memungkinkan |
| `Hold/Camp` | Bertahan di titik bagus (jendela, bukit) |
| `Investigate` | Menuju suara tembakan/langkah |
| `Engage` | Tembak target; strafe, gerak acak, ambil cover |
| `Retreat` | HP rendah / tak berdaya |
| `Heal` | Sembunyi lalu heal/boost |
| `Reload` | Cari cover saat reload |
| `Flee zone` | Lari ke zona jika di luar |

### 18.3 Persepsi
| Sensor | Parameter |
|---|---|
| Visual | FOV 110°, jarak sampai 300 m (target tampak 1.8 m), line-of-sight multi-ray (kepala, torso, kaki); modifikator: cahaya malam, smoke, rumput tinggi/semak (menyamar), gerak (lebih mudah terlihat), jongkok/tiarap |
| Auditif | Tembakan 800 m (AR), langkah 20–40 m, lari 40 m, lompat 30 m, ledakan 400 m; occlusion berdasarkan dinding |
| Memori | Posisi terakhir terlihat, kecepatan, selama 8–15 dtk; estimasi lintasan |
| Reaksi | Waktu sebelum menembak: Rookie 0.9 s, Regular 0.55 s, Veteran 0.30 s |

### 18.4 Penembakan bot
- Bot **menggunakan balistik yang sama** (proyektil, drop). Mereka menghitung lead dan drop (dengan error).
- Error bidik (RMS sudut): Rookie 3.2°, Regular 1.6°, Veteran 0.75°, berkurang ketika jongkok/diam, naik saat bergerak dan jarak.
- Recoil pattern disimulasikan; kontrol recoil memiliki skill factor.
- Burst control: tembak 3–8 peluru, jeda 0.2–0.6 dtk; shotgun & SR memiliki aturan khusus.
- Perilaku taktis: strafe kiri-kanan ADS, peek-and-shoot, flank bila punya granat, throw smoke saat heal, gunakan granat ke bangunan yang dimasuki lawan.
- Level skill menentukan **pemilihan senjata**, **jangkauan engage**, **penggunaan throwables**.
- Kesalahan manusiawi: sesekali tidak memperhatikan, lupa reload, salah memilih jarak.

### 18.5 Navigasi
- **Grid nav 2 m** berhierarki: grid kasar 8 m untuk perencanaan jarak jauh (A*), grid halus 2 m + graph node bangunan untuk dekat.
- Cache jalur, rencana ulang tiap 1.5 dtk atau jika terhalang.
- Steering: seek + obstacle avoidance (raycast fan 5 sinar) + separation antar bot.
- Anti-stuck: jika kecepatan < 0.3 m/s selama 3 dtk → lompat/mundur/ganti jalur; jika 10 dtk → teleportasi aman ke titik nav terdekat (log debug, tidak dilihat pemain).
- Buka pintu, naik tangga, vault pagar rendah.

### 18.6 Pengambilan keputusan (utility)
Skor goal = `bobot × (kebutuhan loot + ancaman + jarak zona + HP + peluru)`. Contoh:
```
needLoot   = 1 - gearScore/targetGearScore
zoneUrgency= clamp((distToZoneEdge - safeMargin) / 100, 0, 1)
threat     = visibleEnemies * dangerFactor
goal       = argmax( w1*needLoot, w2*zoneUrgency, w3*threat, w4*healNeed )
```

### 18.7 Distribusi
Bot mendarat tersebar: 35% di POI tier 3/2 (sehingga baku tembak awal), 45% di sekitar POI tier 1/2, 20% tempat acak. Beberapa bot diberi nama gamer-tag Indonesia fiktif (mis. `BangJago99`, `SiPendiam`, `Kopi_Tubruk`), dengan pemilihan acak non-duplikat.

### 18.8 Ukuran kinerja AI
- Budget ≤ 1.5 ms per frame untuk semua bot.
- Bot yang jauh (> 350 m) disimulasikan **kasar** (posisi interpolasi di grid, tanpa render, tanpa persepsi detail, pertempuran tersimulasi statistik) agar efisien, tetapi pertarungan antar-bot dekat pemain dirender penuh.

---

## 19. ZONA, AIRDROP, PESAWAT, PARASUT

### 19.1 Fase zona (peta 1600 m)
| Fase | Mulai (dtk dari mendarat) | Tahan | Menyempit | Radius awal → akhir (m) | Damage/dtk |
|---|---|---|---|---|---|
| 1 | 0 | 120 | 90 | 780 → 520 | 1 |
| 2 | 210 | 100 | 75 | 520 → 360 | 1.5 |
| 3 | 385 | 90 | 65 | 360 → 240 | 2.5 |
| 4 | 540 | 80 | 55 | 240 → 150 | 4 |
| 5 | 675 | 70 | 50 | 150 → 90 | 6 |
| 6 | 795 | 60 | 45 | 90 → 45 | 8 |
| 7 | 900 | 50 | 40 | 45 → 20 | 10 |
| 8 | 990 | 40 | 35 | 20 → 0 | 12 |
Total ≈ 20–22 menit. Pusat zona berikutnya dipilih acak dalam zona sekarang (offset ≤ radius saat ini − radius berikutnya) dengan bias ke tanah yang tidak air.

Visual:
- Dinding biru di batas zona (shader vertikal bergerak, bunyi dengung), zona putih (aman berikutnya) digambar di peta.
- Efek di luar zona: tint biru + noise, damage tick sound + peringatan teks.
- Peringatan **Red Zone** (bom): 1–2 lingkaran merah acak per fase 3–7, durasi 120 dtk, bom jatuh dengan suara dan dentum (opsional).

### 19.2 Pesawat
- Kecepatan 60 m/s, ketinggian 600 m, melintas dari tepi ke tepi melalui titik acak dalam 60% radius peta.
- Pemain bisa lompat kapan saja (bukan saat di atas laut — warning), ada countdown otomatis lompat di ujung jalur.
- Visual: model pesawat kargo procedural, bayangan, suara mesin, bot melompat berkelompok pada waktu/titik berbeda.

### 19.3 Free-fall & parasut
| Parameter | Nilai |
|---|---|
| Kecepatan terminal (head-down dive) | 78 m/s |
| Free-fall normal | 55 m/s |
| Gerak horizontal free-fall | maks 30 m/s (dive: turun cepat + horizontal lebih besar) |
| Buka parasut otomatis | 120 m AGL (manual: Space) |
| Parasut: turun | 6 m/s |
| Parasut: horizontal | 14 m/s (maks), pengereman S |
| Mendarat | Animasi flare, tanpa damage |
- Marker pemain lain pada HUD; arah kamera boleh bebas.

### 19.4 Airdrop
- Muncul tiap 2 fase mulai fase 2, jatuh dengan parasut + asap warna (merah) terlihat ± 400 m.
- Isi 3–5 item tier legendaris (M24 / AWM-setara, Ghillie? hindari, vest L3, helm L3, scope 8x/15x, med kit).
- Bunyi pesawat kargo, ketika mendarat, bot dalam jarak 500 m berpotensi menuju (bobot tinggi).
- Peti dibuka hold F 3 dtk.

---

## 20. EFEK (PARTIKEL, DECAL, RAGDOLL, SMOKE)

### 20.1 Sistem partikel
- GPU instancing untuk billboard; pool tetap (500–2000). Tipe: muzzle flash (3 variasi), asap muzzle, selongsong, debu, kayu serpihan, percikan logam, tanah, air, darah (opsional), api, asap ledakan, jejak peluru.
- Sorting minimal dengan depthWrite off dan alphaTest.

### 20.2 Muzzle flash
Quad bercabang (starburst) beberapa lapisan + glow; ukuran per senjata; dirender additively; flash hilang setelah 40–60 ms.

### 20.3 Tracer
Garis sempit memanjang di lintasan peluru, warna kuning-putih, setiap 3–5 peluru, memudar 0.12 dtk; suppressor/subsonic tanpa tracer.

### 20.4 Decal bullet hole
Pool 256 decal per dunia, bentuk disesuaikan permukaan (kayu = retak, beton = pecah, logam = penyok, tanah = debu), memudar 90 dtk.

### 20.5 Smoke volumetrik
Partikel besar 40–80 billboard dengan noise displacement dan lighting palsu dari matahari, volume 7 m radius, bergerak lambat, ada transisi buka dan hilang.

### 20.6 Ledakan
Fireball (sprite sheet procedural), shockwave ring, debu terangkat, shake kamera berdasarkan jarak, damage radius, puing/chip decal.

### 20.7 Ragdoll
Verlet dengan 14 titik, constraint panjang, sudut sendi dibatasi; gaya impuls dari arah tembakan; tumbang ke lereng; fade 12 detik; bolehkan senjata jatuh terpisah.

---

## 21. HUD & UI

### 21.1 Prinsip gaya
Taktis, bersih, informatif; panel semi-transparan gelap (rgba(12,14,16,.72)), border 1px halus, sudut 4 px, tipografi condensed uppercase untuk label, angka tabular. Aksen: kuning-amber (#F2B705), merah peringatan (#E5383B), hijau zaitun (#7A8B4A), biru zona (#2B8CFF). **Tidak ada gradient neon, tidak ada emoji.** Ikon dibuat SVG inline konsisten.

### 21.2 Elemen HUD in-game
| Elemen | Posisi | Detail |
|---|---|---|
| Kompas | Atas tengah | Derajat + N/E/S/W + penanda pemain/ping |
| Jumlah hidup & kill | Atas kanan | "HIDUP 23 | KILL 4" |
| Zone timer | Atas tengah bawah kompas | Teks fase + countdown |
| Minimap | Kiri atas | 200 px, rotasi, zona |
| Kill feed | Kanan atas | Siapa membunuh siapa, senjata, headshot ikon |
| HP/Armor/Boost | Bawah tengah | Bar bersegmen (HP putih, armor biru, boost oranye) |
| Ammo | Bawah kanan | `25 / 120`, mode tembak, ikon senjata (siluet SVG) |
| Heal quickslot | Bawah kiri | 7/8/9/0 + jumlah |
| Crosshair | Tengah | Dot + 4 garis dinamis (spread), berubah warna saat target |
| Hit marker | Tengah | |
| Damage indicator | Tepi | 8 sektor |
| Interaksi | Tengah-bawah | "Tahan F — Ambil M416" + progress bar bulat |
| Peringatan | Tengah-atas | "Zona akan menyempit dalam 20 dtk", "Di luar zona!", "Red Zone!" |
| Status | Samping | Ikon: pendarahan? (tidak ada), boost aktif, minum, mengisi ulang |
| Peringkat | Atas | Saat mati |
| Debug | Pojok | F3 |

### 21.3 Menu & layar
- **Main menu, Setup, Pause, Settings, Inventori, Peta besar, Hasil, Cara bermain, Statistik, Error.**
- Transisi lembut (200 ms), fokus keyboard (Tab/Enter), hover state, tooltip.
- Layar **Cara Bermain**: ringkasan kontrol, tips (diagram SVG sederhana).

### 21.4 Pengaturan
| Kategori | Opsi |
|---|---|
| Grafis | Preset, resolusi scale, jarak render, bayangan, rumput, bloom, SSAO, motion blur, FOV, VSync info, batas FPS (30/60/120/∞), Tampilkan FPS |
| Kontrol | Remap tombol (deteksi konflik), sensitivitas, ADS sens, invert Y, toggle/hold (jongkok, ADS, sprint), gamepad |
| Audio | Master/SFX/Ambient/UI/Musik, mode headphone/speaker (HRTF on/off) |
| Gameplay | Bahasa, tampilan darah, hit marker, crosshair style/warna, auto-pickup, auto-sprint, TPP default |
| Aksesibilitas | Mode buta warna (protanopia/deuteranopia), skala UI 80–130%, kurangi guncangan kamera, subtitle suara penting |
| Data | Reset statistik, reset pengaturan |

### 21.5 Peta besar (M)
Pan/zoom, lingkaran zona saat ini dan berikutnya, rute pesawat, POI label, marker (klik tengah), jarak ke marker dalam meter, tempat airdrop, red zone.

---

## 22. PERFORMA & BUDGET

### 22.1 Budget frame (target 60 FPS = 16.6 ms, Medium, 1080p)
| Komponen | Budget (ms) |
|---|---|
| Update simulasi (pemain, peluru, zona) | 1.0 |
| AI bot | 1.5 |
| Culling & persiapan render | 1.5 |
| Render dunia (draw) | 6.0 |
| Pasca proses | 2.0 |
| Audio & UI | 1.0 |
| Cadangan | 3.6 |

### 22.2 Batas teknis
| Metrik | Batas (Medium) |
|---|---|
| Draw call | ≤ 900 |
| Segitiga terlihat | ≤ 1.8 juta |
| Texture memory | ≤ 450 MB |
| Light dinamis aktif | ≤ 8 |
| Partikel aktif | ≤ 600 |
| Bot dirender penuh | ≤ 14 serentak |
| GC pause | < 3 ms; tidak ada alokasi > 100 KB per frame |

### 22.3 Teknik
- Frustum culling + occlusion kasar (per chunk, portal bangunan sederhana).
- Instancing + `InstancedMesh` dengan culling per chunk (kelompok instance per chunk).
- Terrain LOD + skirts; flora LOD + billboard.
- **Merge geometry** untuk bangunan statis per chunk (`BufferGeometryUtils.mergeGeometries`).
- Object pooling: peluru, partikel, decal, light, audio node.
- Texture atlas untuk elemen kecil.
- Worker (opsional): generasi heightmap, generasi tekstur besar, pathfinding.
- Pre-generate dunia berurutan dengan `await` per tahap + `requestIdleCallback`/yield agar progress bar halus.
- Dynamic resolution (target FPS 60, adaptasi tiap 1 dtk).
- Hindari `new Vector3()` di loop; gunakan scratch vectors.

### 22.4 Profiler internal
Overlay F3: FPS, frame ms (CPU/GPU estimasi), draw calls, triangles, geometri, tekstur, memori JS, jumlah bot aktif, proyektil, partikel, suara aktif, posisi pemain, chunk aktif.

---

## 23. STRUKTUR KODE & MILESTONE PEMBANGUNAN

### 23.1 Struktur satu file (urutan)
```
1.  <head>: meta, title, CSS (tema, HUD, menu)
2.  <body>: kontainer canvas, overlay UI (HTML), template SVG ikon
3.  <script type="importmap"> three + addons
4.  <script type="module">
    // ═══ CONFIG ═══
    // ═══ UTIL (PRNG, noise, math, pool, events) ═══
    // ═══ ASSETS (tekstur & material procedural) ═══
    // ═══ WEAPON DEFS + MODEL BUILDERS ═══
    // ═══ WORLD (terrain, flora, bangunan, nav) ═══
    // ═══ PHYSICS (controller, raycast, proyektil, ragdoll) ═══
    // ═══ ENTITIES (Player, Bot, Loot, Throwable) ═══
    // ═══ AI ═══
    // ═══ ZONE / PLANE / AIRDROP ═══
    // ═══ FX ═══
    // ═══ AUDIO ═══
    // ═══ RENDER (renderer, composer, lighting, LOD) ═══
    // ═══ UI (HUD, menu, inventory, map, settings) ═══
    // ═══ GAME (state machine, loop) ═══
    // ═══ DEBUG ═══
    // ═══ BOOT ═══
```
Estimasi 9.000–14.000 baris. Ukuran 450–800 KB.

### 23.2 Milestone (tiap milestone harus **berjalan & lolos QA mini** sebelum lanjut)
| M | Isi | Kriteria selesai |
|---|---|---|
| **M0** | Skeleton, CONFIG, loop fixed-step, error screens, Debug overlay, settings storage | Layar berjalan 60 FPS, F3 berfungsi, tidak ada error |
| **M1** | Tekstur procedural + material library, studio scene menampilkan sampel material | 12 material tampak bagus pada bola/plane sample |
| **M2** | Terrain (heightmap, chunk, LOD, splat), langit, matahari, bayangan, fog, air | Pulau terlihat meyakinkan dari udara dan darat |
| **M3** | Character controller (jalan, sprint, jongkok, tiarap, lompat, vault, lean), collision terrain + collider uji | Gerak terasa baik, tidak jatuh menembus |
| **M4** | Viewmodel + model AKM & M416 lengkap + animasi (idle, sway, ADS, reload, draw) | Senjata terlihat detail dari dekat, animasi mulus |
| **M5** | Balistik proyektil, hitbox, damage, FX tembakan, audio senjata, recoil, dummy target | Semua senjata inti bisa ditembak dengan feedback penuh |
| **M6** | Flora, bangunan procedural dengan interior, pintu, loot point, inventori & loot UI | POI Desa Sukamaju lengkap dan bisa dilooting |
| **M7** | Seluruh POI, jalan, nav grid, minimap & peta besar | Peta penuh, bisa navigasi |
| **M8** | Bot AI (loot, rotate, engage, heal), karakter 3D + animasi + ragdoll | 39 bot bermain wajar |
| **M9** | Pesawat, parasut, zona, red zone, airdrop, kondisi menang/kalah, hasil | Match lengkap dari awal hingga akhir |
| **M10** | Semua senjata, attachment, throwables, armor, heal, polish audio, cuaca, preset kualitas, optimasi | Memenuhi target performa & anti-slop |
| **M11** (stretch) | Kendaraan, malam hari lengkap, senter, mode latihan lanjut, kill-cam | Opsional |

### 23.3 Cara membangun (untuk AI agent)
- **Jangan menulis seluruh file sekaligus.** Bangun per milestone dengan edit bertahap pada `index.html`.
- Setelah tiap milestone: jalankan di browser headless (mis. Playwright), ambil screenshot, cek console error, ukur FPS; perbaiki sebelum lanjut.
- Gunakan fungsi kecil, data-driven; hindari duplikasi.
- Tulis `selfTest()` (aktif via `?test=1`) berisi assertion kritis: ballistic drop 100/300 m, hitbox multiplier, zona radius, loot weight total = 100%, navigasi dari A→B.

---

## 24. QA, TESTING, DEFINITION OF DONE

### 24.1 Checklist fungsional
- [ ] Menu → setup → match → hasil → menu tanpa reload.
- [ ] Semua tombol/slider/dropdown berfungsi dan tersimpan.
- [ ] Semua 10 senjata + 3 throwable dapat dipakai penuh.
- [ ] Setiap attachment mengubah model **dan** statistik.
- [ ] Tiap POI punya loot, bangunan bisa dimasuki, tidak ada ruang tertutup tanpa pintu.
- [ ] Zona menyempit sesuai tabel, damage benar, red zone & airdrop berfungsi.
- [ ] 39 bot bertahan hingga zona akhir secara wajar; tidak ada bot stuck permanen.
- [ ] Menang dan kalah memunculkan hasil yang benar.
- [ ] Pointer lock hilang → auto pause.
- [ ] Resize window / perubahan DPI ditangani.
- [ ] Tab tidak aktif → game pause otomatis.

### 24.2 Checklist visual
- [ ] Tidak ada z-fighting, texture stretching, seam LOD, pop-in kasar.
- [ ] Bayangan stabil (tanpa shimmering mencolok).
- [ ] Senjata tidak tembus tembok (lowering).
- [ ] 10 screenshot acak lolos *smell test* (Bab 3.3).
- [ ] UI terbaca di 1366×768 hingga 4K; skala UI berfungsi.

### 24.3 Checklist audio
- [ ] Tidak ada klik/pop; tembakan tidak berulang monoton.
- [ ] Spasialisasi arah benar (uji kiri/kanan/belakang).
- [ ] Occlusion mengurangi suara di balik dinding.
- [ ] Mute & volume tiap bus berfungsi.

### 24.4 Checklist performa
- [ ] 60 FPS pada Medium di skenario berat (POI Kota + 6 bot + ledakan).
- [ ] Tidak ada memory leak: heap stabil setelah 3 match beruntun.
- [ ] Waktu load sesuai target.

### 24.5 Definition of Done (DoD)
Rilis v1 dianggap selesai bila:
1. Semua milestone M0–M10 lolos kriteria.
2. Checklist 24.1–24.4 centang penuh.
3. Tidak ada pelanggaran daftar **S1–S14**; semua **W1–W10** terpenuhi.
4. Dokumentasi singkat di dalam menu "Cara Bermain" dan komentar kode per modul.
5. Dites di Chrome, Edge, Firefox terbaru.

---

## 25. BATASAN, RISIKO, OPSI FIDELITY TAMBAHAN, LEGAL

### 25.1 Risiko & mitigasi
| Risiko | Dampak | Mitigasi |
|---|---|---|
| Ukuran file/waktu generate besar | Loading lama | Generate bertahap, cache hasil di IndexedDB (opsional), preset kualitas |
| Performa buruk di iGPU | FPS rendah | Dynamic resolution, preset Low, LOD agresif |
| Model procedural terlihat "kotak" | Kesan slop | Aturan 11 (profil extrude, lathe, detail), review visual tiap senjata |
| AI bot bodoh/stuck | Gameplay rusak | Anti-stuck, testing otomatis, simulasi 100 match headless |
| Audio synthesis terdengar murahan | Imersi turun | Layering, convolver, variasi, mixing dinamis |
| Kompleksitas satu file | Sulit dirawat | Modularisasi internal, banner, `CONFIG`, milestone |
| Pointer lock/browser kebijakan | Input gagal | Layar instruksi, retry, pause saat hilang |

### 25.2 Opsi untuk fidelity lebih tinggi (butuh keputusan Anda)
| Opsi | Efek | Konsekuensi |
|---|---|---|
| Embed model GLB CC0 sebagai base64 untuk senjata/karakter | Tampilan jauh lebih realistis | File jadi 5–30 MB, bukan lagi "murni procedural" |
| Embed tekstur foto CC0 (PBR) dalam KTX2/WebP base64 | Material lebih nyata | Ukuran file besar |
| WebGPU renderer (Three.js WebGPU) | Performa & efek lebih baik | Dukungan browser belum merata |
| Tambah Rapier (WASM, via CDN) | Fisika kendaraan/ragdoll akurat | Dependensi tambahan |
Default PRD ini: **procedural murni** + Three.js CDN.

### 25.3 Legal
- Tidak memakai nama/logo/aset PUBG atau merek senjata berlisensi di UI. Nama senjata di UI memakai **nama generik** (mis. "AKM", "M416" boleh sebagai deskriptor umum, namun disarankan versi fiktif seperti "AK-M", "ARX-416" bila ingin aman).
- Nama game, peta, POI, dan teks asli (orisinal).
- Tidak ada konten kekerasan berlebihan: darah dapat dimatikan, ragdoll tanpa gore.

### 25.4 Disclaimer rating
Konten: kekerasan fiksi bersenjata. Saran rating 13+/16+. Tampilkan peringatan di layar awal.

---

## 26. LAMPIRAN

### Lampiran A — Skeleton `CONFIG`
```js
const CONFIG = {
  version: "1.0.0",
  seedDefault: 20261114,
  world: { size: 1600, chunk: 100, seaLevel: 0, maxHeight: 95, collisionCell: 8 },
  sim: { fixedDt: 1/60, maxSubsteps: 5, ballisticDt: 1/120, aiHz: 10 },
  player: {
    hp: 100, radius: 0.35,
    height: { stand: 1.8, crouch: 1.3, prone: 0.6 },
    eye:    { stand: 1.65, crouch: 1.15, prone: 0.45 },
    speed:  { sprint: 6.8, jog: 5.0, walk: 2.8, crouch: 2.0, prone: 0.9, adsMult: 0.6 },
    gravity: 18, jump: 5.6, stepUp: 0.45, slopeMax: 50,
    fallDamageStart: 3.5, fallDamagePerM: 12,
    leanAngle: 15, leanOffset: 0.25
  },
  camera: { fov: 75, near: 0.05, far: 1500, viewmodelFov: 58 },
  ballistics: { gravity: 9.81, maxLife: 3.0, maxDist: 1200, convergence: 80 },
  hitMult: { head: 2.35, neck: 1.6, chest: 1.0, abdomen: 0.95, arm: 0.9, leg: 0.8 },
  armor: {
    helm: [ {abs:.30,dur:80}, {abs:.40,dur:150}, {abs:.55,dur:230} ],
    vest: [ {abs:.30,dur:200},{abs:.40,dur:220},{abs:.55,dur:250} ]
  },
  zone: [
    { wait:120, shrink:90, r0:780, r1:520, dps:1 },
    { wait:100, shrink:75, r0:520, r1:360, dps:1.5 },
    { wait:90,  shrink:65, r0:360, r1:240, dps:2.5 },
    { wait:80,  shrink:55, r0:240, r1:150, dps:4 },
    { wait:70,  shrink:50, r0:150, r1:90,  dps:6 },
    { wait:60,  shrink:45, r0:90,  r1:45,  dps:8 },
    { wait:50,  shrink:40, r0:45,  r1:20,  dps:10 },
    { wait:40,  shrink:35, r0:20,  r1:0,   dps:12 }
  ],
  plane: { speed: 60, altitude: 600 },
  fall:  { terminal: 78, normal: 55, chuteOpenAGL: 120, chuteDescend: 6, chuteHorizontal: 14 },
  bots: { count: 39, difficulty: { rookie:{react:.9,err:3.2}, regular:{react:.55,err:1.6}, veteran:{react:.30,err:.75} } },
  audio: { master:.8, sfx:1, ambient:.6, ui:.6, music:.4, speedOfSound:343 },
  quality: { low:{}, medium:{}, high:{}, ultra:{} }   // diisi sesuai tabel 16.6
};
```

### Lampiran B — Struktur data senjata (data-driven)
```js
{
  id: "m416", name: "M416", class: "AR", ammo: "556",
  damage: 40, rpm: 670, muzzleVel: 780, drag: 0.0009,
  mag: 30, magExt: 40, reload: { tactical: 2.3, empty: 3.0 },
  modes: ["auto","single"],
  falloff: [[0,1.0],[50,1.0],[150,.94],[300,.86],[500,.74]],
  recoil: { pitch: [0.55, 0.35], yaw: 0.18, recovery: 6, pattern: [/* 30 pasang yaw,pitch */] },
  spread: { base: 0.5, ads: 0.22, move: 1.6, jump: 3.0, crouch: 0.75, prone: 0.55 },
  ads: { time: 0.22, fov: 55 },
  sockets: { muzzle:[0,0.035,0.62], grip:[...], optic:[...], mag:[...], stock:[...], eject:[...] },
  model: "buildM416",     // fungsi builder procedural
  sound: "ar_556",
  slots: { optic:true, muzzle:true, grip:true, mag:true, stock:true }
}
```

### Lampiran C — Tabel suara tembakan (parameter sintesis)
| Kelas | Crack (Hz) | Body (Hz) | Thump (Hz) | Tail (dtk) | Jangkauan dengar |
|---|---|---|---|---|---|
| AR 5.56 | 3500–6000 | 600–1400 | 70 | 0.7 | 800 m |
| AR 7.62 | 2800–5000 | 400–1000 | 55 | 0.9 | 900 m |
| SMG .45 | 2500–4500 | 700–1500 | 90 | 0.4 | 500 m |
| Pistol 9mm | 3000–5500 | 900–1800 | 100 | 0.3 | 350 m |
| SR | 2200–4200 | 300–800 | 45 | 1.6 | 1200 m |
| Shotgun | 1800–3500 | 250–700 | 50 | 0.8 | 600 m |

### Lampiran D — Palet visual
| Peran | Hex |
|---|---|
| Latar HUD | `#0C0E10` @ 72% |
| Teks utama | `#EDEFF1` |
| Teks redup | `#9AA3AB` |
| Aksen | `#F2B705` |
| Peringatan | `#E5383B` |
| Zaitun | `#7A8B4A` |
| Zona | `#2B8CFF` |
| HP | `#F5F5F5` |
| Armor | `#5BA3E0` |
| Boost | `#F28C28` |

### Lampiran E — Glosarium
ADS = Aim Down Sights; AGL = Above Ground Level; BDC = Bullet Drop Compensator; CSM = Cascaded Shadow Maps; LOD = Level of Detail; POI = Point of Interest; PBR = Physically Based Rendering; HRTF = Head-Related Transfer Function; IK = Inverse Kinematics.

### Lampiran F — Prompt eksekusi untuk AI agent (salin-tempel)
```
Kamu membangun game 3D battle royale "RAJAWALI ROYALE" dalam SATU file index.html
berdasarkan PRD-RAJAWALI-ROYALE.md. Aturan:
1. Baca seluruh PRD dulu, terutama Bab 3 (Anti-Slop), 11 (modeling senjata), 22 (performa).
2. Bangun per milestone M0→M10. Jangan lompat. Jangan tulis seluruh file sekali jalan;
   edit bertahap.
3. Setelah tiap milestone: jalankan di browser headless, cek console error, ambil screenshot,
   ukur FPS, perbaiki masalah sebelum lanjut. Laporkan hasil singkat.
4. Semua aset procedural (kanvas, noise, WebAudio). Hanya Three.js dari CDN (versi dipin).
5. Semua angka ada di CONFIG / data senjata. Tanpa console.log tersisa, tanpa TODO,
   tanpa placeholder, tanpa tombol mati.
6. Jika ada keputusan di luar PRD yang mengubah scope, tanyakan dulu.
7. Di akhir, jalankan ?test=1 (selfTest) dan checklist QA Bab 24, lalu laporkan.
```

---
*Akhir dokumen.*
