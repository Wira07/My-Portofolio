# PRD — STARDRIFT: Game 3D Pesawat Luar Angkasa (Single File `index.html`)

| Item | Isi |
|---|---|
| Nama game | **STARDRIFT** |
| Genre | Space flight + combat arcade, third-person 3D |
| Platform | Browser desktop (utama), mobile touch (didukung) |
| Deliverable | **Satu file `index.html`** — tanpa build tool, tanpa file aset eksternal |
| Engine | Three.js (via CDN + importmap) |
| Bahasa UI | Bahasa Indonesia |
| Versi dokumen | 1.0 |

---

## 1. Ringkasan Produk

STARDRIFT adalah game 3D di mana pemain mengendalikan sebuah pesawat tempur-eksplorasi melintasi tiga sektor galaksi: sistem bintang kuning dengan planet-planetnya, nebula merah dengan bintang ganda, dan area lubang hitam. Pemain terbang bebas 360°, memindai planet, menembak musuh, menghindari asteroid, mengumpulkan kristal untuk upgrade, lalu melompat antar sektor lewat Warp Gate.

**Janji ke pemain:** terbang di ruang angkasa yang *terasa luas dan indah*, dengan kontrol yang responsif dan pertempuran yang singkat tapi seru. Semua visual dan suara dibuat **prosedural** (shader, geometri kode, Web Audio), sehingga cukup satu file.

### 1.1 Tujuan
1. Game bisa dimainkan langsung dengan membuka `index.html` (double-click atau hosting statis).
2. Terasa seperti game sungguhan: ada loop yang jelas (mulai → misi → upgrade → sektor berikutnya → menang/kalah).
3. Visual ruang angkasa meyakinkan: planet beratmosfer, cincin, matahari bercahaya, nebula, galaksi spiral, lubang hitam.
4. Stabil 60 FPS di laptop menengah (GPU terintegrasi) pada preset Medium.

### 1.2 Non-Goals (sengaja tidak dikerjakan)
- Multiplayer / online leaderboard.
- Mendarat di permukaan planet (planet hanya untuk dijelajahi dari orbit dan dipindai).
- Aset eksternal (model `.glb`, tekstur `.jpg`, audio `.mp3`). Semua prosedural.
- Fisika realistis penuh (gravitasi N-body). Pakai model penerbangan arcade.
- Cerita panjang. Cukup briefing singkat per sektor.

---

## 2. Target Pengguna
- Pemain kasual yang suka game arcade pendek (sesi 10–25 menit).
- Pemain yang ingin game 3D ringan di browser tanpa instalasi.

---

## 3. Batasan Teknis

| Aspek | Ketentuan |
|---|---|
| File | Satu `index.html` berisi HTML + CSS + JS inline |
| Library | Three.js **r160+** via `<script type="importmap">` dari CDN (jsdelivr/unpkg). Addons yang dipakai: `EffectComposer`, `RenderPass`, `UnrealBloomPass`, `ShaderPass`, `OutputPass` |
| Font | Google Fonts `Chakra Petch` (judul/HUD) + `JetBrains Mono` (angka), fallback `system-ui` / `monospace`. Game tetap jalan jika font gagal dimuat |
| Browser | Chrome, Edge, Firefox, Safari versi terbaru (WebGL2) |
| Performa | 60 FPS target; draw call < 150; segitiga di layar < 400.000; partikel aktif ≤ 3.000 |
| Penyimpanan | `localStorage` (skor tertinggi, pengaturan) dibungkus `try/catch` |
| Tanpa internet | Jika CDN gagal dimuat, tampilkan layar error yang jelas (bukan layar kosong) |

---

## 4. Alur Game

### 4.1 State Machine
```
BOOT → TITLE → BRIEFING → PLAYING ⇄ PAUSED
                              │
                  ┌───────────┼────────────┐
                  ▼           ▼            ▼
           SECTOR_CLEAR   GAME_OVER     (Warp)
                  │
              UPGRADE → BRIEFING sektor berikutnya … → VICTORY
```

### 4.2 Alur Sesi
1. **TITLE**: judul, tombol *Mulai*, *Pengaturan*, *Cara Bermain*, skor tertinggi. Latar: pesawat berputar pelan di depan planet.
2. **BRIEFING**: nama sektor, 3 objektif, tombol *Luncurkan*.
3. **PLAYING**: pemain menyelesaikan semua objektif wajib, lalu Warp Gate terbuka.
4. **SECTOR_CLEAR**: ringkasan (waktu, akurasi, kristal, skor) → layar **UPGRADE**.
5. Ulangi sampai sektor 3 selesai → **VICTORY**. Jika Hull = 0 → **GAME_OVER** (opsi *Coba Lagi sektor ini* atau *Menu Utama*).

---

## 5. Gameplay

### 5.1 Model Penerbangan (6 derajat kebebasan, arcade)
| Aksi | Keterangan |
|---|---|
| Pitch / Yaw | Dari mouse (virtual joystick relatif tengah layar, deadzone 6%) atau keyboard/gamepad |
| Roll | Q / E |
| Thrust | W (maju), S (rem). Kecepatan target mengikuti throttle, bukan inersia murni |
| Strafe | A / D (kiri-kanan), R / F (atas-bawah), pelan, untuk menghindar |
| Boost | Shift tahan, kecepatan naik, pakai Energy |
| Flight Assist | Aktif default: pesawat meredam drift otomatis. Toggle `Z` mematikannya (mode "drift") |

**Parameter awal (disimpan di objek `CONFIG`):**
- Kecepatan jelajah maks: **120 u/s**; boost: **260 u/s**; mundur: 40 u/s.
- Akselerasi: 90 u/s²; pengereman: 140 u/s².
- Laju rotasi maks: pitch 1.6 rad/s, yaw 1.2 rad/s, roll 2.2 rad/s; dihaluskan dengan damping.
- Boost menghabiskan **25 Energy/s**, tidak bisa aktif jika Energy < 10 (cooldown sampai Energy > 30).
- **Warp lokal (Hyperdrive)** `Space`: hanya aktif jika tidak ada musuh dalam 1.500 u. Kecepatan 3.000 u/s, FOV melebar, dibatasi 8 detik, cooldown 20 detik. Untuk berpindah antar planet yang jaraknya puluhan ribu unit.

### 5.2 Kamera
- **Chase cam** default: 14 u di belakang, 4 u di atas, dengan spring-damper (lag halus).
- **Cockpit cam** (`V`): sudut pandang depan dengan frame kokpit sederhana.
- **Look-behind** (`C` tahan).
- FOV 70° normal → 85° boost → 100° hyperdrive (transisi 0,3 detik).
- Getaran kamera saat terkena tembakan dan ledakan dekat (amplitudo kecil, bisa dimatikan di Pengaturan).

### 5.3 Status Pesawat
| Stat | Nilai awal | Catatan |
|---|---|---|
| Hull | 100 | Jika 0 → pesawat meledak, game over |
| Shield | 100 | Menyerap damage dulu. Regenerasi 8/s setelah 4 detik tanpa terkena damage |
| Energy | 100 | Dipakai senjata laser dan boost. Regenerasi 15/s |
| Missile | 4 | Maks 8 |

### 5.4 Senjata
| Senjata | Tombol | Damage | Cooldown | Biaya | Catatan |
|---|---|---|---|---|---|
| **Pulse Laser** (2 moncong bergantian) | Klik kiri / `J` | 10 | 0,12 s | 2 Energy | Kecepatan peluru 600 u/s, jangkauan 900 u. Efek lead-indicator di HUD |
| **Homing Missile** | Klik kanan / `K` | 60 (area 12 u) | 3 s | 1 Missile | Perlu *lock* 1,2 detik (tahan kursor/target di kerucut 15°). Kecepatan 220 u/s, belok 2.5 rad/s, hancur sendiri setelah 6 s |

- **Target lock**: `T` memilih musuh terdekat di depan; `Y` ganti target. Target terkunci diberi bracket HUD + jarak.
- Peluru dihitung dengan **swept sphere** (agar peluru cepat tidak menembus target kecil).

### 5.5 Musuh
| Musuh | HP | Kecepatan | Perilaku | Senjata |
|---|---|---|---|---|
| **Drone Scout** | 30 | 90 | Terbang berkelompok 3–5, mengejar pemain, menabrak/menembak jarak dekat | Laser lemah, damage 4 |
| **Raider Fighter** | 80 | 110 | Mengejar, strafe kiri-kanan, mundur saat HP < 30% | Laser ganda, damage 7, tembak 0,5 s |
| **Gunship** | 250 | 60 | Menjaga jarak 500 u, menembakkan misil lambat yang bisa ditembak jatuh | Misil damage 30 |
| **Harbinger** (mini-boss, Sektor 2) | 1.200 | 70 | 3 fase: tembakan sebar → drone spawn → serangan laser beam terkunci (ada telegraph 1,5 s) | — |
| **Leviathan** (boss akhir, Sektor 3) | 2.500 | 50 | Kapal raksasa, 4 titik lemah (turret) harus dihancurkan sebelum inti terbuka; tertarik gravitasi lubang hitam | — |

**AI**: state machine sederhana `PATROL → CHASE → ATTACK → EVADE`, dengan steering behavior (seek, separation antar musuh, obstacle avoidance terhadap asteroid). Jarak deteksi 1.200 u. Musuh tidak boleh "cheat" (tidak tahu posisi pemain di luar jarak deteksi).

### 5.6 Rintangan & Pickup
- **Asteroid**: 3 ukuran (kecil/sedang/besar), bisa dihancurkan (besar pecah jadi 2 sedang, dst.), tabrakan memberi damage proporsional kecepatan relatif. Drop kristal kecil.
- **Pickup** (melayang berputar, tertarik ke pesawat dalam radius 40 u):
  - Energy Cell (+40 Energy)
  - Repair Kit (+35 Hull)
  - Missile Pack (+2 Missile)
  - **Kristal Biru** (mata uang upgrade; +1 hingga +5)

### 5.7 Objektif Misi
Tipe objektif yang tersedia: **Pindai Planet** (terbang dalam radius 2× jari-jari dan tahan pemindaian 3 detik), **Hancurkan N musuh**, **Kumpulkan N kristal**, **Dock di stasiun** (terbang pelan ke dalam cincin dock), **Capai Warp Gate**.

| Sektor | Nama | Objektif wajib | Bahaya khusus |
|---|---|---|---|
| 1 | **Gerbang Helios** | Pindai 3 planet, hancurkan 8 musuh, kumpulkan 10 kristal, capai Warp Gate | Sabuk asteroid, patroli Drone |
| 2 | **Nebula Karmin** | Dock di stasiun & ambil data, hancurkan Raider ×6, kalahkan Harbinger, Warp Gate | Kabut nebula (visibilitas turun, radar terganggu), bintang ganda (area panas, damage Shield) |
| 3 | **Singularitas** | Hancurkan Gunship ×3, kalahkan Leviathan, Warp Gate "kembali ke rumah" | Lubang hitam (tarikan gravitasi + zona bahaya), medan puing |

### 5.8 Upgrade (antar sektor, dibayar kristal)
4 jalur × 3 level:
| Jalur | L1 | L2 | L3 |
|---|---|---|---|
| Armor (Hull maks) | +20 (10 kr) | +40 (20 kr) | +70 (35 kr) |
| Shield (maks + regen) | +20 / +2/s (10) | +40 / +4/s (20) | +60 / +6/s (35) |
| Weapons (damage laser) | +15% (12) | +30% (24) | +50% (40) |
| Engine (kecepatan + boost efisiensi) | +10% (10) | +20% (20) | +30%, boost −20% biaya (35) |

### 5.9 Skor & Tingkat Kesulitan
- Skor: Drone 100, Raider 250, Gunship 600, Harbinger 3.000, Leviathan 6.000, pindai planet 500, kristal 50, bonus waktu & akurasi di akhir sektor.
- Combo ×1–×5: naik tiap kill beruntun dalam 4 detik.
- Kesulitan (Pengaturan): **Santai** (damage musuh ×0,6, HP musuh ×0,8), **Normal** (×1), **Sulit** (×1,3 dan ×1,25, jumlah musuh +25%).

---

## 6. Dunia Game

### 6.1 Skala & Aturan Ruang
- 1 unit = 1 meter "game". Pesawat panjang ≈ 12 u.
- Jari-jari planet 600–2.500 u, jarak antar planet 15.000–60.000 u. Skybox tidak ikut bergerak (selalu mengikuti kamera).
- **Floating origin**: jika kamera > 20.000 u dari titik (0,0,0), seluruh dunia digeser mundur agar presisi float tidak rusak. Dilakukan tanpa efek terlihat.
- `camera.near = 0.5`, `camera.far = 400000`, aktifkan `logarithmicDepthBuffer` bila terjadi z-fighting pada preset High (di Medium pakai teknik *near/far split* untuk objek jauh).
- Objek jauh (planet, matahari) digambar sebagai "backdrop layer" dengan skala diperkecil dan jarak dipertahankan secara visual, agar tidak terpotong far plane.

### 6.2 Sektor 1 — Gerbang Helios
- **Bintang Helios** (kuning-putih): bola emisif + korona (sprite shader) + `DirectionalLight` utama. Flare sprite muncul saat dilihat langsung.
- Planet (nama fiksi):
  1. **Ember** — planet lava, dekat bintang, retakan magma bercahaya, tanpa cincin.
  2. **Vesta** — planet samudra mirip Bumi: lautan, benua, awan bergerak, atmosfer biru tipis, 1 bulan.
  3. **Kora** — planet gurun oranye-karat, kawah, badai debu.
  4. **Jovara** — raksasa gas dengan pita badai dan **cincin** (3 pita, transparan, bayangan jatuh ke planet), 3 bulan.
  5. **Cryo** — planet es kebiruan, kutub terang.
- Sabuk asteroid antara Kora dan Jovara (≈ 1.500 instance, `InstancedMesh`).
- Stasiun ruang angkasa sebagai landmark (bentuk cincin berputar), tempat aman: musuh tidak spawn dalam 1.000 u.

### 6.3 Sektor 2 — Nebula Karmin
- Bintang ganda merah-oranye + biru kecil yang saling berputar.
- Nebula volumetrik semu: beberapa lapis sprite/shader noise besar berwarna magenta-merah dan teal, ada petir kecil sesekali di dalam awan.
- 2 planet saja (gas ungu-merah, dan planet berbatu gelap), 1 stasiun penelitian terbengkalai (objektif dock).

### 6.4 Sektor 3 — Singularitas
- **Lubang hitam** di pusat: bola hitam + *accretion disk* (shader cincin dengan gradasi oranye-putih, berputar) + efek *lensing* palsu (distorsi radial pada post-process di sekitar posisi layar lubang hitam).
- Gravitasi: tarikan ∝ 1/d² dalam radius 6.000 u; zona **Event Horizon** (radius 700 u) = kehancuran instan dengan peringatan "ZONA BAHAYA".
- Puing kapal dan asteroid mengorbit pelan.

### 6.5 Skybox Galaksi (prosedural)
Satu bola besar dengan fragment shader, mengikuti kamera:
1. **Bintang**: 3 lapisan densitas (hash noise), warna suhu (putih-biru, kuning, oranye), kedipan halus.
2. **Pita galaksi** (Milky Way): fbm noise miring dengan gradasi warna debu hangat.
3. **Galaksi jauh**: 3–5 galaksi spiral kecil (sprite shader spiral berputar sangat lambat), setiap sektor posisi berbeda (seed).
4. **Nebula latar**: warna dikontrol per sektor lewat uniform.

Tambahan: partikel debu (`Points`, 1.500) di sekitar pemain untuk memberi rasa kecepatan; streak memanjang saat boost/hyperdrive.

### 6.6 Planet — Spesifikasi Render
- Geometri: `IcosahedronGeometry` detail 6 (≈ 82k segitiga) hanya untuk planet terdekat; planet jauh detail 4. Ganti LOD berdasarkan jarak.
- Material: `ShaderMaterial` dengan **fbm 3D noise** per tipe (warna ramp, ketinggian, kutub, awan). Seed berbeda per planet.
- Atmosfer: bola kedua sedikit lebih besar, shader **Fresnel** + scattering sederhana mengarah ke matahari (warna per planet).
- Cincin: `RingGeometry` dengan tekstur radial dari `CanvasTexture` (pita bergradasi + celah), bayangan dari planet pada cincin (dihitung di shader).
- Pencahayaan malam hari: sisi gelap planet Vesta menampilkan lampu kota kecil (opsional, bila FPS aman).

---

## 7. Arah Visual (Anti-Generik)

### 7.1 Palet (jadikan CSS variable dan konstanta JS)
| Token | Hex | Pemakaian |
|---|---|---|
| `--space-0` | `#05060D` | Latar hitam kebiruan |
| `--space-1` | `#0B1020` | Panel HUD |
| `--star` | `#FFF3D6` | Putih hangat bintang & teks utama |
| `--amber` | `#FFB347` | Aksen utama HUD, indikator aktif |
| `--cyan` | `#5FD1FF` | Teman / pesawat pemain / tembakan pemain |
| `--hostile` | `#FF5A3C` | Musuh / peringatan |
| `--crystal` | `#6FA8FF` | Kristal |
| `--ok` | `#8DE08A` | Status baik |

Hindari: gradasi ungu-pink neon generik, glassmorphism berlebihan, ikon emoji sebagai elemen HUD.

### 7.2 Pesawat Pemain "Aurora" (geometri kode)
- Badan ramping ala jet tempur: fuselage dari `LatheGeometry`/kerucut pipih, kokpit kaca (material transmisif gelap dengan pantulan emisif tipis), dua sayap delta dengan ujung sirip vertikal, dua mesin di belakang.
- Material `MeshStandardMaterial` metalik (`metalness 0.8, roughness 0.35`), panel garis (normal map dari `CanvasTexture`), lampu navigasi merah/hijau berkedip di ujung sayap.
- **Api mesin**: dua cone emisif + partikel jejak (cyan-putih), intensitas mengikuti throttle; biru terang & memanjang saat boost.
- Silhouette musuh jelas berbeda (lihat tabel) dan berwarna oranye-merah-hitam:
  - Drone: bola kecil + 3 sirip.
  - Raider: bentuk panah terbalik, sayap menyapu ke depan.
  - Gunship: badan lebar bertingkat, 2 turret.
  - Harbinger: kapal bercabang simetris, inti bercahaya.
  - Leviathan: struktur panjang berlapis dengan 4 turret terlihat.

### 7.3 Efek & Post-Processing
- **Bloom** (`UnrealBloomPass`: strength 0,6, radius 0,5, threshold 0,85) untuk matahari, laser, mesin, ledakan.
- **Vignette** halus + **chromatic aberration** tipis saat boost/hit (sangat ringan, bisa dimatikan).
- Ledakan: flash sprite + 40–80 partikel serpihan + shockwave ring, bertahan ≤ 1,2 detik, pakai object pool.
- Tembakan laser: capsule emisif memanjang + glow sprite; hit spark pada target.
- Efek kerusakan: layar berkedip tepi merah saat Hull < 30%, asap dari pesawat.

---

## 8. Audio (Web Audio API, prosedural)
Audio dimulai setelah interaksi pertama (kebijakan autoplay): panggil `audioCtx.resume()` pada klik *Mulai*.

| Suara | Sintesis |
|---|---|
| Mesin | Sawtooth + noise → lowpass; frekuensi & volume mengikuti kecepatan |
| Boost | Naikkan cutoff + tambah noise "whoosh" |
| Laser | Square → sweep turun 1.2kHz → 200Hz, envelope 90 ms |
| Misil | Noise tersaring + desis, lalu ledakan saat kena |
| Ledakan | Noise burst + lowpass sweep turun + sub-bass sine |
| Pickup | Dua nada naik (arpeggio pendek) |
| Peringatan | Beep dua nada berulang (Hull rendah, misil mendekat, zona bahaya) |
| Ambient | Drone pad (detune oscillator, LFO lambat), berbeda per sektor |
| Warp | Sweep naik + whoosh, hening sesaat saat tiba |

Kontrol: volume Master / Efek / Musik di Pengaturan, tombol `M` untuk mute.

---

## 9. UI / HUD

### 9.1 Layout HUD saat bermain
- **Tengah**: crosshair (titik + ring tipis), lead indicator untuk target terkunci.
- **Kiri bawah**: bar Hull (atas) & Shield (bawah) — segmen, bukan gradient halus; angka numerik.
- **Kanan bawah**: bar Energy, jumlah Missile (ikon + angka), status Boost.
- **Kiri atas**: objektif aktif (maks 4 baris) dengan centang saat selesai.
- **Kanan atas**: **Radar 3D bulat** (menampilkan musuh, pickup, planet, Warp Gate; titik di atas/bawah bidang diberi garis ke bidang radar).
- **Bawah tengah**: kecepatan (u/s), mode Flight Assist, jarak ke target.
- **Marker**: tanda panah di tepi layar menunjuk objektif/planet berikutnya + jarak; bracket di sekitar target terlihat.
- **Notifikasi** (atas tengah): "Planet Vesta terpindai", "Shield habis!", "Warp Gate terbuka".
- **Pemindaian planet**: lingkaran progres 3 detik + nama planet + info singkat (tipe, jari-jari, suhu fiksi).

### 9.2 Layar Lain
- **Title**: latar 3D hidup (planet + pesawat berputar).
- **Pause** (`Esc` / `P`): Lanjut, Pengaturan, Keluar ke Menu.
- **Pengaturan**: kualitas grafis (Rendah/Sedang/Tinggi), sensitivitas mouse, invert Y, getaran kamera, volume, tingkat kesulitan, tampilkan FPS.
- **Cara Bermain**: tabel kontrol (sesuai bagian 10).
- **Upgrade**: 4 kartu jalur, jumlah kristal, tombol *Beli* dengan status (terkunci/cukup/kurang kristal).
- **Game Over / Victory**: statistik (skor, kill, akurasi, waktu, kristal), skor tertinggi baru ditandai.

---

## 10. Kontrol

| Input | Keyboard + Mouse | Gamepad (Standard mapping) | Touch |
|---|---|---|---|
| Arah (pitch/yaw) | Mouse (pointer lock; klik untuk menangkap) | Stik kanan | Joystick virtual kanan |
| Thrust / Rem | W / S | RT / LT | Slider throttle kiri |
| Strafe | A D R F | Stik kiri | — (opsional dobel-tap) |
| Roll | Q E | LB / RB | Miring/gesture dua jari (opsional) |
| Tembak laser | Klik kiri / J | A | Tombol FIRE |
| Misil | Klik kanan / K | X | Tombol MISSILE |
| Boost | Shift | B | Tombol BOOST |
| Hyperdrive | Space | Y | Tombol WARP |
| Lock target | T / Y | D-pad | Tap musuh |
| Kamera | V (kokpit), C (lihat belakang) | R3 | Tombol kamera |
| Flight Assist | Z | L3 | — |
| Pause | Esc / P | Start | Tombol pause |
| Mute | M | — | — |

Catatan: jika *pointer lock* ditolak, fallback ke mode joystick di layar (mouse jarak dari tengah). Deteksi perangkat sentuh otomatis menampilkan kontrol touch.

---

## 11. Arsitektur Kode (di dalam `index.html`)

### 11.1 Struktur Bagian
```
<head>   meta, title, font, CSS (variable palet, HUD, layar menu)
<body>   <canvas>, <div id="hud">, layar menu/overlay
<script type="importmap">  three + addons
<script type="module">
  1. CONFIG            — semua angka balancing, warna, preset kualitas
  2. Util              — rng seedable, math, noise, pool, event bus
  3. Input             — keyboard, mouse, gamepad, touch → satu objek "intent"
  4. Audio             — mesin sintesis + mixer
  5. Renderer          — scene, kamera, composer, resize, preset kualitas
  6. World             — skybox, bintang, planet, matahari, nebula, lubang hitam, asteroid, stasiun
  7. Entities          — Ship, Enemy(+AI), Projectile, Missile, Pickup, Boss, Gate
  8. Systems           — fisika, kolisi, AI, spawner, objektif, skor, upgrade
  9. UI                — HUD, radar, marker, layar menu, notifikasi
 10. Game              — state machine, loop, save/load
 11. boot()            — deteksi WebGL, muat font, tampilkan title
```

### 11.2 Prinsip
- **Fixed timestep** 1/60 detik (accumulator) untuk fisika; render per frame; batasi delta maks 0,1 s (saat tab disembunyikan, game otomatis pause).
- **Object pooling** untuk peluru, misil, partikel, ledakan, pickup. Tidak ada `new` Mesh/Material di dalam loop.
- **InstancedMesh** untuk asteroid, debu, serpihan.
- **Kolisi**: sphere vs sphere, dengan *spatial hash grid* (sel 200 u) untuk asteroid & musuh; peluru swept sphere.
- **Satu sumber kebenaran**: `CONFIG` menyimpan semua angka (tidak ada angka ajaib tanpa nama di logika).
- **Pembersihan**: `dispose()` geometri/material/tekstur saat pindah sektor; tidak ada memory leak (cek lewat `renderer.info`).
- Semua listener event didaftarkan sekali dan dilepas saat tidak perlu.
- Kode dikomentari per bagian; fungsi pendek dan bernama jelas.

### 11.3 Preset Kualitas
| Preset | Pixel ratio | Detail planet | Bloom | Partikel maks | Asteroid |
|---|---|---|---|---|---|
| Rendah | 1 | 3 | mati | 800 | 400 |
| Sedang (default) | min(dpr, 1.5) | 4 | ya | 2.000 | 900 |
| Tinggi | min(dpr, 2) | 6 | ya + chroma | 3.000 | 1.500 |

Penurunan kualitas otomatis: jika rata-rata FPS < 40 selama 5 detik, turunkan satu preset dan tampilkan notifikasi.

---

## 12. Penyimpanan Data
Key `stardrift.v1`: `{ highScore, settings, bestTimePerSector, unlockedSector }`. Dibaca saat boot dengan `try/catch`; jika korup, reset ke default tanpa crash. Progres sektor/upgrade antar sesi **tidak** disimpan (satu run = satu sesi), kecuali opsi *Lanjutkan sektor* pada versi berikutnya.

---

## 13. Edge Case yang Wajib Ditangani
1. WebGL2 tidak tersedia → layar pesan jelas + saran browser.
2. CDN gagal → pesan error dengan tombol *Muat Ulang*.
3. Resize/rotasi layar → renderer, kamera, composer, dan HUD menyesuaikan.
4. Tab tidak aktif → game pause otomatis; audio di-suspend.
5. Pointer lock ditolak / dilepas → pause otomatis dengan petunjuk "klik untuk melanjutkan".
6. AudioContext belum aktif → audio dimulai setelah klik pertama, tanpa error di console.
7. Gamepad dicabut/dipasang saat bermain → deteksi dinamis.
8. Pemain terbang jauh dari area → panah peringatan "kembali ke area misi" (batas 90.000 u dari pusat sektor, setelah 10 detik di luar batas = damage bertahap).
9. Musuh tidak boleh spawn di dalam planet/asteroid/stasiun atau terlalu dekat pemain (< 600 u).
10. Pemain menabrak planet → ledakan instan (zona atmosfer memberi peringatan 1 detik sebelumnya).
11. Hyperdrive tidak boleh membawa pemain menembus planet (cek jalur, hentikan di jarak aman).
12. Skor tertinggi dan pengaturan tidak hilang bila `localStorage` tidak tersedia (tetap jalan, tanpa menyimpan).

---

## 14. Kriteria Penerimaan (Definition of Done)

**Fungsional**
- [ ] Game terbuka dari `index.html` tanpa error di console.
- [ ] Seluruh alur TITLE → 3 sektor → VICTORY dan jalur GAME_OVER berjalan.
- [ ] Semua objektif di tabel 5.7 bisa diselesaikan dan terdeteksi dengan benar.
- [ ] Kontrol keyboard+mouse, gamepad, dan touch berfungsi sesuai tabel.
- [ ] Semua senjata, musuh, boss, pickup, upgrade bekerja sesuai angka PRD.
- [ ] Pause/lanjut, pengaturan, dan save skor tertinggi berfungsi.

**Visual & audio**
- [ ] Skybox galaksi, bintang, nebula terlihat berbeda di tiap sektor.
- [ ] Minimal 5 planet berbeda tipe di Sektor 1, termasuk satu bercincin dengan bayangan.
- [ ] Matahari bercahaya (bloom + korona + flare), lubang hitam dengan accretion disk dan distorsi.
- [ ] Semua suara pada bagian 8 ada dan tidak clipping; volume bisa diatur.

**Performa**
- [ ] ≥ 55 FPS rata-rata di preset Sedang pada laptop GPU terintegrasi.
- [ ] Draw call < 150 dan tidak ada kenaikan memori terus-menerus setelah 10 menit bermain.

**Checklist Anti-Slop**
- [ ] Tidak ada teks placeholder, "Lorem ipsum", atau tombol yang tidak berfungsi.
- [ ] Setiap elemen HUD terhubung ke data nyata (tidak statis).
- [ ] Tidak ada angka ajaib tanpa nama; seluruh balancing ada di `CONFIG`.
- [ ] Tidak ada `console.log` sisa debug.
- [ ] Palet warna sesuai bagian 7.1; tidak ada ungu-pink neon default.
- [ ] Setiap layar punya state kosong/gagal yang jelas (mis. kristal kurang saat upgrade).
- [ ] Tombol bisa diakses keyboard (fokus terlihat) di layar menu.

---

## 15. Urutan Pengerjaan (Milestone)

| # | Milestone | Hasil yang bisa dites |
|---|---|---|
| M0 | Kerangka: HTML, CSS, renderer, loop, boot, deteksi WebGL | Layar kosong dengan FPS counter, tanpa error |
| M1 | Skybox galaksi + bintang + debu + kamera chase | Pesawat placeholder terbang di ruang angkasa indah |
| M2 | Model pesawat Aurora + kontrol 6DOF + boost + hyperdrive | Terbang terasa enak |
| M3 | Planet prosedural, atmosfer, cincin, matahari, bloom | Sektor 1 terlihat meyakinkan |
| M4 | Senjata, pool peluru, kolisi, asteroid, ledakan, pickup | Bisa menembak dan menghancurkan |
| M5 | Musuh + AI + HUD + radar + target lock + misil | Pertempuran seru |
| M6 | Objektif, skor, upgrade, state machine, Warp Gate | Sektor 1 selesai bisa dimainkan |
| M7 | Sektor 2 & 3, boss, nebula, lubang hitam | Game lengkap |
| M8 | Audio, touch/gamepad, pengaturan, save, polishing, QA edge case | Siap rilis |

Tiap milestone harus berjalan sebelum lanjut ke berikutnya (tidak menulis semua sekaligus tanpa tes).

---

## 16. Risiko & Mitigasi
| Risiko | Mitigasi |
|---|---|
| Presisi float di jarak jauh | Floating origin + backdrop layer untuk objek jauh |
| FPS turun di laptop lemah | Preset kualitas + auto-downgrade + instancing + pooling |
| Shader planet terlalu berat | Noise iterasi terbatas (4–5 oktaf), LOD, cache hasil bila perlu |
| Kontrol mouse membingungkan | Deadzone, indikator virtual joystick, opsi sensitivitas & invert |
| Cakupan terlalu besar untuk satu file | Urutan milestone, `CONFIG` terpusat, fitur opsional (lampu kota, chroma) dipotong dulu bila waktu mepet |

---

## 17. Instruksi untuk AI Coder (salin ke prompt pembuatan game)

> Buat game 3D bernama **STARDRIFT** sesuai PRD ini dalam **satu file `index.html`** lengkap (kode siap pakai, bukan potongan). Gunakan Three.js via importmap CDN. Semua visual (planet, galaksi, nebula, lubang hitam, pesawat) dan audio dibuat prosedural tanpa aset eksternal. Ikuti urutan milestone M0–M8, patuhi arsitektur bagian 11, palet bagian 7.1, angka balancing bagian 5, dan checklist anti-slop bagian 14. Pastikan tidak ada error di console, tidak ada placeholder, dan semua elemen HUD terhubung ke data nyata. Tulis kode dengan komentar per bagian dan seluruh angka di objek `CONFIG`.
