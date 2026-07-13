import { describe, expect, it } from "vitest";
import {
  cleanWebText,
  containsUnrenderedHtmlEntity,
  hasRepeatedSiteChrome,
  isNavigationHeavy,
  looksLikeDialogueDump,
  preferHigherQualityWebText,
} from "@/lib/web-text-quality";

describe("web text quality", () => {
  it("decodes named and numeric HTML entities", () => {
    expect(cleanWebText("婕德&amp;旅行者&hellip;&#x4E00;&#20108;"))
      .toBe("婕德&旅行者…一二");
    expect(containsUnrenderedHtmlEntity("婕德&hellip;")).toBe(true);
    expect(containsUnrenderedHtmlEntity(cleanWebText("婕德&hellip;"))).toBe(false);
  });

  it("detects adjacent repeated site chrome", () => {
    const text =
      "旅行者创作平台-观测枢-原神wiki旅行者创作平台-观测枢-原神wiki";
    expect(hasRepeatedSiteChrome(text)).toBe(true);
  });

  it("detects navigation-heavy page text", () => {
    expect(
      isNavigationHeavy(
        "Created with Sketch 首页 新闻 公告 攻略 图鉴 角色 武器 圣遗物 社区 编辑 历史",
      ),
    ).toBe(true);
  });

  it("detects an uncontextualized speaker-label dialogue dump", () => {
    expect(
      looksLikeDialogueDump(
        "婕德：那个家伙让我不爽。婕德：现在安静了。婕德：她会孤独吗？婕德：真可惜。",
      ),
    ).toBe(true);
  });

  it("keeps a clean search snippet instead of a noisy fetched page excerpt", () => {
    const original = "婕德发现芭别尔的陷害后与塔尼特决裂，并决定选择自己的道路。";
    const page =
      "Created with Sketch 首页 新闻 公告 攻略 图鉴 角色 武器 圣遗物 社区 编辑 " +
      "旅行者创作平台-观测枢-原神wiki旅行者创作平台-观测枢-原神wiki";
    expect(preferHigherQualityWebText(original, page)).toBe(original);
  });
});
