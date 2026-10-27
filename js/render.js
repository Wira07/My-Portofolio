/* ==========================================================================
   render.js — merender section dari data/content.js
   (HTML statis di index.html hanya fallback untuk JS mati / crawler)
   ========================================================================== */
import { $ } from "./motion.js";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = (n) => String(n).padStart(2, "0");

export const CATEGORY_LABEL = { android: "Android", web: "Web", uiux: "UI/UX" };
const TYPE_LABEL = { work: "Pengalaman", education: "Pendidikan", program: "Program", award: "Prestasi" };

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
  $("#journey-list").innerHTML = journey
    .map((j) => {
      const points = (j.points || [])
        .map((p) => {
          let html = esc(p);
          if (j.highlight) html = html.replace(esc(j.highlight), `<mark class="hl">${esc(j.highlight)}</mark>`);
          return `<li>${html}</li>`;
        })
        .join("");
      return `
      <li class="journey__item journey__item--${esc(j.type)}${points ? "" : " journey__item--mini"}">
        <span class="journey__node" aria-hidden="true"></span>
        <article class="journey__card">
          <div class="journey__meta">
            <span class="label">${esc(j.date)}</span>
            <span class="label journey__badge">${esc(TYPE_LABEL[j.type] || j.type)}</span>
          </div>
          <h3 class="journey__title">${esc(j.title)}</h3>
          <p class="journey__org">${esc(j.org)}</p>
          ${points ? `<ul class="journey__points">${points}</ul>` : ""}
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
    `<button class="filter" type="button" data-filter="all" aria-pressed="true">Semua</button>`,
    ...cats.map((k) => `<button class="filter" type="button" data-filter="${esc(k)}" aria-pressed="false">${esc(CATEGORY_LABEL[k] || k)}</button>`)
  ].join("");

  $("#project-list").innerHTML = projects
    .map(
      (p, i) => `
    <li class="project" data-category="${esc(p.category)}">
      <button class="project__row" type="button" data-id="${esc(p.id)}" data-cursor="view" data-cursor-label="Buka" aria-haspopup="dialog" aria-label="Buka detail proyek ${esc(p.title)}">
        <span class="project__thumb${p.portrait ? " project__thumb--portrait" : ""}"><img src="${esc(p.cover)}" alt="${esc(p.title)}" loading="lazy" width="640" height="400"></span>
        <span class="project__num">${pad(i + 1)}</span>
        <span class="project__title">${esc(p.title)}</span>
        <span class="project__meta label"><span>${esc(CATEGORY_LABEL[p.category] || p.category)}</span><span>${esc(p.year)}</span></span>
        <span class="project__arrow">${ARROW}</span>
      </button>
    </li>`
    )
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
