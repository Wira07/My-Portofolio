import type { APIRoute } from "astro";
import { getNoteEntries, getWorkEntries } from "@/lib/content";

export const GET: APIRoute = async ({ site }) => {
  const origin = (site?.toString() || "https://wira.studio").replace(/\/$/, "");
  const [works, notes] = await Promise.all([getWorkEntries("id"), getNoteEntries("id")]);

  const staticPaths = ["/", "/work", "/capabilities", "/process", "/notes", "/about", "/engage", "/uses"];
  const workPaths = works.map((w) => `/work/${w.data.slug}`);
  const notePaths = notes.map((n) => `/notes/${n.data.slug}`);
  const allBasePaths = [...staticPaths, ...workPaths, ...notePaths];

  const urls = allBasePaths.flatMap((p) => {
    const idUrl = `${origin}${p}`;
    const enUrl = p === "/" ? `${origin}/en/` : `${origin}/en${p}`;
    return [
      `  <url>\n    <loc>${idUrl}</loc>\n    <xhtml:link rel="alternate" hreflang="id" href="${idUrl}" />\n    <xhtml:link rel="alternate" hreflang="en" href="${enUrl}" />\n  </url>`,
      `  <url>\n    <loc>${enUrl}</loc>\n    <xhtml:link rel="alternate" hreflang="id" href="${idUrl}" />\n    <xhtml:link rel="alternate" hreflang="en" href="${enUrl}" />\n  </url>`
    ];
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join("\n")}\n</urlset>\n`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" }
  });
};

