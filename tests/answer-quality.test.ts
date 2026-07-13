import { describe, expect, it } from "vitest";
import {
  matchesAnswerLanguage,
  normalizeGeneratedAnswer,
  parseGeneratedAnswer,
  validateAnswerQuality,
} from "@/lib/answer-quality";

describe("answer quality", () => {
  it("accepts a Chinese answer with one proper-name gloss but rejects an English sentence", () => {
    expect(
      matchesAnswerLanguage("丝柯克（Skirk）来自星海。", "zh-CN"),
    ).toBe(true);
    expect(
      matchesAnswerLanguage(
        "丝柯克来自星海。Skirk is a wandering swordswoman from the sea of stars.",
        "zh-CN",
      ),
    ).toBe(false);
  });

  it("parses paragraph citations and strips source markers and web footnotes from text", () => {
    const parsed = parseGeneratedAnswer(
      JSON.stringify({
        paragraphs: [
          {
            text: "丝柯克来自星海。[6][7][external-1]",
            citationIds: ["external-1"],
          },
        ],
      }),
    );
    const normalized = normalizeGeneratedAnswer(parsed!);

    expect(normalized.paragraphs).toEqual([
      { text: "丝柯克来自星海。", citationIds: ["external-1"] },
    ]);
  });

  it("treats stock phrasing as a soft repetition rule and rejects dangling citations", () => {
    const failures = validateAnswerQuality({
      paragraphs: [
        {
          text:
            "先直接回答：目前不能确认。补充来看，资料有限。如果还想看，可以查看来源。",
          citationIds: ["external-9"],
        },
      ],
      language: "zh-CN",
      question: "丝柯克是外星人吗",
      allowedSourceIds: new Set(["external-1"]),
    });

    expect(failures).toContain("template_heavy");
    expect(failures).toContain("invalid_citation");
  });

  it("rejects positive official attribution backed only by non-official references", () => {
    const failures = validateAnswerQuality({
      paragraphs: [
        {
          text: "官方资料表明丝柯克来自星海。",
          citationIds: ["external-1"],
        },
      ],
      language: "zh-CN",
      question: "丝柯克来自哪里",
      allowedSourceIds: new Set(["external-1"]),
      sourceAuthorityById: new Map([["external-1", "non_official"]]),
    });

    expect(failures).toContain("authority_overclaim");
  });

  it("rejects an unsupported claim that a requested Story Quest does not exist", () => {
    const failures = validateAnswerQuality({
      paragraphs: [
        {
          text: "法尔伽目前没有实装传说任务。",
          citationIds: ["external-1"],
        },
      ],
      language: "zh-CN",
      question: "法尔伽传说任务故事梗概",
      allowedSourceIds: new Set(["external-1"]),
      sourceTextById: new Map([
        [
          "external-1",
          "法尔伽是西风骑士团大团长，角色资料包含故事与语音。",
        ],
      ]),
    });

    expect(failures).toContain("unsupported_negative_claim");
  });

  it("allows a negative Story Quest status only when the cited source says so explicitly", () => {
    const failures = validateAnswerQuality({
      paragraphs: [
        {
          text: "该角色尚未实装传说任务。",
          citationIds: ["external-1"],
        },
      ],
      language: "zh-CN",
      question: "这个角色有传说任务吗",
      allowedSourceIds: new Set(["external-1"]),
      sourceTextById: new Map([
        ["external-1", "截至当前版本，该角色尚未实装传说任务。"],
      ]),
    });

    expect(failures).not.toContain("unsupported_negative_claim");
  });

  it("rejects a no-relationship conclusion when supplied evidence records direct interaction", () => {
    const failures = validateAnswerQuality({
      paragraphs: [
        {
          text: "富人和博士之间没有任何已确认的直接关系或互动。",
          citationIds: ["external-1"],
        },
      ],
      language: "zh-CN",
      question: "富人和博士是什么关系？",
      allowedSourceIds: new Set(["external-1", "external-2"]),
      sourceTextById: new Map([
        [
          "external-1",
          "富人与博士同为愚人众执行官，分别位列第九席和第二席。",
        ],
        [
          "external-2",
          "剧情对话中，博士提到为富人换上的肺；富人表示北国银行长期资助博士研究。",
        ],
      ]),
    });

    expect(failures).toContain("unsupported_negative_claim");
  });

  it("rejects traditional-Chinese omission claims when interaction evidence exists", () => {
    const failures = validateAnswerQuality({
      paragraphs: [
        {
          text: "目前資料中並沒有提及他們之間有合作、衝突或其他特殊關聯。",
          citationIds: ["external-1"],
        },
      ],
      language: "zh-CN",
      question: "富人和博士是什么关系？",
      allowedSourceIds: new Set(["external-1", "external-2"]),
      sourceTextById: new Map([
        ["external-1", "两人同为愚人众执行官。"],
        ["external-2", "富人表示北国银行长期资助博士的研究。"],
      ]),
    });

    expect(failures).toContain("unsupported_negative_claim");
  });

  it("uses the character entity instead of treating a long Chinese Story Quest request as one token", () => {
    const failures = validateAnswerQuality({
      paragraphs: [
        {
          text: "法尔伽的故事从远征即将凯旋展开，随后围绕北风骑士的责任与抉择推进。",
          citationIds: ["external-1"],
        },
      ],
      language: "zh-CN",
      question: "法尔伽传说任务故事梗概",
      allowedSourceIds: new Set(["external-1"]),
    });

    expect(failures).not.toContain("off_topic");
  });

  it("normalizes recurring unofficial transliterations to established Chinese names", () => {
    const normalized = normalizeGeneratedAnswer({
      paragraphs: [
        {
          text: "洛亨从纳塔克赖归来，并把拉兹尔的剑交给法尔伽。",
          citationIds: ["external-1"],
        },
      ],
    });

    expect(normalized.paragraphs[0]?.text).toBe(
      "洛恩从挪德卡莱归来,并把雷泽的剑交给法尔伽。",
    );
  });

  it.each([
    "旅行者创作平台-观测枢-原神wiki旅行者创作平台-观测枢-原神wiki",
    "婕德后来明白了真相&hellip;",
    "Created with Sketch 首页 新闻 公告 攻略 图鉴 角色 武器 圣遗物 社区",
  ])("rejects leaked web noise in generated text: %s", (text) => {
    const failures = validateAnswerQuality({
      paragraphs: [{ text, citationIds: [] }],
      language: "zh-CN",
      question: "婕德经历了怎样的变化？",
      allowedSourceIds: new Set(),
    });

    expect(failures).toContain("web_noise");
  });

  it.each([
    "任务攻略 任务流程 前置任务 后续任务 智慧筑屋,凿成七柱 流沙如泪的神殿 埋葬丰饶的沙丘",
    "婕德：我不会再服从。旅行者：我们先离开。派蒙：出口在那边。阿萨里格：你们休想。芭别尔：抓住他们。",
  ])(
    "rejects a character-arc paragraph citing unusable source text: %s",
    (sourceText) => {
      const failures = validateAnswerQuality({
        paragraphs: [
          {
            text: "婕德认清操控后选择离开，并开始决定自己的道路。",
            citationIds: ["external-1"],
          },
        ],
        language: "zh-CN",
        question: "婕德经历了怎样的变化？",
        allowedSourceIds: new Set(["external-1"]),
        sourceTextById: new Map([["external-1", sourceText]]),
      });

      expect(failures).toContain("web_noise");
    },
  );

  it("allows clean relationship evidence with a concise quoted exchange", () => {
    const failures = validateAnswerQuality({
      paragraphs: [
        {
          text: "两人的关系以持续的利益合作为主。",
          citationIds: ["external-1"],
        },
      ],
      language: "zh-CN",
      question: "富人和博士是什么关系？",
      intent: "relationship",
      allowedSourceIds: new Set(["external-1"]),
      sourceTextById: new Map([
        [
          "external-1",
          "剧情概述：两人因共同目标合作。博士：研究可以继续。富人：资金会按约定提供。此后双方仍保持利益合作。",
        ],
      ]),
    });

    expect(failures).not.toContain("web_noise");
  });

  it("uses resolved story intent to reject a raw transcript for a generic story question", () => {
    const failures = validateAnswerQuality({
      paragraphs: [
        {
          text: "女士在冲突中走向了最终结局。",
          citationIds: ["external-1"],
        },
      ],
      language: "zh-CN",
      question: "女士发生了什么？",
      intent: "story",
      allowedSourceIds: new Set(["external-1"]),
      sourceTextById: new Map([
        [
          "external-1",
          "女士：你们无法阻止我。旅行者：到此为止。派蒙：小心。雷电将军：决斗已经结束。九条裟罗：所有人退后。",
        ],
      ]),
    });

    expect(failures).toContain("web_noise");
  });
});
