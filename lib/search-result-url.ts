const SEARCH_ENGINE_BASE = "https://duckduckgo.com";

function safeDecodeRedirectValue(value: string) {
  let decoded = value;
  for (let pass = 0; pass < 2; pass += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) return decoded;
      decoded = next;
    } catch {
      return undefined;
    }
  }
  return decoded;
}

function parseResultUrl(value: string) {
  try {
    return new URL(value, SEARCH_ENGINE_BASE);
  } catch {
    return undefined;
  }
}

function isSearchEnginePage(url: URL) {
  const hostname = url.hostname.replace(/^www\./u, "").toLowerCase();
  const pathname = url.pathname.toLowerCase();

  if (hostname === "duckduckgo.com" || hostname.endsWith(".duckduckgo.com")) {
    return true;
  }
  if (
    (hostname === "yahoo.com" &&
      (pathname === "/" || /^\/(?:search|images|video)(?:\/|$)/u.test(pathname))) ||
    hostname === "search.yahoo.com" ||
    hostname === "images.search.yahoo.com" ||
    hostname === "video.search.yahoo.com" ||
    hostname === "r.search.yahoo.com"
  ) {
    return true;
  }
  if (
    /(?:^|\.)google\.[a-z.]+$/iu.test(hostname) &&
    (pathname === "/" || /^\/(?:search|url)(?:\/|$)/u.test(pathname))
  ) {
    return true;
  }
  if (
    (hostname === "bing.com" || hostname.endsWith(".bing.com")) &&
    (pathname === "/" || /^\/(?:search|ck\/a)(?:\/|$)/u.test(pathname))
  ) {
    return true;
  }
  if (
    (hostname === "sogou.com" || hostname.endsWith(".sogou.com")) &&
    (pathname === "/" || /^\/(?:web|link)(?:\/|$)/u.test(pathname))
  ) {
    return true;
  }
  return false;
}

export function normalizeSearchResultUrl(rawUrl: string): string | undefined {
  if (!rawUrl.trim()) return undefined;
  const parsed = parseResultUrl(rawUrl.trim());
  if (!parsed) return undefined;

  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== "http:" && protocol !== "https:") return undefined;

  const hostname = parsed.hostname.replace(/^www\./u, "").toLowerCase();
  if (hostname === "r.search.yahoo.com") {
    const match = parsed.pathname.match(/\/RU=([^/]+)(?:\/|$)/u);
    if (!match?.[1]) return undefined;
    const target = safeDecodeRedirectValue(match[1]);
    return target ? normalizeSearchResultUrl(target) : undefined;
  }

  if (hostname === "duckduckgo.com" || hostname.endsWith(".duckduckgo.com")) {
    const target = parsed.searchParams.get("uddg");
    if (!target) return undefined;
    const decoded = safeDecodeRedirectValue(target);
    return decoded ? normalizeSearchResultUrl(decoded) : undefined;
  }

  if (isSearchEnginePage(parsed)) return undefined;
  return parsed.toString();
}

export function isUnresolvedSearchResultUrl(rawUrl: string) {
  return normalizeSearchResultUrl(rawUrl) === undefined;
}
