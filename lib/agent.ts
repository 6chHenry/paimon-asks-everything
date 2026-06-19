import { randomUUID } from "node:crypto";
import {
  classifyQuestion,
  isDeepStoryIntent,
  isHighRiskSpoilerQuestion,
} from "@/lib/classification";
import type {
  ChatResult,
  Citation,
  Claim,
  KnowledgeEntry,
  QuestionEvent,
} from "@/lib/domain";
import { recordEvent } from "@/lib/event-store";
import { buildHints, generateGroundedResponse } from "@/lib/generation";
import { t } from "@/lib/i18n";
import { retrieveControlled } from "@/lib/retrieval";
import type { ChatRequest } from "@/lib/schemas";
import { createSpoilerToken } from "@/lib/spoiler-token";
import { recommendStoryResources } from "@/lib/story-resources";
import { emitTrace, type TraceEmitter } from "@/lib/trace";

const prohibitedTerms = [
  "外挂",
  "自动跑图",
  "自动脚本",
  "代练",
  "账号交易",
  "cheat",
  "bot script",
  "account trading",
  "play for me",
];

function isProhibited(question: string) {
  const normalized = question.toLowerCase();
  return prohibitedTerms.some((term) => normalized.includes(term));
}

function inferQuestionLanguage(
  question: string,
  fallback: ChatRequest["language"],
) {
  if (/[\u3400-\u9fff]/u.test(question)) return "zh-CN";
  const latinWords = question.match(/[a-z]{2,}/giu) ?? [];
  return latinWords.length >= 3 ? "en" : fallback;
}

function toCitations(
  entries: Array<KnowledgeEntry & { crossLanguage?: boolean }>,
): Citation[] {
  return entries.map((entry, index) => ({
    id: `source-${index + 1}`,
    title: entry.title,
    url: entry.source.url,
    sourceName: entry.source.sourceName,
    sourceKind: entry.source.sourceKind,
    factStatus: entry.factStatus,
    excerpt: entry.content,
    external: false,
    crossLanguage: Boolean(entry.crossLanguage),
  }));
}

function toClaims(entries: KnowledgeEntry[], citations: Citation[]): Claim[] {
  return entries.slice(0, 3).map((entry, index) => ({
    text: entry.summary,
    citationIds: citations[index] ? [citations[index].id] : [],
    factStatus: entry.factStatus,
  }));
}

function inferConfidence(input: {
  entries: KnowledgeEntry[];
  topScore: number;
  citations: Citation[];
  citedSourceIds: string[];
}): ChatResult["confidence"] {
  if (input.entries.length) return input.topScore >= 6 ? "high" : "medium";

  const citedIds = new Set(input.citedSourceIds);
  const cited = input.citations.filter((citation) =>
    citedIds.size ? citedIds.has(citation.id) : citation.external,
  );
  const evidence = cited.length ? cited : input.citations;
  if (evidence.some((citation) => citation.credibility === "official")) return "high";
  if (evidence.some((citation) => citation.credibility === "trusted_wiki")) {
    return "medium";
  }
  return "low";
}

async function persistResult(
  request: ChatRequest,
  result: ChatResult,
): Promise<ChatResult> {
  const eventId = randomUUID();
  const event: QuestionEvent = {
    id: eventId,
    occurredAt: new Date().toISOString(),
    language: result.language,
    playerProfile: request.profile,
    questionCategory: result.eventClassification.questionCategory,
    confusionTopic: result.eventClassification.confusionTopic,
    spoilerGateTriggered: result.spoilerAction === "confirmation_required",
    usedExternalSearch: result.usedExternalSources,
    responseStatus: result.status,
    sourceKind: "live_increment",
    questionText: request.allowQuestionTextStorage
      ? request.question
      : undefined,
    textConsent: request.allowQuestionTextStorage,
  };
  try {
    await recordEvent(event);
    return { ...result, eventRecorded: true, eventId };
  } catch {
    return { ...result, eventRecorded: false };
  }
}

export async function runAgent(
  request: ChatRequest,
  options: {
    confirmedHighRisk?: boolean;
    recordEvent?: boolean;
    emitTrace?: TraceEmitter;
  } = {},
): Promise<ChatResult> {
  const finish = (result: ChatResult) =>
    options.recordEvent === false
      ? Promise.resolve(result)
      : persistResult(request, result);
  const language = inferQuestionLanguage(request.question, request.language);
  const eventClassification = classifyQuestion(
    request.question,
    language,
  );
  const deepStory = isDeepStoryIntent(
    request.question,
    eventClassification.questionCategory,
  );
  await emitTrace(options.emitTrace, {
    stage: "classify",
    status: "complete",
    message: "看懂问题啦",
    detail: eventClassification.questionCategory,
  });

  if (isProhibited(request.question)) {
    return finish({
      status: "refused",
      answer: t(
        language,
        "这个可不行！外挂、自动化和账号交易，派蒙不能帮忙。要是卡在机关或路线，派蒙可以给你提示。",
        "That one’s off-limits, Traveler. Paimon can’t help with cheats, automation, or account trading, but I can give hints for a puzzle or route.",
      ),
      language,
      answerMode: "safe_refusal",
      claims: [],
      citations: [],
      spoilerAction: "none",
      usedExternalSources: false,
      confidence: "high",
      eventClassification,
      eventRecorded: false,
    });
  }

  const retrieval = retrieveControlled({
    question: request.question,
    language,
    progress: request.progress,
    spoilerPreference: request.spoilerPreference,
    focus: request.focus,
    allowHighRisk: options.confirmedHighRisk,
    maxResults: deepStory ? 8 : 4,
  });
  await emitTrace(options.emitTrace, {
    stage: "retrieval",
    status: "complete",
    message: "本地资料找到了",
    detail: `${retrieval.entries.length} 条命中`,
  });

  if (
    !options.confirmedHighRisk &&
    (isHighRiskSpoilerQuestion(request.question) || deepStory)
  ) {
    await emitTrace(options.emitTrace, {
      stage: "spoiler",
      status: "complete",
      message: "这里要先确认剧透",
    });
    return finish({
      status: "spoiler_confirmation_required",
      answer: "",
      language,
      answerMode: "limited_answer",
      claims: [],
      citations: [],
      spoilerAction: "confirmation_required",
      usedExternalSources: false,
      confidence: "high",
      eventClassification,
      eventRecorded: false,
      confirmationToken: createSpoilerToken(request.question),
      reason: t(
        language,
        deepStory
          ? "这会展开完整故事线，关键转折也会讲到。旅行者，还要继续吗？"
          : "再说下去会碰到关键身份或反转。旅行者，还要继续吗？",
        deepStory
          ? "This will cover the full story, including major turns. Continue, Traveler?"
          : "This reaches a major identity or twist. Continue, Traveler?",
      ),
    });
  }

  const entries = retrieval.entries;
  const generated = await generateGroundedResponse({
    question: request.question,
    language,
    profile: request.profile,
    entries,
    external: [],
    deepStory,
    emitTrace: options.emitTrace,
  });
  const controlledCitations = toCitations(entries);
  const citations = [...controlledCitations, ...generated.external];

  if (!entries.length && !generated.external.length) {
    return finish({
      status: "insufficient_evidence",
      answer: t(
        language,
        "唔……派蒙还没找到可靠资料。先不乱下结论啦。",
        "Hmm… Paimon couldn’t find reliable evidence, so I won’t guess.",
      ),
      language,
      answerMode: "limited_answer",
      claims: [],
      citations: [],
      spoilerAction: "filtered",
      usedExternalSources: true,
      confidence: "low",
      eventClassification,
      eventRecorded: false,
    });
  }

  const isGameplay = eventClassification.questionCategory === "gameplay";
  const recommendationIntent = generated.searchPlan.intent;
  const shouldRecommendReading =
    eventClassification.questionCategory === "story" ||
    eventClassification.questionCategory === "character" ||
    recommendationIntent === "story" ||
    recommendationIntent === "identity" ||
    recommendationIntent === "current_status" ||
    recommendationIntent === "official_media";
  const readingRecommendations =
    shouldRecommendReading
      ? await recommendStoryResources(request.question, language, {
          liveSearch:
            deepStory ||
            eventClassification.questionCategory === "character" ||
            recommendationIntent === "identity" ||
            recommendationIntent === "current_status" ||
            recommendationIntent === "official_media",
          searchPlan: generated.searchPlan,
        }).catch(() => [])
      : [];

  const result = {
    status: "answered",
    answer: generated.answer,
    language,
    answerMode: deepStory
      ? "deep_story"
      : isGameplay
      ? "layered_hint"
      : request.profile === "returning"
        ? "minimal_catch_up"
        : "evidence_answer",
    claims: entries.length ? toClaims(entries, citations) : [],
    citations,
    spoilerAction: options.confirmedHighRisk
      ? "confirmed"
      : retrieval.blockedHighRisk.length
        ? "filtered"
        : "none",
    usedExternalSources: generated.external.length > 0,
    confidence: inferConfidence({
      entries,
      topScore: retrieval.topScore,
      citations,
      citedSourceIds: generated.citedSourceIds,
    }),
    eventClassification,
    eventRecorded: false,
    hints: isGameplay ? buildHints(language) : undefined,
    deepStory,
    readingRecommendations,
  } satisfies ChatResult;
  await emitTrace(options.emitTrace, {
    stage: "final",
    status: "complete",
    message: "回答整理好啦",
    detail: `${citations.length} 条来源`,
  });
  return finish(result);
}
