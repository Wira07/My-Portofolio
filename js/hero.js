/* ==========================================================================
   hero.js — UI hero: split-text judul (A3), rotasi peran (A4),
   intro setelah preloader, parallax scroll, dan penyambung WebGL (A2)
   ========================================================================== */
import { $, $$, motion, MQ, prefersReduced } from "./motion.js";

const html = document.documentElement;
let mm = null;
let gl = null;
let introTl = null;
let introPlayed = false;

/** Siapkan keadaan awal (disembunyikan) lalu tandai hero siap. */
export function init() {
  const hero = $("#hero");
  introPlayed = false;
  mm = gsap.matchMedia();

  mm.add(MQ.motion, () => {
    // --- A3: judul dipecah per karakter ---
    SplitText.create(".hero__title .split", {
      type: "words,chars",
      charsClass: "char",
      wordsClass: "word",
      aria: "none",
      autoSplit: true,
      onSplit(self) {
        const gradChars = $$(".hero__title .grad .char");
        gradChars.forEach((ch, idx) => {
          const t = gradChars.length > 1 ? idx / (gradChars.length - 1) : 0;
          ch.style.setProperty("--t", t.toFixed(3));
        });

        gsap.set(self.chars, { yPercent: 110, rotate: 6, transformOrigin: "0% 100%" });
        gsap.set([".hero__eyebrow", ".hero__roles", ".hero__tagline", ".hero__sub", ".hero__cta .btn", ".hero__scroll"], { opacity: 0, y: 24 });
        gsap.set(".nav__inner", { opacity: 0, y: -24 });

        introTl = gsap.timeline({ paused: !introPlayed })
          .to(self.chars, { yPercent: 0, rotate: 0, duration: motion.dur.lg - 0.2, stagger: motion.stagger.chars, ease: motion.ease.out }, 0)
          .to(".nav__inner", { opacity: 1, y: 0, duration: motion.dur.md }, 0.3)
          .to(".hero__eyebrow", { opacity: 1, y: 0, duration: motion.dur.md }, 0.1)
          .to(".hero__roles", { opacity: 1, y: 0, duration: motion.dur.md }, 0.55)
          .to([".hero__tagline", ".hero__sub"], { opacity: 1, y: 0, duration: motion.dur.md + 0.1, stagger: 0.1 }, 0.65)
          .to(".hero__cta .btn", { opacity: 1, y: 0, duration: motion.dur.md, stagger: 0.1 }, 0.85)
          .to(".hero__scroll", { opacity: 1, y: 0, duration: motion.dur.md }, 1.2)
          .set([".hero__eyebrow", ".hero__roles", ".hero__tagline", ".hero__sub", ".hero__cta .btn", ".hero__scroll", ".nav__inner"], { clearProps: "opacity,transform" });

        return introTl;
      }
    });

    // --- A4: rotasi peran (interval 2.5 dtk = 2.0 dtk tampil + 0.5 dtk slide) ---
    const roleBox = $("#hero-role");
    const items = $$(".hero__role-item", roleBox);
    let roleTl = null;
    if (items.length > 1) {
      roleBox.classList.add("is-live");
      gsap.set(items, { yPercent: 110, opacity: 0 });
      gsap.set(items[0], { yPercent: 0, opacity: 1 });
      roleTl = gsap.timeline({ repeat: -1 });
      items.forEach((cur, i) => {
        const next = items[(i + 1) % items.length];
        roleTl
          .to(cur, { yPercent: -110, opacity: 0, duration: 0.5, ease: motion.ease.inOut }, "+=2.0")
          .fromTo(next, { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.5, ease: motion.ease.out, immediateRender: false }, "<");
      });
      ScrollTrigger.create({ trigger: hero, start: "top bottom", end: "bottom top", onToggle: (s) => (s.isActive ? roleTl.play() : roleTl.pause()) });
    }

    // --- Scroll keluar hero: konten naik & memudar, orbit WebGL menyebar ke seluruh halaman ---
    gsap.to(".hero__inner", {
      yPercent: -14,
      opacity: 0,
      ease: "none",
      scrollTrigger: { trigger: hero, start: "top top", end: "bottom 30%", scrub: true }
    });

    let heroProg = 0;
    let pageProg = 0;
    const syncWebGLScroll = () => {
      if (gl) gl.setScroll(pageProg, heroProg);
    };

    ScrollTrigger.create({
      trigger: hero,
      start: "top top",
      end: "bottom top",
      scrub: true,
      onUpdate: (self) => {
        heroProg = self.progress;
        syncWebGLScroll();
      }
    });

    ScrollTrigger.create({
      trigger: document.documentElement,
      start: "top top",
      end: "bottom bottom",
      scrub: true,
      onUpdate: (self) => {
        pageProg = self.progress;
        syncWebGLScroll();
      }
    });

    html.classList.add("hero-ready");

    return () => {
      roleBox.classList.remove("is-live");
      html.classList.remove("hero-ready");
    };
  });

  // Reduced motion: konten langsung tampil, hanya peran pertama
  mm.add(MQ.reduced, () => { html.classList.add("hero-ready"); });
}

/** Putar intro (dipanggil saat curtain preloader mulai naik) */
export function intro() {
  introPlayed = true;
  if (introTl) introTl.play(0);
}

/** Sambungkan Three.js hero setelah modul lazy termuat */
export function attachWebGL(mod) {
  const canvas = $("#hero-canvas");
  const hero = $("#hero");
  if (!mod || !canvas || prefersReduced() || !mod.hasWebGL()) return null; // fallback: mesh gradient CSS

  const lite = (navigator.hardwareConcurrency || 8) <= 4;
  const mobile = window.innerWidth < 768;
  let count = mobile ? 1200 : 3000;
  if (lite) count = Math.round(count * 0.4); // perangkat lemah: -60%

  try {
    const theme = html.getAttribute("data-theme") === "light" ? "light" : "dark";
    gl = mod.createHero(canvas, { count, theme });
  } catch (e) {
    console.warn("WebGL hero gagal diinisialisasi, memakai fallback CSS.", e);
    return null;
  }
  canvas.classList.add("is-ready");
  hero.classList.add("has-webgl");
  html.classList.add("has-webgl");
  window.addEventListener("themechange", (e) => gl && gl.setTheme(e.detail.theme));
  return gl;
}

export function destroy() {
  if (mm) mm.revert();
  if (gl) gl.destroy();
}
