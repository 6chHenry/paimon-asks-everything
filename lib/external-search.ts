import type {
  Citation,
  FactStatus,
  Language,
  SourceCredibility,
  SourceKind,
} from "@/lib/domain";
import { emitTrace, type TraceEmitter } from "@/lib/trace";
import { fetch as undiciFetch, ProxyAgent } from "undici";
import {
  assessSourceRule,
  assessSources,
  extractPublisherIdentity,
  legacySourceFields,
  platformForUrl,
  sourceAllowedForQuestion,
  sourceGovernanceScore,
} from "@/lib/source-governance";
import { TtlCache } from "@/lib/ttl-cache";

interface MediaWikiProvider {
  apiUrl: string;
  pageBaseUrl: string;
  sourceName: string;
  language: Language | "multi";
}

const EXTERNAL_FETCH_TIMEOUT_MS = 5_500;
const generalSearchCache = new TtlCache<Citation[]>(10 * 60 * 1000);
const pageEnrichmentCache = new TtlCache<Citation>(30 * 60 * 1000);

function boundedSignal(signal: AbortSignal | undefined, timeoutMs: number) {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

export interface ClassifiedWebSource {
  sourceName: string;
  sourceKind: SourceKind;
  credibility: SourceCredibility;
  rank: number;
}

export type SearchIntent =
  | "identity"
  | "relationship"
  | "story"
  | "current_status"
  | "official_media"
  | "general";

export type StorySearchScope = "character_story_quest" | "general_story";

export interface SearchPlan {
  coreEntities: string[];
  aliases: string[];
  intent: SearchIntent;
  queries: string[];
  storyScope?: StorySearchScope;
}

export function inferStorySearchScope(
  question: string,
  intent: SearchIntent,
): StorySearchScope | undefined {
  if (intent !== "story") return undefined;
  return /传说任务|傳說任務|角色任务|角色任務|story\s*quest|legend(?:ary)?\s+quest/iu.test(
    question,
  )
    ? "character_story_quest"
    : "general_story";
}

function cleanSearchValue(value: string, maxLength = 120) {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function uniqueSearchValues(values: unknown, limit: number) {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === "string")
        .map((value) => cleanSearchValue(value))
        .filter((value) => value.length >= 2),
    ),
  ).slice(0, limit);
}

export function normalizeSearchPlan(
  value: Partial<SearchPlan> | undefined,
  fallbackQuery: string,
): SearchPlan {
  const intents: SearchIntent[] = [
    "identity",
    "relationship",
    "story",
    "current_status",
    "official_media",
    "general",
  ];
  const proposedCoreEntities = uniqueSearchValues(value?.coreEntities, 4);
  const proposedAliases = uniqueSearchValues(value?.aliases, 8).filter(
    (alias) => !proposedCoreEntities.includes(alias),
  );
  const proposedEntityTerms = [...proposedCoreEntities, ...proposedAliases];
  const fallback = cleanSearchValue(fallbackQuery, 200);
  const hasQuestionAnchor =
    !proposedEntityTerms.length ||
    proposedEntityTerms.some((entity) => includesEntity(fallback, entity));
  const coreEntities = hasQuestionAnchor ? proposedCoreEntities : [];
  const aliases = hasQuestionAnchor ? proposedAliases : [];
  const entityTerms = [...coreEntities, ...aliases];
  const rawQueries = hasQuestionAnchor ? uniqueSearchValues(value?.queries, 4) : [];
  const entityBoundQueries = entityTerms.length
    ? rawQueries.filter((query) =>
        entityTerms.some((entity) => includesEntity(query, entity)),
      )
    : rawQueries;
  const safeFallback =
    coreEntities.length && !includesEntity(fallback, coreEntities[0])
      ? `${coreEntities[0]} ${fallback}`.slice(0, 200)
      : fallback;
  return {
    coreEntities,
    aliases,
    intent: intents.includes(value?.intent as SearchIntent)
      ? (value?.intent as SearchIntent)
      : "general",
    queries: entityBoundQueries.length ? entityBoundQueries : [safeFallback],
    storyScope:
      value?.storyScope ??
      inferStorySearchScope(
        fallback,
        intents.includes(value?.intent as SearchIntent)
          ? (value?.intent as SearchIntent)
          : "general",
      ),
  };
}

const EN_FANDOM_PROVIDER: MediaWikiProvider = {
  apiUrl: "https://genshin-impact.fandom.com/api.php",
  pageBaseUrl: "https://genshin-impact.fandom.com/wiki/",
  sourceName: "Genshin Impact Wiki",
  language: "en",
};

const MEDIAWIKI_PROVIDERS: MediaWikiProvider[] = [
  EN_FANDOM_PROVIDER,
  {
    apiUrl: "https://genshin-impact.fandom.com/zh/api.php",
    pageBaseUrl: "https://genshin-impact.fandom.com/zh/wiki/",
    sourceName: "Genshin Impact Wiki 中文",
    language: "zh-CN",
  },
  {
    apiUrl: "https://wiki.biligame.com/ys/api.php",
    pageBaseUrl: "https://wiki.biligame.com/ys/",
    sourceName: "原神WIKI_BWIKI",
    language: "zh-CN",
  },
];

const CHINESE_MEDIAWIKI_PROVIDERS = MEDIAWIKI_PROVIDERS.filter(
  (provider) => provider.language === "zh-CN",
);

const credibilityRank: Record<SourceCredibility, number> = {
  official: 100,
  trusted_wiki: 80,
  community: 40,
  unknown_web: 10,
};

let proxyAgent: ProxyAgent | undefined;

function getProxyAgent() {
  if (process.env.NODE_ENV === "test") return undefined;
  const proxyUrl =
    process.env.https_proxy ||
    process.env.HTTPS_PROXY ||
    process.env.http_proxy ||
    process.env.HTTP_PROXY;
  if (!proxyUrl || !/^https?:\/\//i.test(proxyUrl)) return undefined;
  proxyAgent ??= new ProxyAgent(proxyUrl);
  return proxyAgent;
}

async function fetchExternal(
  input: URL,
  init: Pick<RequestInit, "headers" | "method" | "signal"> = {},
) {
  const agent = getProxyAgent();
  if (!agent) return fetch(input, init);
  return undiciFetch(input, {
    method: init.method,
    headers: init.headers,
    signal: init.signal,
    dispatcher: agent,
  });
}

function factStatusForSource(credibility: SourceCredibility): FactStatus {
  if (credibility === "official") return "official_explicit";
  if (credibility === "trusted_wiki") return "trusted_secondary";
  return "community_speculation";
}

function stripHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

function normalizeChineseVariants(value: string) {
  const variants: Record<string, string> = {
    愛: "爱",
    國: "国",
    體: "体",
    傳: "传",
    說: "说",
    務: "务",
    劇: "剧",
    關: "关",
    係: "系",
    與: "与",
    眾: "众",
    執: "执",
    行: "行",
    官: "官",
    歲: "岁",
    後: "后",
    風: "风",
    騎: "骑",
    團: "团",
    機: "机",
    械: "械",
    釋: "释",
    資: "资",
    料: "料",
    個: "个",
    這: "这",
    裡: "里",
    裏: "里",
    對: "对",
    於: "于",
    無: "无",
    產: "产",
    實: "实",
    認: "认",
    號: "号",
    瑪: "玛",
    麗: "丽",
    亞: "亚",
    蘭: "兰",
  };
  return value.replace(/[愛國體傳說務劇關係與眾執歲後風騎團機釋資個這裡裏對於無產實認號瑪麗亞蘭]/gu, (char) => variants[char] ?? char);
}

function decodeHtml(value: string) {
  return stripHtml(value)
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/giu, (_match, code) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&#(\d+);/gu, (_match, code) =>
      String.fromCodePoint(Number.parseInt(code, 10)),
    );
}

function htmlToText(value: string) {
  return decodeHtml(
    value
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<sup[\s\S]*?<\/sup>/gi, " ")
      .replace(/<[^>]*>/g, " "),
  ).replace(/\s+/g, " ");
}

function cjkBigrams(value: string) {
  const bigrams: string[] = [];
  for (let i = 0; i <= value.length - 2; i += 1) {
    bigrams.push(value.slice(i, i + 2));
  }
  return bigrams;
}

function basicTerms(question: string) {
  const terms = question
    .replace(
      /是不是|是否|是谁|是什么|为什么|怎么|如何|有没有|讲了什么|关系|是|吗|呢|了|的/gu,
      " ",
    )
    .split(/[\s,，、/？?。.!;；:：()（）]+/u)
    .map((term) => normalizeChineseVariants(term.trim()).toLowerCase())
    .filter((term) => term.length >= 2);
  const expanded: string[] = [];
  for (const term of terms) {
    expanded.push(term);
    if (/^[\p{Script=Han}]{4,}$/u.test(term)) {
      for (const bigram of cjkBigrams(term)) {
        expanded.push(bigram);
      }
    }
  }
  return Array.from(new Set(expanded));
}

function normalizedExcerptText(value: string) {
  return normalizeChineseVariants(value).normalize("NFKC").toLowerCase();
}

function containsCjk(value: string) {
  return /[\u3400-\u9fff]/u.test(value);
}

export function isChineseAnswerEvidence(citation: Citation) {
  if (citation.crossLanguage) return false;
  try {
    const url = new URL(citation.url);
    const hostname = url.hostname.replace(/^www\./, "").toLowerCase();
    if (
      (hostname === "genshin-impact.fandom.com" &&
        !url.pathname.startsWith("/zh/")) ||
      hostname === "wiki.hoyolab.com" ||
      hostname === "youtube.com" ||
      hostname.endsWith(".youtube.com") ||
      hostname === "youtu.be"
    ) {
      return false;
    }
  } catch {
    return false;
  }
  return containsCjk(`${citation.title} ${citation.excerpt}`);
}

function excerptTermCoverage(text: string, question: string) {
  const normalized = normalizedExcerptText(text);
  const terms = basicTerms(question);
  return terms.filter((term) => normalized.includes(term)).length;
}

function excerptQueryScore(text: string, question: string) {
  const normalized = normalizedExcerptText(text);
  return basicTerms(question).reduce((score, term, index) => {
    if (!normalized.includes(term)) return score;
    return score + term.length + (index === 0 ? 2 : 8);
  }, 0);
}

function focusedExcerpt(text: string, question: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  const lower = normalizedExcerptText(normalized);
  const terms = basicTerms(question);
  const starts = terms
    .flatMap((term) => {
      const first = lower.indexOf(term);
      const last = lower.lastIndexOf(term);
      return [first, last].filter((index) => index >= 0);
    });
  if (!starts.length) return normalized.slice(0, 900).trim();
  const candidates = starts.map((index) => {
    const start = Math.max(0, index - 180);
    const excerpt = normalized.slice(start, start + 900).trim();
    return {
      excerpt,
      index,
      score: excerptQueryScore(excerpt, question),
    };
  });
  candidates.sort((a, b) => b.score - a.score || a.index - b.index);
  return candidates[0]?.excerpt ?? "";
}

function shouldFetchParsedExcerpt(
  excerpt: string | undefined,
  question: string,
  forceFullPage = false,
) {
  if (forceFullPage) return true;
  if (!excerpt) return true;
  const terms = basicTerms(question);
  if (terms.length <= 1) return false;
  return excerptTermCoverage(excerpt, question) < Math.min(2, terms.length);
}

function focusedStoryQuestExcerpt(html: string) {
  const fullText = htmlToText(html);
  const intro = fullText.slice(0, 700).trim();
  const markerIndex = html.search(
    /<span\b[^>]*class=["'][^"']*mw-headline[^"']*["'][^>]*id=["'](?:Summary|剧情简介|剧情梗概|任务剧情|故事梗概)["']/iu,
  );
  if (markerIndex < 0) {
    return fullText.slice(0, 10_000).trim();
  }
  const headingEnd = html.indexOf("</h2>", markerIndex);
  if (headingEnd < 0) return fullText.slice(0, 10_000).trim();
  const sectionStart = headingEnd + "</h2>".length;
  const rest = html.slice(sectionStart);
  const nextHeading = rest.search(/<h2\b/iu);
  const sectionHtml =
    nextHeading >= 0 ? rest.slice(0, nextHeading) : rest;
  const fullSummary = htmlToText(sectionHtml).trim();
  const summary =
    fullSummary.length <= 5_500
      ? fullSummary
      : [
          fullSummary.slice(0, 2_300),
          "[Summary middle]",
          fullSummary.slice(
            Math.max(2_300, Math.floor(fullSummary.length / 2) - 600),
            Math.floor(fullSummary.length / 2) + 600,
          ),
          "[Summary ending]",
          fullSummary.slice(-1_800),
        ].join(" ");
  return `${intro} Summary ${summary}`.trim();
}

async function fetchParsedPageExcerpt(
  provider: MediaWikiProvider,
  pageid: number,
  question: string,
  storyScope?: StorySearchScope,
) {
  const endpoint = new URL(provider.apiUrl);
  endpoint.searchParams.set("action", "parse");
  endpoint.searchParams.set("pageid", String(pageid));
  endpoint.searchParams.set("prop", "text");
  endpoint.searchParams.set("format", "json");
  endpoint.searchParams.set("origin", "*");
  const response = await fetchExternal(endpoint, {
    signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS),
    headers: { "User-Agent": "PaimonAsksEverythingDemo/0.1" },
  });
  if (!response.ok) return "";
  const payload = (await response.json()) as {
    parse?: { text?: { "*": string } };
  };
  const pageHtml = payload.parse?.text?.["*"] ?? "";
  return storyScope === "character_story_quest"
    ? focusedStoryQuestExcerpt(pageHtml)
    : focusedExcerpt(htmlToText(pageHtml), question);
}

export function classifyWebSource(url: string): ClassifiedWebSource {
  const assessment = assessSourceRule({ url, title: "", excerpt: "" });
  const legacy = legacySourceFields(assessment);
  let hostname = "Unknown web";
  let pathname = "";
  try {
    const parsed = new URL(url);
    hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();
    pathname = parsed.pathname.toLowerCase();
  } catch {
    return {
      sourceName: hostname,
      sourceKind: "unknown_web",
      credibility: "unknown_web",
      rank: credibilityRank.unknown_web,
    };
  }
  const sourceName =
    hostname === "wiki.biligame.com"
      ? "原神WIKI_BWIKI"
      : hostname === "genshin-impact.fandom.com"
        ? pathname.startsWith("/zh/")
          ? "Genshin Impact Wiki 中文"
          : "Genshin Impact Wiki"
        : hostname === "baike.mihoyo.com"
          ? "观测枢"
          : hostname === "wiki.hoyolab.com"
            ? "HoYoWiki"
            : assessment.platformKind === "official_site"
              ? hostname.includes("mihoyo")
                ? "米哈游《原神》官网"
                : "HoYoverse"
              : hostname;
  return {
    sourceName,
    sourceKind: legacy.sourceKind,
    credibility: legacy.credibility,
    rank: legacy.rank,
  };
}

async function searchMediaWikiProvider(
  provider: MediaWikiProvider,
  question: string,
  language: Language,
  idPrefix: string,
  storyScope?: StorySearchScope,
): Promise<Citation[]> {
  const endpoint = new URL(provider.apiUrl);
  endpoint.searchParams.set("action", "query");
  endpoint.searchParams.set("list", "search");
  endpoint.searchParams.set("srsearch", question);
  endpoint.searchParams.set("srlimit", "5");
  endpoint.searchParams.set("format", "json");
  endpoint.searchParams.set("origin", "*");

  const response = await fetchExternal(endpoint, {
    signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS),
    headers: { "User-Agent": "PaimonAsksEverythingDemo/0.1" },
  });
  if (!response.ok) return [];
  const payload = (await response.json()) as {
    query?: { search?: Array<{ title: string; snippet: string; pageid: number }> };
  };
  const searchResults = payload.query?.search ?? [];
  const pageIds = searchResults.map((item) => item.pageid).filter(Boolean);
  const extracts = new Map<number, string>();

  if (pageIds.length) {
    const detailEndpoint = new URL(provider.apiUrl);
    detailEndpoint.searchParams.set("action", "query");
    detailEndpoint.searchParams.set("prop", "extracts");
    detailEndpoint.searchParams.set("explaintext", "1");
    detailEndpoint.searchParams.set("exintro", "1");
    detailEndpoint.searchParams.set("pageids", pageIds.join("|"));
    detailEndpoint.searchParams.set("format", "json");
    detailEndpoint.searchParams.set("origin", "*");
    try {
      const detailResponse = await fetchExternal(detailEndpoint, {
        signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS),
        headers: { "User-Agent": "PaimonAsksEverythingDemo/0.1" },
      });
      if (detailResponse.ok) {
        const detailPayload = (await detailResponse.json()) as {
          query?: {
            pages?: Record<string, { pageid: number; extract?: string }>;
          };
        };
        for (const page of Object.values(detailPayload.query?.pages ?? {})) {
          if (page.extract) extracts.set(page.pageid, page.extract.trim());
        }
      }
    } catch {
      // Snippets remain available as a degraded but traceable fallback.
    }
  }

  await Promise.allSettled(
    searchResults.map(async (item) => {
      const existing = extracts.get(item.pageid);
      if (
        !shouldFetchParsedExcerpt(
          existing,
          question,
          storyScope === "character_story_quest",
        )
      ) {
        return;
      }
      const parsedExcerpt = await fetchParsedPageExcerpt(
        provider,
        item.pageid,
        question,
        storyScope,
      );
      if (
        parsedExcerpt &&
        excerptQueryScore(parsedExcerpt, question) >
          excerptQueryScore(existing ?? "", question)
      ) {
        extracts.set(item.pageid, parsedExcerpt);
      }
    }),
  );

  return searchResults.map((item, index) => {
    const url = `${provider.pageBaseUrl}${encodeURIComponent(
      item.title.replace(/ /g, "_"),
    )}`;
    const assessment = assessSourceRule({
      url,
      title: item.title,
      excerpt:
        extracts.get(item.pageid) ||
        stripHtml(item.snippet),
    });
    const legacy = legacySourceFields(assessment);
    return {
      id: `${idPrefix}-${index + 1}`,
      title: item.title,
      url,
      sourceName: provider.sourceName,
      sourceKind: legacy.sourceKind,
      credibility: legacy.credibility,
      factStatus: legacy.factStatus,
      excerpt:
        extracts.get(item.pageid) ||
        stripHtml(item.snippet) ||
        (language === "zh-CN"
          ? `外部 Wiki 搜索命中页面“${item.title}”，需打开页面并结合原始引文核验。`
          : `External wiki search matched the page "${item.title}". Open the page and verify against its cited sources.`),
      external: true,
      crossLanguage:
        provider.language !== "multi" && provider.language !== language,
      assessment,
    } satisfies Citation;
  });
}

function normalizeMatchText(value: string) {
  return normalizeChineseVariants(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s·•—–_()[\]（）【】「」『』《》:：,，。.!！?？/\\-]+/gu, "");
}

function includesEntity(value: string, entity: string) {
  const normalizedValue = normalizeMatchText(value);
  const normalizedEntity = normalizeMatchText(entity);
  return normalizedEntity.length >= 2 && normalizedValue.includes(normalizedEntity);
}

function relevanceTerms(plan: SearchPlan) {
  return plan.queries
    .flatMap((query) => query.split(/[\s,，、/]+/u))
    .map((term) => term.trim().toLowerCase())
    .filter((term) => term.length >= 2);
}

export function entityRelevanceScore(citation: Citation, plan: SearchPlan) {
  const entities = [...plan.coreEntities, ...plan.aliases];
  if (!entities.length) return 0;
  const titleMatches = entities.filter((entity) =>
    includesEntity(citation.title, entity),
  );
  const urlMatches = entities.filter((entity) => {
    try {
      return includesEntity(decodeURIComponent(citation.url), entity);
    } catch {
      return false;
    }
  });
  const excerptMatches = entities.filter((entity) =>
    includesEntity(citation.excerpt, entity),
  );
  const coreMatches = plan.coreEntities.filter(
    (entity) =>
      titleMatches.includes(entity) ||
      urlMatches.includes(entity) ||
      excerptMatches.includes(entity),
  );
  const allCoreBonus =
    plan.coreEntities.length > 1 &&
    coreMatches.length === plan.coreEntities.length
      ? 100
      : 0;
  const matchScore = entities.reduce((score, entity) => {
    if (titleMatches.includes(entity)) return score + 120;
    if (urlMatches.includes(entity)) return score + 80;
    if (excerptMatches.includes(entity)) return score + 30;
    return score;
  }, 0);
  return matchScore + allCoreBonus;
}

function passesEntityGate(
  citation: Citation,
  plan: SearchPlan,
  question: string,
) {
  if (!plan.coreEntities.length) return true;
  const titleOrUrlMatch = [...plan.coreEntities, ...plan.aliases].some(
    (entity) =>
      includesEntity(citation.title, entity) ||
      includesEntity(citation.url, entity),
  );
  if (
    plan.intent === "identity" ||
    plan.intent === "current_status" ||
    plan.intent === "official_media"
  ) {
    return (
      titleOrUrlMatch ||
      (Boolean(identityClaimQueryPattern(question)) &&
        entityRelevanceScore(citation, plan) >= 30)
    );
  }
  const excerptThreshold = plan.intent === "relationship" ? 60 : 30;
  return titleOrUrlMatch || entityRelevanceScore(citation, plan) >= excerptThreshold;
}

function lexicalRelevanceScore(citation: Citation, plan: SearchPlan) {
  const title = citation.title.toLowerCase();
  const excerpt = citation.excerpt.toLowerCase();
  const terms = relevanceTerms(plan);
  const matchedTerms = terms.filter(
    (term) => title.includes(term) || excerpt.includes(term),
  ).length;
  return terms.reduce((score, term) => {
    if (title.includes(term)) score += 4;
    if (excerpt.includes(term)) score += 2;
    return score;
  }, matchedTerms * 10);
}

const relationshipInteractionPattern =
  /对话|台词|互动|合作|联手|资助|支持|投资|治疗|医治|换(?:上|过|了)?[^，。；,.!?]{0,12}(?:肺|身体|器官)|救(?:下|过|了)?|创造|制造|改造|委托|命令|交易|冲突|反对|杀死|告别|告辞|dialogue|conversation|interact(?:ion|ed)?|cooperat(?:e|ion)|fund(?:ed|ing)?|financ(?:e|ed|ing)|treat(?:ed|ment)?|replace(?:d)?[^.!?]{0,20}(?:lung|organ)|saved?|created?|killed?|opposed?|farewell/iu;
const negatedRelationshipInteractionPattern =
  /(?:没有|并无|未曾|从未|不存在|尚未)[^，。；,.!?]{0,20}(?:对话|互动|合作|联系|关系)|no\s+(?:direct\s+)?(?:dialogue|interaction|cooperation|connection|relationship)|never\s+(?:spoke|interacted|cooperated)/iu;

function relationshipInteractionSignalCount(text: string) {
  return (
    text.match(new RegExp(relationshipInteractionPattern.source, "giu"))
      ?.length ?? 0
  );
}

function citationMentionsAllRelationshipEntities(
  citation: Citation,
  plan: SearchPlan,
) {
  if (plan.coreEntities.length < 2) return false;
  const text = `${citation.title} ${citation.excerpt}`;
  return plan.coreEntities.every((entity) => includesEntity(text, entity));
}

export function relationshipInteractionScore(
  citation: Citation,
  plan: SearchPlan,
) {
  if (
    plan.intent !== "relationship" ||
    !citationMentionsAllRelationshipEntities(citation, plan)
  ) {
    return 0;
  }
  const text = `${citation.title} ${citation.excerpt}`;
  if (
    negatedRelationshipInteractionPattern.test(text) &&
    !/资助|支持|投资|治疗|医治|换(?:上|过|了)?[^，。；,.!?]{0,12}(?:肺|身体|器官)|救(?:下|过|了)?|创造|制造|改造|委托|命令|交易|冲突|反对|杀死|告别|告辞|fund(?:ed|ing)?|financ(?:e|ed|ing)|treat(?:ed|ment)?|replace(?:d)?[^.!?]{0,20}(?:lung|organ)|saved?|created?|killed?|opposed?|farewell/iu.test(
      text,
    )
  ) {
    return 0;
  }
  const matchCount = relationshipInteractionSignalCount(text);
  if (!matchCount) return 0;
  const contentBonus =
    citation.assessment?.contentKind === "game_text_reference" ? 80 : 0;
  return 200 + contentBonus + Math.min(matchCount, 6) * 30;
}

function relationshipSpecificQueries(plan: SearchPlan) {
  if (plan.intent !== "relationship") return [];

  const entityNames = [...plan.coreEntities, ...plan.aliases].map((name) =>
    cleanSearchValue(name).toLowerCase(),
  );
  const hasPantalone = entityNames.some((name) =>
    ["富人", "pantalone", "regrator", "潘塔罗涅"].includes(name),
  );
  const hasDottore = entityNames.some((name) =>
    ["博士", "dottore", "il dottore", "多托雷"].includes(name),
  );

  if (!hasPantalone || !hasDottore) return [];

  return [
    "富人 博士 换肺",
    "富人 博士 北国银行 资助",
    "富人 博士 合作 研究",
  ];
}

function expandedQueries(plan: SearchPlan, question: string, language: Language) {
  const queries: string[] = [];
  const subject = plan.coreEntities[0] || plan.aliases[0];
  const relationshipSubject =
    plan.coreEntities.length >= 2
      ? `${plan.coreEntities[0]} ${plan.coreEntities[1]}`
      : undefined;
  const latinAlias = plan.aliases.find((alias) => /[a-z]/iu.test(alias));
  const latinRelationshipSubject =
    plan.aliases.filter((alias) => /[a-z]/iu.test(alias)).length >= 2
      ? plan.aliases.filter((alias) => /[a-z]/iu.test(alias)).slice(0, 2).join(" ")
      : undefined;
  if (plan.intent === "relationship" && relationshipSubject) {
    if (language === "zh-CN") {
      queries.push(
        `${relationshipSubject} 关系`,
        `${relationshipSubject} PV 对话`,
        `${relationshipSubject} 剧情解析`,
        `${relationshipSubject} 主线 对话`,
        `${relationshipSubject} 剧情 实录`,
        `${relationshipSubject} 官方文本`,
        `site:bilibili.com ${relationshipSubject} 对话`,
        `site:zhihu.com ${relationshipSubject} 剧情`,
        `site:gamersky.com ${relationshipSubject} 剧情`,
      );
    } else {
      queries.push(
        `${latinRelationshipSubject ?? relationshipSubject} relationship`,
        `${latinRelationshipSubject ?? relationshipSubject} dialogue`,
        `${latinRelationshipSubject ?? relationshipSubject} story analysis`,
      );
    }
  }
  queries.push(...relationshipSpecificQueries(plan));
  queries.push(...plan.queries);
  if (subject) {
    const identityLike =
      plan.intent === "identity" ||
      /是谁|身份|是什么人|外星人|来自哪里|提瓦特之外|星海|who is|identity|alien|outside teyvat|origin/iu.test(
        question,
      );
    if (identityLike) {
      if (language === "zh-CN") {
        queries.push(
          `${subject} 提瓦特之外`,
          `${subject} 星海 来源`,
          `${subject} 身份 来历`,
          `${subject} 传说任务 剧情文本`,
          `${subject} 传说任务 星球`,
          `${subject} 剧情 世界边界`,
        );
      } else {
        queries.push(
          `${latinAlias ?? subject} outside Teyvat`,
          `${latinAlias ?? subject} alien origin`,
          `${latinAlias ?? subject} identity origin`,
          `${latinAlias ?? subject} story quest origin`,
          `${latinAlias ?? subject} quest text`,
        );
      }
      if (latinAlias) {
        queries.push(
          `${latinAlias} outside Teyvat`,
          `${latinAlias} alien origin`,
          `${latinAlias} not from Teyvat different planet`,
          `${latinAlias} different planet story quest`,
          `${latinAlias} story quest transcript`,
        );
      }
    }
    queries.push(
      language === "zh-CN"
        ? `site:baike.mihoyo.com/ys/obc ${subject}`
        : `site:wiki.hoyolab.com/pc/genshin ${subject}`,
    );
    if (language === "zh-CN") {
      queries.push(`site:wiki.hoyolab.com/pc/genshin ${subject}`);
    }
    queries.push(
      language === "zh-CN"
        ? `site:genshin.hoyoverse.com ${subject} 角色介绍`
        : `site:genshin.hoyoverse.com/en/news ${subject}`,
    );
  }
  const storyLike =
    plan.intent === "story" ||
    /传说任务|劇情|剧情|story\s*quest|quest|walkthrough|全流程/iu.test(
      question,
    );
  if (subject && storyLike) {
    if (language === "zh-CN") {
      queries.push(
        `${subject} 传说任务`,
        `${subject} 传说任务 剧情文本`,
        `${subject} 角色故事 游戏内文本`,
        `${subject} 传说任务 剧情梳理`,
        `${subject} 任务对白`,
      );
    } else {
      queries.push(
        `${subject} story quest`,
        `${subject} story quest transcript`,
        `${subject} story quest plot`,
        `${subject} character story in-game text`,
      );
    }
    if (latinAlias) {
      queries.push(
        `${latinAlias} story quest`,
        `${latinAlias} story quest chapter`,
        `${latinAlias} story quest plot`,
      );
    }
  }
  return Array.from(new Set(queries.map((query) => cleanSearchValue(query)))).slice(
    0,
    plan.intent === "relationship" ? 24 : 16,
  );
}

function decodeSearchUrl(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function isCharacterStoryQuestEvidence(
  citation: Citation,
  plan: SearchPlan,
) {
  if (plan.storyScope !== "character_story_quest") return true;
  const titleAndUrl = `${decodeSearchUrl(citation.url)} ${citation.title}`;
  const text = `${titleAndUrl} ${citation.excerpt}`;
  const titleExplicit =
    /传说任务|傳說任務|角色任务|角色任務|story\s*quest/iu.test(titleAndUrl);
  const structuralEvidence =
    /quest\s+type[\s\S]{0,40}story|(?:is|belongs to)[\s\S]{0,80}story\s*quest|story\s*quest[\s\S]{0,80}(?:chapter|act)|list\s+of\s+(?:quests|acts)[\s\S]{0,120}summary|chapter\s*:?\s*act|任[务務]类型[\s\S]{0,30}(?:传说|傳說|故事)|任[务務]章节/iu.test(
      text,
    );
  return titleExplicit || structuralEvidence;
}

function storyIntentScore(citation: Citation, plan: SearchPlan) {
  if (plan.intent !== "story") return 0;
  const text = `${citation.title} ${citation.excerpt}`.toLowerCase();
  const patterns = [
    /传说任务/u,
    /傳說任務/u,
    /剧情/u,
    /劇情/u,
    /剧情文本/u,
    /任务对白/u,
    /角色故事/u,
    /珍上至珍/u,
    /香糕塔/u,
    /story quest/i,
    /quest chapter/i,
    /quest type story/i,
    /chapter\s*:?\s*act/i,
    /transcript/i,
    /quest plot/i,
  ];
  const base = patterns.reduce(
    (score, pattern) => score + (pattern.test(text) ? 25 : 0),
    0,
  );
  return (
    base +
    (plan.storyScope === "character_story_quest" &&
    isCharacterStoryQuestEvidence(citation, plan)
      ? 180
      : 0) -
    (plan.storyScope === "character_story_quest" &&
    /\(Event\)|（活动）|活動/iu.test(citation.title)
      ? 120
      : 0)
  );
}

function identityClaimQueryPattern(question: string) {
  if (/外星人|提瓦特之外|世界之外|星海|outside\s+teyvat|alien|otherworld|beyond\s+teyvat/iu.test(question)) {
    return /外星人|提瓦特之外|非提瓦特|世界之外|世界边界|星海|星球|宇宙|outside\s+teyvat|not\s+from\s+teyvat|different\s+planet|another\s+planet|border\s+between\s+worlds|alien|otherworld|beyond\s+teyvat/iu;
  }
  if (/身份|来历|来源|来自哪里|origin|identity|where.*from/iu.test(question)) {
    return /身份|来历|来源|来自|origin|identity|from/iu;
  }
  return null;
}

function identityClaimScore(citation: Citation, question: string, plan: SearchPlan) {
  if (plan.intent !== "identity" && plan.intent !== "current_status") return 0;
  const pattern = identityClaimQueryPattern(question);
  if (!pattern) return 0;
  const text = `${citation.title} ${citation.excerpt}`;
  if (!pattern.test(text)) return 0;
  return citation.assessment?.authority === "curated_reference" ||
    citation.assessment?.authority === "official"
    ? 180
    : 90;
}

function dedupeAndRank(
  citations: Citation[],
  plan: SearchPlan,
  question: string,
) {
  const deduped = new Map<string, Citation>();
  for (const citation of citations) {
    const key = `${citation.url.toLowerCase()}::${citation.title.toLowerCase()}`;
    if (!deduped.has(key)) deduped.set(key, citation);
  }
  return [...deduped.values()]
    .filter((citation) => passesEntityGate(citation, plan, question))
    .filter((citation) => isCharacterStoryQuestEvidence(citation, plan))
    .filter((citation) =>
      sourceAllowedForQuestion(citation, { question, plan }),
    )
    .sort((a, b) => {
      const governanceDifference =
        sourceGovernanceScore(b, { question, plan }) -
        sourceGovernanceScore(a, { question, plan });
      const entityDifference =
        entityRelevanceScore(b, plan) - entityRelevanceScore(a, plan);
      const aRank = credibilityRank[a.credibility ?? "unknown_web"];
      const bRank = credibilityRank[b.credibility ?? "unknown_web"];
      const storyDifference = storyIntentScore(b, plan) - storyIntentScore(a, plan);
      const claimDifference =
        identityClaimScore(b, question, plan) -
        identityClaimScore(a, question, plan);
      const lexicalDifference =
        lexicalRelevanceScore(b, plan) - lexicalRelevanceScore(a, plan);
      const relationshipDifference =
        relationshipInteractionScore(b, plan) -
        relationshipInteractionScore(a, plan);
      if (plan.intent === "relationship") {
        return (
          relationshipDifference ||
          governanceDifference ||
          entityDifference ||
          bRank - aRank ||
          lexicalDifference ||
          a.title.localeCompare(b.title)
        );
      }
      if (plan.intent === "story") {
        return (
          governanceDifference ||
          storyDifference ||
          entityDifference ||
          lexicalDifference ||
          bRank - aRank ||
          a.title.localeCompare(b.title)
        );
      }
      if (identityClaimQueryPattern(question)) {
        return (
          claimDifference ||
          governanceDifference ||
          entityDifference ||
          bRank - aRank ||
          lexicalDifference ||
          a.title.localeCompare(b.title)
        );
      }
      return (
        governanceDifference ||
        claimDifference ||
        entityDifference ||
        bRank - aRank ||
        lexicalDifference ||
        a.title.localeCompare(b.title)
      );
    })
    .map((citation, index) => ({ ...citation, id: `external-${index + 1}` }));
}

export function selectCandidatesForAssessment(
  candidates: Citation[],
  plan: SearchPlan,
  question: string,
  limit = 16,
) {
  const ranked = dedupeAndRank(candidates, plan, question);
  if (plan.intent !== "relationship") return ranked.slice(0, limit);

  const directInteractions = ranked
    .filter((citation) => relationshipInteractionScore(citation, plan) > 0)
    .slice(0, 3);
  const reservedKeys = new Set(
    directInteractions.map(
      (citation) =>
        `${citation.url.toLowerCase()}::${citation.title.toLowerCase()}`,
    ),
  );
  const remainder = ranked.filter(
    (citation) =>
      !reservedKeys.has(
        `${citation.url.toLowerCase()}::${citation.title.toLowerCase()}`,
      ),
  );
  return [...directInteractions, ...remainder].slice(0, limit);
}

async function searchProviders(
  query: string,
  language: Language,
  plan: SearchPlan,
): Promise<Citation[]> {
  const providers =
    language === "zh-CN"
      ? CHINESE_MEDIAWIKI_PROVIDERS
      : [EN_FANDOM_PROVIDER, ...MEDIAWIKI_PROVIDERS.filter((p) => p.language === "zh-CN")];
  const results = await Promise.allSettled(
    providers.map((provider, index) =>
      searchMediaWikiProvider(
        provider,
        provider.language === "en"
          ? /[a-z]/iu.test(query)
            ? query
            : plan.aliases.find((alias) => /[a-z]/iu.test(alias)) ?? query
          : query,
        language,
        `external-${index + 1}`,
        plan.storyScope,
      ),
    ),
  );
  return dedupeAndRank(
    results.flatMap((result) =>
      result.status === "fulfilled" ? result.value : [],
    ),
    plan,
    query,
  ).slice(0, 6);
}

function englishDiscoveryQuery(plan: SearchPlan) {
  const alias = plan.aliases.find((value) => /[a-z]/iu.test(value));
  if (!alias) return undefined;
  if (plan.storyScope === "character_story_quest") {
    return `${alias} story quest plot`;
  }
  if (plan.intent === "story") return `${alias} story quest storyline`;
  if (plan.intent === "identity") return `${alias} identity origin`;
  if (plan.intent === "relationship") return `${alias} relationship`;
  return `${alias} Genshin`;
}

async function discoverEnglishClues(
  plan: SearchPlan,
  language: Language,
) {
  if (language !== "zh-CN") return [] as Citation[];
  const query = englishDiscoveryQuery(plan);
  if (!query) return [] as Citation[];
  return searchMediaWikiProvider(
    EN_FANDOM_PROVIDER,
    query,
    language,
    "discovery-en",
    plan.storyScope,
  ).catch(() => []);
}

async function localizedChineseTermsFromEnglishClues(clues: Citation[]) {
  const results = await Promise.allSettled(
    clues.slice(0, 2).map(async (citation) => {
      const endpoint = new URL(EN_FANDOM_PROVIDER.apiUrl);
      endpoint.searchParams.set("action", "parse");
      endpoint.searchParams.set("page", citation.title);
      endpoint.searchParams.set("prop", "text");
      endpoint.searchParams.set("format", "json");
      endpoint.searchParams.set("origin", "*");
      const response = await fetchExternal(endpoint, {
        signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS),
        headers: { "User-Agent": "PaimonAsksEverythingDemo/0.1" },
      });
      if (!response.ok) return [];
      const payload = (await response.json()) as {
        parse?: { text?: { "*": string } };
      };
      const text = htmlToText(payload.parse?.text?.["*"] ?? "");
      return [
        ...text.matchAll(
          /Chinese \(Simplified\)\s+([\p{Script=Han}·・—-]{2,40})/giu,
        ),
      ].map((match) => match[1]!.trim());
    }),
  );
  return Array.from(
    new Set(
      results.flatMap((result) =>
        result.status === "fulfilled" ? result.value : [],
      ),
    ),
  ).slice(0, 4);
}

function chineseQueriesFromEnglishClues(
  plan: SearchPlan,
  clues: Citation[],
  localizedTerms: string[],
) {
  const subject = plan.coreEntities[0];
  if (!subject) return [];
  const generic = [
    `site:wiki.biligame.com/ys ${subject} 传说任务`,
    `site:baike.mihoyo.com/ys/obc ${subject} 传说任务`,
    `${subject} 传说任务 中文WIKI 剧情`,
    `site:zhihu.com ${subject} 传说任务 剧情`,
    `site:mp.weixin.qq.com ${subject} 原神 传说任务`,
  ];
  const localized = localizedTerms.flatMap((term) => [
    `${subject} ${term} 剧情`,
    `site:wiki.biligame.com/ys ${subject} ${term}`,
    `site:baike.mihoyo.com/ys/obc ${subject} ${term}`,
  ]);
  const titleQueries = clues
    .filter((citation) => citation.crossLanguage)
    .map((citation) => citation.title.trim())
    .filter(Boolean)
    .slice(0, 1)
    .flatMap((title) => [
      `${subject} "${title}" 中文 剧情`,
      `${subject} "${title}" 中文WIKI`,
    ]);
  return [...localized, ...generic, ...titleQueries];
}

function normalizeResultUrl(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl, "https://duckduckgo.com");
    const redirected = parsed.searchParams.get("uddg");
    if (redirected) return decodeURIComponent(redirected);
    if (parsed.hostname === "r.search.yahoo.com") {
      const match = parsed.pathname.match(/\/RU=([^/]+)\//u);
      if (match?.[1]) return decodeURIComponent(match[1]);
    }
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

function makeWebCitation({
  id,
  url,
  title,
  excerpt,
}: {
  id: string;
  url: string;
  title: string;
  excerpt: string;
}): Citation[] {
  if (!url || !title) return [];
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    if (
      hostname === "search.yahoo.com" ||
      hostname === "images.search.yahoo.com" ||
      hostname === "video.search.yahoo.com"
    ) {
      return [];
    }
  } catch {
    return [];
  }
  const classification = classifyWebSource(url);
  const fallbackExcerpt =
    excerpt ||
    `General web search matched "${title}". Open the page and verify against primary sources.`;
  const assessment = assessSourceRule({
    url,
    title,
    excerpt: fallbackExcerpt,
  });
  const legacy = legacySourceFields(assessment);
  return [
    {
      id,
      title,
      url,
      sourceName: classification.sourceName,
      sourceKind: legacy.sourceKind,
      credibility: legacy.credibility,
      factStatus: legacy.factStatus,
      excerpt: fallbackExcerpt,
      external: true,
      crossLanguage: false,
      assessment,
    },
  ];
}

function shouldFetchReadablePage(citation: Citation) {
  try {
    const parsed = new URL(citation.url);
    const hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();
    if (
      hostname === "search.yahoo.com" ||
      hostname === "html.duckduckgo.com" ||
      hostname.endsWith(".google.com") ||
      hostname === "google.com"
    ) {
      return false;
    }
    return /^https?:$/iu.test(parsed.protocol);
  } catch {
    return false;
  }
}

function looksLikeHtmlResponse(contentType: string | null, body: string) {
  if (/text\/html|application\/xhtml\+xml/iu.test(contentType ?? "")) {
    return true;
  }
  const trimmed = body.trimStart().slice(0, 500).toLowerCase();
  return (
    trimmed.startsWith("<!doctype html") ||
    trimmed.startsWith("<html") ||
    /<(?:main|article|section|p|div|body)\b/iu.test(trimmed)
  );
}

async function enrichWebCitationUncached(
  citation: Citation,
  options: { signal?: AbortSignal; question?: string } = {},
) {
  let platform = platformForUrl(citation.url);
  const hostname = (() => {
    try {
      return new URL(citation.url).hostname.replace(/^www\./, "").toLowerCase();
    } catch {
      return "";
    }
  })();
  const shortLink = hostname === "hoyo.link";
  if (!shortLink && !shouldFetchReadablePage(citation)) {
    return citation;
  }
  try {
    const response = await fetchExternal(new URL(citation.url), {
      signal: boundedSignal(options.signal, 6_000),
      headers: {
        "User-Agent": "Mozilla/5.0 PaimonAsksEverythingDemo/0.1",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.7",
      },
    });
    if (!response.ok) return citation;
    const html = (await response.text()).slice(0, 800_000);
    if (!looksLikeHtmlResponse(response.headers.get("Content-Type"), html)) {
      return citation;
    }
    const finalUrl = response.url || citation.url;
    platform = platformForUrl(finalUrl);
    const identity = extractPublisherIdentity(finalUrl, html);
    const pageExcerpt = focusedExcerpt(
      htmlToText(html),
      options.question || `${citation.title} ${citation.excerpt}`,
    );
    const originalInteractionSignals = relationshipInteractionSignalCount(
      citation.excerpt,
    );
    const pageInteractionSignals = relationshipInteractionSignalCount(pageExcerpt);
    const excerpt =
      pageExcerpt &&
      (originalInteractionSignals === 0 ||
        pageInteractionSignals >= originalInteractionSignals)
        ? pageExcerpt
        : citation.excerpt;
    const assessment = assessSourceRule({
      url: finalUrl,
      title: citation.title,
      excerpt,
      pageHtml: html,
    });
    const legacy = legacySourceFields(assessment);
    return {
      ...citation,
      url: finalUrl,
      excerpt,
      sourceName:
        assessment.platformKind === "official_site"
          ? finalUrl.includes("mihoyo.com")
            ? "米哈游《原神》官网"
            : "HoYoverse"
          : assessment.publisherKind === "genshin_official"
          ? platform.platform === "bilibili"
            ? "原神官方 · Bilibili"
            : platform.platform === "youtube"
              ? "Genshin Impact · YouTube"
              : platform.platform === "miyoushe"
                ? "原神官方 · 米游社"
                : "Genshin Impact · HoYoLAB"
          : citation.sourceName,
      sourceKind: legacy.sourceKind,
      credibility: legacy.credibility,
      factStatus: legacy.factStatus,
      assessment: {
        ...assessment,
        signals: Array.from(
          new Set([
            ...assessment.signals,
            ...identity.signals,
            ...(finalUrl !== citation.url ? ["resolved-final-url"] : []),
          ]),
        ),
      },
    };
  } catch {
    return citation;
  }
}

async function enrichWebCitation(
  citation: Citation,
  options: { signal?: AbortSignal; question?: string } = {},
) {
  if (process.env.NODE_ENV === "test") {
    return enrichWebCitationUncached(citation, options);
  }
  const cacheKey = `${citation.url.trim().toLowerCase()}::${(
    options.question ?? ""
  )
    .trim()
    .toLowerCase()}`;
  const cached = pageEnrichmentCache.get(cacheKey);
  if (cached) return { ...cached, id: citation.id };
  const enriched = await enrichWebCitationUncached(citation, options);
  pageEnrichmentCache.set(cacheKey, enriched);
  return enriched;
}

function directChineseWikiTitles(term: string) {
  const normalized = cleanSearchValue(term, 60).replace(/ /g, "_");
  if (!normalized || !containsCjk(normalized)) return [];
  return [normalized, `「${normalized}」`];
}

async function probeLocalizedChineseWikiPages(
  plan: SearchPlan,
  localizedTerms: string[],
  question: string,
) {
  const subject = plan.coreEntities[0];
  if (!subject || localizedTerms.length === 0) return [] as Citation[];
  const candidates = localizedTerms
    .slice(0, 2)
    .flatMap((term) =>
      directChineseWikiTitles(term).map((pageTitle, index) => ({
        term,
        pageTitle,
        index,
      })),
    );
  const results = await Promise.allSettled(
    candidates.map(async ({ term, pageTitle, index }) => {
      const endpoint = new URL("https://wiki.biligame.com/ys/api.php");
      endpoint.searchParams.set("action", "parse");
      endpoint.searchParams.set("page", pageTitle);
      endpoint.searchParams.set("prop", "text");
      endpoint.searchParams.set("format", "json");
      endpoint.searchParams.set("origin", "*");
      const response = await fetchExternal(endpoint, {
        signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS),
        headers: {
          "User-Agent": "Mozilla/5.0 PaimonAsksEverythingDemo/0.1",
          Referer: "https://wiki.biligame.com/ys/",
          "Accept-Language": "zh-CN,zh;q=0.9",
        },
      });
      if (!response.ok) return undefined;
      const payload = (await response.json()) as {
        parse?: { title?: string; text?: { "*": string } };
        error?: unknown;
      };
      const pageHtml = payload.parse?.text?.["*"] ?? "";
      if (!pageHtml) return undefined;
      const resolvedTitle = payload.parse?.title?.trim() || pageTitle;
      const url = `https://wiki.biligame.com/ys/${encodeURIComponent(
        resolvedTitle.replace(/ /g, "_"),
      )}`;
      const excerpt =
        plan.storyScope === "character_story_quest"
          ? focusedStoryQuestExcerpt(pageHtml)
          : focusedExcerpt(
              htmlToText(pageHtml),
              `${subject} ${term} ${question}`,
            );
      const assessment = assessSourceRule({
        url,
        title: resolvedTitle,
        excerpt,
      });
      const legacy = legacySourceFields(assessment);
      const citation = {
        id: `direct-zh-wiki-${index + 1}`,
        title: resolvedTitle,
        url,
        sourceName: "原神WIKI_BWIKI",
        sourceKind: legacy.sourceKind,
        credibility: legacy.credibility,
        factStatus: legacy.factStatus,
        excerpt,
        external: true,
        crossLanguage: false,
        assessment,
      } satisfies Citation;
      const pageText = `${citation.title} ${citation.excerpt} ${decodeSearchUrl(
        citation.url,
      )}`;
      if (!citation.excerpt.trim()) return undefined;
      if (!includesEntity(pageText, term) || !includesEntity(pageText, subject)) {
        return undefined;
      }
      if (!isChineseAnswerEvidence(citation)) return undefined;
      if (!isCharacterStoryQuestEvidence(citation, plan)) return undefined;
      return citation;
    }),
  );
  return results.flatMap((result) =>
    result.status === "fulfilled" && result.value ? [result.value] : [],
  );
}

async function searchChineseStoryQuestWikiFast(
  plan: SearchPlan,
  question: string,
) {
  const subject = plan.coreEntities[0];
  if (plan.storyScope !== "character_story_quest" || !subject) {
    return [] as Citation[];
  }
  try {
    const endpoint = new URL("https://wiki.biligame.com/ys/api.php");
    endpoint.searchParams.set("action", "query");
    endpoint.searchParams.set("list", "search");
    endpoint.searchParams.set("srsearch", `${subject} 传说任务`);
    endpoint.searchParams.set("srlimit", "5");
    endpoint.searchParams.set("format", "json");
    endpoint.searchParams.set("origin", "*");
    const response = await fetchExternal(endpoint, {
      signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS),
      headers: {
        "User-Agent": "Mozilla/5.0 PaimonAsksEverythingDemo/0.1",
        Referer: "https://wiki.biligame.com/ys/",
        "Accept-Language": "zh-CN,zh;q=0.9",
      },
    });
    if (!response.ok) return [];
    const payload = (await response.json()) as {
      query?: { search?: Array<{ title?: string }> };
    };
    const localizedTerms = Array.from(
      new Set(
        (payload.query?.search ?? [])
          .map((item) =>
            (item.title ?? "")
              .replace(/^[「『《【]\s*/u, "")
              .replace(/\s*[」』》】]$/u, "")
              .trim(),
          )
          .filter(
            (title) =>
              containsCjk(title) &&
              /(?:之章|篇章|章节|章)$/u.test(title) &&
              title.length <= 30,
          ),
      ),
    ).slice(0, 2);
    return probeLocalizedChineseWikiPages(plan, localizedTerms, question);
  } catch {
    return [];
  }
}

async function searchDuckDuckGoWeb(
  query: string,
  signal?: AbortSignal,
): Promise<Citation[]> {
  const endpoint = new URL("https://html.duckduckgo.com/html/");
  endpoint.searchParams.set("q", query);
  const response = await fetchExternal(endpoint, {
    signal: boundedSignal(signal, EXTERNAL_FETCH_TIMEOUT_MS),
    headers: { "User-Agent": "PaimonAsksEverythingDemo/0.1" },
  });
  if (!response.ok) return [];
  const html = await response.text();
  const matches = [
    ...html.matchAll(
      /<a[^>]*class=["'][^"']*result__a[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<a[^>]*class=["'][^"']*result__snippet[^"']*["'][^>]*>|<div[^>]*class=["'][^"']*result__snippet[^"']*["'][^>]*>)([\s\S]*?)(?:<\/a>|<\/div>)/gi,
    ),
  ];
  return matches.slice(0, 4).flatMap((match, index) => {
    const rawUrl = normalizeResultUrl(decodeHtml(match[1] ?? ""));
    const title = decodeHtml(match[2] ?? "");
    const excerpt = decodeHtml(match[3] ?? "");
    return makeWebCitation({ id: `web-ddg-${index + 1}`, url: rawUrl, title, excerpt });
  });
}

async function searchYahooWeb(
  query: string,
  signal?: AbortSignal,
): Promise<Citation[]> {
  const endpoint = new URL("https://search.yahoo.com/search");
  endpoint.searchParams.set("p", query);
  const response = await fetchExternal(endpoint, {
    signal: boundedSignal(signal, EXTERNAL_FETCH_TIMEOUT_MS),
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.7",
    },
  });
  if (!response.ok) return [];
  const html = await response.text();
  const matches = [
    ...html.matchAll(
      /<a[^>]*href=["']([^"']+)["'][^>]*>[\s\S]*?<h3[^>]*class=["'][^"']*title[^"']*["'][^>]*>([\s\S]*?)<\/h3>[\s\S]*?<\/a>([\s\S]{0,1800}?)(?=<a[^>]*href=|<li[^>]*class=|<\/ol>|$)/gi,
    ),
  ];
  return matches.slice(0, 4).flatMap((match, index) => {
    const url = normalizeResultUrl(decodeHtml(match[1] ?? ""));
    const title = decodeHtml(match[2] ?? "");
    const snippetMatch = (match[3] ?? "").match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    const excerpt = decodeHtml(snippetMatch?.[1] ?? "");
    return makeWebCitation({ id: `web-yahoo-${index + 1}`, url, title, excerpt });
  });
}

async function searchSogouWeb(
  query: string,
  signal?: AbortSignal,
): Promise<Citation[]> {
  if (
    !containsCjk(query) ||
    !/关系|联系|对话|互动|合作|资助|换肺|北国银行/u.test(query)
  ) {
    return [];
  }
  const endpoint = new URL("https://www.sogou.com/web");
  endpoint.searchParams.set("query", query);
  const response = await fetchExternal(endpoint, {
    signal: boundedSignal(signal, EXTERNAL_FETCH_TIMEOUT_MS),
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Accept-Language": "zh-CN,zh;q=0.9",
    },
  });
  if (!response.ok) return [];
  const html = await response.text();
  const matches = [
    ...html.matchAll(
      /<h3[^>]*class=["'][^"']*vr-title[^"']*["'][^>]*>[\s\S]*?<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h3>[\s\S]*?<div[^>]*class=["'][^"']*(?:str-text-info|text-layout|ft|fz-mid)[^"']*["'][^>]*>([\s\S]*?)<\/div>/giu,
    ),
  ];
  return matches.slice(0, 5).flatMap((match, index) => {
    const rawUrl = decodeHtml(match[1] ?? "");
    const url = (() => {
      try {
        return new URL(rawUrl, "https://www.sogou.com").toString();
      } catch {
        return rawUrl;
      }
    })();
    const title = decodeHtml(match[2] ?? "");
    const excerpt = decodeHtml(match[3] ?? "");
    return makeWebCitation({
      id: `web-sogou-${index + 1}`,
      url,
      title,
      excerpt,
    });
  });
}

export async function searchGeneralWeb(
  query: string,
  options: { enrich?: boolean; signal?: AbortSignal } = {},
): Promise<Citation[]> {
  const cacheKey = `web-search-v2:${options.enrich === false ? "raw" : "enriched"}:${query
    .trim()
    .toLowerCase()}`;
  if (process.env.NODE_ENV !== "test") {
    const cached = generalSearchCache.get(cacheKey);
    if (cached) return cached;
  }
  const results = await Promise.allSettled([
    searchDuckDuckGoWeb(query, options.signal),
    searchYahooWeb(query, options.signal),
    searchSogouWeb(query, options.signal),
  ]);
  const citations = results.flatMap((result) =>
    result.status === "fulfilled" ? result.value : [],
  );
  if (options.enrich === false) {
    if (process.env.NODE_ENV !== "test" && citations.length > 0) {
      generalSearchCache.set(cacheKey, citations);
    }
    return citations;
  }
  const enriched = await Promise.allSettled(
    citations
      .slice(0, 8)
      .map((citation) =>
        enrichWebCitation(citation, {
          signal: options.signal,
          question: query,
        }),
      ),
  );
  const output = enriched.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
  if (process.env.NODE_ENV !== "test" && output.length > 0) {
    generalSearchCache.set(cacheKey, output);
  }
  return output;
}

function tieredQueries(plan: SearchPlan, question: string, language: Language) {
  const expanded = expandedQueries(plan, question, language);
  const all =
    language === "zh-CN"
      ? expanded.filter(
          (query) =>
            containsCjk(query) ||
            /site:(?:baike\.mihoyo\.com|wiki\.biligame\.com|zhihu\.com|mp\.weixin\.qq\.com|baike\.baidu\.com)/iu.test(
              query,
            ),
        )
      : expanded;
  const entityLookup = plan.coreEntities.join(" ").trim();
  const latinAlias = plan.aliases.find((alias) => /[a-z]/iu.test(alias));
  const storyQuestLookup =
    language !== "zh-CN" &&
    plan.storyScope === "character_story_quest" &&
    latinAlias
      ? `${latinAlias} story quest plot`
      : undefined;
  const officialWiki = all.find((query) =>
    /site:(?:baike\.mihoyo\.com|wiki\.hoyolab\.com)/iu.test(query),
  );
  const primaryQuery =
    plan.intent === "story"
      ? language === "zh-CN"
        ? plan.queries.find(containsCjk) ?? question
        : plan.queries[1] ?? plan.queries[0]
      : language === "zh-CN"
        ? plan.queries.find(containsCjk) ?? question
        : plan.queries[0];
  const first = Array.from(
    new Set(
      [
        language === "zh-CN" &&
        plan.storyScope === "character_story_quest" &&
        plan.coreEntities[0]
          ? `${plan.coreEntities[0]} 传说任务`
          : undefined,
        entityLookup,
        primaryQuery,
        officialWiki,
      ].filter(Boolean) as string[],
    ),
  );
  if (storyQuestLookup) first.unshift(storyQuestLookup);
  const boundedFirst = Array.from(new Set(first)).slice(0, 3);
  const remaining = all.filter((query) => !boundedFirst.includes(query));
  const chineseCommunity =
    language === "zh-CN" && plan.coreEntities[0]
      ? [
          `site:zhihu.com ${plan.coreEntities[0]} 剧情`,
          `site:mp.weixin.qq.com ${plan.coreEntities[0]} 原神 剧情`,
          `site:baike.baidu.com ${plan.coreEntities[0]} 原神`,
        ]
      : [];
  const relationshipCommunity =
    language === "zh-CN" &&
    plan.intent === "relationship" &&
    plan.coreEntities.length >= 2
      ? [
          `${plan.coreEntities[0]} ${plan.coreEntities[1]} PV 对话`,
          `${plan.coreEntities[0]} ${plan.coreEntities[1]} 剧情解析`,
          `${plan.coreEntities[0]} ${plan.coreEntities[1]} 主线 对话`,
          `${plan.coreEntities[0]} ${plan.coreEntities[1]} 剧情 实录`,
          `${plan.coreEntities[0]} ${plan.coreEntities[1]} 官方文本`,
          `site:bilibili.com ${plan.coreEntities[0]} ${plan.coreEntities[1]} 对话`,
          `site:zhihu.com ${plan.coreEntities[0]} ${plan.coreEntities[1]} 剧情`,
          `site:gamersky.com ${plan.coreEntities[0]} ${plan.coreEntities[1]} 剧情`,
        ]
      : [];
  const relationshipSpecific = relationshipSpecificQueries(plan);
  const second =
    plan.intent === "story" || plan.intent === "identity"
      ? [
          ...remaining.filter((query) =>
            /剧情文本|任务对白|角色故事|传说任务|提瓦特之外|星海|星球|世界边界|outside\s+teyvat|not\s+from\s+teyvat|different\s+planet|alien\s+origin|story quest|transcript|quest plot|quest text/iu.test(
              query,
            ),
          ),
          ...remaining,
          ...chineseCommunity,
        ].filter((query, index, values) => values.indexOf(query) === index)
      : [
          ...relationshipSpecific,
          ...relationshipCommunity,
          ...remaining,
          ...chineseCommunity,
        ].filter((query, index, values) => values.indexOf(query) === index);
  return {
    first: boundedFirst,
    second: second.slice(0, plan.intent === "relationship" ? 20 : 16),
    entityLookup,
  };
}

export async function searchWebEvidence(
  question: string,
  language: Language,
  options: { emitTrace?: TraceEmitter; plan?: Partial<SearchPlan> } = {},
): Promise<Citation[]> {
  const normalizedPlan = normalizeSearchPlan(options.plan, question);
  const plan =
    normalizedPlan.intent === "relationship"
      ? { ...normalizedPlan, storyScope: undefined }
      : normalizedPlan;
  await emitTrace(options.emitTrace, {
    stage: "search",
    status: "running",
    message: "去网上找找资料",
    detail: `intent=${plan.intent}; storyScope=${plan.storyScope ?? "none"}; entities=${plan.coreEntities.join(", ")}; question=${question}`,
  });
  const tiers = tieredQueries(plan, question, language);
  const planEntities = [...plan.coreEntities, ...plan.aliases];
  const runQueries = async (queries: string[]) =>
    Promise.allSettled(
      queries.map(async (query) => {
      await emitTrace(options.emitTrace, {
        stage: "search",
        status: "running",
        message: "正在查看网页和 Wiki",
        detail: query,
      });
      const siteRestricted = /^site:/iu.test(query);
      const queryRetainsEntity =
        !tiers.entityLookup ||
        query === tiers.entityLookup ||
        planEntities.some((entity) => includesEntity(query, entity));
      const wikiEligible =
        !siteRestricted &&
        queryRetainsEntity &&
        (query === tiers.entityLookup ||
          plan.intent === "identity" ||
          plan.intent === "current_status" ||
          plan.intent === "relationship" ||
          plan.intent === "story" ||
          plan.intent === "general");
      const [wikiResults, webResults] = await Promise.allSettled([
        !wikiEligible
          ? Promise.resolve([] as Citation[])
          : searchProviders(query, language, plan),
        searchGeneralWeb(query, { enrich: false }),
      ]);
      return [
        ...(wikiResults.status === "fulfilled" ? wikiResults.value : []),
        ...(webResults.status === "fulfilled" ? webResults.value : []),
      ];
      }),
    );
  const collectCandidates = (
    queryResults: Awaited<ReturnType<typeof runQueries>>,
  ) =>
    queryResults.flatMap((result) =>
      result.status === "fulfilled" ? result.value : [],
    );
  const assessCandidates = async (
    candidates: Citation[],
    useModel: boolean,
    enrich: boolean,
  ) => {
  const uniqueCandidates = new Map<string, Citation>();
  for (const citation of candidates) {
    const key = `${citation.url.toLowerCase()}::${citation.title.toLowerCase()}`;
    if (!uniqueCandidates.has(key)) uniqueCandidates.set(key, citation);
  }
  const selectedCandidates = selectCandidatesForAssessment(
    [...uniqueCandidates.values()],
    plan,
    question,
    16,
  );
  const enrichedCandidates = enrich
    ? await Promise.allSettled(
        selectedCandidates.map((citation) =>
          enrichWebCitation(citation, { question }),
        ),
      )
    : selectedCandidates.map(
        (citation) =>
          ({ status: "fulfilled", value: citation }) as PromiseFulfilledResult<Citation>,
      );
  return assessSources(
    enrichedCandidates.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : [],
    ),
    { question, plan, useModel },
  );
  };
  const fastChineseStoryQuestCandidates =
    language === "zh-CN"
      ? await searchChineseStoryQuestWikiFast(plan, question)
      : [];
  if (fastChineseStoryQuestCandidates.length > 0) {
    const fastAssessed = await assessCandidates(
      fastChineseStoryQuestCandidates,
      false,
      false,
    );
    const fastRanked = dedupeAndRank(fastAssessed, plan, question)
      .filter(isChineseAnswerEvidence)
      .filter((citation) => isCharacterStoryQuestEvidence(citation, plan))
      .slice(0, 8);
    if (fastRanked.length > 0) {
      await emitTrace(options.emitTrace, {
        stage: "search",
        status: "complete",
        message: `找到 ${fastRanked.length} 条可核验来源`,
        detail: fastRanked
          .slice(0, 4)
          .map((item) => item.title)
          .join(" · "),
      });
      return fastRanked;
    }
  }
  const firstResults = await runQueries(tiers.first);
  const firstCandidates = collectCandidates(firstResults);
  const firstAssessed = await assessCandidates(firstCandidates, false, false);
  const firstRanked = dedupeAndRank(firstAssessed, plan, question);
  const localizedTermsFromChineseResults =
    language === "zh-CN" && plan.storyScope === "character_story_quest"
      ? Array.from(
          new Set(
            firstCandidates
              .map((citation) =>
                citation.title
                  .replace(/^[「『《【]\s*/u, "")
                  .replace(/\s*[」』》】]$/u, "")
                  .trim(),
              )
              .filter(
                (title) =>
                  containsCjk(title) &&
                  /(?:之章|篇章|章节|章)$/u.test(title) &&
                  title.length <= 30,
              ),
          ),
        ).slice(0, 3)
      : [];
  const firstTierSufficient =
    language === "zh-CN"
      ? plan.intent === "relationship"
        ? false
        : plan.storyScope === "character_story_quest"
        ? firstRanked
            .filter(isChineseAnswerEvidence)
            .some((citation) =>
              isCharacterStoryQuestEvidence(citation, plan),
            )
        : plan.intent !== "identity" &&
          firstRanked.filter(isChineseAnswerEvidence).length >= 2
      : plan.storyScope === "character_story_quest" &&
        firstRanked.filter((citation) =>
          isCharacterStoryQuestEvidence(citation, plan),
        ).length >= 2;
  const englishClues =
    !firstTierSufficient &&
    language === "zh-CN" &&
    localizedTermsFromChineseResults.length === 0
      ? await discoverEnglishClues(plan, language)
      : [];
  const localizedTermsFromEnglish =
    englishClues.length > 0
      ? await localizedChineseTermsFromEnglishClues(englishClues)
      : [];
  const localizedTerms = Array.from(
    new Set([
      ...localizedTermsFromChineseResults,
      ...localizedTermsFromEnglish,
    ]),
  ).slice(0, 4);
  const clueQueries = chineseQueriesFromEnglishClues(
    plan,
    englishClues,
    localizedTerms,
  );
  const directChineseWikiCandidates =
    !firstTierSufficient && language === "zh-CN"
      ? await probeLocalizedChineseWikiPages(plan, localizedTerms, question)
      : [];
  let secondResults: Awaited<ReturnType<typeof runQueries>> = [];
  if (
    !firstTierSufficient &&
    directChineseWikiCandidates.length === 0 &&
    (tiers.second.length || clueQueries.length)
  ) {
    const secondQueryPool = Array.from(
      new Set(
        plan.intent === "relationship"
          ? [...tiers.second, ...clueQueries]
          : [...clueQueries, ...tiers.second],
      ),
    ).slice(0, 16);
    if (plan.intent === "relationship") {
      const prioritySet = new Set(relationshipSpecificQueries(plan));
      const priorityQueries = secondQueryPool.filter((query) =>
        prioritySet.has(query),
      );
      const supplementalQueries = secondQueryPool.filter(
        (query) => !prioritySet.has(query),
      );
      if (priorityQueries.length > 0) {
        secondResults.push(...(await runQueries(priorityQueries)));
      }
      if (supplementalQueries.length > 0) {
        secondResults.push(...(await runQueries(supplementalQueries)));
      }
    } else {
      secondResults = await runQueries(secondQueryPool);
    }
  }
  const candidates = [
    ...firstCandidates,
    ...collectCandidates(secondResults),
    ...directChineseWikiCandidates,
  ];
  const assessed = await assessCandidates(candidates, true, true);
  const ranked = dedupeAndRank(assessed, plan, question)
    .filter((citation) =>
      language === "zh-CN" ? isChineseAnswerEvidence(citation) : true,
    )
    .slice(0, 8);
  await emitTrace(options.emitTrace, {
    stage: "search",
    status: ranked.length ? "complete" : "skipped",
    message: ranked.length
      ? `找到 ${ranked.length} 条可核验来源`
      : "没有找到可核验来源",
    detail: ranked
      .slice(0, 4)
      .map((item) => item.title)
      .join(" · "),
  });
  return ranked;
}

export async function searchWhitelistedWiki(
  question: string,
  language: Language,
): Promise<Citation[]> {
  return searchMediaWikiProvider(
    EN_FANDOM_PROVIDER,
    question,
    language,
    "external",
  );
}

export function isWhitelistedUrl(url: string) {
  try {
    const hostname = new URL(url).hostname;
    return MEDIAWIKI_PROVIDERS.some(
      (provider) => new URL(provider.apiUrl).hostname === hostname,
    );
  } catch {
    return url.startsWith("/");
  }
}
