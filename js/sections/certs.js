/* ==========================================================================
   sections/certs.js — A19 horizontal scroll pinned (desktop) / carousel swipe (mobile)
   ========================================================================== */
import { $, $$, motion, MQ, revealLines } from "../motion.js";

let mm = null;
const pad = (n) => String(n).padStart(2, "0");

export function init() {
  const pin = $("#certs-pin");
  const track = $("#certs-track");
  const cards = $$(".cert", track);
  const bar = $("#certs-bar");
  const count = $("#certs-count");
  const total = cards.length;

  const setActive = (idx) => {
    cards.forEach((c, i) => c.classList.toggle("is-active", i === idx));
    count.textContent = `${pad(idx + 1)} / ${pad(total)}`;
  };

  mm = gsap.matchMedia();

  mm.add(MQ.motion, () => { revealLines("#certs-title"); });

  /* ---------- Desktop: horizontal scroll yang di-pin ---------- */
  mm.add(`${MQ.motion} and ${MQ.desktop}`, () => {
    track.classList.add("is-pinned");
    const dist = () => Math.max(track.scrollWidth - window.innerWidth, 0);

    const tween = gsap.to(track, {
      x: () => -dist(),
      ease: "none",
      scrollTrigger: {
        trigger: pin,
        start: "top top",
        end: () => `+=${dist()}`,
        pin: true,
        scrub: motion.scroll.scrub,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate(self) {
          gsap.set(bar, { scaleX: Math.max(self.progress, 0.04) });
          // kartu aktif = yang paling dekat dengan pusat layar
          const mid = window.innerWidth / 2;
          let best = 0, bestD = Infinity;
          cards.forEach((c, i) => {
            const r = c.getBoundingClientRect();
            const d = Math.abs(r.left + r.width / 2 - mid);
            if (d < bestD) { bestD = d; best = i; }
          });
          setActive(best);
        }
      }
    });
    setActive(0);

    return () => {
      track.classList.remove("is-pinned");
      tween.kill();
      gsap.set(track, { clearProps: "transform" });
    };
  });

  /* ---------- Mobile / tablet / reduced-motion: carousel swipe ---------- */
  mm.add(`(max-width: 1023px), ${MQ.reduced}`, () => {
    track.classList.add("is-snap");
    const update = () => {
      const max = track.scrollWidth - track.clientWidth;
      gsap.set(bar, { scaleX: max > 0 ? Math.max(track.scrollLeft / max, 0.04) : 1 });
      const mid = track.scrollLeft + track.clientWidth / 2;
      let best = 0, bestD = Infinity;
      cards.forEach((c, i) => {
        const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid);
        if (d < bestD) { bestD = d; best = i; }
      });
      setActive(best);
    };
    track.addEventListener("scroll", update, { passive: true });
    update();
    return () => { track.removeEventListener("scroll", update); track.classList.remove("is-snap"); };
  });
}

export function destroy() { if (mm) mm.revert(); }
