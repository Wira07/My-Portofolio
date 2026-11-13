import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

export const workSchema = z.object({
  title: z.string(),
  slug: z.string(),
  locale: z.enum(["id", "en"]),
  summary: z.string().max(160),
  category: z.array(z.enum(["web", "android", "iot", "ai", "uiux"])).min(1),
  role: z.string(),
  year: z.number(),
  duration: z.string(),
  client: z.string(),
  stack: z.array(z.string()).min(1),
  cover: z.string(),
  coverAlt: z.string(),
  draft: z.boolean().default(false),
  metrics: z
    .array(
      z.object({
        label: z.string(),
        value: z.string(),
        note: z.string().optional()
      })
    )
    .default([]),
  links: z
    .object({
      live: z.string().url().optional(),
      repo: z.string().url().optional(),
      demo: z.string().url().optional()
    })
    .default({}),
  architecture: z.object({
    title: z.string(),
    caption: z.string(),
    nodes: z.array(
      z.object({
        id: z.string(),
        label: z.string(),
        sub: z.string(),
        group: z.enum(["input", "core", "storage", "output"])
      })
    ),
    edges: z.array(
      z.object({
        from: z.string(),
        to: z.string(),
        label: z.string().optional()
      })
    ),
    mermaid: z.string()
  }),
  gallery: z
    .array(
      z.object({
        src: z.string(),
        alt: z.string(),
        caption: z.string(),
        width: z.number().default(1280),
        height: z.number().default(800)
      })
    )
    .default([]),
  featured: z.boolean().default(false),
  order: z.number()
});

export const noteSchema = z.object({
  title: z.string(),
  slug: z.string(),
  locale: z.enum(["id", "en"]),
  summary: z.string().max(180),
  publishedAt: z.string(),
  readingTime: z.string(),
  tags: z.array(z.string()).min(1),
  relatedWork: z.array(z.string()).default([])
});

const work = defineCollection({
  loader: glob({
    pattern: "**/*.mdx",
    base: "./src/content/work",
    generateId: ({ entry }) => entry.replace(/\.mdx?$/, "")
  }),
  schema: workSchema
});

const notes = defineCollection({
  loader: glob({
    pattern: "**/*.mdx",
    base: "./src/content/notes",
    generateId: ({ entry }) => entry.replace(/\.mdx?$/, "")
  }),
  schema: noteSchema
});

export const collections = { work, notes };

