/* ==========================================================================
   main.js — bootstrap: render → preloader → init semua modul
   ========================================================================== */
import { content } from "../data/content.js";
import { register, prefersReduced } from "./motion.js";
import { renderAll } from "./render.js";
import * as smooth from "./smooth-scroll.js";
import * as theme from "./theme.js";
import * as nav from "./nav.js";
import * as cursor from "./cursor.js";
import * as hero from "./hero.js";
import * as rocket from "./rocket.js";
import * as scrollMotion from "./scroll-motion.js";
import * as swarmCompat from "./swarm-compat.js";
import * as preloader from "./preloader.js";
import * as about from "./sections/about.js";
import * as skills from "./sections/skills.js";
import * as journey from "./sections/journey.js";
import * as highlights from "./sections/highlights.js";
import * as projects from "./sections/projects.js";
import * as certs from "./sections/certs.js";
import * as contact from "./sections/contact.js";

const html = document.documentElement;

async function boot() {
  if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") {
    console.error("GSAP tidak termuat — periksa folder /vendor.");
    html.classList.remove("is-loading");
    html.classList.add("no-preload");
    return;
  }

  // 1) Konten dirender dari data/content.js
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  window.scrollTo(0, 0);
  renderAll(content);
  register();
  theme.init();
  swarmCompat.init();

  // 2) Scroll mulus (dihentikan sementara saat preloader tampil)
  smooth.init();
  if (html.classList.contains("is-loading")) smooth.stop();
  smooth.bindAnchors(() => nav.closeMenu());

  // 3) Three.js dimuat lazy, setelah first paint
  const heroModule = prefersReduced()
    ? Promise.resolve(null)
    : new Promise((r) => requestAnimationFrame(() => r()))
        .then(() => import("./hero-webgl.js"))
        .then((mod) => { hero.attachWebGL(mod); return mod; })
        .catch((e) => { console.warn("Three.js tidak termuat; memakai fallback gradient.", e); return null; });

  // 4) Inisialisasi modul (urutan DOM agar ScrollTrigger benar)
  const safeInit = (fn) => {
    try { fn(); } catch (err) { console.error(err); }
  };
  safeInit(() => hero.init());
  safeInit(() => nav.init());
  safeInit(() => about.init());
  safeInit(() => skills.init());
  safeInit(() => journey.init());
  safeInit(() => highlights.init(content.highlights));
  safeInit(() => projects.init(content.projects));
  safeInit(() => certs.init());
  safeInit(() => contact.init(content.meta));
  safeInit(() => scrollMotion.init());
  safeInit(() => rocket.init());
  safeInit(() => cursor.init());
  safeInit(() => cursor.initMagnetic());

  // 5) Preloader sinkron dengan aset nyata
  const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  const pageLoaded = document.readyState === "complete" ? Promise.resolve() : new Promise((r) => window.addEventListener("load", r, { once: true }));
  const ran = await preloader.run([fontsReady, pageLoaded, heroModule], { onReveal: () => hero.intro() });
  if (!ran) hero.intro(); // sesi berulang / reduced-motion: tanpa preloader

  smooth.start();

  // 6) Hitung ulang posisi setelah font & gambar siap
  const refresh = () => ScrollTrigger.refresh();
  fontsReady.then(refresh);
  if (document.readyState !== "complete") window.addEventListener("load", refresh, { once: true });
  setTimeout(refresh, 600);
}

boot().catch((err) => {
  console.error(err);
  html.classList.remove("is-loading");
  html.classList.add("no-preload");
});
