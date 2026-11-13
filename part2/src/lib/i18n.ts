import idDict from "@/i18n/id.json";
import enDict from "@/i18n/en.json";

export type Locale = "id" | "en";
export type Dictionary = typeof idDict;

const DICTS: Record<Locale, Dictionary> = {
  id: idDict,
  en: enDict
};

export function getDict(locale: Locale): Dictionary {
  return DICTS[locale] ?? idDict;
}

export function t(locale: Locale, key: string): string {
  const parts = key.split(".");
  let cur: unknown = getDict(locale);
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in cur) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return key;
    }
  }
  return typeof cur === "string" ? cur : key;
}

export function localePath(locale: Locale, path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (locale === "id") return normalized;
  if (normalized === "/") return "/en/";
  return `/en${normalized}`;
}

export function switchLocalePath(currentPath: string, targetLocale: Locale): string {
  const clean = currentPath.replace(/\/+$/, "") || "/";
  if (targetLocale === "en") {
    if (clean === "/") return "/en/";
    if (clean.startsWith("/en")) return currentPath;
    return `/en${clean}`;
  } else {
    if (clean === "/en") return "/";
    if (clean.startsWith("/en/")) return clean.slice(3) || "/";
    return clean;
  }
}

