import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(...segments: string[]) {
  return readFileSync(path.join(process.cwd(), ...segments), "utf8");
}

describe("Snezhnaya royal atlas UI", () => {
  it("separates browsing, seat archive, and relationship analysis", () => {
    const graph = source("components", "snezhnaya-graph.tsx");

    for (const fragment of [
      'type AtlasView = "constellation" | "seats"',
      'role="tablist"',
      'role="tabpanel"',
      "snezhnaya-seat-archive",
      "snezhnaya-seat-card",
      "relationMode",
      "setRelationshipMode",
      "openNode",
      "比较两份档案",
    ]) {
      expect(graph).toContain(fragment);
    }

    expect(graph).toContain("if (relationMode)");
    expect(graph).toContain("toggleRelationNode(node)");
    expect(graph).toContain("selectGraphNode(node)");
  });

  it("keeps the atlas easter egg optional and the detail dialog escapable", () => {
    const graph = source("components", "snezhnaya-graph.tsx");

    for (const fragment of [
      "touchAtlasSeal",
      "auroraAwake",
      "aria-pressed={auroraAwake}",
      'event.key === "Escape"',
      "event.target === event.currentTarget",
      "autoFocus",
      'aria-live="polite"',
    ]) {
      expect(graph).toContain(fragment);
    }
  });

  it("loads a focused, responsive atlas visual layer", () => {
    const layout = source("app", "layout.tsx");
    const css = source("app", "snezhnaya-atlas.css");

    expect(layout).toContain('import "@/app/snezhnaya-atlas.css"');
    for (const fragment of [
      "--atlas-night",
      "--atlas-frost",
      "--atlas-porcelain",
      ".snezhnaya-atlas-masthead",
      ".snezhnaya-seat-grid",
      ".snezhnaya-detail-quick-facts",
      "min-height: 44px",
      "@media (max-width: 760px)",
      "@media (prefers-reduced-motion: reduce)",
    ]) {
      expect(css).toContain(fragment);
    }
  });
});
