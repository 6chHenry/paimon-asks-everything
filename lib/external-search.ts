import type { Citation, Language } from "@/lib/domain";

const WIKI_HOST = "genshin-impact.fandom.com";

function stripHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

export async function searchWhitelistedWiki(
  question: string,
  language: Language,
): Promise<Citation[]> {
  const endpoint = new URL(`https://${WIKI_HOST}/api.php`);
  endpoint.searchParams.set("action", "query");
  endpoint.searchParams.set("list", "search");
  endpoint.searchParams.set("srsearch", question);
  endpoint.searchParams.set("srlimit", "3");
  endpoint.searchParams.set("format", "json");
  endpoint.searchParams.set("origin", "*");

  const response = await fetch(endpoint, {
    signal: AbortSignal.timeout(5000),
    headers: { "User-Agent": "PaimonAsksEverythingDemo/0.1" },
  });
  if (!response.ok) return [];
  const payload = (await response.json()) as {
    query?: { search?: Array<{ title: string; snippet: string; pageid: number }> };
  };

  return (payload.query?.search ?? []).map((item, index) => ({
    id: `external-${index + 1}`,
    title: item.title,
    url: `https://${WIKI_HOST}/wiki/${encodeURIComponent(
      item.title.replace(/ /g, "_"),
    )}`,
    sourceName: "Genshin Impact Wiki",
    sourceKind: "wiki",
    factStatus: "community_speculation",
    excerpt:
      stripHtml(item.snippet) ||
      (language === "zh-CN"
        ? "外部 Wiki 搜索结果，需结合页面原始引文核验。"
        : "External Wiki result; verify against the page's cited source."),
    external: true,
    crossLanguage: language === "zh-CN",
  }));
}

export function isWhitelistedUrl(url: string) {
  try {
    return new URL(url).hostname === WIKI_HOST;
  } catch {
    return url.startsWith("/");
  }
}
