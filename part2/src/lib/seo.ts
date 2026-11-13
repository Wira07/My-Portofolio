import profile from "@/content/data/profile.json";
import type { Locale } from "./i18n";

const SITE_URL = "https://wira.studio";

export function buildCanonicalUrl(path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${clean}`;
}

export function buildAlternateUrls(path: string): { id: string; en: string } {
  const withoutEn =
    path === "/en" || path === "/en/"
      ? "/"
      : path.startsWith("/en/")
        ? path.slice(3)
        : path;
  const idUrl = `${SITE_URL}${withoutEn}`;
  const enUrl = withoutEn === "/" ? `${SITE_URL}/en/` : `${SITE_URL}/en${withoutEn}`;
  return { id: idUrl, en: enUrl };
}

export function buildPersonJsonLd(locale: Locale) {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: profile.ownerName,
    url: SITE_URL,
    jobTitle:
      locale === "id"
        ? "Independent Software & Product Engineer"
        : "Independent Software & Product Engineer",
    address: {
      "@type": "PostalAddress",
      addressRegion: "West Java",
      addressCountry: "ID"
    },
    alumniOf: {
      "@type": "CollegeOrUniversity",
      name: "Universitas Kuningan"
    },
    sameAs: [profile.social.github, profile.social.linkedin]
  };
}

export function buildServiceJsonLd(locale: Locale) {
  return {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: profile.studioName,
    url: SITE_URL,
    founder: {
      "@type": "Person",
      name: profile.ownerName
    },
    areaServed: "ID",
    description:
      locale === "id"
        ? "Studio rekayasa perangkat lunak independen: Web (Laravel/PHP, JS), Android (Kotlin), IoT (MQTT), dan Computer Vision (YOLO11/TFLite)."
        : "Independent software and product engineering studio building Web platforms, native Android apps, IoT telemetry, and Computer Vision."
  };
}

export function buildWorkJsonLd(opts: {
  title: string;
  description: string;
  url: string;
  year: number;
  stack: string[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: opts.title,
    description: opts.description,
    url: opts.url,
    dateCreated: `${opts.year}-01-01`,
    keywords: opts.stack.join(", "),
    creator: {
      "@type": "Person",
      name: profile.ownerName
    }
  };
}

