import type {
  Citation,
  FactStatus,
  Language,
  SourceCredibility,
  SourceKind,
} from "@/lib/domain";
import { emitTrace, type TraceEmitter } from "@/lib/trace";
import { fetch as undiciFetch, ProxyAgent } from "undici";

interface MediaWikiProvider {
  apiUrl: string;
  pageBaseUrl: string;
  sourceName: string;
  language: Language | "multi";
}

const EXTERNAL_FETCH_TIMEOUT_MS = 12_000;

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
  let hostname = "";
  let pathname = "";
  try {
    const parsed = new URL(url);
    hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();
    pathname = parsed.pathname.toLowerCase();
  } catch {
    return {
      sourceName: "Unknown web",
      sourceKind: "unknown_web",
      credibility: "unknown_web",
      rank: credibilityRank.unknown_web,
    };
  }

  const officialHosts = [
    "hoyoverse.com",
    "genshin.hoyoverse.com",
    "act.hoyoverse.com",
    "baike.mihoyo.com",
    "ys.mihoyo.com",
    "webstatic.mihoyo.com",
  ];
  if (
    officialHosts.some(
      (host) => hostname === host || hostname.endsWith(`.${host}`),
    )
  ) {
    return {
      sourceName: hostname.includes("mihoyo") ? "HoYoWiki" : "HoYoverse",
      sourceKind: "official",
      credibility: "official",
      rank: credibilityRank.official,
    };
  }

  if (
    hostname === "genshin-impact.fandom.com" ||
    hostname === "wiki.biligame.com"
  ) {
    return {
      sourceName:
        hostname === "wiki.biligame.com"
          ? "原神WIKI_BWIKI"
          : pathname.startsWith("/zh/")
            ? "Genshin Impact Wiki 中文"
            : "Genshin Impact Wiki",
      sourceKind: "trusted_wiki",
      credibility: "trusted_wiki",
      rank: credibilityRank.trusted_wiki,
    };
  }

  const communityHosts = [
    "bilibili.com",
    "hoyolab.com",
    "miyoushe.com",
    "tieba.baidu.com",
    "zhihu.com",
    "nga.178.com",
    "bbs.nga.cn",
    "reddit.com",
    "weixin.qq.com",
    "mp.weixin.qq.com",
    "youtube.com",
    "youtu.be",
    "gamersky.com",
    "17173.com",
    "gamer.com.tw",
    "douyin.com",
  ];
  if (
    communityHosts.some(
      (host) => hostname === host || hostname.endsWith(`.${host}`),
    )
  ) {
    return {
      sourceName: hostname,
      sourceKind: "community",
      credibility: "community",
      rank: credibilityRank.community,
    };
  }

  return {
    sourceName: hostname || "Unknown web",
    sourceKind: "unknown_web",
    credibility: "unknown_web",
    rank: credibilityRank.unknown_web,
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
    if (extracts.get(item.pageid) || stripHtml(item.snippet)) continue;
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
    const classification = classifyWebSource(url);
    return {
      id: `${idPrefix}-${index + 1}`,
      title: item.title,
      url,
      sourceName: provider.sourceName,
      sourceKind: classification.sourceKind,
      credibility: classification.credibility,
      factStatus: factStatusForSource(classification.credibility),
      excerpt:
        extracts.get(item.pageid) ||
        stripHtml(item.snippet) ||
        (language === "zh-CN"
          ? `外部 Wiki 搜索命中页面“${item.title}”，需打开页面并结合原始引文核验。`
          : `External wiki search matched the page "${item.title}". Open the page and verify against its cited sources.`),
      external: true,
      crossLanguage:
        provider.language !== "multi" && provider.language !== language,
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
  const titleOrUrlMatch = plan.coreEntities.some(
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
  const storyLike =
    plan.intent === "story" ||
    /传说任务|劇情|剧情|story\s*quest|quest|walkthrough|全流程/iu.test(
      question,
    );
  if (subject && storyLike) {
    if (language === "zh-CN") {
      queries.push(
        `${subject} 传说任务 珍上至珍 剧情`,
        `${subject} 香糕塔之章 珍上至珍`,
        `${subject} 传说任务 全流程剧情`,
        `${subject} 传说任务 图文攻略`,
      );
    } else {
      queries.push(
        `${subject} story quest walkthrough`,
        `${subject} story quest plot`,
        `${subject} Best of the Best quest`,
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
    /全流程/u,
    /图文攻略/u,
    /圖文攻略/u,
    /珍上至珍/u,
    /香糕塔/u,
    /story quest/i,
    /walkthrough/i,
    /quest plot/i,
  ];
  return patterns.reduce((score, pattern) => score + (pattern.test(text) ? 25 : 0), 0);
}

function dedupeAndRank(citations: Citation[], plan: SearchPlan) {
  const deduped = new Map<string, Citation>();
  for (const citation of citations) {
    const key = `${citation.url.toLowerCase()}::${citation.title.toLowerCase()}`;
    if (!deduped.has(key)) deduped.set(key, citation);
  }
  return [...deduped.values()]
    .filter((citation) => passesEntityGate(citation, plan))
    .sort((a, b) => {
      const entityDifference =
        entityRelevanceScore(b, plan) - entityRelevanceScore(a, plan);
      const aRank = credibilityRank[a.credibility ?? "unknown_web"];
      const bRank = credibilityRank[b.credibility ?? "unknown_web"];
      const storyDifference = storyIntentScore(b, plan) - storyIntentScore(a, plan);
      const lexicalDifference =
        lexicalRelevanceScore(b, plan) - lexicalRelevanceScore(a, plan);
      if (plan.intent === "story") {
        return (
          storyDifference ||
          entityDifference ||
          lexicalDifference ||
          bRank - aRank ||
          a.title.localeCompare(b.title)
        );
      }
      return (
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
      searchMediaWikiProvider(provider, query, language, `external-${index + 1}`),
    ),
  );
  return dedupeAndRank(
    results.flatMap((result) =>
      result.status === "fulfilled" ? result.value : [],
    ),
    plan,
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
  return [
    {
      id,
      title,
      url,
      sourceName: classification.sourceName,
      sourceKind: classification.sourceKind,
      credibility: classification.credibility,
      factStatus: factStatusForSource(classification.credibility),
      excerpt:
        excerpt ||
        `General web search matched "${title}". Open the page and verify against primary sources.`,
      external: true,
      crossLanguage: false,
    },
  ];
}

async function searchDuckDuckGoWeb(query: string): Promise<Citation[]> {
  const endpoint = new URL("https://html.duckduckgo.com/html/");
  endpoint.searchParams.set("q", query);
  const response = await fetchExternal(endpoint, {
    signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS),
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

async function searchYahooWeb(query: string): Promise<Citation[]> {
  const endpoint = new URL("https://search.yahoo.com/search");
  endpoint.searchParams.set("p", query);
  const response = await fetchExternal(endpoint, {
    signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS),
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

export async function searchGeneralWeb(query: string): Promise<Citation[]> {
  const results = await Promise.allSettled([
    searchDuckDuckGoWeb(query),
    searchYahooWeb(query),
  ]);
  return results.flatMap((result) =>
    result.status === "fulfilled" ? result.value : [],
  );
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
  const queryResults = await Promise.allSettled(
    expandedQueries(plan, question, language).map(async (query) => {
      await emitTrace(options.emitTrace, {
        stage: "search",
        status: "running",
        message: "正在查看网页和 Wiki",
        detail: query,
      });
      const [wikiResults, webResults] = await Promise.allSettled([
        searchProviders(query, language, plan),
        searchGeneralWeb(query),
      ]);
      return [
        ...(wikiResults.status === "fulfilled" ? wikiResults.value : []),
        ...(webResults.status === "fulfilled" ? webResults.value : []),
      ];
    }),
  );
  const ranked = dedupeAndRank(
    queryResults.flatMap((result) =>
      result.status === "fulfilled" ? result.value : [],
    ),
    plan,
  ).slice(0, 8);
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
