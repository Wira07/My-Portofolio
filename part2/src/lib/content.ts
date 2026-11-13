import { getCollection, type CollectionEntry } from "astro:content";
import type { Locale } from "./i18n";
import profileData from "@/content/data/profile.json";
import capabilitiesData from "@/content/data/capabilities.json";
import processData from "@/content/data/process.json";
import packagesData from "@/content/data/packages.json";
import usesData from "@/content/data/uses.json";

export type WorkEntry = CollectionEntry<"work">;
export type NoteEntry = CollectionEntry<"notes">;

export async function getWorkEntries(locale: Locale): Promise<WorkEntry[]> {
  const all = await getCollection("work", (entry) => entry.data.locale === locale);
  return all.sort((a, b) => a.data.order - b.data.order);
}

export async function getFeaturedWorkEntries(locale: Locale): Promise<WorkEntry[]> {
  const all = await getWorkEntries(locale);
  return all.filter((item) => item.data.featured);
}

export async function getNoteEntries(locale: Locale): Promise<NoteEntry[]> {
  const all = await getCollection("notes", (entry) => entry.data.locale === locale);
  return all.sort(
    (a, b) => new Date(b.data.publishedAt).getTime() - new Date(a.data.publishedAt).getTime()
  );
}

export function getProfile() {
  return profileData;
}

export function getCapabilities() {
  return capabilitiesData.items;
}

export function getProcessSteps() {
  return processData.steps;
}

export function getPackages() {
  return packagesData.packages;
}

export function getWizardConfig() {
  return packagesData.wizardConfig;
}

export function getUses() {
  return usesData.categories;
}

export function formatMetricValue(val: string): { display: string; isTodo: boolean } {
  if (val.trim() === "TODO_METRIC") {
    return { display: "—", isTodo: true };
  }
  return { display: val, isTodo: false };
}

