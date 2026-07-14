import { fetch as undiciFetch, ProxyAgent } from "undici";
import { cleanGeneratedText, matchesAnswerLanguage } from "@/lib/answer-quality";
import type { AnswerParagraph, Language, QuestionCategory } from "@/lib/domain";
import type { SearchIntent, StorySearchScope } from "@/lib/external-search";

let proxyAgent: ProxyAgent | undefined;

function getProxyAgent() {
  const proxyUrl =
    process.env.https_proxy ||
    process.env.HTTPS_PROXY ||
    process.env.http_proxy ||
    process.env.HTTP_PROXY;
  if (!proxyUrl || !/^https?:\/\//iu.test(proxyUrl)) return undefined;
  proxyAgent ??= new ProxyAgent(proxyUrl);
  return proxyAgent;
}

const positiveKnowledgePattern =
  /(?:是谁|身份|是什么人|属于|隶属|领导|什么关系|关系是|who\s+is|identity|belongs?\s+to|leads?|relationship)/iu;
const timeSensitivePattern =
  /(?:现在|目前|最新|这次|下(?:一|个)?|即将|何时|什么时候|实装|上线|发布|版本|卡池|祈愿|today|currently|latest|next|upcoming|release|released|banner|version)/iu;
const leakPattern =
  /(?:爆料|内鬼|泄露|偷跑|未公开|leak|datamine|rumou?r)/iu;
const categoricalNegativePattern =
  /(?:从未|绝不|不可能|没有任何|不存在|未曾|never|no\s+(?:known|direct|confirmed|possible)|does\s+not\s+exist)/iu;
const plotSummaryOrEndingPattern =
  /(?:完整(?:剧情|故事)|全部(?:剧情|故事)|剧情梗概|故事梗概|结局|后来发生了什么|全过程|full\s+(?:plot|story)|plot\s+summary|ending|what\s+happens)/iu;

export function canUseModelKnowledgeFallback(input: {
  question: string;
  category: QuestionCategory;
  intent: SearchIntent;
  storyScope?: StorySearchScope;
  confirmedHighRisk: boolean;
}) {
  if (input.confirmedHighRisk || input.storyScope === "character_arc") return false;
  if (!(["character", "story"] as QuestionCategory[]).includes(input.category)) {
    return false;
  }
  if (!(["identity", "relationship", "general"] as SearchIntent[]).includes(input.intent)) {
    return false;
  }
  if (!positiveKnowledgePattern.test(input.question)) return false;
  return ![
    timeSensitivePattern,
    leakPattern,
    categoricalNegativePattern,
    plotSummaryOrEndingPattern,
  ].some((pattern) => pattern.test(input.question));
}

function stripCodeFence(value: string) {
  const trimmed = value.trim();
  return trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\s*/iu, "").replace(/\s*```$/iu, "")
    : trimmed;
}

function parseModelKnowledgeAnswer(
  content: string,
  language: Language,
): { paragraphs: AnswerParagraph[] } | null {
  try {
    const parsed = JSON.parse(stripCodeFence(content)) as { paragraphs?: unknown };
    if (!Array.isArray(parsed.paragraphs)) return null;
    if (!parsed.paragraphs.length || parsed.paragraphs.length > 4) return null;

    const rawParagraphs = parsed.paragraphs.map(
      (value) => value as { text?: unknown },
    );
    if (rawParagraphs.some((paragraph) => typeof paragraph.text !== "string")) {
      return null;
    }

    const rawText = rawParagraphs
      .map((paragraph) => paragraph.text as string)
      .join("\n");
    if (
      /https?:\/\/|www\.|\[(?:source|external)-\d+\]|\[(?:来源|引用|source|citation)[^\]]*\]/iu.test(
        rawText,
      )
    ) {
      return null;
    }

    const paragraphs = rawParagraphs.map((paragraph) => ({
      text: cleanGeneratedText(paragraph.text as string).replace(
        /([\u3400-\u9fff]),(?=[\u3400-\u9fff])/gu,
        "$1，",
      ),
      citationIds: [],
    }));
    if (paragraphs.some((paragraph) => !paragraph.text)) return null;
    const text = paragraphs.map((paragraph) => paragraph.text).join("\n");
    if (!matchesAnswerLanguage(text, language)) return null;
    return { paragraphs };
  } catch {
    return null;
  }
}

function requestSignal(signal?: AbortSignal) {
  const timeout = AbortSignal.timeout(45_000);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

export async function generateModelKnowledgeAnswer(input: {
  question: string;
  language: Language;
  signal?: AbortSignal;
}): Promise<{ paragraphs: AnswerParagraph[] } | null> {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey || input.signal?.aborted) return null;

  const baseURL = process.env.LLM_BASE_URL || "https://api.deepseek.com";
  const endpoint = new URL("/chat/completions", baseURL);
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  const body = JSON.stringify({
    model: process.env.LLM_MODEL || "deepseek-v4-flash",
    thinking: { type: "disabled" },
    temperature: 0.1,
    max_tokens: 700,
    messages: [
      {
        role: "system",
        content:
          "Live source verification found no usable evidence. Give a tentative, concise answer using only stable Genshin Impact knowledge already known to the model. State the direct answer first and distinguish established setting from uncertain interpretation. Do not claim current release status, quote exact dialogue, assert strong negatives such as that something never happened, or fabricate citations, sources, URLs, or source markers. Return JSON only with shape {\"paragraphs\":[{\"text\":\"...\"}]}, using one to four paragraphs and the requested language.",
      },
      {
        role: "user",
        content: JSON.stringify({
          language: input.language,
          question: input.question,
          instruction:
            "Answer tentatively from stable model knowledge. Do not include citations, URLs, or claims about current availability.",
        }),
      },
    ],
  });

  try {
    const signal = requestSignal(input.signal);
    const agent = getProxyAgent();
    const response = agent
      ? await undiciFetch(endpoint, {
          method: "POST",
          headers,
          body,
          signal,
          dispatcher: agent,
        })
      : await fetch(endpoint, { method: "POST", headers, body, signal });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    return content ? parseModelKnowledgeAnswer(content, input.language) : null;
  } catch {
    return null;
  }
}
