import { fetch as undiciFetch, ProxyAgent } from "undici";
import type { InsightBriefingCard } from "@/lib/insights";
import type { aggregateInsights } from "@/lib/insights";

type BaseInsights = ReturnType<typeof aggregateInsights>;

let proxyAgent: ProxyAgent | undefined;

function getProxyAgent() {
  const proxyUrl =
    process.env.https_proxy ||
    process.env.HTTPS_PROXY ||
    process.env.http_proxy ||
    process.env.HTTP_PROXY;
  if (!proxyUrl || !/^https?:\/\//i.test(proxyUrl)) return undefined;
  proxyAgent ??= new ProxyAgent(proxyUrl);
  return proxyAgent;
}

export type EnrichedInsights = BaseInsights & {
  insightsMode: "ai" | "rules_fallback";
  aiGeneratedAt?: string;
  aiError?: string;
};

function parseJsonObject(content: string) {
  const trimmed = content.trim();
  const jsonText = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "")
    : trimmed;
  try {
    return JSON.parse(jsonText) as unknown;
  } catch {
    return null;
  }
}

function allowedEvidenceItems(base: BaseInsights) {
  return new Set([
    ...base.briefingCards.flatMap((card) => card.evidenceItems),
    ...base.signals.flatMap((signal) => [
      `signal=${signal.id}`,
      `topic=${signal.topic}`,
      signal.evidence,
    ]),
    ...base.topics.map((topic) => `topic=${topic.key}`),
    ...base.languages.map((item) => `language=${item.key}:${item.count}`),
    ...base.profiles.map((item) => `profile=${item.key}:${item.count}`),
    ...base.categories.map((item) => `category=${item.key}:${item.count}`),
  ]);
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validateAiCards(
  value: unknown,
  base: BaseInsights,
): InsightBriefingCard[] | null {
  if (!value || typeof value !== "object") return null;
  const cards = (value as { briefingCards?: unknown }).briefingCards;
  if (!Array.isArray(cards) || !cards.length || cards.length > 4) return null;

  const knownTopics = new Set<string>(base.topics.map((topic) => topic.key));
  const knownLanguages = new Set<string>(base.languages.map((item) => item.key));
  const knownProfiles = new Set<string>(base.profiles.map((item) => item.key));
  const knownCategories = new Set<string>(
    base.categories.map((item) => item.key),
  );
  const knownSignals = new Set<string>(base.signals.map((item) => item.id));
  const allowedEvidence = allowedEvidenceItems(base);
  const normalized: InsightBriefingCard[] = [];

  const isSupportedEvidence = (item: string) => {
    if (allowedEvidence.has(item)) return true;
    const [prefix, rest = ""] = item.split("=");
    const key = rest.split(/[ (:/]/u)[0];
    if (prefix === "topic") return knownTopics.has(key);
    if (prefix === "language") return knownLanguages.has(key);
    if (prefix === "profile") return knownProfiles.has(key);
    if (prefix === "category") return knownCategories.has(key);
    if (prefix === "signal") return knownSignals.has(key);
    return false;
  };

  for (const raw of cards) {
    if (!raw || typeof raw !== "object") return null;
    const card = raw as Record<string, unknown>;
    const id = card.id;
    const topic = card.topic;
    const titleZh = card.titleZh;
    const titleEn = card.titleEn;
    const plainSummaryZh = card.plainSummaryZh;
    const plainSummaryEn = card.plainSummaryEn;
    const playerNeedZh = card.playerNeedZh;
    const playerNeedEn = card.playerNeedEn;
    const strategyZh = card.strategyZh;
    const strategyEn = card.strategyEn;
    const affectedPlayers = card.affectedPlayers;
    const priority = card.priority;
    const evidenceItems = card.evidenceItems;
    if (
      !isString(id) ||
      !isString(topic) ||
      !knownTopics.has(topic) ||
      !isString(titleZh) ||
      !isString(titleEn) ||
      !isString(plainSummaryZh) ||
      !isString(plainSummaryEn) ||
      !isString(playerNeedZh) ||
      !isString(playerNeedEn) ||
      !isString(strategyZh) ||
      !isString(strategyEn) ||
      !isString(affectedPlayers) ||
      (priority !== "high" && priority !== "medium") ||
      !Array.isArray(evidenceItems) ||
      evidenceItems.length === 0 ||
      !evidenceItems.every(
        (item) => typeof item === "string" && isSupportedEvidence(item),
      ) ||
      !evidenceItems.some(
        (item) => typeof item === "string" && allowedEvidence.has(item),
      )
    ) {
      return null;
    }

    normalized.push({
      id,
      topic,
      titleZh,
      titleEn,
      plainSummaryZh,
      plainSummaryEn,
      playerNeedZh,
      playerNeedEn,
      strategyZh,
      strategyEn,
      affectedPlayers,
      priority,
      evidenceItems,
    });
  }

  return normalized;
}

function buildAiInsightPrompt(base: BaseInsights) {
  return {
    total: base.total,
    liveCount: base.liveCount,
    lastUpdated: base.lastUpdated,
    languages: base.languages,
    profiles: base.profiles,
    categories: base.categories,
    topics: base.topics.slice(0, 8),
    signals: base.signals,
    consentedSamples: base.consentedSamples.map((sample) => ({
      language: sample.language,
      questionText: sample.questionText,
      sourceKind: sample.sourceKind,
    })),
    allowedEvidenceItems: [...allowedEvidenceItems(base)],
    instruction:
      "Generate 1-4 globalization strategy briefing cards from the aggregate evidence only. Do not invent topics, counts, languages, or player samples. Use plain language for publishing, community, FAQ, or localization teams. Each card must cite only strings from allowedEvidenceItems.",
    outputShape:
      '{"briefingCards":[{"id":"ai-topic","topic":"fontaine_catch_up","titleZh":"...","titleEn":"...","plainSummaryZh":"...","plainSummaryEn":"...","playerNeedZh":"...","playerNeedEn":"...","strategyZh":"...","strategyEn":"...","affectedPlayers":"...","priority":"high|medium","evidenceItems":["topic=..."]}]}',
  };
}

export async function enrichInsightsWithAi(
  base: BaseInsights,
): Promise<EnrichedInsights> {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    return { ...base, insightsMode: "rules_fallback", aiError: "not_configured" };
  }

  try {
    const endpoint = new URL(
      "/chat/completions",
      process.env.LLM_BASE_URL || "https://api.deepseek.com",
    );
    const body = JSON.stringify({
      model: process.env.LLM_MODEL || "deepseek-v4-flash",
      thinking: { type: "disabled" },
      temperature: 0.2,
      max_tokens: 1400,
      messages: [
        {
          role: "system",
          content:
            "You are a globalization insights analyst for a game publishing team. Return strict JSON only. Ground every strategy in supplied aggregate evidence. Do not expose private reasoning.",
        },
        {
          role: "user",
          content: JSON.stringify(buildAiInsightPrompt(base)),
        },
      ],
    });
    const headers = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
    const agent = getProxyAgent();
    const response = agent
      ? await undiciFetch(endpoint, {
          method: "POST",
          signal: AbortSignal.timeout(45_000),
          headers,
          body,
          dispatcher: agent,
        })
      : await fetch(endpoint, {
      method: "POST",
      signal: AbortSignal.timeout(45_000),
        headers,
        body,
      });
    if (!response.ok) {
      return {
        ...base,
        insightsMode: "rules_fallback",
        aiError: `request_failed_${response.status}`,
      };
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      return { ...base, insightsMode: "rules_fallback", aiError: "empty_output" };
    }
    const cards = validateAiCards(parseJsonObject(content), base);
    if (!cards) {
      return {
        ...base,
        insightsMode: "rules_fallback",
        aiError: "invalid_or_unsupported_output",
      };
    }

    return {
      ...base,
      briefingCards: cards,
      insightsMode: "ai",
      aiGeneratedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      ...base,
      insightsMode: "rules_fallback",
      aiError: error instanceof Error ? error.message : "unknown_error",
    };
  }
}
