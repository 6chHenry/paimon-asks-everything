import { describe, expect, it } from "vitest";
import {
  getQuestionSuggestionResult,
  questionSuggestionCacheKey,
} from "@/lib/question-suggestions";
import {
  getQuestionSuggestionPromptContext,
  validateGeneratedQuestions,
} from "@/lib/question-suggestion-generator";
import { questionSuggestionRequestSchema } from "@/lib/schemas";

const request = {
  topicId: "aranyaka",
  language: "en" as const,
  profile: "story" as const,
  progress: "sumeru" as const,
  spoilerPreference: "low" as const,
  focus: ["story"] as ("story")[],
};

describe("question suggestions", () => {
  it("keeps four unique questions from strict model JSON", () => {
    expect(
      validateGeneratedQuestions(
        '["Why do the Aranara remember the forest?", "How is Vanarana connected to dreams?", "Which quests introduce Marana safely?", "What evidence explains the Aranara cycle?"]',
      ),
    ).toEqual([
      "Why do the Aranara remember the forest?",
      "How is Vanarana connected to dreams?",
      "Which quests introduce Marana safely?",
      "What evidence explains the Aranara cycle?",
    ]);
  });

  it("rejects duplicate, answer-shaped, and incomplete model output", () => {
    expect(validateGeneratedQuestions('["Why?", "Why?", "When?", "How?"]')).toBeNull();
    expect(validateGeneratedQuestions('["The answer is Ruu?", "Why did it happen?", "How did it happen?", "When did it happen?"]')).toBeNull();
  });

  it("falls back to the selected topic after invalid generator output", async () => {
    const result = await getQuestionSuggestionResult(request, async () => null);
    expect(result).toMatchObject({ topicId: "aranyaka", source: "fallback" });
    expect(result?.questions).toHaveLength(5);
    expect(result?.questions[0]).toContain("Aranara");
  });

  it("uses a generated result only after validation", async () => {
    const result = await getQuestionSuggestionResult(
      { ...request, topicId: "golden-slumber" },
      async () => [
        "What conflict drives Golden Slumber?",
        "How does Jeht change during the journey?",
        "Which ruins matter to the quest's context?",
        "What questions remain after the Eternal Oasis?",
      ],
    );
    expect(result).toMatchObject({ topicId: "golden-slumber", source: "generated" });
  });

  it("accepts a custom topic, keeps it in the cache key, and overlays the prompt context", () => {
    const customRequest = { ...request, customTopic: "戴因斯雷布" };
    expect(questionSuggestionRequestSchema.safeParse(customRequest).success).toBe(true);
    expect(questionSuggestionCacheKey(customRequest)).not.toBe(
      questionSuggestionCacheKey({ ...request, customTopic: "坎瑞亚" }),
    );
    expect(
      getQuestionSuggestionPromptContext(
        {
          id: "aranyaka",
          region: "sumeru",
          title: { "zh-CN": "森林书", en: "Aranyaka" },
          scope: { "zh-CN": "兰那罗", en: "Aranara" },
          sourceAnchors: [],
          fallbackQuestions: { "zh-CN": ["问题一？", "问题二？", "问题三？", "问题四？", "问题五？"], en: ["Question one?", "Question two?", "Question three?", "Question four?", "Question five?"] },
        },
        customRequest,
      ),
    ).toMatchObject({ topic: "戴因斯雷布", scope: "戴因斯雷布" });
  });

  it("marks fallback questions when custom generation cannot produce questions", async () => {
    const result = await getQuestionSuggestionResult(
      { ...request, customTopic: "戴因斯雷布" },
      async () => null,
    );
    expect(result).toMatchObject({
      topicId: "aranyaka",
      source: "fallback",
      customFallback: true,
    });
    expect(result?.questions).toHaveLength(5);
  });
});
