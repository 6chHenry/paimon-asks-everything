import { answerSystemPrompt } from "@/lib/answer-prompt";
import { requestDeepSeekAnthropic } from "@/lib/deepseek-anthropic";
import type { Citation, Language, KnowledgeEntry, Profile, QuestionCategory } from "@/lib/domain";
import {
  classifyWebSource,
  entityRelevanceScore,
  type SearchPlan,
} from "@/lib/external-search";
import type { GroundedGenerationResult } from "@/lib/generation";
import { parseNativeWebSearchResponse, type NativeWebSearchResult } from "@/lib/native-web-search";
import { normalizeSearchResultUrl } from "@/lib/search-result-url";
import {
  assessSourceRule,
  legacySourceFields,
  sourceAllowedForQuestion,
  sourceGovernanceScore,
} from "@/lib/source-governance";

export interface NativeAdapterContext {
  question: string;
  language: Language;
  plan: SearchPlan;
}

export interface GenerationDiagnostics {
  apiStyle: "anthropic" | "openai";
  searchProvider: "deepseek_native" | "custom_web";
  model: string;
  responseBlockTypes?: string[];
  nativeSearchRequests?: number;
  nativeSearchResultCount?: number;
  selectedCitationCount?: number;
  fallbackReason?: string;
  stopReason?: string | null;
  answerTruncated?: boolean;
}

export type NativeGenerationOutcome =
  | { ok: true; result: GroundedGenerationResult; diagnostics: GenerationDiagnostics }
  | { ok: false; reason: string; diagnostics: GenerationDiagnostics };

function containsCjk(value: string) {
  return /[\u3400-\u9fff]/u.test(value);
}

function canonicalUrl(value: string) {
  const url = new URL(value);
  url.hash = "";
  return url.toString().replace(/\/$/u, "").toLowerCase();
}

function nativeExcerpt(language: Language) {
  return language === "zh-CN"
    ? "DeepSeek 原生搜索返回的相关页面"
    : "Relevant page returned by DeepSeek native search";
}

export function adaptNativeSearchResults(
  results: NativeWebSearchResult[],
  context: NativeAdapterContext,
) {
  const seen = new Set<string>();
  return results.flatMap((result, index) => {
    const url = normalizeSearchResultUrl(result.url);
    if (!url) return [];
    const key = canonicalUrl(url);
    if (seen.has(key)) return [];
    seen.add(key);
    const excerpt = result.snippet?.trim() || nativeExcerpt(context.language);
    const assessment = assessSourceRule({ url, title: result.title, excerpt });
    const legacy = legacySourceFields(assessment);
    const classification = classifyWebSource(url);
    const crossLanguage = context.language === "zh-CN" &&
      !containsCjk(`${result.title} ${result.snippet ?? ""}`);
    const citation: Citation = {
      id: `native-${index + 1}`,
      title: result.title.trim() || classification.sourceName,
      url,
      sourceName: classification.sourceName,
      sourceKind: legacy.sourceKind,
      credibility: legacy.credibility,
      factStatus: legacy.factStatus,
      excerpt,
      external: true,
      crossLanguage,
      assessment,
    };
    return !crossLanguage &&
      sourceAllowedForQuestion(citation, { question: context.question, plan: context.plan }) &&
      (!context.plan.coreEntities.length || entityRelevanceScore(citation, context.plan) > 0)
      ? [citation]
      : [];
  }).sort((a, b) => sourceGovernanceScore(b, { question: context.question, plan: context.plan }) -
      sourceGovernanceScore(a, { question: context.question, plan: context.plan }))
    .slice(0, 6);
}

function paragraphsFromAnswer(answer: string) {
  return answer.split(/\n{2,}/u).map((text) => ({ text: text.trim(), citationIds: [] })).filter((item) => item.text);
}

function nativePrompt(language: Language, deepStory: boolean) {
  return `${answerSystemPrompt(language, deepStory)}
Use native web search for factual Genshin Impact questions. Answer the conclusion in the first one or two sentences, then explain naturally.
Baidu Baike, Moegirl, Fandom, and BWIKI are valid trusted secondary references for stable worldbuilding, identity, organization, and released story facts. Never call them first-party official sources.
For a normal Chinese question, prefer 300-600 Chinese characters. Do not write an audit report. Do not emit numeric citation markers unless they map to a real URL.`;
}

export async function generateNativeGroundedResponse(input: {
  question: string;
  language: Language;
  profile: Profile;
  entries: KnowledgeEntry[];
  category?: QuestionCategory;
  deepStory?: boolean;
  searchPlan: SearchPlan;
  apiKey: string;
  baseUrl: string;
  model: string;
  signal?: AbortSignal;
}): Promise<NativeGenerationOutcome> {
  const diagnostics: GenerationDiagnostics = {
    apiStyle: "anthropic",
    searchProvider: "deepseek_native",
    model: input.model,
  };
  try {
    const request = {
      baseUrl: input.baseUrl,
      apiKey: input.apiKey,
      model: input.model,
      system: nativePrompt(input.language, Boolean(input.deepStory)),
      messages: [{ role: "user" as const, content: JSON.stringify({
        language: input.language,
        playerProfile: input.profile,
        question: input.question,
        controlledEvidence: input.entries,
        deepStory: Boolean(input.deepStory),
      }) }],
      maxTokens: input.deepStory ? 1600 : 900,
      signal: input.signal,
    };
    let response = await requestDeepSeekAnthropic(request);
    let parsed = parseNativeWebSearchResponse(response);
    if (parsed.answerTruncated && !/[。！？.!?]\s*$/u.test(parsed.answer)) {
      response = await requestDeepSeekAnthropic({
        ...request,
        messages: [...request.messages, { role: "user" as const, content: "Please answer more briefly and finish every sentence." }],
        maxTokens: 700,
      });
      parsed = parseNativeWebSearchResponse(response);
    }
    const external = adaptNativeSearchResults(parsed.results, {
      question: input.question,
      language: input.language,
      plan: input.searchPlan,
    });
    Object.assign(diagnostics, {
      responseBlockTypes: parsed.blockTypes,
      nativeSearchRequests: parsed.nativeSearchRequests,
      nativeSearchResultCount: parsed.results.length,
      selectedCitationCount: external.length,
      stopReason: parsed.stopReason,
      answerTruncated: parsed.answerTruncated,
    });
    if (!parsed.answer) return { ok: false, reason: "missing_final_text", diagnostics };
    if (!external.length && input.searchPlan.coreEntities.length) {
      return { ok: false, reason: "no_relevant_native_results", diagnostics };
    }
    if (parsed.answerTruncated && !/[。！？.!?]\s*$/u.test(parsed.answer)) {
      return { ok: false, reason: "incomplete_max_tokens", diagnostics };
    }
    return {
      ok: true,
      result: {
        answer: parsed.answer,
        answerParagraphs: paragraphsFromAnswer(parsed.answer),
        external,
        citedSourceIds: [],
        searchPlan: input.searchPlan,
        diagnostics,
      },
      diagnostics,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "native_request_failed";
    return { ok: false, reason, diagnostics: { ...diagnostics, fallbackReason: reason } };
  }
}

export async function searchNativeReadingResources(input: {
  question: string;
  language: Language;
  searchPlan: SearchPlan;
  queries: string[];
  apiKey: string;
  baseUrl: string;
  model: string;
  signal?: AbortSignal;
}) {
  const queries = Array.from(
    new Set(input.queries.map((query) => query.trim()).filter(Boolean)),
  ).slice(0, 3);
  if (!queries.length) return [];
  try {
    const response = await requestDeepSeekAnthropic({
      baseUrl: input.baseUrl,
      apiKey: input.apiKey,
      model: input.model,
      system:
        "Find useful optional Genshin Impact reading or viewing resources. Prefer official pages and videos, quest transcripts, then mature story guides. Use web search once. Do not include leaks or invent URLs.",
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            language: input.language,
            question: input.question,
            queries,
            instruction:
              "Search these alternatives in one tool invocation and return only a short acknowledgement after searching.",
          }),
        },
      ],
      maxTokens: 300,
      signal: input.signal,
    });
    const parsed = parseNativeWebSearchResponse(response);
    return adaptNativeSearchResults(parsed.results, {
      question: input.question,
      language: input.language,
      plan: input.searchPlan,
    });
  } catch {
    return [];
  }
}
