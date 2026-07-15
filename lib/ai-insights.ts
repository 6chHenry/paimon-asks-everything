import { fetch as undiciFetch, ProxyAgent } from "undici";
import type { aggregateInsights } from "@/lib/insights";
import {
  buildReleaseBriefingFallback,
  buildReleaseBriefingPrompt,
  validateReleaseAiBriefing,
  type ReleaseAiBriefing,
} from "@/lib/release-ai-briefing";
import { computeReleaseDecisions } from "@/lib/release-insights";

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
  releaseBriefing: ReleaseAiBriefing;
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

function fallbackInsights(
  base: BaseInsights,
  releaseBriefing: ReleaseAiBriefing,
  error: string,
): EnrichedInsights {
  return {
    ...base,
    insightsMode: "rules_fallback",
    aiError: error,
    releaseBriefing,
  };
}

export async function enrichInsightsWithAi(
  base: BaseInsights,
): Promise<EnrichedInsights> {
  const releaseDecisions = computeReleaseDecisions(base);
  const fallbackReleaseBriefing = (error: string) =>
    buildReleaseBriefingFallback(base, releaseDecisions, error);
  const apiKey = process.env.LLM_API_KEY;

  if (!apiKey) {
    return fallbackInsights(
      base,
      fallbackReleaseBriefing("not_configured"),
      "not_configured",
    );
  }

  try {
    const endpoint = new URL(
      "/chat/completions",
      process.env.LLM_BASE_URL || "https://api.deepseek.com",
    );
    const body = JSON.stringify({
      model: process.env.LLM_MODEL || "deepseek-v4-flash",
      thinking: { type: "disabled" },
      temperature: 0.25,
      max_tokens: 2400,
      messages: [
        {
          role: "system",
          content:
            "你是中国游戏制作组的发行洞察分析师。只返回严格 JSON，不要解释过程。你必须基于提供的数据独立选择、排序并写出三条发行建议；规则分数只作为参考和安全边界，不能代替你的判断。文案要通俗、简短、具体，不能编造数据或引用未提供的证据。",
        },
        {
          role: "user",
          content: JSON.stringify(
            buildReleaseBriefingPrompt(base, releaseDecisions),
          ),
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
      const error = `request_failed_${response.status}`;
      return fallbackInsights(base, fallbackReleaseBriefing(error), error);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      return fallbackInsights(
        base,
        fallbackReleaseBriefing("empty_output"),
        "empty_output",
      );
    }

    const parsed = parseJsonObject(content);
    const releaseBriefing = validateReleaseAiBriefing(
      parsed,
      base,
      releaseDecisions,
    );
    if (!releaseBriefing) {
      return fallbackInsights(
        base,
        fallbackReleaseBriefing("invalid_release_recommendations"),
        "invalid_release_recommendations",
      );
    }

    return {
      ...base,
      insightsMode: "ai",
      aiGeneratedAt: new Date().toISOString(),
      releaseBriefing,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return fallbackInsights(base, fallbackReleaseBriefing(message), message);
  }
}
