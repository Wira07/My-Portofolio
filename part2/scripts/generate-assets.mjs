import fs from "node:fs";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";

const root = process.cwd();
const workDir = path.join(root, "public", "images", "work");
fs.mkdirSync(workDir, { recursive: true });

// Ensure satori-friendly .woff files exist in public/fonts
const fontPairs = [
  ["@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff", "instrument-serif-latin-400-normal.woff"],
  ["@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff", "instrument-serif-latin-400-italic.woff"],
  ["@fontsource/inter-tight/files/inter-tight-latin-400-normal.woff", "inter-tight-latin-400-normal.woff"],
  ["@fontsource/inter-tight/files/inter-tight-latin-600-normal.woff", "inter-tight-latin-600-normal.woff"],
  ["@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff", "jetbrains-mono-latin-400-normal.woff"],
  ["@fontsource/jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff", "jetbrains-mono-latin-500-normal.woff"]
];
for (const [srcRel, destName] of fontPairs) {
  const src = path.join(root, "node_modules", srcRel);
  const dst = path.join(root, "public", "fonts", destName);
  if (fs.existsSync(src)) fs.copyFileSync(src, dst);
}

const covers = [
  {
    slug: "ag-420-gas-analyzer",
    code: "PRJ-01",
    tag: "WEB + IOT REALTIME",
    title: "AG-420 ADI Gas Analyzer",
    sub: "Multi-tenant Emission Telemetry · PHP · MQTT · MySQL",
    accent: "#C8FF3D",
    accent2: "#6B8CFF"
  },
  {
    slug: "smart-attendance-ai",
    code: "PRJ-02",
    tag: "ANDROID + COMPUTER VISION",
    title: "Smart Attendance AI",
    sub: "YOLO11 Face Detection · Recognition · Liveness Check",
    accent: "#C8FF3D",
    accent2: "#6B8CFF"
  },
  {
    slug: "parent-notifications",
    code: "PRJ-03",
    tag: "ANDROID · EDTECH",
    title: "Parent Notifications",
    sub: "SMK Model Patriot IV · WhatsApp Auth · Firebase FCM",
    accent: "#C8FF3D",
    accent2: "#6B8CFF"
  },
  {
    slug: "kepalqu",
    code: "PRJ-04",
    tag: "ANDROID · LOGISTICS",
    title: "KepalQu Delivery",
    sub: "Native Kotlin Dispatch · Courier Tracking · Offline Sync",
    accent: "#C8FF3D",
    accent2: "#6B8CFF"
  },
  {
    slug: "techop-id",
    code: "PRJ-05",
    tag: "WEB · DIGITAL AGENCY",
    title: "techop.id Studio Platform",
    sub: "Laravel Blade · Tailwind CSS · Consultation Flow",
    accent: "#C8FF3D",
    accent2: "#6B8CFF"
  },
  {
    slug: "orion-studio",
    code: "PRJ-06",
    tag: "WEB · MOTION ENGINEERING",
    title: "ORION Studio",
    sub: "Next.js · Scroll-Linked 3D Viewport · Performance Budget",
    accent: "#C8FF3D",
    accent2: "#6B8CFF"
  },
  {
    slug: "yolo11-detection",
    code: "PRJ-07",
    tag: "AI · VISION PIPELINE",
    title: "YOLO11 Object Detection",
    sub: "Custom Dataset Pipeline · Inference · Client Documentation",
    accent: "#C8FF3D",
    accent2: "#6B8CFF"
  },
  {
    slug: "salat-detection",
    code: "PRJ-08",
    tag: "AI + ANDROID · EDGE ML",
    title: "Salat Posture Detection",
    sub: "7-Class YOLO11 -> TFLite Quantized · Kotlin CameraX",
    accent: "#C8FF3D",
    accent2: "#6B8CFF"
  }
];

for (const c of covers) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="800" viewBox="0 0 1280 800">
  <defs>
    <pattern id="grid-${c.slug}" width="64" height="64" patternUnits="userSpaceOnUse">
      <path d="M 64 0 L 0 0 0 64" fill="none" stroke="#23272F" stroke-width="1"/>
    </pattern>
    <linearGradient id="glow-${c.slug}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c.accent}" stop-opacity="0.16"/>
      <stop offset="60%" stop-color="${c.accent2}" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#0A0B0D" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="1280" height="800" fill="#0A0B0D"/>
  <rect width="1280" height="800" fill="url(#grid-${c.slug})"/>
  <rect width="1280" height="800" fill="url(#glow-${c.slug})"/>
  <rect x="48" y="48" width="1184" height="704" fill="#111317" stroke="#23272F" stroke-width="1.5"/>
  <line x1="48" y1="128" x2="1232" y2="128" stroke="#23272F" stroke-width="1"/>
  <line x1="48" y1="672" x2="1232" y2="672" stroke="#23272F" stroke-width="1"/>
  <circle cx="88" cy="88" r="6" fill="${c.accent}"/>
  <text x="112" y="94" fill="#ECEAE4" font-family="monospace" font-size="20" letter-spacing="2">${c.code} // ${c.tag}</text>
  <text x="1190" y="94" text-anchor="end" fill="#9A9DA5" font-family="monospace" font-size="18">WIRA.STUDIO ARCHIVE</text>

  <!-- Technical diagram blueprint accent -->
  <g transform="translate(760, 210)" opacity="0.9">
    <rect x="0" y="0" width="420" height="360" fill="#181B21" stroke="#23272F"/>
    <line x1="0" y1="56" x2="420" y2="56" stroke="#23272F"/>
    <text x="20" y="34" fill="#9A9DA5" font-family="monospace" font-size="16">SYSTEM TOPOLOGY</text>
    <rect x="32" y="92" width="150" height="64" rx="4" fill="#111317" stroke="${c.accent2}"/>
    <text x="107" y="130" text-anchor="middle" fill="#ECEAE4" font-family="monospace" font-size="15">INPUT / EDGE</text>
    <rect x="238" y="92" width="150" height="64" rx="4" fill="#111317" stroke="${c.accent}"/>
    <text x="313" y="130" text-anchor="middle" fill="${c.accent}" font-family="monospace" font-size="15">CORE ENGINE</text>
    <rect x="32" y="232" width="150" height="64" rx="4" fill="#111317" stroke="#23272F"/>
    <text x="107" y="270" text-anchor="middle" fill="#ECEAE4" font-family="monospace" font-size="15">DATA STORE</text>
    <rect x="238" y="232" width="150" height="64" rx="4" fill="#111317" stroke="${c.accent}"/>
    <text x="313" y="270" text-anchor="middle" fill="#ECEAE4" font-family="monospace" font-size="15">CLIENT UI</text>
    <path d="M 182 124 L 238 124 M 313 156 L 313 232 M 238 264 L 182 264" stroke="${c.accent}" stroke-width="2" fill="none"/>
  </g>

  <text x="96" y="340" fill="#ECEAE4" font-family="sans-serif" font-size="54" font-weight="600">${c.title}</text>
  <text x="96" y="404" fill="#9A9DA5" font-family="monospace" font-size="22">${c.sub}</text>
  <rect x="96" y="468" width="210" height="44" rx="4" fill="${c.accent}"/>
  <text x="201" y="497" text-anchor="middle" fill="#0A0B0D" font-family="monospace" font-size="16" font-weight="700">CASE STUDY SPEC</text>

  <text x="96" y="720" fill="#9A9DA5" font-family="monospace" font-size="18">EDITORIAL ENGINEERING // VERIFIED ARCHITECTURE</text>
  <text x="1184" y="720" text-anchor="end" fill="${c.accent}" font-family="monospace" font-size="18">wira.studio/work/${c.slug}</text>
</svg>`;

  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 1280 } });
  const pngBuffer = resvg.render().asPng();
  fs.writeFileSync(path.join(workDir, `${c.slug}.png`), pngBuffer);
}

// Create a minimal valid PDF capability deck (public/capability-deck.pdf)
const pdfLines = [
  "%PDF-1.4",
  "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
  "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
  "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj",
  "4 0 obj << /Length 420 >> stream",
  "BT",
  "/F1 20 Tf 54 720 Td (wira.studio - Capability Deck) Tj",
  "/F1 12 Tf 0 -32 Td (Wira Sukma Saputra | Independent Software & Product Studio) Tj",
  "0 -24 Td (Location: Kuningan, West Java, Indonesia) Tj",
  "0 -28 Td (Core Capabilities:) Tj",
  "0 -20 Td (- Web Engineering: PHP, Laravel, JavaScript, Astro, REST API) Tj",
  "0 -18 Td (- Mobile Android: Kotlin, Jetpack Compose, MVVM, FCM) Tj",
  "0 -18 Td (- IoT & Realtime Telemetry: MQTT, Multi-tenant Dashboards) Tj",
  "0 -18 Td (- AI & Computer Vision: Python, YOLO11, TFLite Edge Inference) Tj",
  "0 -18 Td (- Product Design: UI/UX Research, Figma Design Systems, WCAG) Tj",
  "0 -28 Td (Contact: wiralodrasaputra07@gmail.com | https://wira.studio/engage) Tj",
  "ET",
  "endstream endobj",
  "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
  "xref",
  "0 6",
  "0000000000 65535 f ",
  "0000000009 00000 n ",
  "0000000058 00000 n ",
  "0000000115 00000 n ",
  "0000000241 00000 n ",
  "0000000712 00000 n ",
  "trailer << /Size 6 /Root 1 0 R >>",
  "startxref",
  "780",
  "%%EOF"
];
fs.writeFileSync(path.join(root, "public", "capability-deck.pdf"), pdfLines.join("\n"));
console.log("Generated 8 PNG case study covers + capability-deck.pdf + copied .woff fonts");

