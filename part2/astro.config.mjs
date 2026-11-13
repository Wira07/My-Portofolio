import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://wira.studio",
  integrations: [mdx()],
  vite: {
    plugins: [tailwindcss()]
  },
  i18n: {
    defaultLocale: "id",
    locales: ["id", "en"],
    routing: {
      prefixDefaultLocale: false
    }
  },
  build: {
    inlineStylesheets: "auto"
  }
});

