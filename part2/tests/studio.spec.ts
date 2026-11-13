import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const ROUTES_TO_AUDIT = ["/", "/work", "/work/ag-420-gas-analyzer", "/capabilities", "/process", "/notes", "/about", "/engage", "/uses", "/en/"];

test.describe("wira.studio — Acceptance Criteria Suite", () => {
  test("Navigation across primary routes renders H1 cleanly", async ({ page }) => {
    for (const route of ROUTES_TO_AUDIT) {
      await page.goto(route);
      const h1 = page.locator("h1").first();
      await expect(h1).toBeVisible();
      const bodyText = await page.locator("body").innerText();
      expect(bodyText).not.toContain("TODO_METRIC");
    }
  });

  test("Theme toggle & Language toggle persist and navigate cleanly", async ({ page }) => {
    await page.goto("/");
    const html = page.locator("html");
    const initialTheme = await html.getAttribute("data-theme");
    expect(["dark", "light"]).toContain(initialTheme);

    await page.locator("[data-theme-toggle]").first().click();
    const toggledTheme = await html.getAttribute("data-theme");
    expect(toggledTheme).toBe(initialTheme === "dark" ? "light" : "dark");

    await page.reload();
    expect(await html.getAttribute("data-theme")).toBe(toggledTheme);

    await page.locator("[data-lang-toggle]").first().click();
    await expect(page).toHaveURL(/\/en\/?$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("Work page category filtering filters cards dynamically", async ({ page }) => {
    await page.goto("/work");
    const allCards = page.locator("[data-work-card]");
    await expect(allCards).toHaveCount(8);

    await page.locator('[data-work-filter="iot"]').click();
    const visibleCards = page.locator("[data-work-card]:not([hidden])");
    await expect(visibleCards).toHaveCount(1);
    await expect(visibleCards.first()).toContainText("AG-420 ADI Gas Analyzer");
  });

  test("Command Palette opens with Ctrl+K, filters, and navigates via keyboard", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Control+k");
    const dialog = page.locator("#command-palette");
    await expect(dialog).toBeVisible();

    const search = page.locator("#cmd-search-input");
    await search.fill("AG-420");
    const visibleOptions = page.locator('#cmd-results button[role="option"]:not([hidden])');
    await expect(visibleOptions.first()).toContainText("AG-420 ADI Gas Analyzer");

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/work\/ag-420-gas-analyzer\/?$/);
  });

  test("Brief Wizard step progression, validation, and submission work cleanly", async ({ page }) => {
    await page.goto("/engage");
    const nextBtn = page.locator("#wizard-next");
    await nextBtn.click(); // Step 2
    await expect(page.locator('[data-wizard-panel="1"]')).toBeVisible();
    await nextBtn.click(); // Step 3
    await expect(page.locator("#wizard-est-weeks")).toBeVisible();
    await nextBtn.click(); // Step 4

    // Validation catches missing required fields
    await page.locator("#wizard-submit").click();
    await expect(page.locator("#wizard-error")).toBeVisible();

    // Valid fill succeeds
    await page.locator("#brief-name").fill("PT Contoh Indonesia");
    await page.locator("#brief-email").fill("halo@contoh.co.id");
    await page.locator("#brief-notes").fill("Butuh sistem monitoring IoT dan Android.");
    await page.locator("#wizard-submit").click();

    await expect(page.locator("#wizard-success")).toBeVisible();
    await expect(page.locator("#wizard-summary-box")).toContainText("PT Contoh Indonesia");
  });

  test("prefers-reduced-motion disables GSAP/Lenis animations cleanly", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-motion-disabled", "true");
    await expect(page.locator("h1").first()).toBeVisible();
  });

  test("Axe accessibility audit has 0 serious/critical violations on core routes (Dark & Light)", async ({ page }) => {
    const auditRoutes = ["/", "/work", "/work/ag-420-gas-analyzer", "/engage"];
    const waitSettledTheme = async (theme: "dark" | "light") => {
      const expectedRgb = theme === "dark" ? "rgb(10, 11, 13)" : "rgb(246, 245, 241)";
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(page.locator("body")).toHaveCSS("background-color", expectedRgb);
      await page.evaluate(() =>
        Promise.all(
          document
            .getAnimations()
            .filter((anim) => anim.effect?.getComputedTiming().iterations !== Infinity)
            .map((anim) => anim.finished.catch(() => {}))
        )
      );
    };

    for (const route of auditRoutes) {
      await page.goto(route);
      const heroLines = page.locator("[data-hero-line]");
      if ((await heroLines.count()) > 0) {
        await expect(heroLines.last()).toHaveCSS("opacity", "1");
      }

      const initial = (await page.locator("html").getAttribute("data-theme")) as "dark" | "light";
      await waitSettledTheme(initial);

      const firstResults = await new AxeBuilder({ page }).analyze();
      const firstCritical = firstResults.violations.filter((v) =>
        ["serious", "critical"].includes(v.impact || "")
      );
      expect(firstCritical, `Axe ${initial} violations on ${route}`).toEqual([]);

      const toggled: "dark" | "light" = initial === "dark" ? "light" : "dark";
      await page.locator("[data-theme-toggle]").first().click();
      await waitSettledTheme(toggled);

      const secondResults = await new AxeBuilder({ page }).analyze();
      const secondCritical = secondResults.violations.filter((v) =>
        ["serious", "critical"].includes(v.impact || "")
      );
      expect(secondCritical, `Axe ${toggled} violations on ${route}`).toEqual([]);

      // Reset to initial theme
      await page.locator("[data-theme-toggle]").first().click();
      await waitSettledTheme(initial);
    }
  });
});

