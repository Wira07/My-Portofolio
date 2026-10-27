/* ==========================================================================
   smooth-scroll.js — Lenis + sinkron ScrollTrigger (A5)
   ========================================================================== */
import { prefersReduced } from "./motion.js";

let lenis = null;

const tick = (time) => lenis && lenis.raf(time * 1000);

export function init() {
  if (prefersReduced() || typeof Lenis === "undefined") return null;
  lenis = new Lenis({ lerp: 0.1, smoothWheel: true, anchors: false });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);
  return lenis;
}

export function destroy() {
  if (!lenis) return;
  gsap.ticker.remove(tick);
  lenis.destroy();
  lenis = null;
}

export const get = () => lenis;
export const stop = () => lenis && lenis.stop();
export const start = () => lenis && lenis.start();

export function scrollTo(target, opts = {}) {
  if (lenis) {
    lenis.scrollTo(target, { duration: 1.4, easing: (t) => 1 - Math.pow(1 - t, 4), ...opts });
    return;
  }
  if (typeof target === "number") { window.scrollTo(0, target); return; }
  const el = typeof target === "string" ? document.querySelector(target) : target;
  if (el) el.scrollIntoView();
}

/** Link anchor internal (#id) memakai scroll mulus */
export function bindAnchors(onNavigate) {
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const hash = a.getAttribute("href");
    if (!hash || hash === "#") return;
    const target = document.querySelector(hash);
    if (!target) return;
    e.preventDefault();
    if (onNavigate) onNavigate();
    scrollTo(hash === "#hero" ? 0 : target);
    history.pushState(null, "", hash);
    // pindahkan fokus agar pengguna keyboard / screen reader ikut berpindah
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  });
}
