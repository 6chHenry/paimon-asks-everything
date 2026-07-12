import { questionSuggestionTopics } from "@/data/question-suggestion-topics";
import type { QuestionSuggestionResult } from "@/lib/domain";
import {
  generateQuestionSuggestions,
  validateGeneratedQuestions,
} from "@/lib/question-suggestion-generator";
import type { QuestionSuggestionRequest } from "@/lib/schemas";
import { TtlCache } from "@/lib/ttl-cache";

const generatedSuggestionsCache = new TtlCache<QuestionSuggestionResult>(
  30 * 60 * 1000,
);

export function findQuestionSuggestionTopic(topicId: string) {
  return questionSuggestionTopics.find((topic) => topic.id === topicId);
}

export function fallbackQuestionSuggestions(
  request: Pick<QuestionSuggestionRequest, "topicId" | "language">,
): QuestionSuggestionResult | null {
  const topic = findQuestionSuggestionTopic(request.topicId);
  if (!topic) return null;
  return {
    topicId: topic.id,
    questions: [...topic.fallbackQuestions[request.language]],
    source: "fallback",
  };
}

export function questionSuggestionCacheKey(request: QuestionSuggestionRequest) {
  return [
    request.language,
    request.topicId,
    request.profile,
    request.progress,
    request.spoilerPreference,
    request.focus.join(","),
    request.customTopic?.trim().normalize("NFKC").toLocaleLowerCase() ?? "",
  ].join(":");
}

type SuggestionGenerator = (
  topic: NonNullable<ReturnType<typeof findQuestionSuggestionTopic>>,
  request: QuestionSuggestionRequest,
) => Promise<string[] | null>;

export async function getQuestionSuggestionResult(
  request: QuestionSuggestionRequest,
  generator: SuggestionGenerator = generateQuestionSuggestions,
): Promise<QuestionSuggestionResult | null> {
  const topic = findQuestionSuggestionTopic(request.topicId);
  if (!topic) return null;
  const cacheKey = questionSuggestionCacheKey(request);
  const cached = generatedSuggestionsCache.get(cacheKey);
  if (cached) return cached;

  const generated = await generator(topic, request);
  const validated = generated
    ? validateGeneratedQuestions(JSON.stringify(generated))
    : null;
  if (!validated) {
    const fallback = fallbackQuestionSuggestions(request);
    return fallback && request.customTopic
      ? { ...fallback, customFallback: true }
      : fallback;
  }

  return generatedSuggestionsCache.set(cacheKey, {
    topicId: topic.id,
    questions: validated,
    source: "generated",
  });
}
