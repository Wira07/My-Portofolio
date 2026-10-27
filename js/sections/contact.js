/* ==========================================================================
   sections/contact.js — reveal teks raksasa, salin email (A22), jam lokal,
   kembali ke atas, parallax nama footer
   ========================================================================== */
import { $, $$, motion, MQ, revealLines, announce } from "../motion.js";
import * as smooth from "../smooth-scroll.js";

let mm = null;
let clockTimer = null;

export function init(meta) {
  mm = gsap.matchMedia();

  mm.add(MQ.motion, () => {
    revealLines("#contact-title", { duration: motion.dur.lg, stagger: 0.12 });
    gsap.from(["#contact-sub", ".contact__actions .btn", ".social li"], {
      y: 40, opacity: 0, duration: motion.dur.md, stagger: motion.stagger.items, clearProps: "opacity,transform",
      scrollTrigger: { trigger: "#contact-sub", start: "top 90%", once: true }
    });
    // parallax tipis nama raksasa di footer
    gsap.fromTo("#footer-name", { yPercent: 25 }, {
      yPercent: -8, ease: "none",
      scrollTrigger: { trigger: ".footer", start: "top bottom", end: "bottom bottom", scrub: true }
    });
  });

  /* ---------- A22: salin email + micro-feedback ---------- */
  const btn = $("#copy-email");
  const label = $("#copy-label");
  let resetT = null;
  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(meta.email);
    } catch (e) {
      const ta = document.createElement("textarea");
      ta.value = meta.email;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;opacity:0;pointer-events:none";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch (err) { /* abaikan */ }
      ta.remove();
    }
    announce("Email tersalin ke clipboard");
    clearTimeout(resetT);
    const swap = (text) => { label.textContent = text; };
    if (window.matchMedia(MQ.motion).matches) {
      gsap.timeline()
        .to(label, { yPercent: -60, opacity: 0, duration: 0.15, ease: "power2.in", onComplete: () => swap("Tersalin ✓") })
        .fromTo(label, { yPercent: 60 }, { yPercent: 0, opacity: 1, duration: 0.25, ease: motion.ease.out });
    } else swap("Tersalin ✓");
    resetT = setTimeout(() => {
      if (window.matchMedia(MQ.motion).matches) {
        gsap.timeline()
          .to(label, { yPercent: -60, opacity: 0, duration: 0.15, onComplete: () => swap("Salin email") })
          .fromTo(label, { yPercent: 60 }, { yPercent: 0, opacity: 1, duration: 0.25 });
      } else swap("Salin email");
    }, 1800);
  });

  /* ---------- Jam lokal Asia/Jakarta ---------- */
  const clock = $("#clock");
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const tick = () => { clock.textContent = fmt.format(new Date()); };
  tick();
  clockTimer = setInterval(tick, 1000);

  /* ---------- Kembali ke atas ---------- */
  $("#to-top").addEventListener("click", () => smooth.scrollTo(0));
}

export function destroy() {
  if (mm) mm.revert();
  clearInterval(clockTimer);
}
