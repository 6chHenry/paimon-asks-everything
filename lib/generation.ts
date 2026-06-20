import { fetch as undiciFetch, ProxyAgent } from "undici";
import type {
  AnswerParagraph,
  Citation,
  KnowledgeEntry,
  Language,
  Profile,
} from "@/lib/domain";
import {
  answerText,
  cleanGeneratedText,
  matchesAnswerLanguage,
  normalizeGeneratedAnswer,
  parseGeneratedAnswer,
  validateAnswerQuality,
} from "@/lib/answer-quality";
import {
  answerOutputInstruction,
  answerSystemPrompt,
  repairInstruction,
} from "@/lib/answer-prompt";
import {
  compactCleanEvidence,
  evidenceForGeneration,
  safeBoundaryAnswer,
  selectAnswerEvidence,
} from "@/lib/evidence-quality";
import {
  normalizeSearchPlan,
  searchWebEvidence,
  type SearchPlan,
} from "@/lib/external-search";
import { detectQuestionEntities, type QuestionEntity } from "@/lib/entity-lexicon";
import { t } from "@/lib/i18n";
import {
  searchPlanFromUnderstanding,
  type QuestionUnderstanding,
} from "@/lib/question-understanding";
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
    .replace(/女士[（(]愚人众执行官「仆人」[）)]/gu, "愚人众执行官「女士」")
    .replace(/女士[（(]「仆人」[）)]/gu, "「女士」");
}

function normalizeStructuredAnswer(structured: {
  answer: string;
  citedSourceIds: string[];
}) {
  const answer = normalizeKnownTitleConfusions(cleanGeneratedText(structured.answer));
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
  return matchesAnswerLanguage(answer, language);
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
  return compactCleanEvidence(value, 260);
}

function looksLikeIdentityQuestionForFallback(question: string) {
  return /是谁|身份|是什么人|是(?:不是)?|外星人|origin|who is|identity|from where|where.*from/iu.test(
    question,
  );
}

function looksLikeGameplayQuestionForFallback(question: string) {
  return /技能|天赋|命座|倍率|伤害|冷却|配队|武器|圣遗物|玩法|机制|怎么打|build|skill|talent|constellation|damage|cooldown|weapon|artifact/iu.test(
    question,
  );
}

function isGenericWikiExcerpt(citation: Citation) {
  const text = `${citation.title} ${citation.excerpt}`;
  return /欢迎来到|开放编辑|游戏数据库|图鉴资料|攻略内容|wiki.*database|open(?:ly)? edited|game database/iu.test(
    text,
  );
}

function isGameplayMechanicsExcerpt(citation: Citation) {
  const text = `${citation.title} ${citation.excerpt}`;
  return /\/技能|技能|天赋|命座|普通攻击|元素战技|元素爆发|长按|点蛇之狡谋|抗打断|倍率|冷却|伤害|持续快速移动|skill|talent|constellation|normal attack|elemental skill|elemental burst|cooldown|damage/iu.test(
    text,
  );
}

function answerWorthyExternalCitation(citation: Citation, question: string) {
  const text = compactEvidenceText(citation.excerpt || citation.title);
  if (!text) return false;
  if (isGenericWikiExcerpt(citation)) return false;
  if (
    looksLikeIdentityQuestionForFallback(question) &&
    !looksLikeGameplayQuestionForFallback(question) &&
    isGameplayMechanicsExcerpt(citation)
  ) {
    return false;
  }
  return true;
}

function directExternalEvidenceAnswer({
  language,
  question,
  external,
}: {
  language: Language;
  question: string;
  external: Citation[];
}) {
  const useful = external
    .filter((citation) => answerWorthyExternalCitation(citation, question))
    .slice(0, 3);
  if (!useful.length) return "";

  const subject = detectQuestionEntities(question)[0]?.canonical;
  if (
    language === "zh-CN" &&
    useful.every(
      (citation) =>
        !containsCjkText(`${citation.title} ${citation.excerpt}`),
    )
  ) {
    return safeBoundaryAnswer(language, subject, true);
  }

  const facts = useful.map((citation) => ({
    text: compactEvidenceText(citation.excerpt || citation.title),
    id: citation.id,
  }));
  if (language === "zh-CN") {
    const lead = facts[0];
    const supporting = facts
      .slice(1)
      .map((fact) => `${fact.text}[${fact.id}]`)
      .join("；");
    const boundary = /吗|是不是|是否|能否/u.test(question)
      ? "不过，这些资料还不足以单独证明问题里的判断。"
      : "";
    return [
      `现有资料能确认的是：${lead.text}[${lead.id}]`,
      supporting,
      boundary,
    ]
      .filter(Boolean)
      .join("\n\n");
  }
  return facts
    .map((fact) => `${fact.text}[${fact.id}]`)
    .join("\n\n");
}

function preferReviewedEvidence(citations: Citation[]) {
  const reliable = citations.filter(
    (citation) =>
      citation.assessment?.authority === "official" ||
      citation.assessment?.authority === "curated_reference",
  );
  if (reliable.length < 2) return citations;
  return citations.filter(
    (citation) =>
      citation.assessment?.confidence !== "low" ||
      citation.assessment?.contentKind !== "neutral_reference",
  );
}

function downgradeUnsupportedAuthorityClaims(
  paragraphs: AnswerParagraph[],
  sourceAuthorityById: Map<string, "official" | "non_official">,
) {
  return paragraphs.map((paragraph) => {
    const hasOfficialCitation = paragraph.citationIds.some(
      (id) => sourceAuthorityById.get(id) === "official",
    );
    if (hasOfficialCitation) return paragraph;
    return {
      ...paragraph,
      text: paragraph.text.replace(
        /官方(?:资料|设定|明确|确认|介绍|公告)/gu,
        "现有资料",
      ),
    };
  });
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
    ...evidenceForGeneration(citation),
  }));
  return [...controlledEvidence, ...externalEvidence];
}

function deterministicAnswer({
  question,
  language,
  profile,
  entries,
  external,
  deepStory,
}: {
  question: string;
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
    return directExternalEvidenceAnswer({
      language,
      question,
      external,
    });
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
      content: answerSystemPrompt(input.language, Boolean(input.deepStory)),
    },
    {
      role: "user",
      content: JSON.stringify({
        language: input.language,
        playerProfile: input.profile,
        question: input.question,
        evidence,
        instruction:
          "Return strict JSON only with shape {\"answer\":\"...\",\"citedSourceIds\":[\"source-1\"]}. Treat demo_hypothesis and community_speculation as explicitly uncertain. Treat community_analysis as analysis rather than official fact. Treat trusted_secondary as useful corroborating evidence, but do not call it official. Include only supplied source ids in citedSourceIds. If you use inline source notes, use the full source id form like [source-1] or [external-1], without a caret. If the evidence only supports a search hit or page title, say that the reliable answer is limited to where the user can start verifying.",
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
  answerParagraphs?: AnswerParagraph[];
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

function includesSearchEntity(value: string, entity: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .includes(entity.normalize("NFKC").toLowerCase());
}

function inferredLatinAliasesFromQueries(plan: SearchPlan) {
  if (plan.coreEntities.length || plan.aliases.length) return [];
  const genericAliases = new Set(["Genshin Impact"]);
  const aliases = plan.queries.flatMap((query) =>
    Array.from(
      query.matchAll(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\b/gu),
      (match) => match[0].trim(),
    ).flatMap((alias) => [
      alias,
      alias.replace(/^(?:La|Le|The)\s+/u, "").trim(),
    ]),
  );
  return Array.from(new Set(aliases))
    .filter((alias) => alias.length >= 3 && !genericAliases.has(alias))
    .slice(0, 3);
}

function looksLikeIdentityQuestion(question: string) {
  if (/为什么|为何|怎么|如何|死在|死亡|传说任务|讲了什么|讲什么|关系|联系/u.test(question)) {
    return false;
  }
  return /是谁|身份|是什么人|是(?:不是)?/u.test(question);
}

function mergeQuestionEntityAnchors(
  plan: SearchPlan,
  question: string,
  entities?: QuestionEntity[],
): SearchPlan {
  const detected = entities ?? detectQuestionEntities(question);
  if (!detected.length) return plan;

  const coreEntities = [...plan.coreEntities];
  const aliases = [...plan.aliases];
  if (detected.length === 1) {
    for (const alias of inferredLatinAliasesFromQueries(plan)) {
      if (!aliases.some((existing) => includesSearchEntity(existing, alias))) {
        aliases.push(alias);
      }
    }
  }
  for (const entity of detected) {
    const alreadyAnchored = [entity.canonical, ...entity.aliases].some((alias) =>
      [...coreEntities, ...aliases].some((existing) =>
        includesSearchEntity(existing, alias),
      ),
    );
    if (!alreadyAnchored) coreEntities.push(entity.canonical);
    for (const alias of entity.aliases) {
      if (
        !coreEntities.some((existing) => includesSearchEntity(existing, alias)) &&
        !aliases.some((existing) => includesSearchEntity(existing, alias))
      ) {
        aliases.push(alias);
      }
    }
  }

  const anchorTerms = [...coreEntities, ...aliases];
  const primaryAnchor = detected[0]?.canonical ?? coreEntities[0];
  const anchoredQueries = plan.queries.map((query) =>
    anchorTerms.some((entity) => includesSearchEntity(query, entity))
      ? query
      : `${primaryAnchor} ${query}`,
  );

  return {
    coreEntities: Array.from(new Set(coreEntities)).slice(0, 4),
    aliases: Array.from(new Set(aliases)).slice(0, 8),
    intent:
      plan.intent === "general" &&
      detected.some((entity) => entity.kind === "character") &&
      looksLikeIdentityQuestion(question)
        ? "identity"
        : plan.intent,
    queries: Array.from(new Set(anchoredQueries)).slice(0, 4),
  };
}

function overlapsAnyEntityTerm(value: string, entities: QuestionEntity[]) {
  return entities
    .flatMap((entity) => [entity.canonical, ...entity.aliases])
    .some((term) => includesSearchEntity(value, term));
}

function mergeUnderstandingSearchPlan(
  plan: SearchPlan,
  understanding: QuestionUnderstanding | undefined,
  question: string,
) {
  if (!understanding) return mergeQuestionEntityAnchors(plan, question);
  const understandingPlan = searchPlanFromUnderstanding(understanding, question);
  if (!understanding.entities.length) {
    return mergeQuestionEntityAnchors(
      {
        ...plan,
        intent: plan.intent === "general" ? understanding.intent : plan.intent,
        queries: plan.queries.length ? plan.queries : understandingPlan.queries,
      },
      question,
    );
  }

  const onSubjectQueries = plan.queries.filter((query) =>
    overlapsAnyEntityTerm(query, understanding.entities),
  );
  const onSubjectCoreEntities = plan.coreEntities.filter((entity) =>
    overlapsAnyEntityTerm(entity, understanding.entities),
  );
  const onSubjectAliases = plan.aliases.filter((alias) =>
    overlapsAnyEntityTerm(alias, understanding.entities),
  );

  return mergeQuestionEntityAnchors(
    normalizeSearchPlan(
      {
        coreEntities: [
          ...understandingPlan.coreEntities,
          ...onSubjectCoreEntities,
        ],
        aliases: [...understandingPlan.aliases, ...onSubjectAliases],
        intent: plan.intent === "general" ? understanding.intent : plan.intent,
        queries: onSubjectQueries.length
          ? [...onSubjectQueries, ...understandingPlan.queries]
          : understandingPlan.queries,
      },
      question,
    ),
    question,
    understanding.entities,
  );
}

function paragraphsFromText(answer: string): AnswerParagraph[] {
  return answer
    .split(/\n{2,}/u)
    .map((text) => {
      const citationIds = Array.from(
        text.matchAll(/\[((?:source|external)-\d+)\]/giu),
        (match) => match[1],
      );
      return {
        text: text.replace(/\[(?:source|external)-\d+\]/giu, "").trim(),
        citationIds: Array.from(new Set(citationIds)),
      };
    })
    .filter((paragraph) => paragraph.text);
}

function generationFallback(input: {
  question: string;
  language: Language;
  profile: Profile;
  entries: KnowledgeEntry[];
  external: Citation[];
  deepStory?: boolean;
}) {
  const answer = deterministicAnswer(input);
  return {
    answer,
    answerParagraphs: paragraphsFromText(answer),
  };
}

export async function generateGroundedResponse(input: {
  question: string;
  language: Language;
  profile: Profile;
  entries: KnowledgeEntry[];
  external: Citation[];
  deepStory?: boolean;
  emitTrace?: TraceEmitter;
  understanding?: QuestionUnderstanding;
}): Promise<GroundedGenerationResult> {
  const initialFallback = generationFallback(input);
  const questionUnderstanding = input.understanding;
  const questionEntities =
    questionUnderstanding?.entities ?? detectQuestionEntities(input.question);
  const fallbackSearchPlan = questionUnderstanding
    ? searchPlanFromUnderstanding(questionUnderstanding, input.question)
    : mergeQuestionEntityAnchors(
        normalizeSearchPlan(undefined, input.question),
        input.question,
      );
  await emitTrace(input.emitTrace, {
    stage: "generate",
    status: "running",
    message: "正在整理回答",
  });
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    const searched = await searchWebEvidence(input.question, input.language, {
      emitTrace: input.emitTrace,
      plan: fallbackSearchPlan,
    }).catch(() => input.external);
    const rawExternal = searched.length ? searched : input.external;
    const external = selectAnswerEvidence(rawExternal, {
      question: input.question,
      intent: fallbackSearchPlan.intent,
    });
    const fallback = generationFallback({ ...input, external });
    await emitTrace(input.emitTrace, {
      stage: "generate",
      status: "complete",
      message: "先用现有资料回答",
      detail: external.length ? `使用 ${external.length} 条外部来源` : undefined,
    });
    return {
      ...fallback,
      external,
      citedSourceIds: fallback.answerParagraphs.flatMap(
        (paragraph) => paragraph.citationIds,
      ),
      searchPlan: fallbackSearchPlan,
    };
  }

  const baseURL = process.env.LLM_BASE_URL || "https://api.deepseek.com";
  const model = process.env.LLM_MODEL || "deepseek-v4-flash";
  const initialEvidence = buildEvidence(input);
  const usePreparedSearchPlan = Boolean(questionUnderstanding);
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: usePreparedSearchPlan
        ? answerSystemPrompt(input.language, Boolean(input.deepStory))
        : `${answerSystemPrompt(input.language, Boolean(input.deepStory))}
You must use the search_web_evidence tool to plan a current, entity-grounded search before answering.`,
    },
    {
      role: "user",
      content: JSON.stringify({
        language: input.language,
        playerProfile: input.profile,
        question: input.question,
        questionUnderstanding,
        questionEntities,
        controlledEvidence: initialEvidence,
        deepStory: Boolean(input.deepStory),
        instruction: usePreparedSearchPlan
          ? "A validated search plan is already available. Wait for the evidence payload, then answer only from supplied evidence."
          : input.deepStory
            ? "Call search_web_evidence once. Extract the exact core entity or entities, same-entity aliases only, the story intent, and 2-4 focused queries that all retain a core entity. Then write a complete chronological guide. Preserve spoiler gates. Do not answer from model memory."
            : "Call search_web_evidence once. Extract the exact core entity or entities, same-entity aliases only, the intent, and 2-4 focused queries that all retain a core entity. Never broaden to merely related characters. Do not answer from model memory.",
      }),
    },
  ];

  try {
    let searchedExternal: Citation[] = [];
    let searchPlan = fallbackSearchPlan;
    if (usePreparedSearchPlan) {
      await emitTrace(input.emitTrace, {
        stage: "tool",
        status: "running",
        message: "按已确认的实体检索资料",
        detail: "search_web_evidence",
      });
      searchedExternal = await searchWebEvidence(input.question, input.language, {
        emitTrace: input.emitTrace,
        plan: searchPlan,
      });
      searchedExternal = selectAnswerEvidence(preferReviewedEvidence(searchedExternal), {
        question: input.question,
        intent: searchPlan.intent,
      });
      await emitTrace(input.emitTrace, {
        stage: "tool",
        status: "complete",
        message: "新资料找到了",
        detail: `${searchedExternal.length} 条来源`,
      });
    } else {
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
                  },
                  aliases: {
                    type: "array",
                    items: { type: "string" },
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
                  },
                  language: {
                    type: "string",
                    enum: ["zh-CN", "en"],
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
      searchPlan = mergeUnderstandingSearchPlan(
        args.plan,
        questionUnderstanding,
        input.question,
      );
      searchedExternal = await searchWebEvidence(input.question, args.language, {
        emitTrace: input.emitTrace,
        plan: searchPlan,
      });
      searchedExternal = selectAnswerEvidence(preferReviewedEvidence(searchedExternal), {
        question: input.question,
        intent: searchPlan.intent,
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
    }

    const rawExternal = preferReviewedEvidence(
      searchedExternal.length ? searchedExternal : input.external,
    );
    const external = selectAnswerEvidence(rawExternal, {
      question: input.question,
      intent: searchPlan.intent,
    });
    const evidenceFallback = generationFallback({ ...input, external });
    const evidence = buildEvidence({ entries: input.entries, external });
    const allowedSourceIds = new Set(evidence.map((item) => item.id));
    const sourceAuthorityById = new Map(
      evidence.map((item) => {
        const assessment = (
          item as { sourceAssessment?: { authority?: string } }
        ).sourceAssessment;
        return [
          item.id,
          item.sourceKind === "official" ||
          item.sourceKind === "game_text" ||
          assessment?.authority === "official"
            ? ("official" as const)
            : ("non_official" as const),
        ];
      }),
    );
    messages.push({
      role: "user",
      content: JSON.stringify({
        language: input.language,
        question: input.question,
        evidence,
        deepStory: Boolean(input.deepStory),
        instruction: answerOutputInstruction(Boolean(input.deepStory)),
      }),
    });

    const requestFinalAnswer = () =>
      postChatCompletion(baseURL, apiKey, {
        model,
        thinking: { type: "disabled" },
        temperature: 0.2,
        max_tokens: input.deepStory ? 1600 : 800,
        messages,
      });
    let final = await requestFinalAnswer();
    let content = final?.choices?.[0]?.message?.content?.trim();
    let parsed = content ? parseGeneratedAnswer(content) : null;
    let normalized = parsed ? normalizeGeneratedAnswer(parsed) : null;
    let failures = normalized
      ? validateAnswerQuality({
          paragraphs: normalized.paragraphs,
          language: input.language,
          question: input.question,
          allowedSourceIds,
          sourceAuthorityById,
        })
      : ["empty"];

    if (normalized && failures.includes("authority_overclaim")) {
      normalized = {
        paragraphs: downgradeUnsupportedAuthorityClaims(
          normalized.paragraphs,
          sourceAuthorityById,
        ),
      };
      failures = validateAnswerQuality({
        paragraphs: normalized.paragraphs,
        language: input.language,
        question: input.question,
        allowedSourceIds,
        sourceAuthorityById,
      });
    }

    const repairableFailures = failures.filter(
      (failure) => failure !== "template_heavy",
    );
    if (!repairableFailures.length) failures = [];
    if (repairableFailures.length) {
      messages.push({
        role: "assistant",
        content: content ?? JSON.stringify({ paragraphs: [] }),
      });
      messages.push({
        role: "user",
        content: repairInstruction(repairableFailures),
      });
      final = await requestFinalAnswer();
      content = final?.choices?.[0]?.message?.content?.trim();
      parsed = content ? parseGeneratedAnswer(content) : null;
      normalized = parsed ? normalizeGeneratedAnswer(parsed) : null;
      failures = normalized
        ? validateAnswerQuality({
            paragraphs: normalized.paragraphs,
            language: input.language,
            question: input.question,
            allowedSourceIds,
            sourceAuthorityById,
          })
        : ["empty"];
    }

    if (!normalized || failures.length) {
      await emitTrace(input.emitTrace, {
        stage: "generate",
        status: "complete",
        message: "回答校验未通过，改用保守回答",
        detail: failures.join(", "),
      });
      return {
        ...evidenceFallback,
        external,
        citedSourceIds: evidenceFallback.answerParagraphs.flatMap(
          (paragraph) => paragraph.citationIds,
        ),
        searchPlan,
      };
    }

    const citedSourceIds = Array.from(
      new Set(normalized.paragraphs.flatMap((paragraph) => paragraph.citationIds)),
    );
    await emitTrace(input.emitTrace, {
      stage: "generate",
      status: "complete",
      message: "引用检查完成",
      detail: `${citedSourceIds.length} 个引用`,
    });
    return {
      answer: answerText(normalized.paragraphs),
      answerParagraphs: normalized.paragraphs,
      external,
      citedSourceIds,
      searchPlan,
    };

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
      ...initialFallback,
      external: input.external,
      citedSourceIds: initialFallback.answerParagraphs.flatMap(
        (paragraph) => paragraph.citationIds,
      ),
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
