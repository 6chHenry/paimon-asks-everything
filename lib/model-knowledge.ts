import { fetch as undiciFetch, ProxyAgent } from "undici";
import {
  cleanGeneratedText,
  matchesAnswerLanguage,
} from "@/lib/answer-quality";
import type {
  AnswerParagraph,
  Language,
  QuestionCategory,
} from "@/lib/domain";

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

const timeSensitivePattern =
  /(?:\d+(?:\.\d+)?\s*版本|版本\s*\d|什么时候|何时|几号|上线|更新|卡池|复刻|实装|当前版本|最新版本|现在能不能|目前能不能|release\s+date|when.*release|current\s+version|available\s+now|latest\s+version|banner)/iu;
const leakPattern =
  /内鬼|爆料|泄露|偷跑|测试服|解包|leak|datamine|beta\s+leak/iu;
const categoricalNegativePattern =
  /从未|从来没有|未曾|不存在|并无|没有任何|尚未发现|官方没有|no\s+(?:known\s+|confirmed\s+|direct\s+)*(?:relationship|interaction|quest|character|event)|never\s+(?:met|spoke|interacted|appeared)|does\s+not\s+exist|has\s+never/iu;

export function canUseModelKnowledgeFallback(input: {
  question: string;
  category: QuestionCategory;
  confirmedHighRisk: boolean;
}) {
  if (input.confirmedHighRisk) return false;
  if (input.category !== "story" && input.category !== "character") {
    return false;
  }
  return ![
    timeSensitivePattern,
    leakPattern,
    categoricalNegativePattern,
  ].some((pattern) => pattern.test(input.question));
}

function parseParagraphs(content: string, language: Language) {
  const jsonText = content
    .trim()
    .replace(/^```(?:json)?\s*/iu, "")
    .replace(/\s*```$/u, "");
  try {
    const parsed = JSON.parse(jsonText) as {
      paragraphs?: Array<{ text?: unknown }>;
    };
    if (!Array.isArray(parsed.paragraphs)) return null;
    const paragraphs: AnswerParagraph[] = parsed.paragraphs
      .slice(0, 4)
      .flatMap((paragraph) => {
        if (typeof paragraph.text !== "string") return [];
        const text = cleanGeneratedText(paragraph.text);
        if (!text || !matchesAnswerLanguage(text, language)) return [];
        if (
          /\[(?:source|external)-\d+\]|https?:\/\//iu.test(text)
        ) {
          return [];
        }
        return [{ text, citationIds: [] }];
      });
    return paragraphs.length ? { paragraphs } : null;
  } catch {
    return null;
  }
}

export async function generateModelKnowledgeAnswer(input: {
  question: string;
  language: Language;
  signal?: AbortSignal;
}) {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey || input.signal?.aborted) return null;
  const baseURL = process.env.LLM_BASE_URL || "https://api.deepseek.com";
  const endpoint = new URL("/chat/completions", baseURL);
  const timeout = AbortSignal.timeout(45_000);
  const signal = input.signal
    ? AbortSignal.any([input.signal, timeout])
    : timeout;
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  const body = JSON.stringify({
    model: process.env.LLM_MODEL || "deepseek-v4-flash",
    thinking: { type: "disabled" },
    temperature: 0.2,
    max_tokens: 700,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Answer from stable Genshin knowledge already known to the model because live source verification is unavailable. Give the direct answer first. Separate broadly established setting from uncertain interpretation. Do not claim current release status, quote exact dialogue, assert that something never happened, or fabricate citations. Return JSON only with shape {\"paragraphs\":[{\"text\":\"...\"}]}. Never include citation ids or URLs.",
      },
      {
        role: "user",
        content: JSON.stringify({
          language: input.language,
          question: input.question,
          instruction:
            input.language === "zh-CN"
              ? "使用自然的简体中文，先直接回答，再说明确定边界。"
              : "Use natural English. Answer directly, then state the uncertainty boundary.",
        }),
      },
    ],
  });

  try {
    const agent = getProxyAgent();
    const response = agent
      ? await undiciFetch(endpoint, {
          method: "POST",
          headers,
          body,
          signal,
          dispatcher: agent,
        })
      : await fetch(endpoint, {
          method: "POST",
          headers,
          body,
          signal,
        });
    if (!response.ok) return null;
    const completion = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const content = completion.choices?.[0]?.message?.content;
    return content ? parseParagraphs(content, input.language) : null;
  } catch {
    return null;
  }
}
