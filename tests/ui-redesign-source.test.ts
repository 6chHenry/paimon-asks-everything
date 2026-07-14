import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(...segments: string[]) {
  return readFileSync(path.join(process.cwd(), ...segments), "utf8");
}

describe("Genshin-style shell source", () => {
  it("uses the global game navigation shell instead of a topbar-first layout", () => {
    const appShell = source("components", "app-shell.tsx");

    for (const fragment of [
      "game-shell",
      "game-nav-rail",
      "game-nav-tools",
      "language-toggle",
      "game-content",
      "game-bottom-nav",
      "aria-label=\"Main navigation\"",
      "aria-current",
      "clientPath(\"/\")",
      "版本情报",
      "navCollapsed",
      "game-nav-collapse",
      "PanelLeftClose",
      "PanelLeftOpen",
    ]) {
      expect(appShell).toContain(fragment);
    }

    expect(appShell).not.toContain("Unofficial concept demo");
    expect(appShell).not.toContain("非官方");
    expect(appShell).not.toContain("className=\"topbar\"");
    expect(appShell).not.toContain("className=\"nav-links\"");
  });

  it("defines shell styles and mobile navigation behavior", () => {
    const css = source("app", "globals.css");

    expect(css).toContain("--shell-blue");
    expect(css).toContain("--frame-gold");
    expect(css).toContain("--nav-ease");
    expect(css).toContain("cubic-bezier(.2, 0, .38, .9)");
    expect(css).toContain("grid-template-rows: auto 1fr auto");
    expect(css).toContain("grid-template-areas: \"brand toggle\"");
    expect(css).toContain(".game-nav-brand-slot");
    expect(css).toContain(".game-nav-collapse-slot");
    expect(css).toContain("grid-template-rows: 38px 42px");
    expect(css).toContain("gap: 18px");
    expect(css).toContain("padding-top: 9px");
    expect(css).toContain("align-self: start");
    expect(css).toContain("position: static !important");
    expect(css).toContain(".game-shell.nav-collapsed .game-nav-collapse:hover");
    expect(css).toContain(".game-nav-rail");
    expect(css).toContain(".game-shell.nav-collapsed");
    expect(css).toContain(".game-nav-collapse");
    expect(css).toContain(".game-nav-tools");
    expect(css).toContain(".game-bottom-nav");
    expect(css).toContain("@media (max-width: 760px)");
    expect(css).not.toContain("top: 56px");
    expect(css).toContain("@supports (content-visibility: auto)");
    expect(css).toContain("content-visibility: auto");
    expect(css).toContain("contain-intrinsic-size");
    expect(css).toContain(".suggestions-panel");
    expect(css).toContain(".composer:focus-within");
    expect(css).toContain(".empty-conversation::before");
    expect(css).toContain(".composer textarea::placeholder");
    expect(css).toContain("brightness(0) saturate(100%) drop-shadow");
    expect(css).toContain("box-shadow: inset 3px 0 0 rgba(200,170,110,.58)");
    expect(css).toContain("min-height: 198px");
    expect(css).toContain("-webkit-line-clamp: 2");
    expect(css).toContain("order: 5");
    expect(css).toContain("transition-duration: .01ms !important");
  });

  it("keeps the about story as a secondary bilingual easter-egg page", () => {
    const about = source("app", "about", "page.tsx");
    const shell = source("components", "app-shell.tsx");
    const css = source("app", "globals.css");
    const primaryNavigation = shell.slice(
      shell.indexOf("const navigation"),
      shell.indexOf("];", shell.indexOf("const navigation")) + 2,
    );

    expect(about).toContain('"use client"');
    expect(about).toContain("usePreferences");
    expect(about).toContain("为什么需要它");
    expect(about).toContain("Why it needs to exist");
    expect(about).toContain("让玩家更容易进入故事，而不是替玩家经历故事");
    expect(shell).toContain('href={clientPath("/about")}');
    expect(shell).toContain("game-nav-about");
    expect(primaryNavigation).not.toContain("/about");
    expect(shell.indexOf("game-nav-about")).toBeGreaterThan(
      shell.indexOf("game-nav-tools"),
    );
    expect(shell.indexOf("game-nav-about")).toBeLessThan(
      shell.indexOf("game-nav-language-label"),
    );
    expect(css).toContain(".about-page");
    expect(css).toContain(".game-nav-about");
    expect(css).toContain(".about-story-grid");
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
    expect(page).not.toContain("TravelerContextDrawer");
    expect(page).not.toContain("progressItems");
    expect(page).not.toContain("onSelectProgress");
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
  it("keeps PreheatNote concise without a competing depth selector", () => {
    const note = source("components", "preheat-note.tsx");

    expect(note).toContain("export function PreheatNote");
    expect(note).toContain("className=\"intel-brief\"");
    expect(note).not.toContain("selectedDepth");
    expect(note).not.toContain("onSelectDepth");
    expect(note).not.toContain("depth-selector");
    expect(note).toContain("onStart");
  });

  it("renders three role-specific views without focus or depth controls", () => {
    const page = source("app", "preheat", "page.tsx");
    const views = source("components", "preheat-role-views.tsx");

    expect(page).toContain("preheat-intel-page");
    expect(page).toContain("PreheatNote");
    expect(page).toContain("noteOpened");
    expect(page).toContain("preheat-settings-panel");
    expect(page).toContain("preheat-progress-card");
    expect(page).toContain("TravelerContextDrawer");
    expect(page).toContain("setPreferences");
    expect(page).toContain("Latest completed main quest");
    expect(page).toContain("ProgressButtonGroup");
    expect(page).toContain("visibleProfiles");
    expect(page).toContain("NewPlayerPreheat");
    expect(page).toContain("ReturningPlayerPreheat");
    expect(page).toContain("StoryPlayerPreheat");
    expect(page).not.toContain("toggleFocus");
    expect(page).not.toContain('focus: preferences.focus.join(",")');
    expect(page).toContain("preheat-refresh-status");
    expect(page).not.toContain('<select\n            value={preferences.progress}');
    expect(views).toContain("地区速览");
    expect(views).toContain("从这里继续期待");
    expect(views).toContain("完整事件链");
    expect(views).toContain("preheat-intel-workbench");
    expect(views).toContain("GnosisTimeline");
    expect(views).toContain("RelationMap");
    expect(page).toContain("record(\"timeline_node_opened\"");
    const progressButtons = source("components", "progress-button-group.tsx");
    expect(progressButtons).toContain("aria-pressed");
    expect(progressButtons).toContain("progress-button-grid");
    const css = source("app", "globals.css");
    expect(css).toContain("grid-template-columns: minmax(300px, .62fr) minmax(360px, 1fr)");
    expect(css).toContain(".preheat-settings-panel .traveler-context-drawer details:not([open]) summary");
    expect(css).toContain(".progress-button-grid");
    expect(css).toContain(".preheat-progress-card .region-button > span");
    expect(css).toContain("font: 700 22px/1.2 var(--display)");
    expect(css).toContain(".traveler-context-summary");
    expect(page).not.toContain("preheat-intel-masthead");
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
      ".preheat-progress-card",
      ".snezhnaya-intel-section",
      ".ask-layout",
      ".conversation-panel",
      ".suggestions-panel",
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

    for (const badFragment of ["闁?", "缂?", "闁?", "濠?", "闂?"]) {
      expect(combined).not.toContain(badFragment);
    }
  });
});

describe("Paimon evidence experience source", () => {
  it("reframes evidence and trace details in player-facing language", () => {
    const answerCard = source("components", "answer-card.tsx");
    const traceTimeline = source("components", "trace-timeline.tsx");

    expect(answerCard).toContain("派蒙查到的线索");
    expect(answerCard).toContain("playerFactBoundary");
    expect(answerCard).toContain("clue-ledger");
    expect(traceTimeline).toContain("考据记录");
    expect(traceTimeline).toContain("open={!collapsed}");
  });

  it("keeps the clue heading out of the evidence-row grid", () => {
    const styles = source("app", "globals.css");

    expect(styles).toContain(
      ".claim-list > div:not(.clue-ledger-heading) { display: grid;",
    );
    expect(styles).not.toMatch(/\.claim-list > div\s*\{\s*display: grid;/u);
    expect(styles).toContain(
      ".clue-ledger-heading small { max-width: none; text-align: left; }",
    );
  });

  it("renders verification status without changing the clue heading layout", () => {
    const answerCard = source("components", "answer-card.tsx");
    const styles = source("app", "globals.css");

    expect(answerCard).toContain("线索已核验");
    expect(answerCard).toContain("部分线索已核验");
    expect(answerCard).toContain("模型已有知识·未实时核验");
    expect(answerCard).toContain("verification-status");
    expect(styles).toContain(".verification-status.model_knowledge");
    expect(styles).toContain(
      ".claim-list > div:not(.clue-ledger-heading) { display: grid;",
    );
  });
});

describe("Paimon discoveries source", () => {
  it("wires the daily note and shareable clue card into the app", () => {
    expect(source("app", "layout.tsx")).toContain("DiscoveriesProvider");
    expect(source("app", "page.tsx")).toContain("TodayPaimonNote");
    expect(source("components", "traveler-clue-card.tsx")).toContain("navigator.share");
    expect(source("components", "today-paimon-note.tsx")).toContain("今日派蒙小纸条");
  });

  it("records constellation exploration and keeps the brand easter egg discoverable", () => {
    expect(source("components", "snezhnaya-graph.tsx")).toContain("discoverNode(node.id)");
    expect(source("components", "snezhnaya-graph.tsx")).toContain("巡游星图");
    expect(source("components", "app-shell.tsx")).toContain("registerPaimonTap");
    expect(source("components", "app-shell.tsx")).toContain("派蒙才不是搜索按钮");
  });
});

describe("contextual ask-page suggestions", () => {
  it("uses region and story selectors with server-backed suggestion requests", () => {
    const page = source("app", "ask", "page.tsx");
    const css = source("app", "globals.css");

    expect(page).toContain('clientPath("/api/question-suggestions")');
    expect(page).toContain("questionSuggestionTopics");
    expect(page).toContain("让派蒙想几个问题");
    expect(page).toContain("派蒙准备的参考问题");
    expect(page).toContain("void submitQuestion(item, undefined, region)");
    expect(page).toContain("suggestion-region-grid");
    expect(page).toContain("suggestion-topic-grid");
    expect(page).toContain("aria-pressed");
    expect(page).toContain("regionEmblemSources");
    const regionEmblems = source("data", "region-emblems.ts");
    expect(regionEmblems).toContain("Emblem_Nod-Krai_White.png");
    expect(regionEmblems).toContain("Emblem_Snezhnaya.png");
    expect(page).toContain("region-button-emblem");
    expect(page).toContain("topic-region-${region}");
    expect(page).toContain("activeAskRegion");
    expect(page).toContain("void submitQuestion(item, undefined, region)");
    expect(page).toContain("setActiveAskRegion(askedRegion ?? null)");
    expect(page).toContain("ask-region-context");
    expect(page).toContain("派蒙翻出了");
    expect(page).toContain("const selectedRegionIcon = regionEmblemSources[region]");
    expect(page).toContain("<img src={selectedRegionIcon} alt=\"\" />");
    expect(page).not.toContain("suggestedQuestions[language]");
    expect(page).not.toContain("<select");
    expect(css).toContain(".suggestion-controls");
    expect(css).toContain(".suggestion-chip-grid");
    expect(css).toContain(".region-button.is-selected");
    expect(css).toContain(".region-button-emblem");
    expect(css).toContain("filter: brightness(0) saturate(100%)");
    expect(css).toContain(".suggestion-topic-grid button::before");
    expect(css).toContain(".topic-region-mondstadt");
    expect(css).toContain("var(--topic-accent)");
    expect(css).toContain(".ask-region-context");
    expect(css).toContain(".conversation-panel.ask-context-mondstadt");
    expect(css).toContain("font: 700 14px/1.25 var(--display)");
    expect(css).toContain(".region-mondstadt");
    expect(css).toContain(".suggestion-generate");
    expect(css).toContain(".suggestion-status");
    expect(page).toContain("customSuggestionTopic");
    expect(page).toContain('event.key === "Tab"');
    expect(page).toContain("customFallback");
    expect(page).toContain("派蒙暂时没想出来，请换个关键词再试");
    expect(css).toContain(".custom-topic-choice");
    expect(css).toContain(".custom-topic-input");
    expect(css).toContain(".custom-topic-candidates");
    expect(page).toContain("getCustomTopicCandidates(");
    expect(page).not.toContain('const customTopicKeywords = [');
  });
});
