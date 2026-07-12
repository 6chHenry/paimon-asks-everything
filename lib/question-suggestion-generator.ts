import { fetch as undiciFetch, ProxyAgent } from "undici";
import type { QuestionSuggestionTopic } from "@/lib/domain";
import type { QuestionSuggestionRequest } from "@/lib/schemas";

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

function stripMarkdownFence(content: string) {
  const trimmed = content.trim();
  return trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "")
    : trimmed;
}

function normalize(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase();
}

const answerShaped = /答案是|结论是|正确答案|the answer is|it is|source:|https?:\/\//iu;

export function validateGeneratedQuestions(content: string): string[] | null {
  try {
    const parsed = JSON.parse(stripMarkdownFence(content)) as unknown;
    if (!Array.isArray(parsed) || parsed.length < 4 || parsed.length > 5) {
      return null;
    }
    const questions = parsed.map((item) =>
      typeof item === "string" ? item.trim() : "",
    );
    if (
      questions.some(
        (item) =>
          item.length < 8 ||
          item.length > 180 ||
          !/[?？]$/.test(item) ||
          answerShaped.test(item),
      )
    ) {
      return null;
    }
    return new Set(questions.map(normalize)).size === questions.length
      ? questions
      : null;
  } catch {
    return null;
  }
}

export function getQuestionSuggestionPromptContext(
  topic: QuestionSuggestionTopic,
  request: QuestionSuggestionRequest,
) {
  const customTopic = request.customTopic?.trim();
  return {
    topic: customTopic || topic.title[request.language],
    scope: customTopic || topic.scope[request.language],
  };
}

export async function generateQuestionSuggestions(
  topic: QuestionSuggestionTopic,
  request: QuestionSuggestionRequest,
): Promise<string[] | null> {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) return null;
  const baseURL = process.env.LLM_BASE_URL || "https://api.deepseek.com";
  const endpoint = new URL("/chat/completions", baseURL);
  const promptContext = getQuestionSuggestionPromptContext(topic, request);
  const body = JSON.stringify({
    model: process.env.LLM_MODEL || "deepseek-v4-flash",
    thinking: { type: "disabled" },
    temperature: 0.4,
    max_tokens: 360,
    messages: [
      {
        role: "system",
        content:
          "Return a JSON string array only. Generate 4 or 5 player questions, never answers, claims, citations, URLs, invented sources, or unconfirmed premises. Each item must end with a question mark. Respect the requested spoiler preference and do not disclose story information in the question wording.",
      },
      {
        role: "user",
        content: JSON.stringify({
          language: request.language,
          topic: promptContext.topic,
          scope: promptContext.scope,
          playerProfile: request.profile,
          playerProgress: request.progress,
          spoilerPreference: request.spoilerPreference,
          focus: request.focus,
          instruction:
            "Offer different angles: one orientation question, one causal or relationship question, one detail question, and one scope or evidence question. Ask only about this topic.",
        }),
      },
    ],
  });
  try {
    const agent = getProxyAgent();
    const response = agent
      ? await undiciFetch(endpoint, {
          method: "POST",
          signal: AbortSignal.timeout(20_000),
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body,
          dispatcher: agent,
        })
      : await fetch(endpoint, {
          method: "POST",
          signal: AbortSignal.timeout(20_000),
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body,
        });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    return content ? validateGeneratedQuestions(content) : null;
  } catch {
    return null;
  }
}
