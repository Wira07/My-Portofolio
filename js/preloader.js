/* ==========================================================================
   preloader.js — counter 0→100 sinkron aset nyata + curtain wipe (A1)
   Total ≤ 2.2 dtk, hanya sekali per sesi, dilewati jika reduced-motion.
   ========================================================================== */
import { $, $$, motion } from "./motion.js";

const MIN_COUNT = 0.9;   // detik: waktu minimum tampil agar animasi terbaca
const MAX_COUNT = 1.2;   // detik: batas keras fase hitung (sisanya ≈ 0.8s exit)

/**
 * @param {Promise[]} tasks promise aset nyata (font, WebGL, window load)
 * @param {{ onReveal?: Function }} opts onReveal dipanggil saat curtain mulai naik
 * @returns {Promise<boolean>} true jika preloader benar-benar berjalan
 */
export function run(tasks = [], { onReveal } = {}) {
  const html = document.documentElement;
  const el = $("#preloader");
  if (!el || html.classList.contains("no-preload")) {
    html.classList.remove("is-loading");
    return Promise.resolve(false);
  }

  const letters = $$(".preloader__word span", el);
  const countEl = $("#preloader-count");
  const bar = $("#preloader-bar");

  gsap.fromTo(letters, { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, duration: motion.dur.md, stagger: 0.08 });

  let done = 0;
  const total = Math.max(tasks.length, 1);
  tasks.forEach((p) => Promise.resolve(p).catch(() => {}).then(() => { done++; }));

  return new Promise((resolve) => {
    const state = { v: 0 };
    const start = performance.now();
    const render = () => {
      const n = Math.round(state.v);
      countEl.textContent = n;
      gsap.set(bar, { scaleX: state.v / 100 });
    };

    const exit = () => {
      const tl = gsap.timeline({
        onComplete: () => {
          el.style.display = "none";
          html.classList.remove("is-loading");
          try { sessionStorage.setItem("seen", "1"); } catch (e) { /* abaikan */ }
          resolve(true);
        }
      });
      tl.to(letters, { yPercent: -110, duration: 0.45, stagger: 0.04, ease: motion.ease.inOut }, 0)
        .to(".preloader__meta", { opacity: 0, duration: 0.3 }, 0)
        .call(() => { html.classList.remove("is-loading"); if (onReveal) onReveal(); }, null, 0.15)
        .to(el, { clipPath: "inset(0 0 100% 0)", duration: 0.65, ease: motion.ease.inOut }, 0.15);
    };

    const tick = () => {
      const t = (performance.now() - start) / 1000;
      let target = Math.round((done / total) * 100);
      target = Math.min(target, (t / MIN_COUNT) * 100);
      if (t >= MAX_COUNT) target = 100;
      state.v += (target - state.v) * 0.18;
      if (target === 100 && state.v > 99.3) {
        state.v = 100;
        render();
        gsap.ticker.remove(tick);
        exit();
        return;
      }
      render();
    };
    gsap.ticker.add(tick);
  });
}
