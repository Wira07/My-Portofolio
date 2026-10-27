/* ==========================================================================
   sections/journey.js — A14 garis timeline SVG tergambar, A15 highlight sweep,
   node aktif, kartu & bullet muncul bertahap
   ========================================================================== */
import { $, $$, motion, MQ, revealLines } from "../motion.js";

let mm = null;

export function init() {
  mm = gsap.matchMedia();
  const items = $$(".journey__item");
  const timeline = $("#journey-timeline");

  mm.add(MQ.motion, () => {
    revealLines("#journey-title");

    // A14: garis SVG tergambar mengikuti scroll (stroke-dashoffset scrub)
    const svg = $("#journey-line");
    const draw = $("#journey-draw");
    const size = () => {
      const h = Math.ceil(svg.getBoundingClientRect().height);
      draw.style.strokeDasharray = h + 2;
      return h + 2;
    };
    gsap.fromTo(draw,
      { strokeDashoffset: size },
      { strokeDashoffset: 0, ease: "none",
        scrollTrigger: { trigger: timeline, start: "top 60%", end: "bottom 60%", scrub: motion.scroll.scrub, invalidateOnRefresh: true } });

    items.forEach((item) => {
      // node menyala saat garis mencapainya
      ScrollTrigger.create({ trigger: item, start: "top 62%", toggleClass: { targets: item, className: "is-active" } });

      gsap.from($(".journey__card", item), {
        y: 60, opacity: 0, duration: motion.dur.md, clearProps: "opacity,transform",
        scrollTrigger: { trigger: item, start: "top 82%", once: true }
      });
      const lis = $$("li", item);
      if (lis.length) {
        gsap.from(lis, {
          x: -16, opacity: 0, duration: 0.6, stagger: motion.stagger.items, delay: 0.25, clearProps: "opacity,transform",
          scrollTrigger: { trigger: item, start: "top 75%", once: true }
        });
      }
    });

    // A15: highlight "30%" — garis bawah menyapu
    $$("mark.hl").forEach((mark) => {
      gsap.set(mark, { "--hl": 0 });
      gsap.to(mark, {
        "--hl": 1, duration: motion.dur.md, ease: motion.ease.soft, delay: 0.2,
        scrollTrigger: { trigger: mark, start: "top 85%", once: true }
      });
    });

    return () => {
      items.forEach((i) => i.classList.remove("is-active"));
      draw.style.strokeDasharray = "";
      draw.style.strokeDashoffset = "";
    };
  });

  // Reduced motion: seluruh timeline tampil statis
  mm.add(MQ.reduced, () => {
    items.forEach((i) => i.classList.add("is-active"));
    $$("mark.hl").forEach((m) => m.style.setProperty("--hl", "1"));
  });
}

export function destroy() { if (mm) mm.revert(); }
