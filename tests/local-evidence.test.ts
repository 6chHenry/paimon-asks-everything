import { describe, expect, it } from "vitest";
import { knowledgeEntries } from "@/data/knowledge";
import type { KnowledgeEntry } from "@/lib/domain";
import type { SearchPlan } from "@/lib/external-search";
import { assessLocalEvidenceSufficiency } from "@/lib/local-evidence";

function plan(overrides: Partial<SearchPlan>): SearchPlan {
  return {
    coreEntities: [],
    aliases: [],
    intent: "general",
    queries: [],
    ...overrides,
  };
}

function entry(conceptId: string, language = "zh-CN") {
  const found = knowledgeEntries.find(
    (candidate) =>
      candidate.conceptId === conceptId && candidate.language === language,
  );
  if (!found) throw new Error(`Missing fixture ${conceptId}/${language}`);
  return found;
}

const jehtProfile: KnowledgeEntry = {
  id: "jeht-profile-zh",
  conceptId: "jeht-profile",
  language: "zh-CN",
  title: "婕德人物资料",
  content: "婕德是旅行者在沙漠中认识的佣兵。",
  summary: "婕德是沙漠佣兵。",
  aliases: ["婕德"],
  tags: ["jeht", "character"],
  contentType: "character",
  spoilerLevel: 1,
  minimumProgress: "sumeru",
  factStatus: "trusted_secondary",
  source: {
    title: "婕德",
    url: "https://example.com/jeht",
    sourceName: "Test Wiki",
    sourceKind: "trusted_wiki",
  },
  reviewed: true,
};

describe("local evidence sufficiency", () => {
  it("accepts a reviewed atomic relationship fact", () => {
    expect(
      assessLocalEvidenceSufficiency({
        question: "冰之女皇与愚人众执行官之间是什么关系？",
        category: "character",
        entries: [entry("tsaritsa-harbingers-command")],
        plan: plan({
          coreEntities: ["冰之女皇", "愚人众执行官"],
          intent: "relationship",
        }),
      }),
    ).toEqual({
      sufficient: true,
      reason: "atomic_relationship",
      entryIds: ["tsaritsa-harbingers-command-zh"],
    });
  });

  it("accepts the controlled Fontaine catch-up bridge", () => {
    expect(
      assessLocalEvidenceSufficiency({
        question: "我停在枫丹，现在还能看懂目标版本吗？",
        category: "version_overview",
        entries: [entry("fontaine-bridge")],
        plan: plan({ intent: "general" }),
      }),
    ).toEqual({
      sufficient: true,
      reason: "controlled_catch_up",
      entryIds: ["fontaine-bridge-zh"],
    });
  });

  it("accepts the generic layered puzzle hint", () => {
    expect(
      assessLocalEvidenceSufficiency({
        question: "这个机械机关我卡住了，先给一点提示。",
        category: "gameplay",
        entries: [entry("mechanical-puzzle")],
        plan: plan({ intent: "general" }),
      }),
    ).toEqual({
      sufficient: true,
      reason: "layered_hint",
      entryIds: ["mechanical-puzzle-zh"],
    });
  });

  it("never treats a single character card as a complete character arc", () => {
    expect(
      assessLocalEvidenceSufficiency({
        question: "婕德经历了怎样的成长？",
        category: "character",
        entries: [jehtProfile],
        plan: plan({
          coreEntities: ["婕德"],
          intent: "story",
          storyScope: "character_arc",
        }),
      }),
    ).toEqual({
      sufficient: false,
      reason: "character_arc_requires_stage_coverage",
      entryIds: [],
    });
  });
});
