import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

let activeLenis: Lenis | null = null;
let rafId: number | null = null;

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  return (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.dataset.reducedMotion === "true"
  );
}

export function destroyMotion(): void {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  if (activeLenis) {
    activeLenis.destroy();
    activeLenis = null;
  }
  ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
}

export function initStudioMotion(): void {
  if (typeof window === "undefined") return;
  destroyMotion();

  const root = document.documentElement;
  if (prefersReducedMotion()) {
    root.dataset.motionDisabled = "true";
    document.querySelectorAll<HTMLElement>("[data-reveal], [data-hero-line]").forEach((el) => {
      el.style.opacity = "1";
      el.style.transform = "none";
    });
    document.querySelectorAll<HTMLElement>("[data-count-to]").forEach((el) => {
      const target = el.dataset.countTo;
      if (target) el.textContent = target;
    });
    const processTrack = document.querySelector<HTMLElement>("[data-process-fill]");
    if (processTrack) processTrack.style.transform = "scaleY(1)";
    return;
  }

  root.dataset.motionDisabled = "false";
  gsap.registerPlugin(ScrollTrigger);

  // Smooth scroll via Lenis synced cleanly with ScrollTrigger
  const lenis = new Lenis({
    duration: 1.05,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true
  });
  activeLenis = lenis;
  lenis.on("scroll", ScrollTrigger.update);

  const tick = (time: number) => {
    lenis.raf(time);
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);

  // 1. Hero staggered line reveals
  const heroLines = gsap.utils.toArray<HTMLElement>("[data-hero-line]");
  if (heroLines.length) {
    gsap.fromTo(
      heroLines,
      { yPercent: 28, opacity: 0 },
      {
        yPercent: 0,
        opacity: 1,
        duration: 0.72,
        stagger: 0.08,
        ease: "power3.out",
        clearProps: "transform"
      }
    );
  }

  // 2. Editorial hairline grid sweeps
  gsap.utils.toArray<HTMLElement>("[data-line-draw]").forEach((line) => {
    gsap.fromTo(
      line,
      { scaleX: 0, transformOrigin: "left center" },
      {
        scaleX: 1,
        duration: 0.7,
        ease: "power3.out",
        scrollTrigger: {
          trigger: line,
          start: "top 92%",
          once: true
        }
      }
    );
  });

  // 3. Controlled section/card reveals
  gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el) => {
    gsap.fromTo(
      el,
      { y: 18, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.58,
        ease: "power3.out",
        clearProps: "transform",
        scrollTrigger: {
          trigger: el,
          start: "top 88%",
          once: true
        }
      }
    );
  });

  // 4. Case cover gentle 8% parallax
  gsap.utils.toArray<HTMLElement>("[data-parallax-img]").forEach((img) => {
    gsap.fromTo(
      img,
      { yPercent: -4 },
      {
        yPercent: 4,
        ease: "none",
        scrollTrigger: {
          trigger: img.parentElement ?? img,
          start: "top bottom",
          end: "bottom top",
          scrub: true
        }
      }
    );
  });

  // 5. Process timeline scroll line progress
  const processFill = document.querySelector<HTMLElement>("[data-process-fill]");
  const processWrap = document.querySelector<HTMLElement>("[data-process-wrap]");
  if (processFill && processWrap) {
    gsap.fromTo(
      processFill,
      { scaleY: 0, transformOrigin: "top center" },
      {
        scaleY: 1,
        ease: "none",
        scrollTrigger: {
          trigger: processWrap,
          start: "top 70%",
          end: "bottom 70%",
          scrub: true
        }
      }
    );
  }

  // 6. Architecture SVG path drawing
  gsap.utils.toArray<SVGGeometryElement>("[data-arch-edge]").forEach((edge, idx) => {
    const len = typeof edge.getTotalLength === "function" ? edge.getTotalLength() : 160;
    gsap.set(edge, { strokeDasharray: len, strokeDashoffset: len });
    gsap.to(edge, {
      strokeDashoffset: 0,
      duration: 0.65,
      delay: Math.min(idx * 0.08, 0.4),
      ease: "power2.out",
      scrollTrigger: {
        trigger: edge.closest("svg") ?? edge,
        start: "top 85%",
        once: true
      }
    });
  });

  // 7. Metric numeric counter animation (numeric values only)
  gsap.utils.toArray<HTMLElement>("[data-count-to]").forEach((el) => {
    const raw = el.dataset.countTo || "";
    const match = raw.match(/^(\d+(?:\.\d+)?)(.*)$/);
    if (!match) return;
    const endNum = parseFloat(match[1]);
    const suffix = match[2] || "";
    const obj = { val: 0 };
    ScrollTrigger.create({
      trigger: el,
      start: "top 90%",
      once: true,
      onEnter: () => {
        gsap.to(obj, {
          val: endNum,
          duration: 0.75,
          ease: "power2.out",
          onUpdate: () => {
            el.textContent = `${Number.isInteger(endNum) ? Math.round(obj.val) : obj.val.toFixed(1)}${suffix}`;
          }
        });
      }
    });
  });

  // 8. Magnetic buttons (<= 7px shift, desktop hover only)
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    document.querySelectorAll<HTMLElement>("[data-magnetic]").forEach((btn) => {
      if (btn.dataset.magneticBound === "true") return;
      btn.dataset.magneticBound = "true";
      btn.addEventListener("pointermove", (e) => {
        const rect = btn.getBoundingClientRect();
        const relX = ((e.clientX - rect.left) / rect.width - 0.5) * 12;
        const relY = ((e.clientY - rect.top) / rect.height - 0.5) * 10;
        gsap.to(btn, { x: relX, y: relY, duration: 0.25, ease: "power2.out" });
      });
      btn.addEventListener("pointerleave", () => {
        gsap.to(btn, { x: 0, y: 0, duration: 0.35, ease: "power3.out" });
      });
    });
  }
}

