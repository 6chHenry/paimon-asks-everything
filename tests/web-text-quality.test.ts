import { describe, expect, it } from "vitest";
import {
  cleanWebText,
  containsUnrenderedHtmlEntity,
  decodeHtmlEntities,
  hasRepeatedSiteChrome,
  isNavigationHeavy,
  isUnusableWebText,
  looksLikeBrowserEditShell,
  looksLikeDialogueDump,
  looksLikeShortRawDialogue,
  looksLikeSiteDescriptionShell,
  preferHigherQualityWebText,
  webTextQualityScore,
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

  it("detects a compact task-index run with fewer than six navigation tokens", () => {
    expect(
      isNavigationHeavy(
        "任务攻略 任务流程 前置任务 后续任务 智慧筑屋,凿成七柱 流沙如泪的神殿 埋葬丰饶的沙丘",
      ),
    ).toBe(true);
  });

  it("hard-rejects live wiki breadcrumb, bookmark, and editing instructions", () => {
    const liveExcerpt =
      '首页 > 头像 > 婕德与奔奔 如果是第一次来,按"Ctrl+D"...按右上角“WIKI功能→编辑”...';

    expect(isNavigationHeavy(liveExcerpt)).toBe(true);
    expect(webTextQualityScore(liveExcerpt)).toBe(Number.NEGATIVE_INFINITY);
  });

  it("hard-rejects a high-confidence browser and collaborative-edit shell", () => {
    const liveExcerpt =
      "This site requires JavaScript enabled. Please check your browser settings... 欢迎正在阅读这个条目的旅行者协助 编辑本条目...萌娘百科祝各位旅行者在本站度过愉快的时光!";
    const cleanExcerpt =
      "失去父亲后，她一度把新的部族当作归属，认清背叛后决定自己选择未来。";

    expect(looksLikeBrowserEditShell(liveExcerpt)).toBe(true);
    expect(isNavigationHeavy(liveExcerpt)).toBe(true);
    expect(isUnusableWebText(liveExcerpt)).toBe(true);
    expect(webTextQualityScore(liveExcerpt)).toBe(Number.NEGATIVE_INFINITY);
    expect(looksLikeBrowserEditShell(cleanExcerpt)).toBe(false);
    expect(isUnusableWebText(cleanExcerpt)).toBe(false);
  });

  it.each([
    "欢迎阅读本页面的剧情分析，本文将帮助你理解角色的成长。",
    "Welcome to this page. This article will help readers understand the character arc.",
  ])("keeps reader-help copy that does not ask anyone to edit: %s", (cleanExcerpt) => {
    expect(looksLikeBrowserEditShell(cleanExcerpt)).toBe(false);
    expect(isNavigationHeavy(cleanExcerpt)).toBe(false);
    expect(isUnusableWebText(cleanExcerpt)).toBe(false);
    expect(webTextQualityScore(cleanExcerpt)).toBeGreaterThan(0);
  });

  it.each([
    "欢迎正在阅读本页面的旅行者协助编辑本条目。",
    "Welcome, readers. Please help edit this page.",
  ])("detects an explicit collaborative edit instruction: %s", (editShell) => {
    expect(looksLikeBrowserEditShell(editShell)).toBe(true);
    expect(isUnusableWebText(editShell)).toBe(true);
  });

  it("detects an uncontextualized speaker-label dialogue dump", () => {
    expect(
      looksLikeDialogueDump(
        "婕德：那个家伙让我不爽。婕德：现在安静了。婕德：她会孤独吗？婕德：真可惜。",
      ),
    ).toBe(true);
  });

  it("detects multiline dialogue turns with repeated speakers", () => {
    expect(
      looksLikeDialogueDump(
        "婕德：那个家伙让我不爽\n旅行者：我们先冷静下来\n婕德：现在已经安静了",
      ),
    ).toBe(true);
  });

  it("detects a dense raw transcript even when every speaker label differs", () => {
    expect(
      looksLikeDialogueDump(
        "婕德：我不能再相信她了。旅行者：先把线索理清。派蒙：这里还有一封信。阿萨里格：你们不该看到它。芭别尔：一切都是为了部族。",
      ),
    ).toBe(true);
  });

  it.each([
    "派蒙:想念婕德和奔奔了... 冻梨:你还别说，这段剧情确实让人难忘。",
    "派蒙：想念婕德和奔奔了……冻梨：你还别说，这段剧情确实让人难忘。",
  ])("detects a short raw dialogue excerpt from its opening turns: %s", (excerpt) => {
    expect(looksLikeShortRawDialogue(excerpt)).toBe(true);
  });

  it("keeps narrative prose that contains only one quoted line", () => {
    expect(
      looksLikeShortRawDialogue(
        "这段剧情展示了婕德逐渐建立自我判断的过程。婕德：这一次我要自己决定。此后她独自踏上旅程。",
      ),
    ).toBe(false);
  });

  it.each([
    "米游社-原神社区是米哈游旗下官方社区，提供游戏资讯、攻略、角色图鉴、活动内容与玩家交流。",
    "星港论坛是由北辰互动运营的官方社区平台，提供新闻、攻略、图鉴与活动内容。",
    "Starlight Hub is an official community operated by Northwind Media, offering news, guides, a catalog, and events.",
  ])("hard-rejects a source-neutral site-description shell: %s", (shell) => {
    expect(looksLikeSiteDescriptionShell(shell)).toBe(true);
    expect(isUnusableWebText(shell)).toBe(true);
    expect(webTextQualityScore(shell)).toBe(Number.NEGATIVE_INFINITY);
  });

  it.each([
    "社区分析认为，她仍在学习如何为自己做决定。",
    "她加入的社区由居民共同运营，后来成为她短暂的归属。",
  ])("keeps substantive prose that happens to mention a community: %s", (prose) => {
    expect(looksLikeSiteDescriptionShell(prose)).toBe(false);
    expect(isUnusableWebText(prose)).toBe(false);
  });

  it("keeps a concise narrative summary that includes one quoted exchange", () => {
    expect(
      looksLikeDialogueDump(
        "剧情概述：两人先因共同目标合作。博士：研究可以继续。富人：资金会按约定提供。此后双方仍保持利益合作。",
      ),
    ).toBe(false);
  });

  it("does not mistake structured prose labels for dialogue turns", () => {
    expect(
      looksLikeDialogueDump("前因：她发现了陷害。转折：她选择反抗。结果：她走上自己的道路。"),
    ).toBe(false);
  });

  it("keeps a clean search snippet instead of a noisy fetched page excerpt", () => {
    const original = "婕德发现芭别尔的陷害后与塔尼特决裂，并决定选择自己的道路。";
    const page =
      "Created with Sketch 首页 新闻 公告 攻略 图鉴 角色 武器 圣遗物 社区 编辑 " +
      "旅行者创作平台-观测枢-原神wiki旅行者创作平台-观测枢-原神wiki";
    expect(preferHigherQualityWebText(original, page)).toBe(original);
  });

  it("hard-rejects a long candidate containing only repeated site chrome noise", () => {
    const original = "婕德与塔尼特决裂。";
    const candidate =
      "这段页面正文很长但没有提供更可靠的情节上下文。".repeat(40) +
      "观测枢wiki观测枢wiki";
    expect(candidate.length).toBeGreaterThan(700);
    expect(hasRepeatedSiteChrome(candidate)).toBe(true);
    expect(isNavigationHeavy(candidate)).toBe(false);
    expect(preferHigherQualityWebText(original, candidate)).toBe(original);
  });

  it("hard-rejects a long candidate containing only navigation noise", () => {
    const original = "婕德选择了自己的道路。";
    const candidate =
      "这段页面正文很长但没有提供更可靠的情节上下文。".repeat(40) +
      " 首页 新闻 公告 攻略 图鉴 角色";
    expect(candidate.length).toBeGreaterThan(700);
    expect(hasRepeatedSiteChrome(candidate)).toBe(false);
    expect(isNavigationHeavy(candidate)).toBe(true);
    expect(preferHigherQualityWebText(original, candidate)).toBe(original);
  });

  it("hard-rejects a long detected dialogue dump", () => {
    const original = "婕德最终选择独自上路。";
    const candidate = (
      "婕德：那个家伙让我不爽，但我会继续说很长很长的一段台词来填满页面\n" +
      "旅行者：我们应该先冷静下来，再把所有重复对话逐句记录下来\n"
    ).repeat(16);
    expect(candidate.length).toBeGreaterThan(700);
    expect(looksLikeDialogueDump(candidate)).toBe(true);
    expect(preferHigherQualityWebText(original, candidate)).toBe(original);
  });

  it("double-decodes common typographic entities with a strict pass bound", () => {
    expect(
      decodeHtmlEntities(
        "&amp;mdash;&ensp;&ldquo;约定&rdquo;&ndash;&lsquo;继续&rsquo;&bull;&middot;",
      ),
    ).toBe("— “约定”–‘继续’•·");

    const overEncoded = decodeHtmlEntities("&amp;amp;mdash;");
    expect(overEncoded).toBe("&mdash;");
    expect(containsUnrenderedHtmlEntity(overEncoded)).toBe(true);
  });

  it("leaves invalid scalar and display entities unresolved and rejects them", () => {
    const invalid = "&#0; &#x1F; &#xD800; &#xFDD0; &#xFFFF; &#x110000;";
    expect(decodeHtmlEntities(invalid)).toBe(invalid);
    expect(containsUnrenderedHtmlEntity(cleanWebText(invalid))).toBe(true);

    const original = "婕德与塔尼特决裂。";
    const candidate = "看似详尽的候选正文。".repeat(100) + invalid;
    expect(preferHigherQualityWebText(original, candidate)).toBe(original);
  });

  it("hard-rejects unresolved named entities", () => {
    const original = "婕德离开了塔尼特部族。";
    const candidate = "看似详尽的候选正文。".repeat(100) + "&unknownentity;";
    expect(preferHigherQualityWebText(original, candidate)).toBe(original);
  });

  it("strips literal and encoded directional format controls", () => {
    const directionalControls =
      "\u061c" +
      Array.from({ length: 0x10 }, (_, offset) =>
        String.fromCodePoint(0x2060 + offset),
      ).join("");
    const encodedDirectionalControls =
      "&#x061C;" +
      Array.from(
        { length: 0x10 },
        (_, offset) => `&#x${(0x2060 + offset).toString(16)};`,
      ).join("");

    expect(cleanWebText(`前${directionalControls}后`)).toBe("前后");
    expect(cleanWebText(`前${encodedDirectionalControls}后`)).toBe("前后");
  });
});
