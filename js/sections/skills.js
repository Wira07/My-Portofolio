/* ==========================================================================
   sections/skills.js — A12 marquee reaktif scroll, A13 kartu 3D tilt + spotlight,
   chip stagger saat masuk viewport
   ========================================================================== */
import { $, $$, motion, MQ, revealLines } from "../motion.js";

let mm = null;

export function init() {
  mm = gsap.matchMedia();

  mm.add(MQ.motion, () => {
    revealLines("#skills-title");

    /* ---------- A12: marquee dua baris, arah & kecepatan mengikuti scroll ---------- */
    const marquee = $("#marquee");
    marquee.classList.add("is-live");
    const rows = $$(".marquee__row", marquee).map((row, i) => {
      const track = $(".marquee__track", row);
      const group = $(".marquee__group", track);
      return { track, group, dir: i % 2 === 0 ? -1 : 1, x: 0, w: 0, set: gsap.quickSetter(track, "x", "px") };
    });
    const measure = () => rows.forEach((r) => { r.w = r.group.getBoundingClientRect().width; r.x = gsap.utils.wrap(-r.w, 0, r.x); });
    measure();
    ScrollTrigger.addEventListener("refresh", measure);

    let lastY = window.scrollY;
    let vel = 0;        // px/s (berteken arah), diperhalus
    let dirFactor = 1;  // 1 = searah awal, -1 = terbalik (scroll naik)
    const BASE = 70;    // px/s
    const tick = (time, deltaMs) => {
      const dt = Math.min(deltaMs, 64) / 1000;
      if (!dt) return;
      const y = window.scrollY;
      const v = (y - lastY) / dt;
      lastY = y;
      vel += (v - vel) * Math.min(1, dt * 8);
      if (Math.abs(vel) > 40) dirFactor += (Math.sign(vel) - dirFactor) * Math.min(1, dt * 6);
      const boost = Math.min(Math.abs(vel) * 0.18, 700);
      const speed = BASE + boost;
      rows.forEach((r) => {
        if (!r.w) return;
        r.x = gsap.utils.wrap(-r.w, 0, r.x + r.dir * dirFactor * speed * dt);
        r.set(r.x);
      });
    };
    gsap.ticker.add(tick);

    /* ---------- Chip masuk bertahap ---------- */
    $$(".skill-card").forEach((card) => {
      gsap.from(card, {
        y: 60, opacity: 0, duration: motion.dur.md, clearProps: "opacity,transform",
        scrollTrigger: { trigger: card, start: "top 90%", once: true }
      });
      gsap.from($$(".chip", card), {
        y: 18, opacity: 0, duration: 0.6, stagger: 0.05, delay: 0.15, clearProps: "opacity,transform",
        scrollTrigger: { trigger: card, start: "top 85%", once: true }
      });
    });

    return () => {
      gsap.ticker.remove(tick);
      ScrollTrigger.removeEventListener("refresh", measure);
      marquee.classList.remove("is-live");
      rows.forEach((r) => gsap.set(r.track, { clearProps: "transform" }));
    };
  });

  /* ---------- A13: tilt 3D + spotlight (desktop, tanpa reduced-motion) ---------- */
  mm.add(`${MQ.motion} and ${MQ.fine}`, () => {
    const ac = new AbortController();
    $$(".skill-card").forEach((card) => {
      const rx = gsap.quickTo(card, "rotationX", { duration: 0.4, ease: "power3" });
      const ry = gsap.quickTo(card, "rotationY", { duration: 0.4, ease: "power3" });
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        ry((px - 0.5) * 12);
        rx(-(py - 0.5) * 12);
        card.style.setProperty("--mx", `${px * 100}%`);
        card.style.setProperty("--my", `${py * 100}%`);
      }, { signal: ac.signal });
      card.addEventListener("pointerleave", () => { rx(0); ry(0); }, { signal: ac.signal });
    });
    return () => {
      ac.abort();
      gsap.set(".skill-card", { clearProps: "transform" });
    };
  });
}

export function destroy() { if (mm) mm.revert(); }
