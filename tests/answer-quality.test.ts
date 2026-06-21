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
});
