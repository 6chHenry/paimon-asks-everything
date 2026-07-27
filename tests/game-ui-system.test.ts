import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(...segments: string[]) {
  return readFileSync(path.join(process.cwd(), ...segments), "utf8");
}

describe("whole-site game UI system", () => {
  it("adds route-aware in-game chrome without changing the primary navigation", () => {
    const shell = source("components", "app-shell.tsx");

    for (const fragment of [
      "pageChrome",
      "route-${routeSlug}",
      "game-world-backdrop",
      "game-status-bar",
      "game-status-location",
      "game-status-archive",
      "game-main-content",
      "skip-link",
      "至冬观测档案",
    ]) {
      expect(shell).toContain(fragment);
    }
  });

  it("loads the global game layer before the atlas-specific layer", () => {
    const layout = source("app", "layout.tsx");
    const gameUiIndex = layout.indexOf('import "@/app/game-ui.css"');
    const atlasIndex = layout.indexOf('import "@/app/snezhnaya-atlas.css"');

    expect(gameUiIndex).toBeGreaterThan(-1);
    expect(atlasIndex).toBeGreaterThan(gameUiIndex);
  });

  it("covers every page archetype and keeps accessibility safeguards", () => {
    const css = source("app", "game-ui.css");

    for (const fragment of [
      ".home-intel-page",
      ".preheat-page",
      ".ask-page",
      ".release-decision-page",
      ".preview-page",
      ".about-page",
      ".game-status-bar",
      "min-height: 44px",
      "grid-template-columns: repeat(4, minmax(0, 1fr))",
      "@media (max-width: 760px)",
      "@media (prefers-reduced-motion: reduce)",
      ":focus-visible",
    ]) {
      expect(css).toContain(fragment);
    }
  });

  it("keeps both homepage carousel indicators compact and visually unified", () => {
    const css = source("app", "game-ui.css");

    for (const fragment of [
      ".home-video-dots,\n.snezhnaya-character-dots",
      ".home-video-dots button.active,\n.snezhnaya-character-dots button.active",
      ".home-video-dots button::before,\n.snezhnaya-character-dots button::before",
      ".home-video-dots button.active::before,\n.snezhnaya-character-dots button.active::before",
      "background: transparent",
      "width: 18px",
      "width: 28px",
    ]) {
      expect(css).toContain(fragment);
    }

    expect(css).not.toContain(
      ".home-video-dots button { min-width: 44px; min-height: 44px;",
    );
    expect(css).not.toContain(
      ".snezhnaya-character-dots button { min-width: 44px; min-height: 44px;",
    );
  });
});
