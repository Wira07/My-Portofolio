/* ==========================================================================
   theme.js — toggle gelap/terang, disimpan di localStorage (A21)
   Memakai View Transitions API, fallback fade.
   ========================================================================== */
import { $, prefersReduced, announce } from "./motion.js";

const root = document.documentElement;
const current = () => (root.getAttribute("data-theme") === "light" ? "light" : "dark");

function apply(theme) {
  root.setAttribute("data-theme", theme);
  try { localStorage.setItem("theme", theme); } catch (e) { /* abaikan */ }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "light" ? "#F6F6F2" : "#0A0B10");
  updateButton();
  window.dispatchEvent(new CustomEvent("themechange", { detail: { theme } }));
}

function updateButton() {
  const btn = $("#theme-toggle");
  if (!btn) return;
  btn.setAttribute("aria-label", current() === "dark" ? "Ganti ke tema terang" : "Ganti ke tema gelap");
}

function toggle() {
  const next = current() === "dark" ? "light" : "dark";
  if (document.startViewTransition && !prefersReduced()) {
    document.startViewTransition(() => apply(next));
  } else {
    root.classList.add("theme-fade");
    apply(next);
    setTimeout(() => root.classList.remove("theme-fade"), 550);
  }
  announce(next === "light" ? "Tema terang aktif" : "Tema gelap aktif");
}

export function init() {
  const btn = $("#theme-toggle");
  if (!btn) return;
  apply(current()); // sinkronkan meta + tombol dengan nilai dari inline script
  btn.addEventListener("click", toggle);
}
