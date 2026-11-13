import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");

const failures = [];
const passes = [];

const checkExists = (relPath) => {
  const full = path.join(dist, relPath);
  if (!fs.existsSync(full)) {
    failures.push(`Missing build artifact: dist/${relPath}`);
  } else {
    passes.push(`Found dist/${relPath}`);
  }
};

// 1. Required routes & machine endpoints
const requiredPaths = [
  "index.html",
  "work/index.html",
  "capabilities/index.html",
  "process/index.html",
  "notes/index.html",
  "about/index.html",
  "engage/index.html",
  "uses/index.html",
  "404.html",
  "en/index.html",
  "en/work/index.html",
  "en/capabilities/index.html",
  "en/process/index.html",
  "en/notes/index.html",
  "en/about/index.html",
  "en/engage/index.html",
  "en/uses/index.html",
  "sitemap.xml",
  "robots.txt",
  "rss.xml",
  "og/default.png",
  "og/ag-420-gas-analyzer.png",
  "cv.pdf",
  "capability-deck.pdf"
];

const workSlugs = [
  "ag-420-gas-analyzer",
  "smart-attendance-ai",
  "parent-notifications",
  "kepalqu",
  "techop-id",
  "orion-studio",
  "yolo11-detection",
  "salat-detection"
];

const noteSlugs = [
  "mqtt-realtime-dashboard",
  "yolo11-android-tflite",
  "whatsapp-login-fcm-parent-app"
];

for (const s of workSlugs) {
  requiredPaths.push(`work/${s}/index.html`, `en/work/${s}/index.html`, `og/${s}.png`);
}
for (const s of noteSlugs) {
  requiredPaths.push(`notes/${s}/index.html`, `en/notes/${s}/index.html`, `og/${s}.png`);
}

for (const rel of requiredPaths) {
  checkExists(rel);
}

// 2. Scan all built HTML files for missing img attributes & leaked TODO_METRIC
const walkHtml = (dir) => {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkHtml(full));
    else if (entry.name.endsWith(".html")) out.push(full);
  }
  return out;
};

const htmlFiles = walkHtml(dist);
let imgChecked = 0;
for (const file of htmlFiles) {
  const rel = path.relative(dist, file);
  const html = fs.readFileSync(file, "utf8");

  if (html.includes("TODO_METRIC")) {
    failures.push(`Literal TODO_METRIC leaked into rendered HTML: ${rel}`);
  }

  const imgTags = html.match(/<img\b[^>]*>/gi) || [];
  for (const tag of imgTags) {
    imgChecked++;
    if (!/\balt\s*=/.test(tag)) failures.push(`<img> missing alt in ${rel}: ${tag}`);
    if (!/\bwidth\s*=/.test(tag)) failures.push(`<img> missing width in ${rel}: ${tag}`);
    if (!/\bheight\s*=/.test(tag)) failures.push(`<img> missing height in ${rel}: ${tag}`);
  }
}

console.log(`Checked ${requiredPaths.length} expected routes/assets and ${imgChecked} <img> tags across ${htmlFiles.length} HTML files.`);

// 3. Verify no hard-coded prose sentences inside src/components/**/*.astro
const walkAstro = (dir) => {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkAstro(full));
    else if (entry.name.endsWith(".astro")) out.push(full);
  }
  return out;
};

const astroFiles = walkAstro(path.join(root, "src", "components"));
const stripJsxExpressions = (input) => {
  let out = "";
  let depth = 0;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === "{") {
      depth++;
      out += " ";
    } else if (ch === "}") {
      if (depth > 0) depth--;
      out += " ";
    } else if (depth === 0) {
      out += ch;
    }
  }
  return out;
};

for (const file of astroFiles) {
  const src = fs.readFileSync(file, "utf8");
  const rawTemplate = src.split("---").slice(2).join("---")
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "");
  const templatePart = stripJsxExpressions(rawTemplate)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = templatePart.split(" ").filter((w) => /[a-zA-Z]{4,}/.test(w));
  const nonBrand = words.filter((w) => !["GitHub", "LinkedIn", "WhatsApp", "Home"].includes(w));
  if (nonBrand.length > 0) {
    failures.push(`Potential hard-coded UI text in ${path.relative(root, file)}: "${nonBrand.join(" ")}"`);
  }
}

if (failures.length > 0) {
  console.error("FAILURES:");
  for (const f of failures) console.error(" -", f);
  process.exit(1);
} else {
  console.log(`ALL CHECKS PASSED (${passes.length} artifacts verified, 0 leaked TODO_METRIC, 0 invalid <img> tags).`);
}
