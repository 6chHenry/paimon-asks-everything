import type { AnswerParagraph, Language } from "@/lib/domain";

export interface ParsedGeneratedAnswer {
  paragraphs: AnswerParagraph[];
}

export type AnswerQualityFailure =
  | "empty"
  | "language_mismatch"
  | "off_topic"
  | "invalid_citation"
  | "authority_overclaim"
  | "web_noise"
  | "template_heavy";

function stripCodeFence(value: string) {
  const trimmed = value.trim();
  return trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "")
    : trimmed;
}

function uniqueStrings(values: unknown) {
  return Array.isArray(values)
    ? Array.from(
        new Set(values.filter((value): value is string => typeof value === "string")),
      )
    : [];
}

export function parseGeneratedAnswer(content: string): ParsedGeneratedAnswer | null {
  try {
    const parsed = JSON.parse(stripCodeFence(content)) as {
      paragraphs?: unknown;
      answer?: unknown;
      citedSourceIds?: unknown;
    };
    if (Array.isArray(parsed.paragraphs)) {
      const paragraphs = parsed.paragraphs
        .map((value) => value as { text?: unknown; citationIds?: unknown })
        .filter((value) => typeof value.text === "string" && value.text.trim())
        .map((value) => ({
          text: (value.text as string).trim(),
          citationIds: uniqueStrings(value.citationIds),
        }));
      return paragraphs.length ? { paragraphs } : null;
    }
    if (typeof parsed.answer === "string" && parsed.answer.trim()) {
      return {
        paragraphs: parsed.answer
          .split(/\n{2,}/u)
          .map((text) => text.trim())
          .filter(Boolean)
          .map((text) => ({
            text,
            citationIds: uniqueStrings(parsed.citedSourceIds),
          })),
      };
    }
  } catch {
    return null;
  }
  return null;
}

export function cleanGeneratedText(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\u00ad\u200b-\u200f\u202a-\u202e\u2060\ufeff]/gu, "")
    .replace(/\[(?:\d{1,3}|编辑|edit)\]/giu, "")
    .replace(/\[(?:source|external)-\d+\]/giu, "")
    .replace(/\s+([，。！？；：,.!?;:])/gu, "$1")
    .trim();
}

export function normalizeGeneratedAnswer(answer: ParsedGeneratedAnswer) {
  return {
    paragraphs: answer.paragraphs
      .map((paragraph) => ({
        text: cleanGeneratedText(paragraph.text)
          .replace(
            /女士[（(]愚人众执行官「仆人」[）)]/gu,
            "愚人众执行官「女士」",
          )
          .replace(/女士[（(]「仆人」[）)]/gu, "「女士」"),
        citationIds: Array.from(new Set(paragraph.citationIds)),
      }))
      .filter((paragraph) => paragraph.text),
  };
}

export function answerText(paragraphs: AnswerParagraph[]) {
  return paragraphs
    .map((paragraph) => {
      const markers = paragraph.citationIds.map((id) => `[${id}]`).join("");
      return `${paragraph.text}${markers}`;
    })
    .join("\n\n");
}

function containsCjk(value: string) {
  return /[\u3400-\u9fff]/u.test(value);
}

function containsEnglishSentence(value: string) {
  const withoutIds = value.replace(/\[(?:source|external)-\d+\]/giu, "");
  return /(?:^|[。！？!?]\s*)[A-Z][A-Za-z'’-]*(?:\s+[A-Za-z'’-]+){4,}(?:[.!?]|$)/mu.test(
    withoutIds,
  );
}

export function matchesAnswerLanguage(value: string, language: Language) {
  if (language === "zh-CN") {
    return containsCjk(value) && !containsEnglishSentence(value);
  }
  return !containsCjk(value);
}

function salientTerms(question: string, language: Language) {
  if (language === "zh-CN" || containsCjk(question)) {
    return question
      .split(
        /(?:\s+|[，,。.!！?？、；;：:]|和|与|跟|及|同|的|是不是|是否|是谁|是|为什么|怎么|什么|关系|联系|区别|讲了|讲|说|介绍|一下|吗|呢|了)/u,
      )
      .map((term) => term.trim())
      .filter((term) => term.length >= 2);
  }
  const stopwords = new Set([
    "what",
    "who",
    "why",
    "how",
    "the",
    "and",
    "with",
    "about",
    "tell",
    "explain",
    "relationship",
    "connection",
    "between",
  ]);
  return question
    .toLowerCase()
    .split(/[^a-z0-9'-]+/iu)
    .filter((term) => term.length >= 3 && !stopwords.has(term));
}

function isOffTopic(value: string, question: string, language: Language) {
  const terms = salientTerms(question, language);
  if (!terms.length) return false;
  const normalized = value.toLowerCase();
  return !terms.some((term) => normalized.includes(term.toLowerCase()));
}

function containsWebNoise(value: string) {
  return /\[(?:\d{1,3}|编辑|edit)\]|\bToggle\b|\bContents?\b|\bNavigation\b|\bChange History\b/iu.test(
    value,
  );
}

function isTemplateHeavy(value: string, language: Language) {
  const patterns =
    language === "zh-CN"
      ? [
          /先直接回答/u,
          /补充来看/u,
          /根据资料显示/u,
          /如果还想看/u,
          /来源.*(?:下面|下方)/u,
        ]
      : [
          /direct answer/i,
          /additional context/i,
          /according to the material/i,
          /if you want to see more/i,
          /sources?.*(?:below|at the bottom)/i,
        ];
  return patterns.filter((pattern) => pattern.test(value)).length >= 3;
}

export function validateAnswerQuality(input: {
  paragraphs: AnswerParagraph[];
  language: Language;
  question: string;
  allowedSourceIds: Set<string>;
  sourceAuthorityById?: Map<string, "official" | "non_official">;
}) {
  const failures: AnswerQualityFailure[] = [];
  const text = input.paragraphs.map((paragraph) => paragraph.text).join("\n");
  if (!text.trim()) failures.push("empty");
  if (!matchesAnswerLanguage(text, input.language)) failures.push("language_mismatch");
  if (isOffTopic(text, input.question, input.language)) failures.push("off_topic");
  if (
    input.paragraphs.some((paragraph) =>
      paragraph.citationIds.some((id) => !input.allowedSourceIds.has(id)),
    )
  ) {
    failures.push("invalid_citation");
  }
  if (
    input.sourceAuthorityById &&
    input.paragraphs.some(
      (paragraph) =>
        /官方(?:资料|设定|明确|确认|介绍|公告).{0,12}(?:表明|说明|称|写|指出|是|为)|according to official|official (?:material|information|sources?) (?:says?|states?|describes?)/iu.test(
          paragraph.text,
        ) &&
        !paragraph.citationIds.some(
          (id) => input.sourceAuthorityById?.get(id) === "official",
        ),
    )
  ) {
    failures.push("authority_overclaim");
  }
  if (containsWebNoise(text)) failures.push("web_noise");
  if (isTemplateHeavy(text, input.language)) failures.push("template_heavy");
  return Array.from(new Set(failures));
}
