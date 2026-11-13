/* ==========================================================================
   sections/projects.js — A16 preview mengikuti kursor, A17 modal shared-element
   (Flip), A18 filter reorder (Flip)
   ========================================================================== */
import { $, $$, motion, MQ, revealLines, announce } from "../motion.js";
import { CATEGORY_LABEL } from "../render.js";
import * as smooth from "../smooth-scroll.js";

const html = document.documentElement;
let mm = null;

export function init(projects) {
  const byId = new Map(projects.map((p) => [p.id, p]));
  const list = $("#project-list");
  const modal = $("#project-modal");
  const panel = $("#modal-panel");
  const backdrop = $("#modal-backdrop");
  const closeBtn = $("#modal-close");
  const contentEl = $("#modal-content");
  const preview = $("#project-preview");
  const previewFrame = $("#project-preview-frame");
  const previewImg = $("#project-preview-img");

  let lastFocus = null;
  let source = null;     // elemen asal untuk transisi shared-element
  let isOpen = false;
  let closing = false;

  // pramuat cover untuk preview hover di desktop setelah halaman selesai dimuat
  const preloadCovers = () => projects.forEach((p) => { const i = new Image(); i.src = p.cover; });
  if (window.matchMedia(MQ.fine).matches) {
    if (document.readyState === "complete") setTimeout(preloadCovers, 200);
    else window.addEventListener("load", () => setTimeout(preloadCovers, 200), { once: true });
  }

  mm = gsap.matchMedia();

  /* ---------- Reveal heading & baris ---------- */
  mm.add(MQ.motion, () => {
    revealLines("#projects-title");
    gsap.from(".filter, .project", {
      y: 40, opacity: 0, duration: motion.dur.md, stagger: motion.stagger.items, clearProps: "opacity,transform",
      scrollTrigger: { trigger: "#project-filters", start: "top 90%", once: true }
    });
  });

  /* ---------- A16: preview gambar mengikuti kursor (desktop saja) ---------- */
  mm.add(`${MQ.motion} and ${MQ.fine}`, () => {
    const ac = new AbortController();
    gsap.set(preview, { xPercent: -50, yPercent: -50 });
    const xTo = gsap.quickTo(preview, "x", { duration: 0.4, ease: "power3" });
    const yTo = gsap.quickTo(preview, "y", { duration: 0.4, ease: "power3" });
    const rTo = gsap.quickTo(preview, "rotation", { duration: 0.5, ease: "power3" });
    let reset = null;

    list.addEventListener("pointermove", (e) => {
      xTo(e.clientX + 40);
      yTo(e.clientY);
      rTo(gsap.utils.clamp(-10, 10, e.movementX * 0.5));
      if (reset) reset.kill();
      reset = gsap.delayedCall(0.08, () => rTo(0));
    }, { signal: ac.signal });

    $$(".project__row", list).forEach((row) => {
      const p = byId.get(row.dataset.id);
      const rowThumbImg = $(".project__thumb-img", row);
      const screenItems = $$(".project__screen-item", row);

      row.addEventListener("pointerenter", (e) => {
        previewImg.src = rowThumbImg ? rowThumbImg.src : p.cover;
        previewFrame.classList.toggle("is-portrait", Boolean(p.portrait));
        gsap.set(preview, { x: e.clientX + 40, y: e.clientY });
        gsap.fromTo(previewFrame, { clipPath: "inset(100% 0% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 0.5, ease: motion.ease.out, overwrite: true });
      }, { signal: ac.signal });

      row.addEventListener("pointerleave", () => {
        if (rowThumbImg && rowThumbImg.src !== p.cover) {
          rowThumbImg.src = p.cover;
          screenItems.forEach((el, idx) => el.classList.toggle("is-active", idx === 0));
        }
        gsap.to(previewFrame, { clipPath: "inset(0% 0% 100% 0%)", duration: 0.4, ease: motion.ease.inOut, overwrite: true });
      }, { signal: ac.signal });

      screenItems.forEach((item) => {
        item.addEventListener("pointerenter", () => {
          const src = item.dataset.screenSrc;
          if (!src) return;
          screenItems.forEach((el) => el.classList.toggle("is-active", el === item));
          if (rowThumbImg) rowThumbImg.src = src;
          previewImg.src = src;
        }, { signal: ac.signal });
      });
    });
    return () => { ac.abort(); gsap.set(preview, { clearProps: "all" }); };
  });

  /* ---------- A18: filter kategori (FLIP reorder) ---------- */
  const filters = $("#project-filters");
  filters.addEventListener("click", (e) => {
    const btn = e.target.closest(".filter");
    if (!btn) return;
    const key = btn.dataset.filter;
    $$(".filter", filters).forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));

    const items = $$(".project", list);
    const animate = window.matchMedia(MQ.motion).matches;
    const state = animate ? Flip.getState(items) : null;
    let shown = 0;
    items.forEach((li) => {
      const show = key === "all" || li.dataset.category === key;
      li.classList.toggle("is-hidden", !show);
      if (show) shown++;
    });
    announce(`${shown} proyek ditampilkan`);
    if (animate) {
      Flip.from(state, {
        duration: 0.6, ease: motion.ease.inOut, stagger: 0.05,
        onEnter: (els) => gsap.fromTo(els, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.6, clearProps: "opacity,transform" }),
        onLeave: (els) => gsap.to(els, { opacity: 0, y: -20, duration: 0.4 })
      });
    }
  });

  /* ---------- A17: modal detail ---------- */
  const fmtLinks = (links = {}) => {
    const defs = [["live", "Lihat situs"], ["github", "GitHub"], ["playstore", "Play Store"]];
    const out = defs.filter(([k]) => links[k]).map(([k, label]) => `<a class="btn btn--primary" href="${links[k]}" target="_blank" rel="noopener">${label}</a>`);
    return out.length ? out.join("") : `<a class="btn btn--ghost" href="#contact" data-close>Tertarik? Ceritakan kebutuhan Anda</a>`;
  };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let activeProject = null;
  let activeScreenIdx = 0;

  function setModalScreen(idx) {
    if (!activeProject) return;
    const gal = Array.isArray(activeProject.gallery) && activeProject.gallery.length ? activeProject.gallery : [activeProject.cover];
    const caps = Array.isArray(activeProject.galleryCaptions) ? activeProject.galleryCaptions : [];
    activeScreenIdx = ((idx % gal.length) + gal.length) % gal.length;

    const coverImg = $("#modal-cover-img");
    const capText = $("#modal-caption-text");
    const capCount = $("#modal-caption-count");

    if (coverImg) {
      gsap.fromTo(coverImg, { opacity: 0.35, scale: 0.985 }, { opacity: 1, scale: 1, duration: 0.35, ease: "power2.out" });
      coverImg.src = gal[activeScreenIdx];
      coverImg.alt = caps[activeScreenIdx] || `Tampilan proyek ${activeProject.title}`;
    }
    if (capText) {
      capText.textContent = caps[activeScreenIdx] || `${activeProject.title} — Tampilan ${activeScreenIdx + 1}`;
    }
    if (capCount) {
      capCount.textContent = `Layar ${String(activeScreenIdx + 1).padStart(2, "0")} / ${String(gal.length).padStart(2, "0")}`;
    }

    $$(".modal__gallery-item", contentEl).forEach((btn, i) => {
      btn.classList.toggle("is-active", i === activeScreenIdx);
      btn.setAttribute("aria-pressed", String(i === activeScreenIdx));
    });
  }

  function fill(p, initialIdx = 0) {
    activeProject = p;
    const gal = Array.isArray(p.gallery) && p.gallery.length ? p.gallery : [p.cover];
    const caps = Array.isArray(p.galleryCaptions) ? p.galleryCaptions : [];
    activeScreenIdx = Math.max(0, Math.min(gal.length - 1, initialIdx));

    const currentSrc = gal[activeScreenIdx] || p.cover;
    const currentCap = caps[activeScreenIdx] || `${p.title} — Tampilan Utama`;

    const pointsHtml =
      Array.isArray(p.points) && p.points.length
        ? `<div class="modal__points-wrap">
            <h3 class="label modal__points-title">Fitur &amp; Sorotan Utama</h3>
            <ul class="modal__points">
              ${p.points.map((pt) => `<li>${esc(pt)}</li>`).join("")}
            </ul>
          </div>`
        : "";

    const galleryHtml =
      gal.length > 1
        ? `<div class="modal__gallery-section" style="margin-top:var(--sp-8)">
            <p class="label modal__gallery-label">Galeri Tangkapan Layar (${gal.length} Layar — Klik untuk memperbesar)</p>
            <div class="modal__gallery${p.portrait ? " modal__gallery--portrait" : ""}" role="group" aria-label="Galeri tangkapan layar proyek">
              ${gal
                .map(
                  (g, idx) => `
                <button class="modal__gallery-item${idx === activeScreenIdx ? " is-active" : ""}" type="button" data-gal-idx="${idx}" aria-pressed="${idx === activeScreenIdx}">
                  <span class="modal__gallery-thumb"><img src="${esc(g)}" alt="${esc(caps[idx] || `${p.title} layar ${idx + 1}`)}" loading="lazy"></span>
                  <span class="modal__gallery-cap"><b>${String(idx + 1).padStart(2, "0")}</b> ${esc(caps[idx] || `Tampilan ${idx + 1}`)}</span>
                </button>`
                )
                .join("")}
            </div>
          </div>`
        : "";

    contentEl.innerHTML = `
      <p class="label section__eyebrow" data-m><b>${esc(p.year)}</b> ${esc(CATEGORY_LABEL[p.category] || p.category)}${p.subtitle ? ` · ${esc(p.subtitle)}` : ""}</p>
      <h2 class="modal__title" id="modal-title" data-m>${esc(p.title)}</h2>
      <div class="modal__cover${p.portrait ? " modal__cover--portrait" : ""}" id="modal-cover" style="margin-top:var(--sp-8)">
        <img id="modal-cover-img" src="${esc(currentSrc)}" alt="${esc(currentCap)}" width="1200" height="750">
      </div>
      <div class="modal__caption-bar" data-m>
        <div class="modal__caption-info">
          <span class="label modal__caption-count" id="modal-caption-count">Layar ${String(activeScreenIdx + 1).padStart(2, "0")} / ${String(gal.length).padStart(2, "0")}</span>
          <p class="modal__caption-text" id="modal-caption-text">${esc(currentCap)}</p>
        </div>
        ${
          gal.length > 1
            ? `<div class="modal__caption-nav">
                <button class="btn btn--ghost btn--sm" type="button" data-gal-prev aria-label="Layar sebelumnya">← Sebelumnya</button>
                <button class="btn btn--ghost btn--sm" type="button" data-gal-next aria-label="Layar berikutnya">Berikutnya →</button>
              </div>`
            : ""
        }
      </div>
      <div class="modal__body">
        <div data-m>
          <p class="modal__summary">${esc(p.summary)}</p>
          ${p.highlight ? `<p class="stat__num grad" style="margin-top:var(--sp-6);font-size:clamp(1.6rem,3vw,2.6rem)">${esc(p.highlight)}</p>` : ""}
          ${pointsHtml}
          ${galleryHtml}
        </div>
        <dl class="modal__facts" data-m>
          <div class="modal__fact"><dt class="label">Peran</dt><dd>${esc(p.role)}</dd></div>
          <div class="modal__fact"><dt class="label">Stack &amp; Teknologi</dt><dd class="modal__stack">${p.stack.map((s) => `<span class="chip">${esc(s)}</span>`).join("")}</dd></div>
          <div class="modal__fact"><dt class="label">Tautan</dt><dd class="modal__links">${fmtLinks(p.links)}</dd></div>
        </dl>
      </div>`;
  }

  function sourceFor(row) {
    // desktop: frame preview yang mengikuti kursor; seluler/keyboard: thumbnail baris
    const thumb = $(".project__thumb", row);
    if (thumb && thumb.offsetParent) return thumb;
    if (preview && getComputedStyle(preview).display !== "none") {
      const r = previewFrame.getBoundingClientRect();
      if (r.width > 0 && r.right > 0 && r.left < window.innerWidth) return previewFrame;
    }
    return null;
  }

  function openModal(row, initialIdx = 0) {
    const p = byId.get(row.dataset.id);
    if (!p || isOpen) return;
    isOpen = true;
    lastFocus = row;
    source = sourceFor(row);
    fill(p, initialIdx);

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    html.classList.add("modal-open");
    smooth.stop();
    panel.scrollTop = 0;

    const cover = $("#modal-cover");
    const bits = $$("[data-m]", contentEl);
    const animate = window.matchMedia(MQ.motion).matches;

    if (!animate) {
      gsap.set([backdrop, panel], { opacity: 1 });
    } else {
      const tl = gsap.timeline({ defaults: { ease: motion.ease.out } });
      tl.to(backdrop, { opacity: 1, duration: 0.4 }, 0).set(panel, { opacity: 1 }, 0);
      if (source) {
        // shared-element: cover mengembang dari posisi preview/thumbnail
        Flip.fit(cover, source, { scale: true });
        tl.to(cover, { x: 0, y: 0, scaleX: 1, scaleY: 1, duration: 0.9, ease: motion.ease.inOut, clearProps: "transform" }, 0);
      } else {
        tl.fromTo(cover, { scale: 0.9, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.9, clearProps: "transform,opacity" }, 0);
      }
      tl.fromTo(bits, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, stagger: 0.08, clearProps: "opacity,transform" }, 0.35);
    }
    closeBtn.focus({ preventScroll: true });
    announce(`Detail proyek ${p.title} dibuka`);
  }

  function closeModal() {
    if (!isOpen || closing) return;
    closing = true;
    const cover = $("#modal-cover");
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
      if (lastFocus) lastFocus.focus({ preventScroll: true });
    };
    if (!animate) { finish(); return; }

    const tl = gsap.timeline({ onComplete: finish, defaults: { ease: motion.ease.inOut } });
    const canFly = source && panel.scrollTop < 4 && source.isConnected;
    tl.to($$("[data-m]", contentEl), { opacity: 0, y: 20, duration: 0.3, stagger: 0.03 }, 0);
    if (canFly) {
      tl.add(Flip.fit(cover, source, { scale: true, duration: 0.7, ease: motion.ease.inOut }), 0.05);
      tl.to(panel, { opacity: 0, duration: 0.35 }, 0.4).to(backdrop, { opacity: 0, duration: 0.35 }, 0.4);
    } else {
      tl.to(panel, { opacity: 0, duration: 0.4 }, 0.1).to(backdrop, { opacity: 0, duration: 0.4 }, 0.1);
    }
  }

  list.addEventListener("click", (e) => {
    const screenEl = e.target.closest(".project__screen-item");
    const row = e.target.closest(".project__row");
    if (row) {
      const idx = screenEl ? Number(screenEl.dataset.screenIdx) || 0 : 0;
      openModal(row, idx);
    }
  });
  closeBtn.addEventListener("click", closeModal);
  backdrop.addEventListener("click", closeModal);
  contentEl.addEventListener("click", (e) => {
    const a = e.target.closest("[data-close]");
    if (a) {
      closeModal();
      return;
    }
    const galItem = e.target.closest("[data-gal-idx]");
    if (galItem) {
      setModalScreen(Number(galItem.dataset.galIdx) || 0);
      return;
    }
    if (e.target.closest("[data-gal-prev]")) {
      setModalScreen(activeScreenIdx - 1);
      return;
    }
    if (e.target.closest("[data-gal-next]")) {
      setModalScreen(activeScreenIdx + 1);
    }
  });

  // Esc menutup + panah kiri/kanan galeri + focus trap
  document.addEventListener("keydown", (e) => {
    if (!isOpen) return;
    if (e.key === "Escape") { e.preventDefault(); closeModal(); return; }
    if (e.key === "ArrowLeft") { setModalScreen(activeScreenIdx - 1); return; }
    if (e.key === "ArrowRight") { setModalScreen(activeScreenIdx + 1); return; }
    if (e.key !== "Tab") return;
    const focusables = $$('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])', modal).filter((el) => el.offsetParent !== null || el === closeBtn);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
}

export function destroy() { if (mm) mm.revert(); }
