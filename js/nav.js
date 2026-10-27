/* ==========================================================================
   nav.js — navigasi: auto-hide, link aktif (indikator), progress bar,
   menu mobile dengan clip-path circle reveal (A7, A20)
   ========================================================================== */
import { $, $$, motion, MQ } from "./motion.js";
import * as smooth from "./smooth-scroll.js";

const html = document.documentElement;
let mm = null;
let menuOpen = false;
let closeMenuFn = () => {};

export function closeMenu() { closeMenuFn(); }

export function init() {
  const nav = $("#nav");
  const links = $$("[data-nav]");
  const indicator = $(".nav__indicator");
  const linkWrap = $("#nav-links");
  const toggle = $("#menu-toggle");
  const menu = $("#mobile-menu");
  const menuLinks = $$("a", menu);
  const progress = $("#progress");

  /* --- Progress bar scroll (A7) --- */
  gsap.to(progress, {
    scaleX: 1,
    ease: "none",
    scrollTrigger: { start: 0, end: "max", scrub: motion.scroll.scrub }
  });

  /* --- Auto-hide + latar saat scroll --- */
  ScrollTrigger.create({
    start: 0,
    end: "max",
    onUpdate(self) {
      const y = self.scroll();
      nav.classList.toggle("is-scrolled", y > 24);
      if (menuOpen) return;
      if (y > 240 && self.direction === 1) nav.classList.add("is-hidden");
      else if (self.direction === -1 || y <= 240) nav.classList.remove("is-hidden");
    }
  });
  // tampilkan nav saat fokus keyboard masuk ke dalamnya
  nav.addEventListener("focusin", () => nav.classList.remove("is-hidden"));

  /* --- Link aktif + indikator (garis bawah bergeser) --- */
  const moveIndicator = (link, instant = false) => {
    if (!link || !linkWrap.offsetParent) return;
    const wrap = linkWrap.getBoundingClientRect();
    const r = link.getBoundingClientRect();
    const x = r.left - wrap.left + 16;
    const w = Math.max(r.width - 32, 1);
    gsap.to(indicator, { x, scaleX: w, opacity: 1, duration: instant ? 0 : motion.dur.sm, ease: motion.ease.out, overwrite: "auto" });
  };
  let activeLink = null;
  const setActive = (id) => {
    activeLink = links.find((a) => a.getAttribute("href") === `#${id}`) || null;
    links.forEach((a) => {
      const on = a === activeLink;
      a.classList.toggle("is-active", on);
      if (on) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
    });
    if (activeLink) moveIndicator(activeLink);
    else gsap.to(indicator, { opacity: 0, duration: motion.dur.sm });
  };
  links.forEach((a) => {
    const id = a.getAttribute("href").slice(1);
    const section = document.getElementById(id);
    if (!section) return;
    ScrollTrigger.create({
      trigger: section,
      start: "top 55%",
      end: "bottom 55%",
      onToggle: (self) => { if (self.isActive) setActive(id); else if (activeLink === a) setActive(""); }
    });
  });
  window.addEventListener("resize", () => moveIndicator(activeLink, true));

  /* --- Menu mobile (clip-path circle reveal) --- */
  const origin = () => {
    const r = toggle.getBoundingClientRect();
    return `${r.left + r.width / 2}px ${r.top + r.height / 2}px`;
  };
  const maxR = () => Math.hypot(window.innerWidth, window.innerHeight) + 40;

  mm = gsap.matchMedia();
  mm.add(MQ.motion, () => {
    const openMenu = () => {
      menuOpen = true;
      menu.removeAttribute("inert");
      menu.classList.add("is-open");
      toggle.setAttribute("aria-expanded", "true");
      toggle.setAttribute("aria-label", "Tutup menu");
      nav.classList.remove("is-hidden");
      html.classList.add("menu-open");
      smooth.stop();
      gsap.fromTo(menu, { clipPath: `circle(0px at ${origin()})` }, { clipPath: `circle(${maxR()}px at ${origin()})`, duration: 0.7, ease: motion.ease.inOut });
      gsap.fromTo(menuLinks.concat($$(".menu__foot .btn", menu)), { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: motion.dur.md, stagger: motion.stagger.items, delay: 0.25 });
    };
    closeMenuFn = () => {
      if (!menuOpen) return;
      menuOpen = false;
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Buka menu");
      html.classList.remove("menu-open");
      smooth.start();
      menu.setAttribute("inert", "");
      gsap.to(menu, {
        clipPath: `circle(0px at ${origin()})`, duration: 0.55, ease: motion.ease.inOut,
        onComplete: () => menu.classList.remove("is-open")
      });
    };
    const onToggle = () => (menuOpen ? closeMenuFn() : openMenu());
    toggle.addEventListener("click", onToggle);
    menuLinks.forEach((a) => a.addEventListener("click", closeMenuFn));
    return () => {
      toggle.removeEventListener("click", onToggle);
      menuLinks.forEach((a) => a.removeEventListener("click", closeMenuFn));
    };
  });

  // Reduced motion: menu tampil/hilang tanpa animasi clip-path
  mm.add(MQ.reduced, () => {
    const set = (open) => {
      menuOpen = open;
      menu.classList.toggle("is-open", open);
      menu.style.clipPath = open ? "none" : "";
      if (open) menu.removeAttribute("inert"); else menu.setAttribute("inert", "");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Tutup menu" : "Buka menu");
      html.classList.toggle("menu-open", open);
    };
    closeMenuFn = () => set(false);
    const onToggle = () => set(!menuOpen);
    toggle.addEventListener("click", onToggle);
    menuLinks.forEach((a) => a.addEventListener("click", closeMenuFn));
    return () => {
      toggle.removeEventListener("click", onToggle);
      menuLinks.forEach((a) => a.removeEventListener("click", closeMenuFn));
    };
  });

  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && menuOpen) { closeMenuFn(); toggle.focus(); } });
  // menu ditutup otomatis saat layar melebar ke desktop
  window.matchMedia(MQ.desktop).addEventListener("change", (e) => { if (e.matches) closeMenuFn(); });
}

export function destroy() { if (mm) mm.revert(); }
