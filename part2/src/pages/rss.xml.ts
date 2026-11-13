import rss from "@astrojs/rss";
import type { APIRoute } from "astro";
import { getNoteEntries, getWorkEntries } from "@/lib/content";

export const GET: APIRoute = async ({ site }) => {
  const [notes, works] = await Promise.all([getNoteEntries("id"), getWorkEntries("id")]);
  const items = [
    ...notes.map((note) => ({
      title: note.data.title,
      description: note.data.summary,
      pubDate: new Date(note.data.publishedAt),
      link: `/notes/${note.data.slug}`
    })),
    ...works.map((work) => ({
      title: `Case Study: ${work.data.title}`,
      description: work.data.summary,
      pubDate: new Date(`${work.data.year}-01-01`),
      link: `/work/${work.data.slug}`
    }))
  ];

  return rss({
    title: "wira.studio — Engineering Notes & Case Studies",
    description:
      "Studi kasus rekayasa perangkat lunak dan catatan teknis arsitektur dari Wira Sukma Saputra.",
    site: site?.toString() || "https://wira.studio",
    items
  });
};

