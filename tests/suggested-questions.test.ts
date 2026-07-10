import { describe, expect, it } from "vitest";
import { questionSuggestionTopics } from "@/data/question-suggestion-topics";

describe("question suggestion topic catalog", () => {
  it("covers all selectable regions with curated bilingual fallback questions", () => {
    expect(new Set(questionSuggestionTopics.map((topic) => topic.region))).toEqual(
      new Set([
        "mondstadt",
        "liyue",
        "inazuma",
        "sumeru",
        "fontaine",
        "natlan",
        "nodkrai",
      ]),
    );
    expect(questionSuggestionTopics).toHaveLength(15);

    for (const topic of questionSuggestionTopics) {
      expect(topic.sourceAnchors.length).toBeGreaterThan(0);
      expect(topic.fallbackQuestions["zh-CN"]).toHaveLength(5);
      expect(topic.fallbackQuestions.en).toHaveLength(5);
    }
  });

  it("keeps fallback prompts as questions rather than answers", () => {
    const prompts = questionSuggestionTopics.flatMap((topic) => [
      ...topic.fallbackQuestions["zh-CN"],
      ...topic.fallbackQuestions.en,
    ]);
    expect(prompts.every((prompt) => /[?？]$/.test(prompt))).toBe(true);
    expect(prompts.join("\n")).not.toMatch(/答案是|the answer is/i);
  });
});
