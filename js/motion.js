/* ==========================================================================
   motion.js — token animasi + helper (PRD 7.5)
   GSAP, ScrollTrigger, SplitText, Flip dimuat global dari /vendor.
   ========================================================================== */
export const motion = {
  ease:    { out: "expo.out", inOut: "power3.inOut", soft: "power2.out" },
  dur:     { xs: 0.2, sm: 0.4, md: 0.8, lg: 1.2, xl: 1.6 },
  stagger: { chars: 0.03, words: 0.06, items: 0.08 },
  scroll:  { start: "top 85%", scrub: 0.6 }
};

/** Media query untuk gsap.matchMedia() */
export const MQ = {
  motion:  "(prefers-reduced-motion: no-preference)",
  reduced: "(prefers-reduced-motion: reduce)",
  fine:    "(hover: hover) and (pointer: fine)",
  desktop: "(min-width: 1024px)"
};

export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export const prefersReduced = () => window.matchMedia(MQ.reduced).matches;
export const isFinePointer = () => window.matchMedia(MQ.fine).matches;

export function register() {
  gsap.registerPlugin(ScrollTrigger, SplitText, Flip);
  gsap.defaults({ ease: motion.ease.out });
  ScrollTrigger.defaults({ start: motion.scroll.start });
}

/**
 * Reveal per baris (A8): teks dipecah jadi baris bertopeng lalu naik satu per satu.
 * autoSplit menjaga pemecahan tetap benar setelah font termuat / resize,
 * sedangkan ScrollTrigger dibuat satu kali di luar onSplit agar tidak bentrok saat refresh.
 */
export function revealLines(target, { trigger, start = motion.scroll.start, delay = 0, stagger = 0.1, duration = motion.dur.md } = {}) {
  const el = typeof target === "string" ? $(target) : target;
  if (!el) return null;
  let played = false;
  const split = SplitText.create(el, {
    type: "lines",
    mask: "lines",
    autoSplit: true,
    aria: "none",
    linesClass: "line",
    onSplit(self) {
      if (!played) {
        gsap.set(self.lines, { yPercent: 110 });
      }
    }
  });
  ScrollTrigger.create({
    trigger: trigger || el,
    start,
    once: true,
    onEnter() {
      played = true;
      if (split.lines && split.lines.length) {
        gsap.to(split.lines, {
          yPercent: 0,
          duration,
          delay,
          stagger,
          ease: motion.ease.out,
          overwrite: "auto"
        });
      }
    }
  });
  return split;
}

/** Debounce sederhana */
export function debounce(fn, ms = 150) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

export function announce(text) {
  const live = $("#live");
  if (!live) return;
  live.textContent = "";
  requestAnimationFrame(() => { live.textContent = text; });
}
