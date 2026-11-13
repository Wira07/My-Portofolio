/* ==========================================================================
   sections/journey.js — A14 garis timeline SVG tergambar, A15 highlight sweep,
   filter fase perjalanan (Kerja, Freelance, Kuliah, Prestasi), node & kartu
   ========================================================================== */
import { $, $$, motion, MQ, revealLines, announce } from "../motion.js";

let mm = null;

export function init() {
  mm = gsap.matchMedia();
  const items = $$(".journey__item");
  const timeline = $("#journey-timeline");
  const filters = $("#journey-filters");

  mm.add(MQ.motion, () => {
    revealLines("#journey-title");

    gsap.from(".journey__intro, .journey__filter", {
      y: 22,
      opacity: 0,
      duration: motion.dur.md,
      stagger: 0.06,
      ease: motion.ease.out,
      clearProps: "opacity,transform",
      scrollTrigger: { trigger: "#journey", start: "top 82%", once: true }
    });

    // A14: garis SVG tergambar mengikuti scroll (stroke-dashoffset scrub)
    const svg = $("#journey-line");
    const draw = $("#journey-draw");
    const size = () => {
      const h = Math.ceil(svg.getBoundingClientRect().height);
      draw.style.strokeDasharray = h + 2;
      return h + 2;
    };
    gsap.fromTo(
      draw,
      { strokeDashoffset: size },
      {
        strokeDashoffset: 0,
        ease: "none",
        scrollTrigger: {
          trigger: timeline,
          start: "top 60%",
          end: "bottom 60%",
          scrub: motion.scroll.scrub,
          invalidateOnRefresh: true
        }
      }
    );

    items.forEach((item) => {
      // node menyala saat garis mencapainya
      ScrollTrigger.create({
        trigger: item,
        start: "top 65%",
        toggleClass: { targets: item, className: "is-active" }
      });

      gsap.from($(".journey__card", item), {
        y: 52,
        opacity: 0,
        duration: motion.dur.md,
        clearProps: "opacity,transform",
        scrollTrigger: { trigger: item, start: "top 85%", once: true }
      });
      const lis = $$(".journey__points li", item);
      if (lis.length) {
        gsap.from(lis, {
          x: -16,
          opacity: 0,
          duration: 0.55,
          stagger: 0.06,
          delay: 0.2,
          clearProps: "opacity,transform",
          scrollTrigger: { trigger: item, start: "top 80%", once: true }
        });
      }
    });

    // A15: highlight ("30%", "Juara 2", "Predikat Pujian") — garis bawah menyapu
    $$("mark.hl").forEach((mark) => {
      gsap.set(mark, { "--hl": 0 });
      gsap.to(mark, {
        "--hl": 1,
        duration: motion.dur.md,
        ease: motion.ease.soft,
        delay: 0.2,
        scrollTrigger: { trigger: mark, start: "top 85%", once: true }
      });
    });

    return () => {
      items.forEach((i) => i.classList.remove("is-active"));
      draw.style.strokeDasharray = "";
      draw.style.strokeDashoffset = "";
    };
  });

  // Filter interaktif per fase (Semua, Karir Kerja, Freelance, Masa Kuliah, Program & Prestasi)
  if (filters) {
    filters.addEventListener("click", (e) => {
      const btn = e.target.closest(".journey__filter");
      if (!btn) return;
      const key = btn.dataset.jfilter;

      $$(".journey__filter", filters).forEach((b) => {
        b.setAttribute("aria-pressed", String(b === btn));
      });

      let shown = 0;
      items.forEach((li) => {
        const t = li.dataset.jtype;
        const match =
          key === "all" ||
          (key === "program-award" ? t === "program" || t === "award" : t === key);
        li.classList.toggle("is-filtered-out", !match);
        if (match) shown++;
      });

      timeline.classList.toggle("is-filtered", key !== "all");
      announce(`${shown} fase perjalanan ditampilkan`);

      if (window.matchMedia(MQ.motion).matches) {
        const visibleCards = items
          .filter((li) => !li.classList.contains("is-filtered-out"))
          .map((li) => $(".journey__card", li));
        gsap.fromTo(
          visibleCards,
          { opacity: 0, y: 24 },
          { opacity: 1, y: 0, duration: 0.45, stagger: 0.05, ease: motion.ease.out, clearProps: "opacity,transform" }
        );
      }

      setTimeout(() => ScrollTrigger.refresh(), 100);
    });
  }

  // Reduced motion: seluruh timeline tampil statis
  mm.add(MQ.reduced, () => {
    items.forEach((i) => i.classList.add("is-active"));
    $$("mark.hl").forEach((m) => m.style.setProperty("--hl", "1"));
  });
}

export function destroy() {
  if (mm) mm.revert();
}
