/* ==========================================================================
   swarm-compat.js — Adaptor Kompatibilitas Ekstensi Chrome "Swarm Rebuild"
   --------------------------------------------------------------------------
   Mengatasi 4 kendala arsitektur saat Swarm Rebuild (<swarm-rebuild>) aktif:
   1) Layer "over" (position: fixed) yang menutupi layer "world":
      Menyembunyikan canvas/overlay dekoratif berukuran penuh via class
      `html.is-swarm` dan menyisipkan snapshot galaksi 3D ke bagian Hero
      di dalam `.world` milik Shadow DOM `<swarm-rebuild>` sehingga galaksi
      ikut ter-scroll alami bersama Hero dan tidak menutupi section lain.
   2) Konflik Lenis Smooth Scroll vs pemindaian `scan()` Swarm Rebuild:
      Menghentikan Lenis sementara selama `<swarm-rebuild>` aktif agar
      `window.scrollTo(..., { behavior: "instant" })` milik Swarm Rebuild
      kembali tepat ke `scrollY = 0` dan scroll/Tour berjalan mulus.
   3) Posisi 13 planet logo teknologi di Hero:
      Mengunci proyeksi 3D planet pada keadaan Hero penuh (`uHeroExit = 0`)
      selama pemindaian berlangsung.
   4) Angka statistik & teks SplitText:
      Memastikan angka counter `.stat__num` menampilkan nilai akhir dan
      pecahan kata/karakter SplitText disatukan menjadi inline via CSS.
   ========================================================================== */
import { $$ } from "./motion.js";
import * as smooth from "./smooth-scroll.js";
import * as hero from "./hero.js";

const html = document.documentElement;
let active = false;
let worldObserver = null;

function paintSwarmBackdrop(host, galaxyUrl) {
  if (!host || !host.shadowRoot) return;
  const root = host.shadowRoot;
  const bg = root.querySelector(".bg");
  const world = root.querySelector(".world");

  const isLight = html.getAttribute("data-theme") === "light";
  if (bg) {
    bg.style.backgroundImage = isLight
      ? "radial-gradient(55vmax 55vmax at 82% 18%, rgba(5, 150, 105, 0.12), transparent 70%), radial-gradient(50vmax 50vmax at 72% 82%, rgba(37, 99, 235, 0.10), transparent 70%)"
      : "radial-gradient(55vmax 55vmax at 82% 18%, rgba(61, 220, 132, 0.16), transparent 70%), radial-gradient(50vmax 50vmax at 72% 82%, rgba(47, 107, 255, 0.14), transparent 70%)";
    bg.style.backgroundSize = "auto, auto";
    bg.style.backgroundPosition = "center, center";
    bg.style.backgroundRepeat = "no-repeat";
  }

  // Tempatkan snapshot galaksi & 3 cincin orbit di layer paling bawah .world (khusus area Hero)
  // agar ikut bergulir ke atas saat di-scroll ke section Tentang/Skill/Proyek.
  if (world && galaxyUrl) {
    const injectHeroGalaxy = () => {
      if (world.querySelector(".swarm-hero-galaxy")) return;
      const g = document.createElement("div");
      g.className = "swarm-hero-galaxy";
      g.style.cssText =
        `position:absolute;left:0;top:0;width:100%;height:${window.innerHeight}px;` +
        `pointer-events:none;background:url("${galaxyUrl}") center top / 100% 100% no-repeat;`;
      world.insertBefore(g, world.firstChild);
    };

    injectHeroGalaxy();
    if (worldObserver) worldObserver.disconnect();
    worldObserver = new MutationObserver(() => injectHeroGalaxy());
    worldObserver.observe(world, { childList: true });
  }
}

export function enterSwarm(host) {
  if (active) {
    if (host) paintSwarmBackdrop(host, hero.captureGalaxySnapshot());
    return;
  }
  active = true;

  // 1) Kunci posisi 13 planet di orbit Hero & ambil snapshot galaksi sebelum canvas disembunyikan
  hero.setSwarmMode(true);
  const galaxyUrl = hero.captureGalaxySnapshot();

  // 2) Matikan Lenis sementara supaya window.scrollTo() dari scan() Swarm Rebuild tidak dilawan
  smooth.destroy();

  // 3) Aktifkan mode CSS kompatibilitas Swarm Rebuild
  html.classList.add("is-swarm");

  // 4) Pastikan angka statistik menampilkan nilai akhir saat dipindai
  $$(".stat__num").forEach((el) => {
    const val = el.dataset.value;
    const suf = el.dataset.suffix || "";
    if (val != null) el.textContent = `${val}${suf}`;
  });

  // 5) Pasang latar galaksi 3D di dalam Shadow DOM <swarm-rebuild>
  if (host) {
    paintSwarmBackdrop(host, galaxyUrl);
  }
}

export function exitSwarm() {
  if (!active) return;
  active = false;

  if (worldObserver) {
    worldObserver.disconnect();
    worldObserver = null;
  }

  html.classList.remove("is-swarm");
  hero.setSwarmMode(false);

  // Hidupkan kembali Lenis smooth scroll & segarkan posisi ScrollTrigger
  smooth.init();
  smooth.start();
  if (typeof ScrollTrigger !== "undefined") {
    requestAnimationFrame(() => ScrollTrigger.refresh());
  }
}

export function init() {
  const existing = document.querySelector("swarm-rebuild");
  if (existing) enterSwarm(existing);

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const n of m.addedNodes) {
        if (n && n.nodeType === 1 && n.tagName && n.tagName.toLowerCase() === "swarm-rebuild") {
          enterSwarm(n);
        }
      }
      for (const n of m.removedNodes) {
        if (n && n.nodeType === 1 && n.tagName && n.tagName.toLowerCase() === "swarm-rebuild") {
          if (!document.querySelector("swarm-rebuild")) {
            exitSwarm();
          }
        }
      }
    }
  });

  observer.observe(html, { childList: true });
  window.__swarmCompat = { enterSwarm, exitSwarm };
}
