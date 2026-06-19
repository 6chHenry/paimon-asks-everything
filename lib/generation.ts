import { fetch as undiciFetch, ProxyAgent } from "undici";
import type {
  Citation,
  KnowledgeEntry,
  Language,
  Profile,
} from "@/lib/domain";
import {
  normalizeSearchPlan,
  searchWebEvidence,
  type SearchPlan,
} from "@/lib/external-search";
import { t } from "@/lib/i18n";
import { releaseContextPrompt } from "@/lib/release-context";
import { emitTrace, type TraceEmitter } from "@/lib/trace";

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

function parseStructuredAnswer(content: string) {
  const trimmed = content.trim();
  const jsonText = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "")
    : trimmed;
  try {
    const parsed = JSON.parse(jsonText) as {
      answer?: unknown;
      citedSourceIds?: unknown;
    };
    if (typeof parsed.answer !== "string") return null;
    if (
      parsed.citedSourceIds !== undefined &&
      (!Array.isArray(parsed.citedSourceIds) ||
        !parsed.citedSourceIds.every((id) => typeof id === "string"))
    ) {
      return null;
    }
    return {
      answer: parsed.answer.trim(),
      citedSourceIds: (parsed.citedSourceIds ?? []) as string[],
    };
  } catch {
    return null;
  }
}

function validateStructuredAnswer(
  structured: { answer: string; citedSourceIds: string[] },
  allowedSourceIds: Set<string>,
) {
  if (!structured.answer) return false;
  if (!allowedSourceIds.size) return true;
  if (!structured.citedSourceIds.length) return false;
  return structured.citedSourceIds.every((id) => allowedSourceIds.has(id));
}

function containsCjkText(value: string) {
  return /[\u3400-\u9fff]/u.test(value);
}

function hasInlineCitationMarker(answer: string) {
  return /(?:[（(]\s*(?:来源|source)\s*[:：]\s*(?:external|source)-\d+\s*[)）])|(?:\^\[(?:external|source)-\d+\])|(?:\[(?:external|source)-\d+\])/iu.test(
    answer,
  );
}

function normalizeKnownTitleConfusions(answer: string) {
  return answer
    .replace(/女士（愚人众执行官「仆人」）/gu, "愚人众执行官「女士」")
    .replace(/女士（「仆人」）/gu, "「女士」");
}

function normalizeStructuredAnswer(structured: {
  answer: string;
  citedSourceIds: string[];
}) {
  const answer = normalizeKnownTitleConfusions(structured.answer);
  if (!structured.citedSourceIds.length || hasInlineCitationMarker(answer)) {
    return answer;
  }

  const notes = structured.citedSourceIds
    .slice(0, 3)
    .map((id) => `[${id}]`)
    .join("");
  const trailingWhitespace = answer.match(/(\s*)$/u)?.[1] ?? "";
  const body = answer.slice(0, answer.length - trailingWhitespace.length);
  return `${body}${notes}${trailingWhitespace}`;
}

function matchesRequestedLanguage(answer: string, language: Language) {
  if (language === "zh-CN") return true;
  return !containsCjkText(answer);
}

function salientQuestionTerms(question: string, language: Language) {
  if (language === "zh-CN" || containsCjkText(question)) {
    return Array.from(
      new Set(
        question
          .split(
            /(?:\s+|[，,。.!！?？、；;：:]|和|与|跟|及|同|的|是谁|为什么|怎么|什么|关系|联系|区别|讲了|讲|说|介绍|一下|吗|呢|了)/u,
          )
          .map((term) => term.trim())
          .filter((term) => term.length >= 2),
      ),
    );
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
  return Array.from(
    new Set(
      question
        .toLowerCase()
        .split(/[^a-z0-9'-]+/iu)
        .map((term) => term.trim())
        .filter((term) => term.length >= 3 && !stopwords.has(term)),
    ),
  );
}

function isOffTopicAnswer(answer: string, question: string, language: Language) {
  const terms = salientQuestionTerms(question, language);
  if (!terms.length) return false;
  const normalizedAnswer = answer.toLowerCase();
  return !terms.some((term) => normalizedAnswer.includes(term.toLowerCase()));
}

function compactEvidenceText(value: string) {
  return value
    .replace(/\s+/gu, " ")
    .replace(/^[。；，、,.!?\s]+/u, "")
    .trim()
    .slice(0, 260);
}

function directExternalEvidenceAnswer({
  language,
  external,
}: {
  language: Language;
  external: Citation[];
}) {
  const useful = external
    .filter((citation) => compactEvidenceText(citation.excerpt || citation.title))
    .slice(0, 3);
  if (!useful.length) return "";

  const paragraphs = useful.map((citation, index) => {
    const text = compactEvidenceText(citation.excerpt || citation.title);
    const sourceNote = `[${citation.id}]`;
    if (language === "zh-CN") {
      return index === 0
        ? `先直接回答：${text}${sourceNote}`
        : `补充来看：${text}${sourceNote}`;
    }
    return index === 0
      ? `Direct answer: ${text}${sourceNote}`
      : `Additional context: ${text}${sourceNote}`;
  });

  const ending =
    language === "zh-CN"
      ? "如果还想看更完整的原文、视频或细节，再打开下面的参考来源。"
      : "Open the references below only if you want the fuller article, video, or extra details.";
  return [...paragraphs, ending].join("\n\n");
}

function isLazyOrNonAnswer(answer: string, language: Language) {
  const normalized = answer.replace(/\s+/gu, "");
  const patterns =
    language === "zh-CN"
      ? [
          /不用.*补完/u,
          /来源.*(下面|下方)/u,
          /参考.*(下面|下方)/u,
          /先从.+(查起|看起|核对)/u,
          /只找到外部资料/u,
          /不能当成官方结论/u,
        ]
      : [
          /do not need every old quest/i,
          /sources? (are )?(below|at the bottom)/i,
          /references? (are )?(below|at the bottom)/i,
          /start with .+/i,
          /only found external material/i,
          /not an official conclusion/i,
        ];
  return patterns.some((pattern) => pattern.test(normalized));
}

function buildEvidence(input: {
  entries: KnowledgeEntry[];
  external: Citation[];
}) {
  const controlledEvidence = input.entries.map((entry, index) => ({
    id: `source-${index + 1}`,
    title: entry.title,
    summary: entry.summary,
    excerpt: entry.content,
    sourceName: entry.source.sourceName,
    sourceKind: entry.source.sourceKind,
    factStatus: entry.factStatus,
    external: false,
  }));
  const externalEvidence = input.external.map((citation) => ({
    id: citation.id,
    title: citation.title,
    summary: citation.excerpt,
    excerpt: citation.excerpt,
    sourceName: citation.sourceName,
    sourceKind: citation.sourceKind,
    credibility: citation.credibility,
    factStatus: citation.factStatus,
    external: true,
  }));
  return [...controlledEvidence, ...externalEvidence];
}

function deterministicAnswer({
  language,
  profile,
  entries,
  external,
  deepStory,
}: {
  language: Language;
  profile: Profile;
  entries: KnowledgeEntry[];
  external: Citation[];
  deepStory?: boolean;
}) {
  const sameLanguageEntries = entries.filter((entry) => entry.language === language);
  const usableEntries = sameLanguageEntries.length
    ? sameLanguageEntries
    : language === "en"
      ? entries.filter(
          (entry) => !containsCjkText(`${entry.summary} ${entry.content}`),
        )
      : entries;
  if (deepStory && usableEntries.length) {
    const storyEntries = usableEntries.slice(0, 5);
    const sections =
      language === "zh-CN"
        ? [
            ["故事起点", storyEntries[0]],
            ["关键人物", storyEntries[1]],
            ["故事脉络", storyEntries[2]],
            ["核心主题", storyEntries[3]],
          ]
        : [
            ["Where it begins", storyEntries[0]],
            ["Key people", storyEntries[1]],
            ["Story thread", storyEntries[2]],
            ["Core themes", storyEntries[3]],
          ];
    const body = sections
      .filter((item): item is [string, KnowledgeEntry] => Boolean(item[1]))
      .map(([heading, entry]) => `## ${heading}\n${entry.content}`)
      .join("\n\n");
    return t(
      language,
      `旅行者，这条故事线很长，派蒙按顺序讲清楚！\n\n${body}\n\n来源和延伸阅读都放在下面啦。`,
      `Traveler, this story is a long one, so Paimon will take it in order!\n\n${body}\n\nSources and further reading are below.`,
    );
  }
  if (external.length) {
    return directExternalEvidenceAnswer({ language, external });
  }

  const first = usableEntries[0];
  const supporting = usableEntries.slice(1, 3);
  const opening =
    profile === "returning"
      ? t(
          language,
          "可以！不用把旧内容全部补完。",
          "Yes! You do not need every old quest.",
        )
      : t(
          language,
          "先说结论！看这几条背景就够了。",
          "Short answer, Traveler: these points are enough.",
        );
  const details = [first, ...supporting]
    .filter(Boolean)
    .map((entry) => entry.summary.replace(/[。；.!;]+$/u, ""))
    .join(language === "zh-CN" ? "；" : " ");
  const boundary = entries.some(
    (entry) =>
      entry.factStatus === "community_speculation" ||
      entry.factStatus === "demo_hypothesis",
  )
    ? t(
        language,
        "推测和演示假设都标出来啦。",
        "Theories and demo hypotheses are labeled.",
      )
    : t(
        language,
        "来源都放在下面啦。",
        "The sources are below.",
      );
  return `${opening}\n\n${details}\n\n${boundary}`;
}

export async function generateGroundedAnswer(input: {
  question: string;
  language: Language;
  profile: Profile;
  entries: KnowledgeEntry[];
  external: Citation[];
  deepStory?: boolean;
}) {
  const fallback = deterministicAnswer(input);
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) return fallback;
  const baseURL = process.env.LLM_BASE_URL || "https://api.deepseek.com";
  const evidence = buildEvidence(input);
  const allowedSourceIds = new Set(evidence.map((item) => item.id));
  const messages = [
    {
      role: "system",
      content:
        `You are Paimon, a concise game-version guide. ${releaseContextPrompt()} In Chinese, use short, lively sentences, occasionally call the user 旅行者, answer first, and sound helpful rather than theatrical. In English, use short lively Paimon-style sentences and occasionally call the user Traveler. Do not pile on catchphrases. Evidence, privacy, safety, and uncertainty wording must stay plain and precise. Answer only in the requested language. For language=en, use English only and do not include Chinese wording except inside source ids. Answer only from supplied evidence. Preserve spoiler boundaries, never recommend spending or pulling, and do not expose internal reasoning. External wiki evidence is useful for orientation but must not be presented as official fact. If evidence is thin, return a cautious boundary answer instead of an empty answer.`,
    },
    {
      role: "user",
      content: JSON.stringify({
        language: input.language,
        playerProfile: input.profile,
        question: input.question,
        evidence,
        instruction:
          "Return strict JSON only with shape {\"answer\":\"...\",\"citedSourceIds\":[\"source-1\"]}. Treat demo_hypothesis and community_speculation as explicitly uncertain. Treat trusted_secondary as useful corroborating evidence, but do not call it official. Include only supplied source ids in citedSourceIds. If you use inline source notes, use the full source id form like [source-1] or [external-1], without a caret. If the evidence only supports a search hit or page title, say that the reliable answer is limited to where the user can start verifying.",
      }),
    },
  ];
  try {
    const endpoint = new URL("/chat/completions", baseURL);
    const body = JSON.stringify({
      model: process.env.LLM_MODEL || "deepseek-v4-flash",
      temperature: 0.2,
      max_tokens: 800,
      messages,
    });
    const headers = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
    const requestOptions: RequestInit = {
      method: "POST",
      signal: AbortSignal.timeout(45_000),
      headers,
      body,
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
      : await fetch(endpoint, requestOptions);
    if (!response.ok) {
      const errorText = await response.text();
      console.warn("LLM generation request failed", {
        status: response.status,
        body: errorText.slice(0, 500),
      });
      return fallback;
    }
    const completion = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = completion.choices?.[0]?.message?.content?.trim();
    if (!content) {
      console.warn("LLM generation returned empty content");
      return fallback;
    }
    const structured = parseStructuredAnswer(content);
    if (structured) {
      if (!validateStructuredAnswer(structured, allowedSourceIds)) return fallback;
      const answer = normalizeStructuredAnswer(structured);
      if (isLazyOrNonAnswer(answer, input.language)) return fallback;
      if (isOffTopicAnswer(answer, input.question, input.language)) return fallback;
      return matchesRequestedLanguage(answer, input.language) ? answer : fallback;
    }
    const answer = normalizeKnownTitleConfusions(content);
    if (isLazyOrNonAnswer(answer, input.language)) return fallback;
    if (isOffTopicAnswer(answer, input.question, input.language)) return fallback;
    return matchesRequestedLanguage(answer, input.language) ? answer : fallback;
  } catch (error) {
    const cause = error instanceof Error ? error.cause : undefined;
    console.warn("LLM generation request errored", {
      message: error instanceof Error ? error.message : String(error),
      cause:
        cause && typeof cause === "object" && "code" in cause
          ? String(cause.code)
          : undefined,
    });
    return fallback;
  }
}

export interface GroundedGenerationResult {
  answer: string;
  external: Citation[];
  citedSourceIds: string[];
  searchPlan: SearchPlan;
}

type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
};

async function postChatCompletion(
  baseURL: string,
  apiKey: string,
  body: Record<string, unknown>,
) {
  const endpoint = new URL("/chat/completions", baseURL);
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  const serialized = JSON.stringify(body);
  const agent = getProxyAgent();
  const response = agent
    ? await undiciFetch(endpoint, {
        method: "POST",
        signal: AbortSignal.timeout(45_000),
        headers,
        body: serialized,
        dispatcher: agent,
      })
    : await fetch(endpoint, {
        method: "POST",
        signal: AbortSignal.timeout(45_000),
        headers,
        body: serialized,
      });
  if (!response.ok) {
    const errorText = await response.text();
    console.warn("LLM generation request failed", {
      status: response.status,
      body: errorText.slice(0, 500),
    });
    return null;
  }
  return (await response.json()) as {
    choices?: Array<{
      finish_reason?: string;
      message?: {
        content?: string | null;
        tool_calls?: ChatMessage["tool_calls"];
      };
    }>;
  };
}

function parseSearchArguments(
  rawArguments: string,
  fallback: { question: string; language: Language },
) {
  try {
    const parsed = JSON.parse(rawArguments) as {
      query?: unknown;
      coreEntities?: unknown;
      aliases?: unknown;
      intent?: unknown;
      queries?: unknown;
      language?: unknown;
    };
    const legacyQuery =
      typeof parsed.query === "string" && parsed.query.trim()
        ? parsed.query.trim()
        : fallback.question;
    return {
      plan: normalizeSearchPlan(
        {
          coreEntities: Array.isArray(parsed.coreEntities)
            ? parsed.coreEntities.filter(
                (value): value is string => typeof value === "string",
              )
            : [],
          aliases: Array.isArray(parsed.aliases)
            ? parsed.aliases.filter(
                (value): value is string => typeof value === "string",
              )
            : [],
          intent:
            typeof parsed.intent === "string"
              ? (parsed.intent as SearchPlan["intent"])
              : "general",
          queries: Array.isArray(parsed.queries)
            ? parsed.queries.filter(
                (value): value is string => typeof value === "string",
              )
            : [legacyQuery],
        },
        fallback.question,
      ),
      language:
        parsed.language === "zh-CN" || parsed.language === "en"
          ? parsed.language
          : fallback.language,
    };
  } catch {
    return {
      plan: normalizeSearchPlan(undefined, fallback.question),
      language: fallback.language,
    };
  }
}

export async function generateGroundedResponse(input: {
  question: string;
  language: Language;
  profile: Profile;
  entries: KnowledgeEntry[];
  external: Citation[];
  deepStory?: boolean;
  emitTrace?: TraceEmitter;
}): Promise<GroundedGenerationResult> {
  const fallback = deterministicAnswer(input);
  const fallbackSearchPlan = normalizeSearchPlan(undefined, input.question);
  await emitTrace(input.emitTrace, {
    stage: "generate",
    status: "running",
    message: "正在整理回答",
  });
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    const searched = await searchWebEvidence(input.question, input.language, {
      emitTrace: input.emitTrace,
    }).catch(() => input.external);
    const external = searched.length ? searched : input.external;
    await emitTrace(input.emitTrace, {
      stage: "generate",
      status: "complete",
      message: "先用现有资料回答",
      detail: external.length ? `使用 ${external.length} 条外部来源` : undefined,
    });
    return {
      answer: deterministicAnswer({ ...input, external }),
      external,
      citedSourceIds: [],
      searchPlan: fallbackSearchPlan,
    };
  }

  const baseURL = process.env.LLM_BASE_URL || "https://api.deepseek.com";
  const model = process.env.LLM_MODEL || "deepseek-v4-flash";
  const initialEvidence = buildEvidence(input);
  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        `You are Paimon, a game-version evidence guide. ${releaseContextPrompt()} Use lively, clear language and occasionally call the user 旅行者 or Traveler, but keep evidence and uncertainty wording precise. Do not overuse catchphrases. For deep story requests, give a substantial chronological explanation with clear sections for setup, key people, major developments, and themes; do not collapse the answer into a short summary. Answer only in the requested language. For language=en, use English only and do not include Chinese wording except inside source ids. You must use the search_web_evidence tool to plan a current, entity-grounded search. Final factual claims must cite supplied evidence only. Trusted wiki sources are high-value community indexes, not official sources.`,
    },
    {
      role: "user",
      content: JSON.stringify({
        language: input.language,
        playerProfile: input.profile,
        question: input.question,
        controlledEvidence: initialEvidence,
        deepStory: Boolean(input.deepStory),
        instruction:
          input.deepStory
            ? "Call search_web_evidence once. Extract the exact core entity or entities, same-entity aliases only, the story intent, and 2-4 focused queries that all retain a core entity. Then write a complete chronological guide. Preserve spoiler gates. Do not answer from model memory."
            : "Call search_web_evidence once. Extract the exact core entity or entities, same-entity aliases only, the intent, and 2-4 focused queries that all retain a core entity. Never broaden to merely related characters. Do not answer from model memory.",
      }),
    },
  ];

  try {
    const first = await postChatCompletion(baseURL, apiKey, {
      model,
      thinking: { type: "disabled" },
      temperature: 0.1,
      max_tokens: input.deepStory ? 800 : 500,
      messages,
      tool_choice: "required",
      tools: [
        {
          type: "function",
          function: {
            name: "search_web_evidence",
            description:
              "Plan and search current Genshin Impact evidence. Identify the exact subject first; every query must retain a core entity. Results are entity-filtered before authority ranking.",
            parameters: {
              type: "object",
              properties: {
                coreEntities: {
                  type: "array",
                  items: { type: "string" },
                  description:
                    "One to four exact entities that are the direct subject of the question.",
                },
                aliases: {
                  type: "array",
                  items: { type: "string" },
                  description:
                    "Only alternate names that refer to the same core entities.",
                },
                intent: {
                  type: "string",
                  enum: [
                    "identity",
                    "relationship",
                    "story",
                    "current_status",
                    "official_media",
                    "general",
                  ],
                },
                queries: {
                  type: "array",
                  minItems: 1,
                  maxItems: 4,
                  items: { type: "string" },
                  description:
                    "Focused current-search queries. Every query must contain a core entity or exact alias.",
                },
                language: {
                  type: "string",
                  enum: ["zh-CN", "en"],
                  description: "Preferred search language.",
                },
              },
              required: [
                "coreEntities",
                "aliases",
                "intent",
                "queries",
                "language",
              ],
              additionalProperties: false,
            },
          },
        },
      ],
    });
    const assistantMessage = first?.choices?.[0]?.message;
    const toolCalls = assistantMessage?.tool_calls ?? [];
    const toolCall = toolCalls.find(
      (call) => call.function.name === "search_web_evidence",
    );
    let searchedExternal: Citation[] = [];
    let searchPlan = fallbackSearchPlan;
    if (toolCall) {
      await emitTrace(input.emitTrace, {
        stage: "tool",
        status: "running",
        message: "还要再查一下",
        detail: "search_web_evidence",
      });
      messages.push({
        role: "assistant",
        content: assistantMessage?.content ?? null,
        tool_calls: toolCalls,
      });
      const args = parseSearchArguments(toolCall.function.arguments, {
        question: input.question,
        language: input.language,
      });
      searchPlan = args.plan;
      searchedExternal = await searchWebEvidence(input.question, args.language, {
        emitTrace: input.emitTrace,
        plan: searchPlan,
      });
      await emitTrace(input.emitTrace, {
        stage: "tool",
        status: "complete",
        message: "新资料找到了",
        detail: `${searchedExternal.length} 条来源`,
      });
      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify({
          citations: searchedExternal,
        }),
      });
    } else {
      searchedExternal = await searchWebEvidence(input.question, input.language, {
        emitTrace: input.emitTrace,
        plan: fallbackSearchPlan,
      });
    }

    const external = searchedExternal.length ? searchedExternal : input.external;
    const evidenceFallback =
      directExternalEvidenceAnswer({ language: input.language, external }) ||
      fallback;
    const evidence = buildEvidence({ entries: input.entries, external });
    const allowedSourceIds = new Set(evidence.map((item) => item.id));
    messages.push({
      role: "user",
      content: JSON.stringify({
        language: input.language,
        question: input.question,
        evidence,
        deepStory: Boolean(input.deepStory),
        instruction:
          input.deepStory
            ? "Return strict JSON only with shape {\"answer\":\"...\",\"citedSourceIds\":[\"source-1\",\"external-1\"],\"confidence\":\"high|medium|low\"}. First re-check that every citation is actually about the requested core entities; ignore any drifted result. The answer must be a substantial chronological story guide with short section labels for setup, key people, major developments, and themes. Every factual sentence must be supported by supplied evidence. Do not add etymology, symbolism, chronology, organization founders, quest names, or character relationships unless they are explicit in the supplied evidence. Cite only supplied source ids. Preserve uncertainty and spoiler boundaries. In Chinese call yourself 派蒙, never Paimon. If you add inline source notes, use [source-1] or [external-1], without a caret."
            : "Return strict JSON only with shape {\"answer\":\"...\",\"citedSourceIds\":[\"source-1\",\"external-1\"],\"confidence\":\"high|medium|low\"}. First re-check that every citation is actually about the requested core entities; ignore any drifted result. Cite only supplied source ids. Use trusted_secondary evidence for normal answers when it directly supports the claim, but do not call trusted_wiki or community evidence official. If you add inline source notes, use the full supplied source id form like [source-1] or [external-1], without a caret; the UI will render it as a compact numeric note. Never write parentheticals such as （来源：external-4）.",
      }),
    });

    const final = await postChatCompletion(baseURL, apiKey, {
      model,
      thinking: { type: "disabled" },
      temperature: 0.2,
      max_tokens: input.deepStory ? 1600 : 800,
      messages,
    });
    const content = final?.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return { answer: evidenceFallback, external, citedSourceIds: [], searchPlan };
    }
    const structured = parseStructuredAnswer(content);
    if (structured && validateStructuredAnswer(structured, allowedSourceIds)) {
      const answer = normalizeStructuredAnswer(structured);
      if (isLazyOrNonAnswer(answer, input.language)) {
        await emitTrace(input.emitTrace, {
          stage: "generate",
          status: "complete",
          message: "回答太空，改用证据摘要",
        });
        return {
          answer: evidenceFallback,
          external,
          citedSourceIds: external.map((citation) => citation.id).slice(0, 3),
          searchPlan,
        };
      }
      if (isOffTopicAnswer(answer, input.question, input.language)) {
        await emitTrace(input.emitTrace, {
          stage: "generate",
          status: "complete",
          message: "回答跑题，改用证据摘要",
        });
        return {
          answer: evidenceFallback,
          external,
          citedSourceIds: external.map((citation) => citation.id).slice(0, 3),
          searchPlan,
        };
      }
      if (!matchesRequestedLanguage(answer, input.language)) {
        await emitTrace(input.emitTrace, {
          stage: "generate",
          status: "complete",
          message: "换成正确语言回答",
        });
        return { answer: evidenceFallback, external, citedSourceIds: [], searchPlan };
      }
      await emitTrace(input.emitTrace, {
        stage: "generate",
        status: "complete",
        message: "引用检查完成",
        detail: `${structured.citedSourceIds.length} 个引用`,
      });
      return {
        answer,
        external,
        citedSourceIds: structured.citedSourceIds,
        searchPlan,
      };
    }
    await emitTrace(input.emitTrace, {
      stage: "generate",
      status: "complete",
      message: "引用不够稳，改用保守回答",
    });
    return { answer: evidenceFallback, external, citedSourceIds: [], searchPlan };
  } catch (error) {
    const cause = error instanceof Error ? error.cause : undefined;
    console.warn("LLM tool generation request errored", {
      message: error instanceof Error ? error.message : String(error),
      cause:
        cause && typeof cause === "object" && "code" in cause
          ? String(cause.code)
          : undefined,
    });
    await emitTrace(input.emitTrace, {
      stage: "generate",
      status: "error",
      message: "生成出错，改用保守回答",
    });
    return {
      answer: fallback,
      external: input.external,
      citedSourceIds: [],
      searchPlan: fallbackSearchPlan,
    };
  }
}

export function buildHints(language: Language): [string, string, string] {
  return language === "zh-CN"
    ? [
        "先别急着按机关：观察附近可交互物的颜色、朝向和运动节奏。",
        "把机关当成一个顺序系统：先找能改变能量状态的节点，再看哪些装置会同步响应。",
        "完整思路：从离入口最近的能量节点开始，按视觉连线依次激活；每次操作后等待运动部件归位，再处理下一组。",
      ]
    : [
        "Before touching the mechanism, inspect nearby interactables, colors, directions, and movement rhythm.",
        "Treat it as a sequence system: find the node that changes energy state, then watch which devices respond together.",
        "Full approach: start with the energy node nearest the entrance, activate along the visible connection order, and let each moving part settle before the next step.",
      ];
}
