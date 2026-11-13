/* ==========================================================================
   rocket.js — Efek Visual Kosmik Multi-Variasi Saat Scroll (#scroll-fx)
   - Menggantikan roket tunggal dengan 4 variasi animasi latar belakang yang
     elegan, minimalis (tidak ramai), dan tidak menutupi teks (z-index: 0):
     0) Bintang Jatuh / Komet Cahaya Melengkung (lintasan & arah bervariasi)
     1) Gelombang Pita Aurora Halus di tepi layar
     2) Prisma Kristal Wireframe 3D yang berputar mengikuti scroll
     3) Jaringan Konstelasi Bintang dengan denyut cahaya
   - Hanya muncul saat pengguna sedang melakukan scroll, lalu memudar halus
     saat berhenti scroll dan berganti variasi pada scroll berikutnya.
   ========================================================================== */
import { $, prefersReduced } from "./motion.js";

const PALETTES = [
  { a: [61, 220, 132],  b: [56, 189, 248] },  // Emerald -> Cyan
  { a: [56, 189, 248],  b: [47, 107, 255] },  // Cyan -> Electric Blue
  { a: [168, 85, 247],  b: [56, 189, 248] },  // Violet -> Cyan
  { a: [250, 204, 21],  b: [61, 220, 132] }   // Gold -> Emerald
];

// 6 variasi lintasan lengkung bezier untuk Bintang Jatuh (agar arah selalu beda-beda)
const COMET_PATHS = [
  { p0: [0.88, 0.08], p1: [0.55, 0.18], p2: [0.14, 0.42] }, // Kanan-Atas -> Kiri-Tengah
  { p0: [0.12, 0.10], p1: [0.48, 0.20], p2: [0.86, 0.44] }, // Kiri-Atas -> Kanan-Tengah
  { p0: [0.92, 0.18], p1: [0.78, 0.50], p2: [0.88, 0.84] }, // Lengkung Sisi Kanan
  { p0: [0.08, 0.20], p1: [0.22, 0.52], p2: [0.12, 0.86] }, // Lengkung Sisi Kiri
  { p0: [0.76, 0.06], p1: [0.88, 0.36], p2: [0.62, 0.68] }, // Busur Diagonal Kanan
  { p0: [0.24, 0.06], p1: [0.10, 0.38], p2: [0.36, 0.70] }  // Busur Diagonal Kiri
];

// Simpul 3D Octahedron untuk variasi Prisma Kristal
const OCTA_VERTS = [
  [0, 1.15, 0],
  [0, -1.15, 0],
  [1, 0, 0],
  [-1, 0, 0],
  [0, 0, 1],
  [0, 0, -1]
];
const OCTA_EDGES = [
  [0, 2], [0, 3], [0, 4], [0, 5],
  [1, 2], [1, 3], [1, 4], [1, 5],
  [2, 4], [4, 3], [3, 5], [5, 2]
];

const rgba = (rgb, a) => `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${Math.max(0, Math.min(1, a)).toFixed(3)})`;
const mixRgb = (c1, c2, t) => [
  Math.round(c1[0] + (c2[0] - c1[0]) * t),
  Math.round(c1[1] + (c2[1] - c1[1]) * t),
  Math.round(c1[2] + (c2[2] - c1[2]) * t)
];

function bezier2(p0, p1, p2, t, w, h) {
  const u = 1 - t;
  const x = (u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0]) * w;
  const y = (u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]) * h;
  return [x, y];
}

export function init() {
  const canvas = $("#scroll-fx");
  if (!canvas || prefersReduced()) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.style.opacity = "0";
  canvas.style.visibility = "hidden";

  let viewW = window.innerWidth || 1280;
  let viewH = window.innerHeight || 800;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);

  let lastScrollY = window.scrollY;
  let isScrolling = false;
  let idleTimer = null;
  let running = false;
  let ready = false;

  let variant = 0;       // 0: comet, 1: aurora, 2: prism3d, 3: constellation
  let pathIdx = 0;       // indeks lintasan comet (0..5)
  let side = 1;          // -1: sisi kiri, +1: sisi kanan
  let palIdx = 0;        // indeks warna (0..3)

  let progress = 0;      // 0..1 sepanjang siklus animasi
  let alpha = 0;         // opasitas saat aktif scroll
  let speedBoost = 0;
  let scrollAccum = 0;
  let lastTime = performance.now();

  // Simpul konstelasi relatif untuk variasi 3
  const constNodes = [
    [0.0, -0.26], [0.04, -0.15], [-0.03, -0.05],
    [0.03, 0.06], [-0.02, 0.16], [0.02, 0.27]
  ];

  function resize() {
    viewW = window.innerWidth || 1280;
    viewH = window.innerHeight || 800;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(viewW * dpr);
    canvas.height = Math.round(viewH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function nextVariant() {
    variant = (variant + 1) % 4;
    pathIdx = (pathIdx + 1 + Math.floor(Math.random() * 2)) % COMET_PATHS.length;
    side = side === 1 ? -1 : 1;
    palIdx = (palIdx + 1) % PALETTES.length;
    progress = 0;
  }

  setTimeout(() => {
    lastScrollY = window.scrollY;
    ready = true;
  }, 600);

  /* ---------- Render Variasi 0: Bintang Jatuh / Komet Halus ---------- */
  function drawComet(pal, a) {
    const path = COMET_PATHS[pathIdx];
    const headT = Math.min(1, progress);
    const tailLen = 0.22;
    const steps = 28;

    ctx.lineCap = "round";
    for (let i = 0; i < steps; i++) {
      const f0 = i / steps;
      const f1 = (i + 1) / steps;
      const t0 = Math.max(0, headT - tailLen * (1 - f0));
      const t1 = Math.max(0, headT - tailLen * (1 - f1));
      if (t1 <= t0) continue;

      const [x0, y0] = bezier2(path.p0, path.p1, path.p2, t0, viewW, viewH);
      const [x1, y1] = bezier2(path.p0, path.p1, path.p2, t1, viewW, viewH);
      const col = mixRgb(pal.b, pal.a, f1);

      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.strokeStyle = rgba(col, a * Math.pow(f1, 1.7) * 0.65);
      ctx.lineWidth = 0.6 + f1 * 2.4;
      ctx.stroke();
    }

    // Titik kepala bintang jatuh yang lembut
    const [hx, hy] = bezier2(path.p0, path.p1, path.p2, headT, viewW, viewH);
    const grad = ctx.createRadialGradient(hx, hy, 0, hx, hy, 18);
    grad.addColorStop(0, rgba([255, 255, 255], a * 0.85));
    grad.addColorStop(0.35, rgba(pal.a, a * 0.55));
    grad.addColorStop(1, rgba(pal.b, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(hx, hy, 18, 0, Math.PI * 2);
    ctx.fill();
  }

  /* ---------- Render Variasi 1: Gelombang Pita Aurora di Tepi Layar ---------- */
  function drawAurora(pal, a, now) {
    const baseX = side > 0 ? viewW * 0.91 : viewW * 0.09;
    const amp = Math.min(viewW * 0.035, 42);
    const tSec = now * 0.002 + scrollAccum * 0.004;

    for (let layer = 0; layer < 2; layer++) {
      const col = layer === 0 ? pal.a : pal.b;
      ctx.beginPath();
      const yStart = viewH * 0.14;
      const yEnd = viewH * 0.86;
      const segs = 40;
      for (let i = 0; i <= segs; i++) {
        const u = i / segs;
        const y = yStart + (yEnd - yStart) * u;
        const env = Math.sin(u * Math.PI);
        const x =
          baseX +
          Math.sin(u * 5.2 - tSec + layer * 1.3) * amp * env +
          Math.cos(u * 2.8 + tSec * 0.7) * (amp * 0.4) * env;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = rgba(col, a * (layer === 0 ? 0.38 : 0.24));
      ctx.lineWidth = layer === 0 ? 2.2 : 5.5;
      ctx.stroke();
    }
  }

  /* ---------- Render Variasi 2: Prisma Kristal 3D Berputar ---------- */
  function drawPrism3D(pal, a, now) {
    const cx = side > 0 ? viewW * 0.89 : viewW * 0.11;
    const cy = viewH * (0.28 + 0.44 * progress);
    const radius = Math.min(viewW, viewH) * 0.052;

    const rx = now * 0.0012 + scrollAccum * 0.005;
    const ry = now * 0.0016 + scrollAccum * 0.007;
    const cxR = Math.cos(rx), sxR = Math.sin(rx);
    const cyR = Math.cos(ry), syR = Math.sin(ry);

    const proj = OCTA_VERTS.map(([vx, vy, vz]) => {
      // rotasi Y lalu X
      const x1 = vx * cyR - vz * syR;
      const z1 = vx * syR + vz * cyR;
      const y2 = vy * cxR - z1 * sxR;
      const z2 = vy * sxR + z1 * cxR;
      const persp = 3.2 / (3.2 - z2 * 0.45);
      return [cx + x1 * radius * persp, cy + y2 * radius * persp, z2];
    });

    // Cincin orbit tipis mengelilingi prisma
    ctx.beginPath();
    ctx.ellipse(cx, cy, radius * 1.45, radius * 0.52, rx * 0.35, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(pal.b, a * 0.25);
    ctx.lineWidth = 1;
    ctx.stroke();

    // Rusuk octahedron
    ctx.lineWidth = 1.25;
    OCTA_EDGES.forEach(([i, j], idx) => {
      const p1 = proj[i];
      const p2 = proj[j];
      const col = idx % 2 === 0 ? pal.a : pal.b;
      ctx.beginPath();
      ctx.moveTo(p1[0], p1[1]);
      ctx.lineTo(p2[0], p2[1]);
      ctx.strokeStyle = rgba(col, a * 0.42);
      ctx.stroke();
    });

    // Titik sudut bercahaya
    proj.forEach(([px, py]) => {
      ctx.fillStyle = rgba(pal.a, a * 0.7);
      ctx.beginPath();
      ctx.arc(px, py, 2.2, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  /* ---------- Render Variasi 3: Jaringan Konstelasi & Denyut Cahaya ---------- */
  function drawConstellation(pal, a) {
    const cx = side > 0 ? viewW * 0.90 : viewW * 0.10;
    const cy = viewH * 0.5;
    const pts = constNodes.map(([nx, ny], i) => [
      cx + nx * viewW + Math.sin(progress * 5 + i) * 8,
      cy + ny * viewH
    ]);

    ctx.lineWidth = 1.1;
    for (let i = 0; i < pts.length - 1; i++) {
      ctx.beginPath();
      ctx.moveTo(pts[i][0], pts[i][1]);
      ctx.lineTo(pts[i + 1][0], pts[i + 1][1]);
      ctx.strokeStyle = rgba(pal.b, a * 0.28);
      ctx.stroke();
    }

    // Denyut cahaya berjalan dari simpul atas ke bawah mengikuti progress scroll
    const pulsePos = progress * (pts.length - 1);
    const idx = Math.min(pts.length - 2, Math.floor(pulsePos));
    const frac = pulsePos - idx;
    const px = pts[idx][0] + (pts[idx + 1][0] - pts[idx][0]) * frac;
    const py = pts[idx][1] + (pts[idx + 1][1] - pts[idx][1]) * frac;

    const grad = ctx.createRadialGradient(px, py, 0, px, py, 14);
    grad.addColorStop(0, rgba([255, 255, 255], a * 0.8));
    grad.addColorStop(0.4, rgba(pal.a, a * 0.5));
    grad.addColorStop(1, rgba(pal.a, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px, py, 14, 0, Math.PI * 2);
    ctx.fill();

    pts.forEach(([x, y], i) => {
      ctx.fillStyle = rgba(i % 2 === 0 ? pal.a : pal.b, a * 0.65);
      ctx.beginPath();
      ctx.arc(x, y, 2.6, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function step(now) {
    // dt tidak boleh negatif (timestamp rAF bisa lebih kecil dari performance.now() pada frame pertama)
    const dt = Math.max(0, Math.min((now - lastTime) / 1000, 0.05));
    lastTime = now;

    if (isScrolling) {
      alpha += (1 - alpha) * Math.min(1, dt * 10);
      progress += (0.52 + speedBoost * 0.45) * dt;
      if (progress >= 1.0) {
        // Berganti ke variasi & arah baru secara mulus jika pengguna masih terus scroll panjang
        nextVariant();
      }
    } else {
      alpha += (0 - alpha) * Math.min(1, dt * 7);
      progress = Math.min(1, progress + 0.25 * dt);
    }
    progress = Math.max(0, Math.min(1, progress));

    speedBoost *= Math.pow(0.08, dt);

    ctx.clearRect(0, 0, viewW, viewH);

    if (alpha <= 0.008 && !isScrolling) {
      alpha = 0;
      canvas.style.opacity = "0";
      canvas.style.visibility = "hidden";
      running = false;
      nextVariant(); // Siapkan variasi berbeda untuk scroll berikutnya
      return;
    }

    canvas.style.visibility = "visible";
    canvas.style.opacity = "1";

    const pal = PALETTES[palIdx];
    const smoothEnv = Math.sin(Math.max(0.05, Math.min(0.95, progress)) * Math.PI);
    const effAlpha = alpha * (0.45 + 0.55 * smoothEnv);

    if (variant === 0) drawComet(pal, effAlpha);
    else if (variant === 1) drawAurora(pal, effAlpha, now);
    else if (variant === 2) drawPrism3D(pal, effAlpha, now);
    else drawConstellation(pal, effAlpha);

    requestAnimationFrame(step);
  }

  function onScroll() {
    if (!ready) return;
    const y = window.scrollY;
    const dy = y - lastScrollY;
    lastScrollY = y;

    if (Math.abs(dy) < 0.5) return;

    scrollAccum += Math.abs(dy);
    speedBoost = Math.min(1.8, speedBoost + Math.abs(dy) / 160);
    isScrolling = true;

    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      isScrolling = false;
    }, 280);

    if (!running) {
      running = true;
      lastTime = performance.now();
      requestAnimationFrame(step);
    }
  }

  resize();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", resize, { passive: true });
}
