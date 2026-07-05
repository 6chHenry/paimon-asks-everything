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
