import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const componentSource = readFileSync(
  new URL("../components/release-decision-center.tsx", import.meta.url),
  "utf8",
);

const cssSource = readFileSync(
  new URL("../app/globals.css", import.meta.url),
  "utf8",
);

describe("focused release-insights UI", () => {
  it("centers the page on a three-reason recommendation stack", () => {
    expect(componentSource).toContain("release-recommendation-stack");
    expect(componentSource).toContain("玩家需要");
    expect(componentSource).toContain("现在发布");
    expect(componentSource).toContain("注意边界");
    expect(componentSource).toContain("开发组参考");
  });

  it("renders the server-provided AI recommendations instead of recomputing rule actions", () => {
    expect(componentSource).toContain("releaseBriefing?.recommendations");
    expect(componentSource).not.toContain("computeReleaseDecisions");
  });

  it("removes duplicated dashboard sections from the main flow", () => {
    expect(componentSource).not.toContain("机会与风险矩阵");
    expect(componentSource).not.toContain("发布前理解风险");
    expect(componentSource).not.toContain("本次会议建议");
  });

  it("keeps detailed evidence in one accessible disclosure", () => {
    expect(componentSource).toContain("aria-expanded");
    expect(componentSource).toContain("当前建议依据");
    expect(componentSource).toContain("主题热度");
    expect(componentSource).toContain("证据明细");
    expect(componentSource).toContain("判断规则与数据缺口");
    expect(componentSource).not.toContain("release-evidence-tabs");
  });

  it("provides responsive editorial styling for the focused hierarchy", () => {
    expect(cssSource).toContain(".release-recommendation-stack");
    expect(cssSource).toContain(".release-reason-row");
    expect(cssSource).toContain(".release-developer-reference");
    expect(cssSource).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
