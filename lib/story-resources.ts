import { curatedStoryResources } from "@/data/story-resources";
import type {
  Citation,
  Language,
  ReadingResource,
  ReadingResourceAuthority,
  ReadingResourceKind,
} from "@/lib/domain";
import {
  entityRelevanceScore,
  normalizeSearchPlan,
  searchGeneralWeb,
  type SearchPlan,
} from "@/lib/external-search";
import { assessSourceRule } from "@/lib/source-governance";

function normalizedText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ");
}

function curatedMatches(question: string, language: Language) {
  const normalized = normalizedText(question);
  return curatedStoryResources.filter(
    (resource) =>
      (resource.language === language || resource.language === "multi") &&
      resource.aliases.some((alias) =>
        normalized.includes(normalizedText(alias)),
      ),
  );
}

function resourceMeta(citation: Citation): {
  platform: string;
  kind: ReadingResourceKind;
  authority: ReadingResourceAuthority;
} | null {
  try {
    const hostname = new URL(citation.url).hostname
      .replace(/^www\./, "")
      .toLowerCase();
    const assessment =
      citation.assessment ??
      assessSourceRule({
        url: citation.url,
        title: citation.title,
        excerpt: citation.excerpt,
      });
    const officialVideo =
      assessment.publisherKind === "genshin_official" &&
      (assessment.contentKind === "character_profile" ||
        assessment.contentKind === "announcement");
    if (assessment.platformKind === "official_site") {
      return {
        platform: "原神官方",
        kind: "official_text",
        authority: "official",
      };
    }
    if (
      assessment.platformKind === "official_operated_wiki" ||
      assessment.authority === "curated_reference"
    ) {
      return {
        platform: citation.sourceName,
        kind: "story_guide",
        authority: "reference",
      };
    }
    if (hostname === "youtube.com" || hostname === "youtu.be") {
      return {
        platform: "YouTube",
        kind: officialVideo ? "official_video" : "analysis_video",
        authority: officialVideo ? "official" : "community",
      };
    }
    if (hostname === "bilibili.com" || hostname.endsWith(".bilibili.com")) {
      return {
        platform: officialVideo ? "Bilibili · 原神官方" : "Bilibili",
        kind: officialVideo ? "official_video" : "analysis_video",
        authority: officialVideo ? "official" : "community",
      };
    }
    if (hostname === "zhihu.com" || hostname.endsWith(".zhihu.com")) {
      return {
        platform: "知乎",
        kind: "discussion",
        authority: "community",
      };
    }
    if (
      hostname === "miyoushe.com" ||
      hostname.endsWith(".miyoushe.com") ||
      hostname === "hoyolab.com" ||
      hostname.endsWith(".hoyolab.com")
    ) {
      return {
        platform: hostname.includes("miyoushe") ? "米游社" : "HoYoLAB",
        kind: officialVideo ? "official_video" : "story_guide",
        authority: officialVideo ? "official" : "community",
      };
    }
  } catch {
    return null;
  }
  return null;
}

function stableReadingResourceId(url: string) {
  const normalized = url.trim().toLowerCase();
  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) >>> 0;
  }
  return `reading-${hash.toString(36)}`;
}

function fromCitation(
  citation: Citation,
  language: Language,
): ReadingResource | null {
  const meta = resourceMeta(citation);
  if (!meta) return null;
  return {
    id: stableReadingResourceId(citation.url),
    title: citation.title,
    url: citation.url,
    platform: meta.platform,
    kind: meta.kind,
    authority: meta.authority,
    spoilerLevel: meta.kind === "official_video" ? 1 : 3,
    reason:
      meta.authority === "official"
        ? language === "zh-CN"
          ? "官方影像，可直接查看角色公开信息。"
          : "Official media containing publicly released character information."
        : language === "zh-CN"
          ? "社区整理或解析，建议选择性查看。"
          : "Community guide or analysis; view selectively.",
    language,
  };
}

export function readingQueries(
  question: string,
  language: Language,
  searchPlan?: Partial<SearchPlan>,
) {
  const plan = normalizeSearchPlan(searchPlan, question);
  const entity = plan.coreEntities[0] || question;
  const characterLike =
    plan.intent === "identity" ||
    plan.intent === "current_status" ||
    plan.intent === "official_media";
  if (language === "zh-CN") {
    return characterLike
      ? [
          `site:miyoushe.com/ys/article ${entity} 角色PV 角色演示 原神官方`,
          `site:bilibili.com/video ${entity} 角色PV 角色演示 原神官方`,
          `site:bilibili.com/video ${entity} 角色预告 原神官方`,
        ]
      : [
          `site:miyoushe.com ${entity} 剧情 梳理`,
          `site:bilibili.com/video ${entity} 剧情 解析`,
          `site:zhihu.com ${entity} 剧情 梳理`,
        ];
  }
  return characterLike
    ? [
        `site:hoyolab.com ${entity} character teaser demo`,
        `site:youtube.com ${entity} character teaser demo Genshin Impact`,
      ]
    : [
        `site:hoyolab.com ${entity} story guide`,
        `site:youtube.com ${entity} lore explained Genshin`,
      ];
}

export async function recommendStoryResources(
  question: string,
  language: Language,
  options: {
    liveSearch?: boolean;
    searchPlan?: Partial<SearchPlan>;
    citations?: Citation[];
    minimumBeforeLiveSearch?: number;
    signal?: AbortSignal;
  } = {},
) {
  const curated = curatedMatches(question, language);
  const searchPlan = normalizeSearchPlan(options.searchPlan, question);
  const reused = (options.citations ?? [])
    .filter(
      (citation) =>
        !searchPlan.coreEntities.length ||
        entityRelevanceScore(citation, searchPlan) > 0,
    )
    .map((citation) => fromCitation(citation, language))
    .filter((resource): resource is ReadingResource => Boolean(resource));
  const minimumBeforeLiveSearch = options.minimumBeforeLiveSearch ?? 2;
  let live: ReadingResource[] = [];
  if (
    options.liveSearch &&
    curated.length + reused.length < minimumBeforeLiveSearch
  ) {
    const results = await Promise.allSettled(
      readingQueries(question, language, searchPlan).map((query) =>
        searchGeneralWeb(query, { signal: options.signal }),
      ),
    );
    live = results
      .flatMap((result) =>
        result.status === "fulfilled" ? result.value : [],
      )
      .filter(
        (citation) =>
          !searchPlan.coreEntities.length ||
          entityRelevanceScore(citation, searchPlan) > 0,
      )
      .map((citation) => fromCitation(citation, language))
      .filter((resource): resource is ReadingResource => Boolean(resource));
  }

  const deduped = new Map<string, ReadingResource>();
  for (const resource of [...curated, ...reused, ...live]) {
    const key = resource.url.toLowerCase();
    if (!deduped.has(key)) deduped.set(key, resource);
  }
  const authorityRank: Record<ReadingResourceAuthority, number> = {
    official: 3,
    reference: 2,
    community: 1,
  };
  return [...deduped.values()]
    .sort(
      (a, b) =>
        authorityRank[b.authority] - authorityRank[a.authority] ||
        a.spoilerLevel - b.spoilerLevel,
    )
    .slice(0, 6);
}
