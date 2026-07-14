import { describe, expect, it } from "vitest";
import {
  isUnresolvedSearchResultUrl,
  normalizeSearchResultUrl,
} from "@/lib/search-result-url";

describe("search result URL normalization", () => {
  it("decodes a valid Yahoo RU destination to an absolute target", () => {
    const result = normalizeSearchResultUrl(
      "https://r.search.yahoo.com/_ylt=test/RV=2/RE=1/RO=10/RU=https%3A%2F%2Fwww.miyoushe.com%2Fys%2Farticle%2F35324992/RK=2/RS=test",
    );

    expect(result).toBe("https://www.miyoushe.com/ys/article/35324992");
    expect(isUnresolvedSearchResultUrl(result ?? "")).toBe(false);
  });

  it.each([
    "https://example.com/story?q=a%26b",
    "https://example.com/story?q=a%3Db",
  ])("preserves reserved query encoding in Yahoo RU and DDG targets: %s", (target) => {
    const yahooRu = `https://r.search.yahoo.com/_ylt=test/RU=${encodeURIComponent(target)}/RS=test`;
    const ddg = `//duckduckgo.com/l/?uddg=${encodeURIComponent(target)}`;

    expect(normalizeSearchResultUrl(yahooRu)).toBe(target);
    expect(normalizeSearchResultUrl(ddg)).toBe(target);
  });

  it.each([
    "https://www.yahoo.com/",
    "https://search.yahoo.com/search?p=jeht",
    "https://r.search.yahoo.com/_ylt=test/RU=%E0%A4%A/RS=test",
    "//duckduckgo.com/l/?uddg=%E0%A4%A",
    "https://duckduckgo.com/?q=jeht",
    "https://www.sogou.com/link?url=unresolved",
    "javascript:alert(1)",
    "not a URL",
  ])("returns no destination for an unresolved or malformed result URL: %s", (url) => {
    expect(normalizeSearchResultUrl(url)).toBeUndefined();
    expect(isUnresolvedSearchResultUrl(url)).toBe(true);
  });

  it("decodes a valid DuckDuckGo redirect target", () => {
    expect(
      normalizeSearchResultUrl(
        "//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fstory",
      ),
    ).toBe("https://example.com/story");
  });

  it("keeps a valid content path on a search-company host", () => {
    expect(normalizeSearchResultUrl("https://news.yahoo.com/story/123")).toBe(
      "https://news.yahoo.com/story/123",
    );
  });

  it.each([
    "https://www.google.com/webhp",
    "https://www.google.co.uk/advanced_search",
    "https://www.bing.com/images/search?q=story",
    "https://cn.bing.com/videos/search?q=story",
    "https://tw.search.yahoo.com/",
    "https://news.search.yahoo.com/search?p=story",
    "https://images.search.yahoo.com/search/images?p=story",
  ])("rejects an unresolved localized search-engine page: %s", (url) => {
    expect(normalizeSearchResultUrl(url)).toBeUndefined();
    expect(isUnresolvedSearchResultUrl(url)).toBe(true);
  });
});
