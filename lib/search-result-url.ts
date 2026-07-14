const SEARCH_ENGINE_BASE = "https://duckduckgo.com";

function absoluteHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function safeDecodeRedirectValue(value: string) {
  let candidate = value;
  for (let pass = 0; pass < 2; pass += 1) {
    const absolute = absoluteHttpUrl(candidate);
    if (absolute) return absolute;
    try {
      const next = decodeURIComponent(candidate);
      if (next === candidate) return undefined;
      candidate = next;
    } catch {
      return undefined;
    }
  }
  return absoluteHttpUrl(candidate);
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
    hostname.endsWith(".search.yahoo.com")
  ) {
    return true;
  }
  if (
    /(?:^|\.)google\.[a-z.]+$/iu.test(hostname) &&
    (pathname === "/" ||
      /^\/(?:search|url|webhp|advanced_search)(?:\/|$)/u.test(pathname))
  ) {
    return true;
  }
  if (
    (hostname === "bing.com" || hostname.endsWith(".bing.com")) &&
    (pathname === "/" ||
      /^\/(?:search|ck\/a|images\/search|videos\/search)(?:\/|$)/u.test(
        pathname,
      ))
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
