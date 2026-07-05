import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(...segments: string[]) {
  return readFileSync(path.join(process.cwd(), ...segments), "utf8");
}

describe("Genshin-style shell source", () => {
  it("uses the global game navigation shell instead of a topbar-first layout", () => {
    const appShell = source("components", "app-shell.tsx");

    expect(appShell).toContain("game-shell");
    expect(appShell).toContain("game-nav-rail");
    expect(appShell).toContain("game-status-bar");
    expect(appShell).toContain("game-content");
    expect(appShell).toContain("game-bottom-nav");
    expect(appShell).toContain("aria-label=\"Main navigation\"");
    expect(appShell).toContain("aria-current");
    expect(appShell).toContain("clientPath(\"/\")");
    expect(appShell).toContain("版本情报");
    expect(appShell).not.toContain("className=\"topbar\"");
    expect(appShell).not.toContain("className=\"nav-links\"");
  });

  it("defines shell styles and mobile navigation behavior", () => {
    const css = source("app", "globals.css");

    expect(css).toContain("--shell-blue");
    expect(css).toContain("--frame-gold");
    expect(css).toContain(".game-nav-rail");
    expect(css).toContain(".game-status-bar");
    expect(css).toContain(".game-bottom-nav");
    expect(css).toContain("@media (max-width: 760px)");
  });
});

describe("Genshin-style homepage source", () => {
  it("keeps homepage orchestration small and delegates visual sections", () => {
    const page = source("app", "page.tsx");

    expect(page).toContain("HomeHeroIntel");
    expect(page).toContain("HomeVideoFeature");
    expect(page).toContain("HomeCharacterDossier");
    expect(page).toContain("HomeGraphSummary");
    expect(page).toContain("HomePreheatBrief");
    expect(page).toContain("HomeAskEntry");
    expect(page).toContain("TravelerContextDrawer");
    expect(page).not.toContain("<SnezhnayaGraph graph={snezhnayaGraph} />");
  });

  it("provides a graph preview component as the strongest homepage entry", () => {
    const preview = source("components", "snezhnaya-graph-preview.tsx");

    expect(preview).toContain("SnezhnayaGraphPreview");
    expect(preview).toContain("home-graph-preview");
    expect(preview).toContain("href={href}");
    expect(preview).toContain("aria-label");
    expect(preview).toContain("graph.nodes");
    expect(preview).not.toContain("analyzeRelationship");
  });

  it("defines the homepage section hooks in a focused component file", () => {
    const home = source("components", "home-intel.tsx");

    for (const exportName of [
      "HomeHeroIntel",
      "HomeVideoFeature",
      "HomeCharacterDossier",
      "HomeGraphSummary",
      "HomePreheatBrief",
      "HomeAskEntry",
      "TravelerContextDrawer",
    ]) {
      expect(home).toContain(`export function ${exportName}`);
    }
  });
});
