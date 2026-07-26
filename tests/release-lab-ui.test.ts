import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const componentPath = "components/release-incrementality-lab.tsx";
const pagePath = "app/release-lab/page.tsx";

describe("release incrementality interview UI", () => {
  it("keeps synthetic evidence, control, uncertainty and holdout visible", () => {
    const source = readFileSync(componentPath, "utf8");

    expect(source).toContain("合成随机实验");
    expect(source).toContain("不触达");
    expect(source).toContain("95% 区间");
    expect(source).toContain("Holdout");
    expect(source).toContain("联合增量");
    expect(source).toContain("不是全部留存");
  });

  it("provides both PV targeting and channel attribution scenarios", () => {
    const source = readFileSync(componentPath, "utf8");

    expect(source).toContain('"pv"');
    expect(source).toContain('"attribution"');
    expect(source).toContain("PV × 玩家");
    expect(source).toContain("达人 × 展会");
  });

  it("renders from the validated server report", () => {
    const page = readFileSync(pagePath, "utf8");

    expect(page).toContain("loadReleaseLabReport");
    expect(page).toContain("<ReleaseIncrementalityLab");
  });

  it("adds the lab to global navigation", () => {
    const shell = readFileSync("components/app-shell.tsx", "utf8");

    expect(shell).toContain('href: "/release-lab"');
    expect(shell).toContain('labelZh: "增量实验"');
  });

  it("has focused responsive lab styles", () => {
    const styles = readFileSync("app/globals.css", "utf8");

    expect(styles).toContain(".release-lab-page");
    expect(styles).toContain(".release-lab-primary");
    expect(styles).toContain("@media (max-width: 720px)");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
