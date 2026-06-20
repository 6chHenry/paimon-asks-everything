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

export interface SearchPlan {
  coreEntities: string[];
  aliases: string[];
  intent: SearchIntent;
  queries: string[];
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

function basicTerms(question: string) {
  return question
    .split(/[\s,，、/？?。.!;；:：()（）]+/u)
    .map((term) => term.trim().toLowerCase())
    .filter((term) => term.length >= 2);
}

function focusedExcerpt(text: string, question: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  const lower = normalized.toLowerCase();
  const terms = basicTerms(question);
  const index = terms
    .map((term) => lower.indexOf(term))
    .filter((item) => item >= 0)
    .sort((a, b) => a - b)[0];
  const start = Math.max(0, (index ?? 0) - 450);
  return normalized.slice(start, start + 900).trim();
}

async function fetchParsedPageExcerpt(
  provider: MediaWikiProvider,
  pageid: number,
  question: string,
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
  return focusedExcerpt(htmlToText(payload.parse?.text?.["*"] ?? ""), question);
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
): Promise<Citation[]> {
  const endpoint = new URL(provider.apiUrl);
  endpoint.searchParams.set("action", "query");
  endpoint.searchParams.set("list", "search");
  endpoint.searchParams.set("srsearch", question);
  endpoint.searchParams.set("srlimit", "3");
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

  for (const item of searchResults) {
    if (extracts.get(item.pageid)) continue;
    try {
      const parsedExcerpt = await fetchParsedPageExcerpt(
        provider,
        item.pageid,
        question,
      );
      if (parsedExcerpt) extracts.set(item.pageid, parsedExcerpt);
    } catch {
      // Search result title remains available as a degraded fallback.
    }
  }

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

function passesEntityGate(citation: Citation, plan: SearchPlan) {
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
    return titleOrUrlMatch;
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

function expandedQueries(plan: SearchPlan, question: string, language: Language) {
  const queries = [...plan.queries];
  const subject = plan.coreEntities[0] || plan.aliases[0];
  if (subject) {
    const latinAlias = plan.aliases.find((alias) => /[a-z]/iu.test(alias));
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
        );
      } else {
        queries.push(
          `${latinAlias ?? subject} outside Teyvat`,
          `${latinAlias ?? subject} alien origin`,
          `${latinAlias ?? subject} identity origin`,
        );
      }
      if (latinAlias) {
        queries.push(
          `${latinAlias} outside Teyvat`,
          `${latinAlias} alien origin`,
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
        `${subject} 传说任务 剧情文本`,
        `${subject} 角色故事 游戏内文本`,
        `${subject} 传说任务 剧情梳理`,
        `${subject} 任务对白`,
      );
    } else {
      queries.push(
        `${subject} story quest transcript`,
        `${subject} story quest plot`,
        `${subject} character story in-game text`,
      );
    }
  }
  return Array.from(new Set(queries.map((query) => cleanSearchValue(query)))).slice(
    0,
    8,
  );
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
    /transcript/i,
    /quest plot/i,
  ];
  return patterns.reduce((score, pattern) => score + (pattern.test(text) ? 25 : 0), 0);
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
    .filter((citation) => passesEntityGate(citation, plan))
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
      const lexicalDifference =
        lexicalRelevanceScore(b, plan) - lexicalRelevanceScore(a, plan);
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
      return (
        governanceDifference ||
        entityDifference ||
        bRank - aRank ||
        lexicalDifference ||
        a.title.localeCompare(b.title)
      );
    })
    .map((citation, index) => ({ ...citation, id: `external-${index + 1}` }));
}

async function searchProviders(
  query: string,
  language: Language,
  plan: SearchPlan,
): Promise<Citation[]> {
  const providers =
    language === "zh-CN"
      ? MEDIAWIKI_PROVIDERS
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
    const excerpt = pageExcerpt || citation.excerpt;
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

export async function searchGeneralWeb(
  query: string,
  options: { enrich?: boolean; signal?: AbortSignal } = {},
): Promise<Citation[]> {
  const cacheKey = `${options.enrich === false ? "raw" : "enriched"}:${query
    .trim()
    .toLowerCase()}`;
  if (process.env.NODE_ENV !== "test") {
    const cached = generalSearchCache.get(cacheKey);
    if (cached) return cached;
  }
  const results = await Promise.allSettled([
    searchDuckDuckGoWeb(query, options.signal),
    searchYahooWeb(query, options.signal),
  ]);
  const citations = results.flatMap((result) =>
    result.status === "fulfilled" ? result.value : [],
  );
  if (options.enrich === false) {
    if (process.env.NODE_ENV !== "test") {
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
  if (process.env.NODE_ENV !== "test") {
    generalSearchCache.set(cacheKey, output);
  }
  return output;
}

function tieredQueries(plan: SearchPlan, question: string, language: Language) {
  const all = expandedQueries(plan, question, language);
  const entityLookup = plan.coreEntities.join(" ").trim();
  const officialWiki = all.find((query) =>
    /site:(?:baike\.mihoyo\.com|wiki\.hoyolab\.com)/iu.test(query),
  );
  const primaryQuery =
    plan.intent === "story"
      ? plan.queries[1] ?? plan.queries[0]
      : plan.queries[0];
  const first = Array.from(
    new Set(
      [entityLookup, primaryQuery, officialWiki].filter(Boolean) as string[],
    ),
  ).slice(0, 3);
  const remaining = all.filter((query) => !first.includes(query));
  const second =
    plan.intent === "story"
      ? [
          ...remaining.filter((query) =>
            /剧情文本|任务对白|角色故事|story quest|transcript|quest plot/iu.test(
              query,
            ),
          ),
          ...remaining,
        ].filter((query, index, values) => values.indexOf(query) === index)
      : remaining;
  return { first, second: second.slice(0, 2), entityLookup };
}

export async function searchWebEvidence(
  question: string,
  language: Language,
  options: { emitTrace?: TraceEmitter; plan?: Partial<SearchPlan> } = {},
): Promise<Citation[]> {
  const plan = normalizeSearchPlan(options.plan, question);
  await emitTrace(options.emitTrace, {
    stage: "search",
    status: "running",
    message: "去网上找找资料",
    detail: question,
  });
  const tiers = tieredQueries(plan, question, language);
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
      const wikiEligible =
        !siteRestricted &&
        (!tiers.entityLookup ||
          query === tiers.entityLookup ||
          (plan.intent === "story" &&
            /剧情文本|任务对白|角色故事|story quest|transcript|quest plot|duel before the throne/iu.test(
              query,
            )));
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
  const selectedCandidates = [...uniqueCandidates.values()].slice(0, 8);
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
  const enoughEvidence = (ranked: Citation[]) => {
    const authoritative = ranked.filter(
      (citation) =>
        citation.assessment?.authority === "official" ||
        citation.assessment?.authority === "curated_reference",
    );
    if (
      plan.intent === "story" &&
      !ranked.some((citation) => storyIntentScore(citation, plan) > 0)
    ) {
      return false;
    }
    if (authoritative.some((citation) => citation.assessment?.authority === "official")) {
      return true;
    }
    return ranked.length >= 3 && authoritative.length >= 2;
  };
  const firstResults = await runQueries(tiers.first);
  let candidates = collectCandidates(firstResults);
  let assessed = await assessCandidates(candidates, false, false);
  let ranked = dedupeAndRank(assessed, plan, question).slice(0, 8);
  const firstRoundEnough = enoughEvidence(ranked);
  if (!firstRoundEnough && tiers.second.length) {
    const secondResults = await runQueries(tiers.second);
    candidates = [...candidates, ...collectCandidates(secondResults)];
    assessed = await assessCandidates(candidates, true, true);
    ranked = dedupeAndRank(assessed, plan, question).slice(0, 8);
  }
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
