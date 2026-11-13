/* ==========================================================================
   scroll-motion.js — Animasi scroll tingkat "profesional" (tidak ramai):
   1) Cahaya latar (ambient) yang berganti warna & posisi mengikuti section aktif
   2) Garis pembuka section yang "tergambar" dari tengah saat section masuk
   3) Garis eyebrow (••—) yang memanjang saat judul section muncul
   4) Judul section bergeser pelan (parallax kedalaman) saat di-scroll
   5) Gambar thumbnail proyek: zoom-out + parallax halus mengikuti scroll
   6) Momentum skew halus pada baris proyek berdasarkan kecepatan scroll
   ========================================================================== */
import { $, $$, MQ } from "./motion.js";

let mm = null;

/** Warna & posisi cahaya latar per section: [r,g,b, x%, y%] */
const TINTS = {
  hero:       [61, 220, 132, 78, 28],
  about:      [61, 220, 132, 16, 30],
  skills:     [56, 189, 248, 84, 24],
  journey:    [168, 85, 247, 14, 40],
  highlights: [250, 204, 21, 86, 30],
  projects:   [47, 107, 255, 12, 34],
  certs:      [61, 220, 132, 80, 46],
  contact:    [56, 189, 248, 50, 70]
};

export function init() {
  mm = gsap.matchMedia();

  mm.add(MQ.motion, () => {
    const cleanups = [];

    /* ---------- 1) Cahaya latar yang mengikuti section aktif ---------- */
    const ambient = document.createElement("div");
    ambient.className = "scroll-ambient";
    ambient.setAttribute("aria-hidden", "true");
    document.body.prepend(ambient);
    cleanups.push(() => ambient.remove());

    const setTint = (id) => {
      const t = TINTS[id] || TINTS.hero;
      ambient.style.setProperty("--amb", `rgb(${t[0]}, ${t[1]}, ${t[2]})`);
      ambient.style.setProperty("--amb-x", `${t[3]}%`);
      ambient.style.setProperty("--amb-y", `${t[4]}%`);
    };
    setTint("hero");

    $$("#main > section").forEach((sec) => {
      const id = sec.id || "hero";
      ScrollTrigger.create({
        trigger: sec,
        start: "top 55%",
        end: "bottom 55%",
        onToggle: (self) => { if (self.isActive) setTint(id); }
      });
    });

    /* ---------- 2) Garis pembuka tiap section ---------- */
    $$("#main > section.section").forEach((sec) => {
      const rule = document.createElement("span");
      rule.className = "section-rule";
      rule.setAttribute("aria-hidden", "true");
      sec.prepend(rule);
      gsap.fromTo(
        rule,
        { scaleX: 0, opacity: 0 },
        {
          scaleX: 1, opacity: 1, duration: 1.5, ease: "expo.out",
          scrollTrigger: { trigger: sec, start: "top 82%", once: true }
        }
      );
      cleanups.push(() => rule.remove());
    });

    /* ---------- 3) Garis eyebrow memanjang ---------- */
    $$(".section__eyebrow").forEach((el) => {
      gsap.fromTo(
        el,
        { "--eb": 0 },
        {
          "--eb": 1, duration: 1.1, ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 92%", once: true }
        }
      );
    });

    /* ---------- 4) Parallax kedalaman pada kepala section ---------- */
    $$("#main .section__head").forEach((head) => {
      if (head.closest(".certs")) return; // section sertifikat memakai pin horizontal
      gsap.fromTo(
        head,
        { yPercent: 6 },
        {
          yPercent: -8, ease: "none",
          scrollTrigger: { trigger: head, start: "top bottom", end: "bottom top", scrub: 0.6 }
        }
      );
    });

    /* ---------- 5) Parallax + zoom halus gambar thumbnail proyek ---------- */
    $$(".project__thumb-img").forEach((img) => {
      const row = img.closest(".project");
      gsap.fromTo(
        img,
        { scale: 1.2, yPercent: -5 },
        {
          scale: 1, yPercent: 5, ease: "none",
          scrollTrigger: { trigger: row, start: "top bottom", end: "bottom top", scrub: 0.5 }
        }
      );
    });

    /* ---------- 6) Momentum skew halus berdasarkan kecepatan scroll ---------- */
    const infos = $$(".project__info");
    if (infos.length) {
      gsap.set(infos, { transformOrigin: "0% 50%" });
      const skewTo = gsap.quickTo(infos, "skewY", { duration: 0.6, ease: "power3" });
      ScrollTrigger.create({
        trigger: "#projects",
        start: "top bottom",
        end: "bottom top",
        onUpdate: (self) => skewTo(gsap.utils.clamp(-1.4, 1.4, self.getVelocity() / -520)),
        onLeave: () => skewTo(0),
        onLeaveBack: () => skewTo(0)
      });
      const reset = () => skewTo(0);
      ScrollTrigger.addEventListener("scrollEnd", reset);
      cleanups.push(() => {
        ScrollTrigger.removeEventListener("scrollEnd", reset);
        gsap.set(infos, { clearProps: "transform" });
      });
    }

    // Posisi baris proyek berubah setelah filter (Flip) -> hitung ulang trigger scrub
    const filters = $("#project-filters");
    if (filters) {
      const onFilter = () => setTimeout(() => ScrollTrigger.refresh(), 850);
      filters.addEventListener("click", onFilter);
      cleanups.push(() => filters.removeEventListener("click", onFilter));
    }

    return () => cleanups.forEach((fn) => fn());
  });
}

export function destroy() { if (mm) mm.revert(); }

