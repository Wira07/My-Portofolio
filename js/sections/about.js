/* ==========================================================================
   sections/about.js — A9 teks terisi mengikuti scroll, A10 counter,
   A11 image mask reveal + parallax, A8 reveal judul
   ========================================================================== */
import { $, $$, motion, MQ, revealLines } from "../motion.js";

let mm = null;

export function init() {
  mm = gsap.matchMedia();

  mm.add(MQ.motion, () => {
    // Judul: reveal per baris (Tentang + Cerita Saya)
    revealLines("#about-title");
    if ($("#about-story-title")) {
      revealLines("#about-story-title");
    }

    // A11: potret — mask reveal dari bawah + parallax isi
    const portrait = $("#about-portrait");
    const inner = $("#about-portrait-inner");
    gsap.fromTo(portrait,
      { clipPath: "inset(100% 0% 0% 0%)" },
      { clipPath: "inset(0% 0% 0% 0%)", duration: motion.dur.lg, ease: motion.ease.inOut,
        scrollTrigger: { trigger: portrait, start: "top 85%", once: true } });
    gsap.fromTo(inner,
      { yPercent: -4, scale: 1.07 },
      { yPercent: 4, scale: 1.07, ease: "none",
        scrollTrigger: { trigger: portrait, start: "top bottom", end: "bottom top", scrub: true } });
    gsap.from([".about__tag", ".about__chips .chip"], {
      y: 24, opacity: 0, duration: motion.dur.md, stagger: motion.stagger.items, clearProps: "opacity,transform",
      scrollTrigger: { trigger: ".about__chips", start: "top 92%", once: true }
    });

    // A9: seluruh paragraf .about__summary (termasuk Cerita Saya) — kata per kata terisi mengikuti scroll
    $$(".about__summary").forEach((el) => {
      const split = SplitText.create(el, {
        type: "words",
        wordsClass: "word",
        tag: "span",
        aria: "none"
      });
      gsap.fromTo(
        split.words,
        { opacity: 0.65 },
        {
          opacity: 1,
          ease: "none",
          stagger: 0.08,
          scrollTrigger: { trigger: el, start: "top 86%", end: "bottom 60%", scrub: true }
        }
      );
    });

    // A10: counter angka
    $$(".stat__num").forEach((el) => {
      const value = Number(el.dataset.value);
      const suffix = el.dataset.suffix || "";
      const o = { v: 0 };
      el.textContent = `0${suffix}`;
      gsap.to(o, {
        v: value, duration: motion.dur.xl, ease: motion.ease.soft,
        onUpdate: () => { el.textContent = `${Math.round(o.v)}${suffix}`; },
        scrollTrigger: { trigger: el, start: "top 92%", once: true }
      });
    });
    gsap.from(".stat", {
      y: 40, opacity: 0, duration: motion.dur.md, stagger: motion.stagger.items, clearProps: "opacity,transform",
      scrollTrigger: { trigger: "#stats", start: "top 90%", once: true }
    });
  });
}

export function destroy() { if (mm) mm.revert(); }
