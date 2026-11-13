import type { APIRoute } from "astro";
import { getNoteEntries, getWorkEntries } from "@/lib/content";
import { renderOgPng } from "@/lib/og";

export async function getStaticPaths() {
  const [works, notes] = await Promise.all([getWorkEntries("id"), getNoteEntries("id")]);

  return [
    {
      params: { slug: "default" },
      props: {
        eyebrow: "INDEPENDENT SOFTWARE STUDIO",
        title: "Software yang dibangun seperti produk, bukan proyek.",
        subtitle: "Web (Laravel/PHP, JS) · Android (Kotlin) · IoT (MQTT) · Computer Vision (YOLO11)",
        tag: "WIRA.STUDIO"
      }
    },
    ...works.map((w) => ({
      params: { slug: w.data.slug },
      props: {
        eyebrow: `CASE STUDY // ${w.data.year}`,
        title: w.data.title,
        subtitle: w.data.summary,
        tag: w.data.category.map((c) => c.toUpperCase()).join(" · ")
      }
    })),
    ...notes.map((n) => ({
      params: { slug: n.data.slug },
      props: {
        eyebrow: `ENGINEERING NOTE // ${n.data.publishedAt}`,
        title: n.data.title,
        subtitle: n.data.summary,
        tag: n.data.tags.slice(0, 2).join(" · ")
      }
    }))
  ];
}

export const GET: APIRoute = async ({ props }) => {
  const png = await renderOgPng(props as { eyebrow: string; title: string; subtitle: string; tag?: string });
  return new Response(new Uint8Array(png), {
    headers: { "Content-Type": "image/png" }
  });
};

