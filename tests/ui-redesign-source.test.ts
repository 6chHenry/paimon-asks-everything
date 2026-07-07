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

    expect(page).toContain("HomeVideoCarousel");
    expect(page.indexOf("<HomeVideoCarousel")).toBeLessThan(
      page.indexOf("<SnezhnayaCharacterCarousel"),
    );
    expect(page.indexOf("<SnezhnayaCharacterCarousel")).toBeLessThan(
      page.indexOf("<HomeHeroIntel"),
    );
    expect(page).toContain("SnezhnayaCharacterCarousel");
    expect(page).toContain("HomeHeroIntel");
    expect(page).not.toContain("HomeCharacterDossier");
    expect(page).not.toContain("HomeGraphSummary");
    expect(page).not.toContain("HomePreheatBrief");
    expect(page).toContain("HomeAskEntry");
    expect(page).toContain("TravelerContextDrawer");
    expect(page).not.toContain("HomeVideoFeature");
    expect(page).not.toContain("<SnezhnayaGraph graph={snezhnayaGraph} />");
  });

  it("provides a graph preview component as the strongest homepage entry", () => {
    const preview = source("components", "snezhnaya-graph-preview.tsx");

    expect(preview).toContain("SnezhnayaGraphPreview");
    expect(preview).toContain("home-graph-preview");
    expect(preview).toContain("href={href}");
    expect(preview).toContain("aria-label");
    expect(preview).toContain("graph.nodes");
    expect(preview).toContain("\"pantalone\"");
    expect(preview).not.toContain("analyzeRelationship");
  });

  it("defines the homepage section hooks in a focused component file", () => {
    const home = source("components", "home-intel.tsx");

    for (const exportName of [
      "HomeHeroIntel",
      "HomeVideoCarousel",
      "HomeCharacterDossier",
      "HomeGraphSummary",
      "HomePreheatBrief",
      "HomeAskEntry",
      "TravelerContextDrawer",
    ]) {
      expect(home).toContain(`export function ${exportName}`);
    }
    expect(home).toContain("window.setInterval");
    expect(home).toContain("manualControl");
    expect(home).toContain("setManualControl(true)");
    expect(home).toContain("video.miyousheUrl");
  });

  it("keeps graph videos out of the homepage graph and moves them to preheat", () => {
    const homePage = source("app", "page.tsx");
    const preheatPage = source("app", "preheat", "page.tsx");
    const graph = source("components", "snezhnaya-graph.tsx");
    const slider = source("components", "snezhnaya-video-slider.tsx");

    expect(homePage).toContain("showVideos={false}");
    expect(preheatPage).toContain("PreheatNote");
    expect(preheatPage).not.toContain("SnezhnayaVideoSlider");
    expect(preheatPage).not.toContain("preheat-video-block");
    expect(graph).toContain("showVideos = true");
    expect(graph).toContain("SnezhnayaVideoSlider");
    expect(slider).toContain("video.miyousheUrl");
  });
});

describe("Genshin-style preheat source", () => {
  it("keeps PreheatNote props stable while reframing it as an intelligence brief", () => {
    const note = source("components", "preheat-note.tsx");

    expect(note).toContain("export function PreheatNote");
    expect(note).toContain("className=\"intel-brief\"");
    expect(note).toContain("selectedDepth");
    expect(note).toContain("onSelectDepth");
    expect(note).toContain("onStart");
  });

  it("adds preheat page hooks without removing the existing workbench logic", () => {
    const page = source("app", "preheat", "page.tsx");

    expect(page).toContain("preheat-intel-page");
    expect(page).toContain("PreheatNote");
    expect(page).not.toContain("preheat-intel-masthead");
    expect(page).toContain("preheat-intel-workbench");
    expect(page).toContain("GnosisTimeline");
    expect(page).toContain("RelationMap");
    expect(page).toContain("record(\"timeline_node_opened\"");
  });
});

describe("Genshin-style Snezhnaya graph source", () => {
  it("adds visual integration hooks without removing graph interactions", () => {
    const graph = source("components", "snezhnaya-graph.tsx");

    expect(graph).toContain("snezhnaya-intel-section");
    expect(graph).toContain("snezhnaya-intel-map");
    expect(graph).toContain("snezhnaya-intel-detail");
    expect(graph).toContain("snezhnaya-intel-dialog");
    expect(graph).toContain("toggleRelationNode");
    expect(graph).toContain("analyzeRelationship");
    expect(graph).toContain("TraceTimeline");
    expect(graph).toContain("AnswerCard");
  });
});

describe("Genshin-style responsive safeguards", () => {
  it("defines responsive rules for shell, homepage hero, dossier cards, and graph preview", () => {
    const css = source("app", "globals.css");

    for (const selector of [
      ".game-bottom-nav",
      ".snezhnaya-character-carousel",
      ".home-hero-intel",
      ".home-graph-preview",
      ".home-dossier-grid",
      ".traveler-context-drawer",
      ".snezhnaya-intel-section",
    ]) {
      expect(css).toContain(selector);
    }

    expect(css).toContain("@media (max-width: 980px)");
    expect(css).toContain("@media (max-width: 760px)");
    expect(css).toContain("@media (max-width: 560px)");
    expect(css).toContain(".home-graph-preview-caption::after");
    expect(css).toContain("overflow-wrap: anywhere");
    expect(css).toContain("padding-bottom: 116px");
    expect(css).not.toContain("calc(-50% - 130px)");
  });

  it("does not reintroduce known mojibake in redesigned homepage sources", () => {
    const combined = [
      source("app", "page.tsx"),
      source("components", "home-intel.tsx"),
      source("components", "snezhnaya-graph-preview.tsx"),
      source("components", "preheat-note.tsx"),
    ].join("\n");

    for (const badFragment of ["鍓", "绋", "鈥", "澶", "闂"]) {
      expect(combined).not.toContain(badFragment);
    }
  });
});
