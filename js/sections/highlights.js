/* ==========================================================================
   sections/highlights.js — Sorotan & Eksplorasi 3D:
   - Reveal 3D perspektif saat scroll (ScrollTrigger)
   - Multi-layer 3D cursor tilt + holographic glare sheen + Z-depth parallax
   - Mode tampilan interaktif: Bento 3D ↔ Orbit 3D (Coverflow 3D Stage)
   - Shared-element 3D Lightbox Modal (Flip) dengan navigasi antar-sorotan
   ========================================================================== */
import { $, $$, motion, MQ, revealLines, announce } from "../motion.js";
import * as smooth from "../smooth-scroll.js";

const html = document.documentElement;
let mm = null;

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = (n) => String(n).padStart(2, "0");

export function init(highlightsData) {
  if (!highlightsData || !Array.isArray(highlightsData.items)) return;
  const items = highlightsData.items;
  const byId = new Map(items.map((it) => [it.id, it]));

  const section = $("#highlights");
  const stage = $("#highlights-stage");
  const grid = $("#highlights-grid");
  const deckNav = $("#hl-deck-nav");
  const prevBtn = $("#hl-prev");
  const nextBtn = $("#hl-next");
  const dotsWrap = $("#hl-dots");
  const counterEl = $("#hl-counter");
  const modeBtns = $$("[data-hl-mode]", section);

  // Modal elements
  const modal = $("#hl-modal");
  const panel = $("#hl-modal-panel");
  const backdrop = $("#hl-modal-backdrop");
  const closeBtn = $("#hl-modal-close");
  const contentEl = $("#hl-modal-content");

  if (!section || !stage || !grid) return;

  const cards = $$(".hl-card", grid);
  let mode = "bento"; // "bento" | "showcase"
  let activeIndex = 0;

  // Modal state
  let isOpen = false;
  let closing = false;
  let lastFocus = null;
  let sourceEl = null;
  let activeModalItem = null;

  mm = gsap.matchMedia();

  /* ---------- 1. Scroll-Driven 3D Entrance ---------- */
  mm.add(MQ.motion, () => {
    revealLines("#highlights-title");

    gsap.from("#highlights-sub, .hl-controls", {
      y: 28,
      opacity: 0,
      duration: motion.dur.md,
      stagger: 0.1,
      ease: motion.ease.out,
      clearProps: "opacity,transform",
      scrollTrigger: { trigger: "#highlights", start: "top 82%", once: true }
    });

    cards.forEach((card, i) => {
      const inner = $(".hl-card__inner", card);
      const pic = $(".hl-card__pic", card);
      const points = $$(".hl-card__points li", card);
      const chips = $$(".hl-card__tags .chip", card);

      const tl = gsap.timeline({
        scrollTrigger: { trigger: card, start: "top 88%", once: true }
      });

      tl.fromTo(
        inner,
        {
          opacity: 0,
          y: 72,
          rotationX: -16,
          rotationY: i % 2 === 0 ? 10 : -10,
          scale: 0.92,
          transformPerspective: 1400
        },
        {
          opacity: 1,
          y: 0,
          rotationX: 0,
          rotationY: 0,
          scale: 1,
          duration: 1.05,
          ease: motion.ease.out,
          clearProps: "opacity,transform"
        },
        0
      );

      if (pic) {
        tl.fromTo(
          pic,
          { scale: 1.14 },
          { scale: 1, duration: 1.2, ease: motion.ease.out, clearProps: "transform" },
          0.05
        );
      }

      if (points.length) {
        tl.fromTo(
          points,
          { y: 18, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.55, stagger: 0.06, ease: motion.ease.out, clearProps: "opacity,transform" },
          0.32
        );
      }

      if (chips.length) {
        tl.fromTo(
          chips,
          { scale: 0.85, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.45, stagger: 0.04, ease: "back.out(1.7)", clearProps: "opacity,transform" },
          0.42
        );
      }
    });
  });

  /* ---------- 2. Multi-Layer 3D Cursor Tilt & Glare (Desktop Fine Pointer) ---------- */
  mm.add(`${MQ.motion} and ${MQ.fine}`, () => {
    const cleanups = cards.map((card) => {
      const inner = $(".hl-card__inner", card);
      const pic = $(".hl-card__pic", card);
      const floatTop = $(".hl-card__floating-top", card);
      const floatStat = $(".hl-card__stat-float", card);

      gsap.set(inner, { transformPerspective: 1400, transformStyle: "preserve-3d" });

      const rxTo = gsap.quickTo(inner, "rotationX", { duration: 0.45, ease: "power3.out" });
      const ryTo = gsap.quickTo(inner, "rotationY", { duration: 0.45, ease: "power3.out" });
      const pxTo = pic ? gsap.quickTo(pic, "x", { duration: 0.55, ease: "power3.out" }) : null;
      const pyTo = pic ? gsap.quickTo(pic, "y", { duration: 0.55, ease: "power3.out" }) : null;
      const bxTo = floatTop ? gsap.quickTo(floatTop, "x", { duration: 0.45, ease: "power3.out" }) : null;
      const byTo = floatTop ? gsap.quickTo(floatTop, "y", { duration: 0.45, ease: "power3.out" }) : null;
      const sxTo = floatStat ? gsap.quickTo(floatStat, "x", { duration: 0.45, ease: "power3.out" }) : null;
      const syTo = floatStat ? gsap.quickTo(floatStat, "y", { duration: 0.45, ease: "power3.out" }) : null;

      const onMove = (e) => {
        const r = card.getBoundingClientRect();
        if (!r.width || !r.height) return;
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        const nx = px - 0.5;
        const ny = py - 0.5;

        const maxTilt = mode === "showcase" ? 8 : 12;
        rxTo(-ny * maxTilt);
        ryTo(nx * maxTilt);

        if (pxTo && pyTo) {
          pxTo(-nx * 16);
          pyTo(-ny * 16);
        }
        if (bxTo && byTo) {
          bxTo(nx * 14);
          byTo(ny * 12);
        }
        if (sxTo && syTo) {
          sxTo(nx * 18);
          syTo(ny * 14);
        }

        card.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
        card.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
        card.style.setProperty("--glare-op", "1");
      };

      const onEnter = () => {
        card.classList.add("is-hovered");
        if (pic) gsap.to(pic, { scale: 1.045, duration: 0.55, ease: "power3.out", overwrite: "auto" });
      };

      const onLeave = () => {
        card.classList.remove("is-hovered");
        rxTo(0);
        ryTo(0);
        if (pxTo && pyTo) {
          pxTo(0);
          pyTo(0);
        }
        if (bxTo && byTo) {
          bxTo(0);
          byTo(0);
        }
        if (sxTo && syTo) {
          sxTo(0);
          syTo(0);
        }
        if (pic) gsap.to(pic, { scale: 1, duration: 0.65, ease: "power3.out", overwrite: "auto" });
        card.style.setProperty("--glare-op", "0");
      };

      card.addEventListener("pointerenter", onEnter);
      card.addEventListener("pointermove", onMove);
      card.addEventListener("pointerleave", onLeave);

      return () => {
        card.removeEventListener("pointerenter", onEnter);
        card.removeEventListener("pointermove", onMove);
        card.removeEventListener("pointerleave", onLeave);
        gsap.set([inner, pic, floatTop, floatStat].filter(Boolean), { clearProps: "all" });
      };
    });

    return () => cleanups.forEach((fn) => fn());
  });

  /* ---------- 3. Orbit 3D Carousel / Bento 3D Mode Switcher ---------- */
  function getSignedOffset(i, active, total) {
    let diff = i - active;
    if (diff > total / 2) diff -= total;
    if (diff < -total / 2) diff += total;
    return diff;
  }

  function updateOrbitUI() {
    if (counterEl) counterEl.textContent = `${pad(activeIndex + 1)} / ${pad(cards.length)}`;
    if (dotsWrap) {
      $$(".hl-dot", dotsWrap).forEach((d, idx) => {
        const active = idx === activeIndex;
        d.classList.toggle("is-active", active);
        d.setAttribute("aria-current", active ? "true" : "false");
      });
    }
    cards.forEach((c, idx) => {
      c.classList.toggle("is-orbit-active", mode === "showcase" && idx === activeIndex);
    });
  }

  function layoutOrbit(animate = true) {
    if (mode !== "showcase") return;
    const total = cards.length;
    const stageWidth = stage.clientWidth || window.innerWidth;
    const isMobile = window.innerWidth < 768;
    const spreadX = isMobile ? Math.min(stageWidth * 0.42, 190) : Math.min(stageWidth * 0.34, 410);
    const dur = animate && window.matchMedia(MQ.motion).matches ? 0.85 : 0;

    updateOrbitUI();

    cards.forEach((card, i) => {
      const diff = getSignedOffset(i, activeIndex, total);
      let props;

      if (diff === 0) {
        props = {
          xPercent: -50,
          x: 0,
          y: 0,
          z: 16,
          rotationY: 0,
          rotationX: 0,
          scale: 1,
          opacity: 1,
          zIndex: 10
        };
      } else if (diff === -1) {
        props = {
          xPercent: -50,
          x: -spreadX,
          y: 22,
          z: -130,
          rotationY: isMobile ? 22 : 34,
          rotationX: -2,
          scale: isMobile ? 0.84 : 0.82,
          opacity: isMobile ? 0.45 : 0.72,
          zIndex: 6
        };
      } else if (diff === 1) {
        props = {
          xPercent: -50,
          x: spreadX,
          y: 22,
          z: -130,
          rotationY: isMobile ? -22 : -34,
          rotationX: -2,
          scale: isMobile ? 0.84 : 0.82,
          opacity: isMobile ? 0.45 : 0.72,
          zIndex: 6
        };
      } else {
        props = {
          xPercent: -50,
          x: 0,
          y: -12,
          z: -260,
          rotationY: 0,
          rotationX: 4,
          scale: 0.66,
          opacity: 0.22,
          zIndex: 2
        };
      }

      gsap.to(card, {
        ...props,
        transformPerspective: 1600,
        duration: dur,
        ease: motion.ease.out,
        overwrite: "auto"
      });
    });

    requestAnimationFrame(() => {
      const activeCard = cards[activeIndex];
      if (activeCard && mode === "showcase") {
        grid.style.minHeight = `${activeCard.offsetHeight + 36}px`;
      }
    });
  }

  function setMode(nextMode) {
    if (nextMode === mode) return;
    mode = nextMode;
    stage.dataset.mode = mode;

    modeBtns.forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.hlMode === mode));
    });

    if (mode === "showcase") {
      if (deckNav) deckNav.hidden = false;
      layoutOrbit(true);
      announce("Mode Orbit 3D aktif. Gunakan tombol panah atau klik kartu di samping untuk memutar.");
    } else {
      if (deckNav) deckNav.hidden = true;
      grid.style.minHeight = "";
      cards.forEach((c) => c.classList.remove("is-orbit-active"));
      const animate = window.matchMedia(MQ.motion).matches;
      if (animate) {
        gsap.to(cards, {
          xPercent: 0,
          x: 0,
          y: 0,
          z: 0,
          rotationX: 0,
          rotationY: 0,
          scale: 1,
          opacity: 1,
          duration: 0.65,
          stagger: 0.04,
          ease: motion.ease.out,
          onComplete: () => gsap.set(cards, { clearProps: "all" })
        });
      } else {
        gsap.set(cards, { clearProps: "all" });
      }
      announce("Mode Bento 3D aktif.");
    }

    setTimeout(() => ScrollTrigger.refresh(), 700);
  }

  function stepOrbit(dir) {
    activeIndex = (activeIndex + dir + cards.length) % cards.length;
    layoutOrbit(true);
    const activeItem = items[activeIndex];
    if (activeItem) announce(`Sorotan ${activeIndex + 1}: ${activeItem.title}`);
  }

  modeBtns.forEach((btn) => {
    btn.addEventListener("click", () => setMode(btn.dataset.hlMode));
  });

  if (prevBtn) prevBtn.addEventListener("click", () => stepOrbit(-1));
  if (nextBtn) nextBtn.addEventListener("click", () => stepOrbit(1));

  if (dotsWrap) {
    dotsWrap.addEventListener("click", (e) => {
      const dot = e.target.closest("[data-hl-goto]");
      if (!dot) return;
      const idx = Number(dot.dataset.hlGoto);
      if (!Number.isNaN(idx)) {
        activeIndex = idx;
        layoutOrbit(true);
      }
    });
  }

  // Resize listener for Orbit 3D mode
  window.addEventListener("resize", () => {
    if (mode === "showcase") layoutOrbit(false);
  });

  // Touch swipe for Orbit 3D mode
  let touchStartX = 0;
  let touchStartY = 0;
  stage.addEventListener(
    "touchstart",
    (e) => {
      if (mode !== "showcase" || !e.touches.length) return;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    },
    { passive: true }
  );
  stage.addEventListener(
    "touchend",
    (e) => {
      if (mode !== "showcase" || !e.changedTouches.length) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy)) {
        stepOrbit(dx < 0 ? 1 : -1);
      }
    },
    { passive: true }
  );

  // Keyboard navigation in Orbit 3D mode
  section.addEventListener("keydown", (e) => {
    if (mode !== "showcase" || isOpen) return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      stepOrbit(-1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      stepOrbit(1);
    }
  });

  /* ---------- 4. Shared-Element 3D Lightbox Modal ---------- */
  function fillModal(item) {
    const idx = items.findIndex((it) => it.id === item.id);
    const prevItem = items[(idx - 1 + items.length) % items.length];
    const nextItem = items[(idx + 1) % items.length];

    contentEl.innerHTML = `
      <div class="hl-modal__top" data-hm>
        <p class="label section__eyebrow"><b>${pad(idx + 1)} / ${pad(items.length)}</b> ${esc(item.badge)}</p>
        <span class="label hl-modal__date">${esc(item.date)}</span>
      </div>
      <h2 class="modal__title hl-modal__title" id="hl-modal-title" data-hm>${esc(item.title)}</h2>
      <p class="hl-modal__subtitle" data-hm>${esc(item.subtitle)}</p>

      <div class="modal__cover hl-modal__cover hl-modal__cover--${esc(item.aspect || "landscape")}" id="hl-modal-cover">
        <img class="hl-modal__backdrop-img" src="${esc(item.image)}" alt="" aria-hidden="true">
        <picture>
          <source srcset="${esc(item.image)}" type="image/webp">
          <img class="hl-modal__main-img" src="${esc(item.fallback || item.image)}" alt="${esc(item.alt || item.title)}">
        </picture>
        <div class="hl-modal__stat-badge">
          <strong class="grad">${esc(item.stat)}</strong>
          <span>${esc(item.statLabel)}</span>
        </div>
      </div>

      <div class="modal__body hl-modal__body">
        <div class="hl-modal__story" data-hm>
          <p class="modal__summary">${esc(item.summary)}</p>
          <h3 class="label hl-modal__points-head">Sorotan &amp; Dampak Utama</h3>
          <ul class="hl-modal__points">
            ${(item.points || []).map((pt) => `<li>${esc(pt)}</li>`).join("")}
          </ul>
        </div>
        <dl class="modal__facts" data-hm>
          <div class="modal__fact">
            <dt class="label">Kategori</dt>
            <dd>${esc(item.badge)}</dd>
          </div>
          <div class="modal__fact">
            <dt class="label">Waktu &amp; Penyelenggara</dt>
            <dd>${esc(item.date)} · ${esc(item.subtitle)}</dd>
          </div>
          <div class="modal__fact">
            <dt class="label">Fokus &amp; Keahlian</dt>
            <dd class="modal__stack">${(item.tags || []).map((t) => `<span class="chip">${esc(t)}</span>`).join("")}</dd>
          </div>
        </dl>
      </div>

      <div class="hl-modal__nav" data-hm>
        <button class="btn btn--ghost" type="button" data-hl-switch="${esc(prevItem.id)}">
          ← ${esc(prevItem.badge)}
        </button>
        <button class="btn btn--primary" type="button" data-hl-switch="${esc(nextItem.id)}">
          ${esc(nextItem.badge)} →
        </button>
      </div>
    `;
  }

  function openModal(itemId, triggerEl) {
    const item = byId.get(itemId);
    if (!item || isOpen) return;
    isOpen = true;
    activeModalItem = item;
    lastFocus = triggerEl || document.activeElement;

    const card = $(`.hl-card[data-hl-id="${item.id}"]`, grid);
    sourceEl = card ? $(".hl-card__media", card) : null;

    fillModal(item);

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    html.classList.add("modal-open");
    smooth.stop();
    panel.scrollTop = 0;

    const cover = $("#hl-modal-cover");
    const bits = $$("[data-hm]", contentEl);
    const animate = window.matchMedia(MQ.motion).matches;

    if (!animate) {
      gsap.set([backdrop, panel], { opacity: 1 });
    } else {
      const tl = gsap.timeline({ defaults: { ease: motion.ease.out } });
      tl.to(backdrop, { opacity: 1, duration: 0.4 }, 0).set(panel, { opacity: 1 }, 0);
      if (sourceEl && typeof Flip !== "undefined") {
        Flip.fit(cover, sourceEl, { scale: true });
        tl.to(cover, { x: 0, y: 0, scaleX: 1, scaleY: 1, duration: 0.85, ease: motion.ease.inOut, clearProps: "transform" }, 0);
      } else {
        tl.fromTo(cover, { scale: 0.9, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.75, clearProps: "transform,opacity" }, 0);
      }
      tl.fromTo(bits, { y: 34, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, stagger: 0.06, clearProps: "opacity,transform" }, 0.28);
    }

    closeBtn.focus({ preventScroll: true });
    announce(`Detail sorotan ${item.title} dibuka`);
  }

  function switchModalItem(nextId) {
    const item = byId.get(nextId);
    if (!item || !isOpen) return;
    activeModalItem = item;
    const card = $(`.hl-card[data-hl-id="${item.id}"]`, grid);
    sourceEl = card ? $(".hl-card__media", card) : null;

    const idx = items.findIndex((it) => it.id === item.id);
    if (idx >= 0) {
      activeIndex = idx;
      if (mode === "showcase") layoutOrbit(false);
    }

    const animate = window.matchMedia(MQ.motion).matches;
    if (!animate) {
      fillModal(item);
      panel.scrollTop = 0;
      return;
    }

    gsap.to(contentEl, {
      opacity: 0,
      y: 16,
      duration: 0.22,
      ease: "power2.in",
      onComplete: () => {
        fillModal(item);
        panel.scrollTop = 0;
        gsap.fromTo(
          contentEl,
          { opacity: 0, y: -16 },
          { opacity: 1, y: 0, duration: 0.4, ease: motion.ease.out, clearProps: "opacity,transform" }
        );
        announce(`Beralih ke sorotan ${item.title}`);
      }
    });
  }

  function closeModal() {
    if (!isOpen || closing) return;
    closing = true;
    const cover = $("#hl-modal-cover");
    const animate = window.matchMedia(MQ.motion).matches;

    const finish = () => {
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
      html.classList.remove("modal-open");
      gsap.set([backdrop, panel], { opacity: 0 });
      contentEl.innerHTML = "";
      smooth.start();
      isOpen = false;
      closing = false;
      if (lastFocus && typeof lastFocus.focus === "function") {
        lastFocus.focus({ preventScroll: true });
      }
    };

    if (!animate) {
      finish();
      return;
    }

    const tl = gsap.timeline({ onComplete: finish, defaults: { ease: motion.ease.inOut } });
    const canFly = sourceEl && panel.scrollTop < 8 && sourceEl.isConnected && typeof Flip !== "undefined";
    tl.to($$("[data-hm]", contentEl), { opacity: 0, y: 18, duration: 0.25, stagger: 0.02 }, 0);
    if (canFly && cover) {
      tl.add(Flip.fit(cover, sourceEl, { scale: true, duration: 0.65, ease: motion.ease.inOut }), 0.04);
      tl.to(panel, { opacity: 0, duration: 0.32 }, 0.35).to(backdrop, { opacity: 0, duration: 0.32 }, 0.35);
    } else {
      tl.to(panel, { opacity: 0, duration: 0.35 }, 0.08).to(backdrop, { opacity: 0, duration: 0.35 }, 0.08);
    }
  }

  // Click handling on cards (supports both Orbit rotation on side cards & Modal open)
  grid.addEventListener("click", (e) => {
    const card = e.target.closest(".hl-card");
    if (!card) return;
    const idx = Number(card.dataset.hlIndex);

    // If in Orbit 3D mode and user clicked a non-active side card, rotate it to front first
    if (mode === "showcase" && idx !== activeIndex) {
      activeIndex = idx;
      layoutOrbit(true);
      return;
    }

    const openTarget = e.target.closest("[data-hl-open]");
    if (openTarget) {
      openModal(openTarget.dataset.hlOpen, openTarget);
    }
  });

  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (backdrop) backdrop.addEventListener("click", closeModal);
  if (contentEl) {
    contentEl.addEventListener("click", (e) => {
      const sw = e.target.closest("[data-hl-switch]");
      if (sw) switchModalItem(sw.dataset.hlSwitch);
    });
  }

  document.addEventListener("keydown", (e) => {
    if (!isOpen) return;
    if (e.key === "Escape") {
      e.preventDefault();
      closeModal();
      return;
    }
    if (e.key === "ArrowRight" && activeModalItem) {
      const idx = items.findIndex((it) => it.id === activeModalItem.id);
      const next = items[(idx + 1) % items.length];
      if (next) switchModalItem(next.id);
      return;
    }
    if (e.key === "ArrowLeft" && activeModalItem) {
      const idx = items.findIndex((it) => it.id === activeModalItem.id);
      const prev = items[(idx - 1 + items.length) % items.length];
      if (prev) switchModalItem(prev.id);
      return;
    }
    if (e.key !== "Tab") return;
    const focusables = $$('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])', modal).filter(
      (el) => el.offsetParent !== null || el === closeBtn
    );
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
}

export function destroy() {
  if (mm) mm.revert();
}
