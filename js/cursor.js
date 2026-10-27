/* ==========================================================================
   cursor.js — kursor kustom (A6) + tombol magnetic
   Hanya perangkat `hover: hover` & `pointer: fine`, dan bukan reduced-motion.
   ========================================================================== */
import { $, $$, MQ } from "./motion.js";

const enabled = () => window.matchMedia(MQ.fine).matches && window.matchMedia(MQ.motion).matches;

export function init() {
  if (!enabled()) return;

  const dot = $(".cursor__dot");
  const ring = $(".cursor__ring");
  const label = $(".cursor__label");
  if (!dot || !ring || !label) return;

  gsap.set([dot, ring, label], { xPercent: -50, yPercent: -50 });

  const xDot = gsap.quickTo(dot, "x", { duration: 0.1, ease: "power3" });
  const yDot = gsap.quickTo(dot, "y", { duration: 0.1, ease: "power3" });
  const xRing = gsap.quickTo(ring, "x", { duration: 0.3, ease: "power3" });
  const yRing = gsap.quickTo(ring, "y", { duration: 0.3, ease: "power3" });
  const xLab = gsap.quickTo(label, "x", { duration: 0.3, ease: "power3" });
  const yLab = gsap.quickTo(label, "y", { duration: 0.3, ease: "power3" });

  let shown = false;
  const show = (v) => {
    if (shown === v) return;
    shown = v;
    gsap.to([dot, ring], { opacity: v ? 1 : 0, duration: 0.3, overwrite: "auto" });
    if (!v) gsap.to(label, { opacity: 0, duration: 0.2 });
  };

  window.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return;
    show(true);
    xDot(e.clientX); yDot(e.clientY);
    xRing(e.clientX); yRing(e.clientY);
    xLab(e.clientX); yLab(e.clientY);
  }, { passive: true });

  document.addEventListener("mouseleave", () => show(false));
  document.addEventListener("mouseenter", () => show(true));

  let state = "idle";
  const setState = (next, text = "") => {
    if (next === state && label.textContent === text) return;
    state = next;
    ring.classList.toggle("is-active", next === "link");
    ring.classList.toggle("is-view", next === "view");
    label.textContent = text;
    gsap.to(ring, { scale: next === "view" ? 2.4 : next === "link" ? 1.6 : 1, duration: 0.4, ease: "expo.out", overwrite: "auto" });
    gsap.to(dot, { scale: next === "idle" ? 1 : 0.4, duration: 0.3, overwrite: "auto" });
    gsap.to(label, { opacity: next === "view" ? 1 : 0, duration: 0.25, overwrite: "auto" });
  };

  document.addEventListener("pointerover", (e) => {
    const view = e.target.closest('[data-cursor="view"]');
    if (view) return setState("view", view.dataset.cursorLabel || "Lihat");
    if (e.target.closest("a, button, [data-cursor]")) return setState("link");
    setState("idle");
  });

  document.documentElement.classList.add("cursor-on");
}

/** Tombol magnetic: elemen tertarik ke arah kursor saat mendekat */
export function initMagnetic() {
  if (!enabled()) return;
  $$("[data-magnetic]").forEach((el) => {
    const xTo = gsap.quickTo(el, "x", { duration: 0.8, ease: "elastic.out(1, 0.45)" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.8, ease: "elastic.out(1, 0.45)" });
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * 0.3);
      yTo((e.clientY - (r.top + r.height / 2)) * 0.3);
    });
    el.addEventListener("pointerleave", () => { xTo(0); yTo(0); });
  });
}
