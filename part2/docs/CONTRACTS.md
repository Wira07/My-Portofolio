# CONTRACTS — `wira.studio` Swarm Interface Specification

Dokumen ini menjadi sumber kontrak bersama antar-modul untuk menjamin tidak ada konflik tipe data, penamaan token CSS, skema konten, atau key i18n.

---

## 1. Design Tokens (`src/styles/tokens.css`)

Tema gelap (`[data-theme="dark"]`, default) dan tema terang (`[data-theme="light"]`):

| Token | Dark Default | Light | Kegunaan |
|---|---|---|---|
| `--bg` | `#0A0B0D` | `#F6F5F1` | Latar halaman utama |
| `--surface` | `#111317` | `#FFFFFF` | Permukaan panel & kartu utama |
| `--surface-2` | `#181B21` | `#EDECE7` | Permukaan sekunder & input |
| `--line` | `#23272F` | `#D9D7D0` | Garis pemisah 1px |
| `--text` | `#ECEAE4` | `#101114` | Teks utama (WCAG AA/AAA) |
| `--text-dim` | `#9A9DA5` | `#5B5E66` | Teks sekunder & metadata |
| `--accent` | `#C8FF3D` | `#4F7A00` | Aksen lime teknis / fokus CTA |
| `--accent-ink` | `#0A0B0D` | `#FFFFFF` | Warna teks di atas latar `--accent` |
| `--accent-2` | `#6B8CFF` | `#2448D8` | Biru info & diagram arsitektur |
| `--danger` | `#FF5C5C` | `#C92A2A` | Pesan galat / validasi |

Tipografi:
- `--font-display`: `'Instrument Serif', Georgia, serif`
- `--font-sans`: `'Inter Tight', system-ui, -apple-system, sans-serif`
- `--font-mono`: `'JetBrains Mono', ui-monospace, monospace`
- Radius: `--radius-sm: 2px; --radius-md: 4px; --radius-lg: 6px;`

---

## 2. Content Collections Schema (`src/content.config.ts`)

### Collection `work`
```ts
{
  title: string;
  slug: string;
  locale: "id" | "en";
  summary: string; // max 160 chars
  category: Array<"web" | "android" | "iot" | "ai" | "uiux">; // min 1
  role: string;
  year: number;
  duration: string;
  client: string;
  stack: string[];
  cover: string;
  coverAlt: string;
  draft: boolean; // default false
  metrics: Array<{ label: string; value: string; note?: string }>;
  links: { live?: string; repo?: string; demo?: string };
  architecture: {
    title: string;
    caption: string;
    nodes: Array<{ id: string; label: string; sub: string; group: "input" | "core" | "storage" | "output" }>;
    edges: Array<{ from: string; to: string; label?: string }>;
    mermaid: string;
  };
  gallery: Array<{ src: string; alt: string; caption: string; width: number; height: number }>;
  featured: boolean;
  order: number;
}
```
> Aturan keras metrik: nilai `TODO_METRIC` tidak pernah dicetak literal ke DOM; UI wajib merender `"—"` disertai catatan status verifikasi.

### Collection `notes`
```ts
{
  title: string;
  slug: string;
  locale: "id" | "en";
  summary: string; // max 180 chars
  publishedAt: string; // YYYY-MM-DD
  readingTime: string;
  tags: string[];
  relatedWork: string[]; // slug array
}
```

---

## 3. Component Contracts

- `BaseLayout.astro`: `{ title: string; description: string; locale: Locale; path: string; ogImage?: string; jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>; activeNav?: NavKey; noindex?: boolean }`
- `Wordmark.astro`: `{ href: string; label: string; tag?: string }`
- `NavBar.astro`: `{ locale: Locale; currentPath: string; activeNav?: NavKey }`
- `StatusStrip.astro`: `{ locale: Locale }`
- `Button.astro`: `{ href?: string; type?: "button" | "submit"; variant?: "primary" | "secondary" | "ghost"; magnetic?: boolean; download?: boolean | string; target?: string; rel?: string; ariaLabel?: string; id?: string; className?: string }`
- `Section.astro`: `{ id?: string; index?: string; label: string; title?: string; subtitle?: string; borderTop?: boolean; className?: string }`
- `CaseCard.astro`: `{ item: WorkEntry; locale: Locale; index: number; layout?: "grid" | "stack" }`
- `CaseHero.astro`: `{ item: WorkEntry; locale: Locale; indexLabel: string }`
- `CaseMeta.astro`: `{ item: WorkEntry; locale: Locale }`
- `ArchDiagram.astro`: `{ architecture: WorkArchitecture; locale: Locale }`
- `MetricCounter.astro`: `{ metrics: WorkMetric[]; locale: Locale; title: string }`
- `CapabilityRow.astro`: `{ capability: CapabilityItem; locale: Locale; caseMap: Record<string, WorkEntry> }`
- `ProcessTimeline.astro`: `{ steps: ProcessStep[]; locale: Locale }`
- `BriefWizard.astro`: `{ locale: Locale }`
- `CommandPalette.astro`: `{ locale: Locale; searchItems: CommandSearchItem[] }`

---

## 4. i18n Key Structure (`src/i18n/{id,en}.json`)

Namespace top-level:
- `meta`: brand, localeName, toggleLangLabel
- `nav`: work, capabilities, process, notes, about, engage, uses, cmdPlaceholder, openMenu, closeMenu, skipToContent
- `hero`: eyebrow, headlineLine1, headlineLine2, headlineAccent, sub, ctaPrimary, ctaSecondary, scrollCue
- `home`: statusTitle, workSectionLabel, workSectionTitle, workViewAll, capLabel, capTitle, capViewAll, processLabel, processTitle, processViewAll, notesLabel, notesTitle, notesViewAll, engageLabel, engageTitle, engageSub
- `work`: title, subtitle, filterAll, categories (`web`, `android`, `iot`, `ai`, `uiux`), draftBadge, draftNotice, backToWork, meta (`role`, `duration`, `year`, `client`, `stack`, `links`, `live`, `repo`, `demo`), metricsTitle, metricsTodoNote, archTitle, mermaidToggle, nextCase, prevCase
- `capabilities`: title, subtitle, proofLabel, expandHint
- `process`: title, subtitle, deliverablesLabel, governanceTitle
- `notes`: title, subtitle, publishedLabel, readingTimeLabel, relatedWorkLabel, backToNotes
- `about`: title, subtitle, educationTitle, experienceTitle, certsTitle, ctaTitle
- `engage`: title, subtitle, packagesTitle, includesLabel, durationLabel, clientNeedsLabel, pricingPrefix, wizardTitle, wizardSteps (`step1`, `step2`, `step3`, `step4`), estimateTitle, validationError, submitSuccess, mailtoFallback, waFallback
- `uses`: title, subtitle
- `notFound`: code, title, subtitle, backHome
- `palette`: triggerLabel, searchPlaceholder, empty, groups (`pages`, `work`, `notes`, `actions`), actions (`toggleTheme`, `switchLang`, `copyEmail`, `downloadCv`)
- `footer`: sitemapTitle, connectTitle, docsTitle, cvLabel, deckLabel, copyEmail, emailCopied, localTimeLabel, versionLabel

