/* ==========================================================================
   render.js — merender section dari data/content.js
   (HTML statis di index.html hanya fallback untuk JS mati / crawler)
   ========================================================================== */
import { $ } from "./motion.js";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = (n) => String(n).padStart(2, "0");

export const CATEGORY_LABEL = { android: "Android", web: "Web", uiux: "UI/UX" };
const TYPE_LABEL = {
  work: "Karir Perusahaan",
  freelance: "Freelance Mandiri",
  education: "Masa Kuliah & Studi",
  program: "Program Nasional",
  award: "Prestasi Lomba"
};
const TYPE_ICON = {
  work: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>',
  freelance: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  education: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>',
  program: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>',
  award: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>'
};

const ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>';

export function renderAll(c) {
  renderMeta(c);
  renderStats(c);
  renderSkills(c);
  renderJourney(c);
  renderHighlights(c);
  renderProjects(c);
  renderCerts(c);
  renderContact(c);
}

function renderMeta({ meta, about }) {
  $("#hero-status").textContent = meta.status;
  $("#about-status").textContent = meta.status;
  $("#about-location").textContent = meta.location;
  $("#hero-tagline").textContent = meta.tagline;
  $("#hero-sub").textContent = meta.subtitle;
  $("#hero-roles-sr").textContent = meta.roles.join(", ");
  $("#hero-role").innerHTML = meta.roles.map((r) => `<span class="hero__role-item">${esc(r)}</span>`).join("");
  $("#about-summary").textContent = about.summary;
  const photoEl = $("#about-photo");
  if (photoEl && about.photo) {
    photoEl.src = about.photo;
    photoEl.alt = meta.name;
  }
  const storyBody = $("#about-story-body");
  if (storyBody && Array.isArray(about.story)) {
    storyBody.innerHTML = about.story.map((p) => `<p class="about__summary">${esc(p)}</p>`).join("");
  }
  $("#hero-wa").href = meta.whatsapp;
  $("#menu-wa").href = meta.whatsapp;
  ["#nav-cv", "#menu-cv", "#link-cv"].forEach((s) => { $(s).href = meta.cv; });
}

function renderStats({ about }) {
  $("#stats").innerHTML = about.stats
    .map((s) => `<li class="stat"><span class="stat__num grad" data-value="${s.value}" data-suffix="${esc(s.suffix)}">${s.value}${esc(s.suffix)}</span><p class="stat__label">${esc(s.label)}</p></li>`)
    .join("");
}

function renderSkills({ skills }) {
  // Marquee dua baris dari seluruh skill
  const all = skills.flatMap((g) => g.items);
  const half = Math.ceil(all.length / 2);
  const rows = [all.slice(0, half), all.slice(half)];
  const group = (items, hidden) =>
    `<div class="marquee__group"${hidden ? ' aria-hidden="true"' : ""}>${items.map((i) => `<span class="marquee__item">${esc(i)}</span>`).join("")}</div>`;
  $("#marquee").innerHTML = rows
    .map((items) => `<div class="marquee__row"><div class="marquee__track">${group(items, false)}${group(items, true)}</div></div>`)
    .join("");

  // Kartu per grup
  $("#skill-grid").innerHTML = skills
    .map(
      (g, i) => `
    <article class="skill-card" data-tilt>
      <div class="skill-card__head">
        <h3 class="skill-card__title">${esc(g.group)}</h3>
        <span class="label">${pad(i + 1)}</span>
      </div>
      <ul class="skill-card__chips">${g.items.map((it) => `<li class="chip">${esc(it)}</li>`).join("")}</ul>
    </article>`
    )
    .join("");
}

function renderJourney({ journey }) {
  const filtersEl = $("#journey-filters");
  if (filtersEl) {
    const countOf = (types) => journey.filter((j) => types.includes(j.type)).length;
    const filterDefs = [
      { key: "all", label: "Semua Fase", count: journey.length, cls: "all" },
      { key: "work", label: "Karir Kerja", count: countOf(["work"]), cls: "work" },
      { key: "freelance", label: "Freelance", count: countOf(["freelance"]), cls: "freelance" },
      { key: "education", label: "Masa Kuliah", count: countOf(["education"]), cls: "education" },
      { key: "program-award", label: "Program & Prestasi", count: countOf(["program", "award"]), cls: "award" }
    ];
    filtersEl.innerHTML = filterDefs
      .map(
        (f, i) => `
      <button class="journey__filter journey__filter--${f.cls}" type="button" data-jfilter="${f.key}" aria-pressed="${i === 0 ? "true" : "false"}">
        <span class="journey__filter-dot" aria-hidden="true"></span>
        <span>${esc(f.label)}</span>
        <small>${f.count}</small>
      </button>`
      )
      .join("");
  }

  $("#journey-list").innerHTML = journey
    .map((j) => {
      const points = (j.points || [])
        .map((p) => {
          let html = esc(p);
          if (j.highlight) html = html.replace(esc(j.highlight), `<mark class="hl">${esc(j.highlight)}</mark>`);
          return `<li>${html}</li>`;
        })
        .join("");
      const tags = (j.tags || [])
        .map((t) => `<li class="chip journey__chip">${esc(t)}</li>`)
        .join("");
      const icon = TYPE_ICON[j.type] || TYPE_ICON.work;
      return `
      <li class="journey__item journey__item--${esc(j.type)}${points ? "" : " journey__item--mini"}" data-jtype="${esc(j.type)}">
        <span class="journey__node" aria-hidden="true">${icon}</span>
        <article class="journey__card">
          <div class="journey__meta">
            <span class="label journey__date">${esc(j.date)}</span>
            <span class="label journey__badge">${icon}<span>${esc(TYPE_LABEL[j.type] || j.type)}</span></span>
            ${j.phase ? `<span class="label journey__phase">${esc(j.phase)}</span>` : ""}
          </div>
          <h3 class="journey__title">${esc(j.title)}</h3>
          <p class="journey__org">${esc(j.org)}</p>
          ${j.summary ? `<p class="journey__summary">${esc(j.summary)}</p>` : ""}
          ${points ? `<ul class="journey__points">${points}</ul>` : ""}
          ${tags ? `<ul class="journey__tags" aria-label="Teknologi & fokus">${tags}</ul>` : ""}
        </article>
      </li>`;
    })
    .join("");
}

function renderHighlights({ highlights }) {
  if (!highlights || !Array.isArray(highlights.items)) return;
  const grid = $("#highlights-grid");
  if (!grid) return;

  const eyebrow = $("#highlights-eyebrow");
  const sub = $("#highlights-sub");
  if (eyebrow && highlights.eyebrow) eyebrow.textContent = highlights.eyebrow;
  if (sub && highlights.sub) sub.textContent = highlights.sub;

  grid.innerHTML = highlights.items
    .map(
      (item, i) => `
    <article class="hl-card hl-card--${esc(item.layout || "card")} hl-card--${esc(item.aspect || "landscape")}" data-hl-id="${esc(item.id)}" data-hl-index="${i}">
      <div class="hl-card__inner">
        <span class="hl-card__glare" aria-hidden="true"></span>
        <span class="hl-card__border-glow" aria-hidden="true"></span>
        <div class="hl-card__media" data-hl-media data-hl-open="${esc(item.id)}" data-cursor="view" data-cursor-label="Lihat Foto">
          <img class="hl-card__backdrop" src="${esc(item.image)}" alt="" aria-hidden="true" loading="lazy" decoding="async">
          <picture class="hl-card__pic">
            <source srcset="${esc(item.image)}" type="image/webp">
            <img class="hl-card__img" src="${esc(item.fallback || item.image)}" alt="${esc(item.alt || item.title)}" loading="lazy" decoding="async">
          </picture>
          <div class="hl-card__floating-top">
            <span class="hl-card__badge"><i class="hl-card__badge-dot" aria-hidden="true"></i>${esc(item.badge)}</span>
            <span class="hl-card__index" aria-hidden="true">${pad(i + 1)}</span>
          </div>
          <div class="hl-card__stat-float" aria-hidden="true">
            <strong class="hl-card__stat-num grad">${esc(item.stat)}</strong>
            <small class="hl-card__stat-label">${esc(item.statLabel)}</small>
          </div>
        </div>
        <div class="hl-card__body">
          <div class="hl-card__meta">
            <span class="label hl-card__date">${esc(item.date)}</span>
            <span class="label hl-card__sub">${esc(item.subtitle)}</span>
          </div>
          <h3 class="hl-card__title">${esc(item.title)}</h3>
          <p class="hl-card__summary">${esc(item.summary)}</p>
          <ul class="hl-card__points">
            ${(item.points || []).map((pt) => `<li>${esc(pt)}</li>`).join("")}
          </ul>
          <div class="hl-card__foot">
            <ul class="hl-card__tags" aria-label="Topik terkait">
              ${(item.tags || []).map((t) => `<li class="chip">${esc(t)}</li>`).join("")}
            </ul>
            <button class="hl-card__cta" type="button" data-hl-open="${esc(item.id)}" data-cursor="view" data-cursor-label="Detail 3D" aria-haspopup="dialog" aria-label="Buka cerita lengkap ${esc(item.title)}">
              <span>Lihat Detail</span> ${ARROW}
            </button>
          </div>
        </div>
      </div>
    </article>`
    )
    .join("");

  const dots = $("#hl-dots");
  if (dots) {
    dots.innerHTML = highlights.items
      .map(
        (item, i) =>
          `<button class="hl-dot${i === 0 ? " is-active" : ""}" type="button" data-hl-goto="${i}" aria-label="Ke sorotan ${i + 1}: ${esc(item.title)}" aria-current="${i === 0 ? "true" : "false"}"></button>`
      )
      .join("");
  }
}

function renderProjects({ projects }) {
  const cats = [...new Set(projects.map((p) => p.category))];
  $("#project-filters").innerHTML = [
    `<button class="filter" type="button" data-filter="all" aria-pressed="true">Semua (${projects.length})</button>`,
    ...cats.map((k) => {
      const count = projects.filter((p) => p.category === k).length;
      return `<button class="filter" type="button" data-filter="${esc(k)}" aria-pressed="false">${esc(CATEGORY_LABEL[k] || k)} (${count})</button>`;
    })
  ].join("");

  $("#project-list").innerHTML = projects
    .map((p, i) => {
      const gal = Array.isArray(p.gallery) && p.gallery.length ? p.gallery : [p.cover];
      const caps = Array.isArray(p.galleryCaptions) ? p.galleryCaptions : [];
      const miniThumbs =
        gal.length > 1
          ? `<span class="project__screens" aria-label="${gal.length} tangkapan layar proyek">
              ${gal
                .map(
                  (src, idx) =>
                    `<span class="project__screen-item${idx === 0 ? " is-active" : ""}" data-screen-idx="${idx}" data-screen-src="${esc(src)}" title="${esc(caps[idx] || `${p.title} — Layar ${idx + 1}`)}">
                      <img src="${esc(src)}" alt="${esc(caps[idx] || `${p.title} layar ${idx + 1}`)}" loading="lazy" width="120" height="75">
                    </span>`
                )
                .join("")}
            </span>`
          : "";

      const stackChips = (p.stack || [])
        .slice(0, 5)
        .map((s) => `<span class="project__tag">${esc(s)}</span>`)
        .join("");

      return `
    <li class="project" data-category="${esc(p.category)}">
      <button class="project__row" type="button" data-id="${esc(p.id)}" data-cursor="view" data-cursor-label="Buka Detail" aria-haspopup="dialog" aria-label="Buka detail proyek ${esc(p.title)}">
        <span class="project__num">${pad(i + 1)}</span>
        <span class="project__thumb${p.portrait ? " project__thumb--portrait" : ""}">
          <img class="project__thumb-img" src="${esc(p.cover)}" alt="${esc(p.title)}" loading="lazy" width="640" height="400">
          ${gal.length > 1 ? `<span class="project__thumb-count">${gal.length} Layar</span>` : ""}
        </span>
        <span class="project__info">
          <span class="project__title">${esc(p.title)}</span>
          ${p.subtitle ? `<span class="project__subtitle">${esc(p.subtitle)}</span>` : ""}
          <span class="project__desc">${esc(p.summary)}</span>
          <span class="project__foot">
            ${miniThumbs}
            <span class="project__tags">${stackChips}</span>
          </span>
        </span>
        <span class="project__meta label">
          <span class="project__cat-badge">${esc(CATEGORY_LABEL[p.category] || p.category)}</span>
          <span>${esc(p.year)}</span>
        </span>
        <span class="project__arrow">${ARROW}</span>
      </button>
    </li>`;
    })
    .join("");
}

function renderCerts({ certs }) {
  const initials = (org) => org.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const iconHtml = (c) => {
    const logo = c.logo || (/dicoding/i.test(c.org) ? "assets/img/dicoding-logo.png" : "");
    if (logo) {
      return `<span class="cert__icon cert__icon--logo" aria-hidden="true"><img src="${esc(logo)}" alt="${esc(c.org)}" width="52" height="52" loading="lazy"></span>`;
    }
    return `<span class="cert__icon" aria-hidden="true">${esc(initials(c.org))}</span>`;
  };
  $("#certs-track").innerHTML = certs
    .map(
      (c, i) => `
    <li class="cert">
      <div class="cert__top">
        ${iconHtml(c)}
        <span class="cert__no">${pad(i + 1)}/${pad(certs.length)}</span>
      </div>
      <div>
        <h3 class="cert__title">${esc(c.title)}</h3>
        <span class="label cert__badge">${esc(c.org)}</span>
      </div>
    </li>`
    )
    .join("");
  $("#certs-count").textContent = `01 / ${pad(certs.length)}`;
}

function renderContact({ meta, contact }) {
  $("#contact-title").textContent = contact.headline;
  $("#contact-sub").textContent = contact.sub;
  $("#link-wa").href = meta.whatsapp;
  $("#link-mail").href = `mailto:${meta.email}`;
  const items = [
    ["GitHub", meta.social.github],
    ["LinkedIn", meta.social.linkedin]
  ].filter(([, url]) => url);
  const social = $("#social");
  social.innerHTML = items.map(([name, url]) => `<li><a href="${esc(url)}" target="_blank" rel="noopener" data-magnetic>${esc(name)} ${ARROW.replace("<svg ", '<svg width="14" height="14" ')}</a></li>`).join("");
  social.hidden = items.length === 0;
  $("#year").textContent = new Date().getFullYear();
}
