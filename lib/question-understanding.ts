import { fetch as undiciFetch, ProxyAgent } from "undici";
import { classifyQuestion } from "@/lib/classification";
import type { EventClassification, Language } from "@/lib/domain";
import {
  detectQuestionEntities,
  isCharacterArcQuestion,
  type QuestionEntity,
} from "@/lib/entity-lexicon";
import {
  inferStorySearchScope,
  normalizeSearchPlan,
  type SearchIntent,
  type SearchPlan,
} from "@/lib/external-search";

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

export interface ModelQuestionUnderstanding {
  entities: QuestionEntity[];
  intent: SearchIntent;
  claim?: string;
  queries: string[];
}

export interface QuestionUnderstanding extends ModelQuestionUnderstanding {
  classification: EventClassification;
  ruleEntities: QuestionEntity[];
  modelEntities: QuestionEntity[];
  agreement: "confirmed" | "rule_only" | "model_only" | "conflict";
}

const understandingCache = new Map<
  string,
  { expiresAt: number; value: QuestionUnderstanding }
>();
const UNDERSTANDING_CACHE_TTL_MS = 30 * 60 * 1000;

function normalized(value: string) {
  return value.normalize("NFKC").toLowerCase();
}

function entityTerms(entity: QuestionEntity) {
  return [entity.canonical, ...entity.aliases].map(normalized);
}

function entitiesOverlap(left: QuestionEntity, right: QuestionEntity) {
  const leftTerms = entityTerms(left);
  const rightTerms = entityTerms(right);
  return leftTerms.some((term) => rightTerms.includes(term));
}

function questionMentionsEntity(question: string, entity: QuestionEntity) {
  const haystack = normalized(question);
  return entityTerms(entity).some((term) => haystack.includes(term));
}

function uniqueStrings(values: string[], limit: number) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).slice(
    0,
    limit,
  );
}

function inferIntent(question: string, classification: EventClassification): SearchIntent {
  if (/关系|联系|relationship|connection/iu.test(question)) return "relationship";
  if (isCharacterArcQuestion(question)) return "story";
  if (
    /传说任务|剧情|故事|story|quest|发生了什么|为什么.*(?:死|死亡|牺牲|离开)|死在|被.*杀|结局/iu.test(
      question,
    )
  ) {
    return "story";
  }
  if (/pv|演示|预告|official media|teaser|trailer/iu.test(question)) {
    return "official_media";
  }
  if (/是谁|身份|是什么人|是(?:不是)?/u.test(question)) return "identity";
  if (classification.questionCategory === "character") return "current_status";
  return "general";
}

function queriesForEntities(
  question: string,
  entities: QuestionEntity[],
  intent: SearchIntent,
) {
  if (!entities.length) return [question];
  if (entities.length >= 2) {
    return [
      `${entities.map((entity) => entity.canonical).join(" ")} 关系`,
      question,
    ];
  }
  const entity = entities[0]!;
  if (intent === "story" && isCharacterArcQuestion(question)) {
    return uniqueStrings(
      [
        question,
        `${entity.canonical} 剧情 经历`,
        `${entity.canonical} 结局 变化`,
      ],
      4,
    );
  }
  return uniqueStrings(
    [
      question.includes(entity.canonical) ? question : `${entity.canonical} ${question}`,
      ...entity.aliases.map((alias) => `${alias} ${question}`),
    ],
    4,
  );
}

export function ruleUnderstandQuestion(
  question: string,
  language: Language,
): QuestionUnderstanding {
  const classification = classifyQuestion(question, language);
  const entities = detectQuestionEntities(question);
  const intent = inferIntent(question, classification);
  return {
    entities,
    ruleEntities: entities,
    modelEntities: [],
    intent,
    claim: undefined,
    queries: queriesForEntities(question, entities, intent),
    classification,
    agreement: entities.length ? "rule_only" : "model_only",
  };
}

export function shouldUseModelQuestionUnderstanding(
  question: string,
  rule: QuestionUnderstanding,
) {
  if (process.env.QUESTION_UNDERSTANDING_LLM_ENABLED === "false") return false;
  if (!rule.entities.length) return true;
  if (hasCompleteCharacterArcRule(question, rule)) return false;
  if (
    rule.intent === "story" &&
    rule.entities.some((entity) => entity.aliases.length === 0)
  ) {
    return true;
  }
  if (rule.intent === "relationship" && rule.entities.length < 2) return true;
  if (
    rule.classification.questionCategory === "other" &&
    rule.intent === "general"
  ) {
    return true;
  }
  const anchoredQueries = rule.queries.filter((query) =>
    rule.entities.some((entity) =>
      entityTerms(entity).some((term) => normalized(query).includes(term)),
    ),
  );
  return anchoredQueries.length !== rule.queries.length;
}

function hasCompleteCharacterArcRule(
  question: string,
  rule: QuestionUnderstanding,
) {
  if (!isCharacterArcQuestion(question) || rule.intent !== "story") return false;
  const primaryEntity = rule.entities[0];
  if (!primaryEntity) return false;
  return (
    rule.queries.includes(`${primaryEntity.canonical} 剧情 经历`) &&
    rule.queries.includes(`${primaryEntity.canonical} 结局 变化`)
  );
}

function mergeAliases(base: QuestionEntity, model: QuestionEntity) {
  const shouldPromoteCanonical =
    normalized(model.canonical).includes(normalized(base.canonical)) &&
    model.canonical.length > base.canonical.length;
  const canonical = shouldPromoteCanonical ? model.canonical : base.canonical;
  return {
    ...base,
    canonical,
    aliases: uniqueStrings(
      [
        shouldPromoteCanonical ? base.canonical : undefined,
        ...base.aliases,
        model.canonical,
        ...model.aliases,
      ].filter(
        (alias): alias is string =>
          typeof alias === "string" &&
          normalized(alias) !== normalized(canonical),
      ),
      8,
    ),
  };
}

const CHARACTER_ARC_PREDICATE_PATTERN =
  /经历了?|怎么(?:的)?变化|怎样(?:的)?变化|如何(?:转变|变化|改变)|有什么(?:成长|变化)|成长|变化|转变|改变|结局|剧情|故事|character\s+(?:development|arc)|how\s+.*(?:change|develop)/iu;

const CHARACTER_ARC_QUERY_PATTERN =
  /剧情|劇情|经历|經歷|变化|變化|成长|成長|转变|轉變|结局|結局|故事|story|character\s+(?:development|arc)|quest|development/iu;

function reconcileCharacterArcUnderstanding(
  rule: QuestionUnderstanding,
  model: ModelQuestionUnderstanding,
): QuestionUnderstanding {
  const acceptedModelEntities = model.entities.filter((modelEntity) =>
    rule.entities.some((ruleEntity) => entitiesOverlap(ruleEntity, modelEntity)),
  );
  const entities = rule.entities.map((ruleEntity) => {
    const matchingEntities = acceptedModelEntities.filter((modelEntity) =>
      entitiesOverlap(ruleEntity, modelEntity),
    );
    const aliases = uniqueStrings(
      [
        ...ruleEntity.aliases,
        ...matchingEntities.flatMap((entity) => [entity.canonical, ...entity.aliases]),
      ].filter(
        (candidate) =>
          normalized(candidate) !== normalized(ruleEntity.canonical) &&
          !CHARACTER_ARC_PREDICATE_PATTERN.test(candidate),
      ),
      8,
    );
    return { ...ruleEntity, aliases };
  });
  const terms = entities.flatMap((entity) => [entity.canonical, ...entity.aliases]);
  const safeModelQueries =
    model.intent === "story"
      ? model.queries.filter(
          (query) =>
            CHARACTER_ARC_QUERY_PATTERN.test(query) &&
            terms.some((term) => normalized(query).includes(normalized(term))),
        )
      : [];
  const rejectedModelEntities = model.entities.length - acceptedModelEntities.length;
  const agreement = rejectedModelEntities
    ? "conflict"
    : acceptedModelEntities.length
      ? "confirmed"
      : "rule_only";

  return {
    entities,
    ruleEntities: rule.ruleEntities,
    modelEntities: model.entities,
    intent: "story",
    claim: rule.claim,
    queries: uniqueStrings([...rule.queries, ...safeModelQueries], 4),
    classification: rule.classification,
    agreement,
  };
}

function anchorQueries(
  queries: string[],
  entities: QuestionEntity[],
  fallback: string,
  intent: SearchIntent,
) {
  if (!entities.length) return uniqueStrings(queries.length ? queries : [fallback], 4);
  const terms = entities.flatMap((entity) => [entity.canonical, ...entity.aliases]);
  const primary = entities[0]!.canonical;
  const fallbackQueries = queriesForEntities(fallback, entities, intent);
  const sourceQueries =
    intent === "story" && isCharacterArcQuestion(fallback)
      ? [...fallbackQueries, ...queries]
      : queries.length
        ? queries
        : fallbackQueries;
  return uniqueStrings(
    sourceQueries.map((query) =>
      terms.some((term) => normalized(query).includes(normalized(term)))
        ? query
        : `${primary} ${query}`,
    ),
    4,
  );
}

export function reconcileQuestionUnderstanding(
  question: string,
  rule: QuestionUnderstanding,
  model?: ModelQuestionUnderstanding | null,
): QuestionUnderstanding {
  if (!model) return rule;
  if (hasCompleteCharacterArcRule(question, rule)) {
    return reconcileCharacterArcUnderstanding(rule, model);
  }

  const mergedEntities = [...rule.entities];
  const acceptedModelEntities: QuestionEntity[] = [];
  let rejectedModelEntities = 0;

  for (const modelEntity of model.entities) {
    const matchingIndex = mergedEntities.findIndex((entity) =>
      entitiesOverlap(entity, modelEntity),
    );
    if (matchingIndex >= 0) {
      mergedEntities[matchingIndex] = mergeAliases(
        mergedEntities[matchingIndex]!,
        modelEntity,
      );
      acceptedModelEntities.push(modelEntity);
      continue;
    }
    if (!rule.entities.length && questionMentionsEntity(question, modelEntity)) {
      mergedEntities.push(modelEntity);
      acceptedModelEntities.push(modelEntity);
      continue;
    }
    rejectedModelEntities += 1;
  }

  const conflict = Boolean(rule.entities.length && rejectedModelEntities);
  const agreement = conflict
    ? "conflict"
    : rule.entities.length && acceptedModelEntities.length
      ? "confirmed"
      : rule.entities.length
        ? "rule_only"
        : acceptedModelEntities.length
          ? "model_only"
          : "rule_only";
  const intent =
    agreement === "conflict" || model.intent === "general"
      ? rule.intent
      : model.intent;
  const queries =
    agreement === "conflict"
      ? queriesForEntities(question, mergedEntities, intent)
      : anchorQueries(model.queries, mergedEntities, question, intent);

  return {
    entities: mergedEntities,
    ruleEntities: rule.ruleEntities,
    modelEntities: model.entities,
    intent,
    claim: model.claim,
    queries,
    classification: rule.classification,
    agreement,
  };
}

function parseModelUnderstanding(content: string): ModelQuestionUnderstanding | null {
  const trimmed = content.trim();
  const jsonText = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "")
    : trimmed;
  try {
    const parsed = JSON.parse(jsonText) as {
      entities?: unknown;
      intent?: unknown;
      claim?: unknown;
      queries?: unknown;
    };
    const intents: SearchIntent[] = [
      "identity",
      "relationship",
      "story",
      "current_status",
      "official_media",
      "general",
    ];
    return {
      entities: Array.isArray(parsed.entities)
        ? parsed.entities
            .map((entity) => entity as Partial<QuestionEntity>)
            .filter(
              (entity) =>
                typeof entity.canonical === "string" &&
                Array.isArray(entity.aliases) &&
                (entity.kind === "character" || entity.kind === "story"),
            )
            .map((entity) => ({
              canonical: entity.canonical!,
              aliases: entity.aliases!.filter(
                (alias): alias is string => typeof alias === "string",
              ),
              kind: entity.kind!,
            }))
            .slice(0, 4)
        : [],
      intent: intents.includes(parsed.intent as SearchIntent)
        ? (parsed.intent as SearchIntent)
        : "general",
      claim: typeof parsed.claim === "string" ? parsed.claim : undefined,
      queries: Array.isArray(parsed.queries)
        ? parsed.queries.filter(
            (query): query is string => typeof query === "string",
          ).slice(0, 4)
        : [],
    };
  } catch {
    return null;
  }
}

export async function understandQuestionWithModel(
  question: string,
  language: Language,
): Promise<ModelQuestionUnderstanding | null> {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) return null;
  const baseURL = process.env.LLM_BASE_URL || "https://api.deepseek.com";
  const endpoint = new URL("/chat/completions", baseURL);
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  const body = JSON.stringify({
    model: process.env.LLM_MODEL || "deepseek-v4-flash",
    thinking: { type: "disabled" },
    temperature: 0,
    max_tokens: 500,
    messages: [
      {
        role: "system",
        content:
          "Extract structured understanding from the raw user question only. Do not answer the question. Return strict JSON only.",
      },
      {
        role: "user",
        content: JSON.stringify({
          language,
          question,
          instruction:
            "Return {\"entities\":[{\"canonical\":\"...\",\"aliases\":[\"...\"],\"kind\":\"character|story\"}],\"intent\":\"identity|relationship|story|current_status|official_media|general\",\"claim\":\"...\",\"queries\":[\"...\"]}. Entities must be direct subjects of the raw question. Include established names in other languages as aliases when known, especially the official English character name. For a character Story Quest request, include an English query like '<English alias> story quest'. Queries must retain a direct entity or alias.",
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
          headers,
          body,
          dispatcher: agent,
        })
      : await fetch(endpoint, {
          method: "POST",
          signal: AbortSignal.timeout(20_000),
          headers,
          body,
        });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    return content ? parseModelUnderstanding(content) : null;
  } catch {
    return null;
  }
}

export async function understandQuestion(
  question: string,
  language: Language,
): Promise<QuestionUnderstanding> {
  const cacheKey = `${language}:${normalized(question)}`;
  const cached = understandingCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const rule = ruleUnderstandQuestion(question, language);
  const needsModel = shouldUseModelQuestionUnderstanding(question, rule);
  const model = needsModel
    ? await understandQuestionWithModel(question, language)
    : null;
  const value = reconcileQuestionUnderstanding(question, rule, model);
  if (!needsModel || model) {
    understandingCache.set(cacheKey, {
      expiresAt: Date.now() + UNDERSTANDING_CACHE_TTL_MS,
      value,
    });
  }
  return value;
}

export function searchPlanFromUnderstanding(
  understanding: Pick<QuestionUnderstanding, "entities" | "intent" | "queries">,
  fallbackQuestion: string,
): SearchPlan {
  return normalizeSearchPlan(
    {
      coreEntities: understanding.entities.map((entity) => entity.canonical),
      aliases: understanding.entities.flatMap((entity) => entity.aliases),
      intent: understanding.intent,
      queries: understanding.queries,
      storyScope: inferStorySearchScope(
        fallbackQuestion,
        understanding.intent,
      ),
    },
    fallbackQuestion,
  );
}
