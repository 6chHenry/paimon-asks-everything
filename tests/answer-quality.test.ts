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
});
