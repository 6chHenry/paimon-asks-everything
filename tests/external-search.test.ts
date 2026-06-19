import { afterEach, describe, expect, it, vi } from "vitest";
import {
  classifyWebSource,
  normalizeSearchPlan,
  searchWebEvidence,
  searchWhitelistedWiki,
} from "@/lib/external-search";

describe("whitelisted external search", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("hydrates search results with page extracts instead of relying on snippets only", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            query: {
              search: [
                {
                  title: "Liben",
                  snippet: "snippet-only merchant text",
                  pageid: 1001,
                },
              ],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            query: {
              pages: {
                "1001": {
                  pageid: 1001,
                  title: "Liben",
                  extract:
                    "Liben is a recurring event NPC who travels across regions and trades items with the Traveler.",
                },
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const results = await searchWhitelistedWiki("Who is Liben?", "en");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(results[0]?.excerpt).toContain("recurring event NPC");
    expect(results[0]?.excerpt).not.toContain("snippet-only");
    expect(results[0]?.factStatus).toBe("trusted_secondary");
  });

  it("classifies source credibility without calling trusted wikis official", () => {
    expect(
      classifyWebSource("https://www.hoyoverse.com/en-us/news/101566"),
    ).toMatchObject({
      sourceKind: "official",
      credibility: "official",
    });
    expect(
      classifyWebSource("https://genshin-impact.fandom.com/zh/wiki/原神_Wiki"),
    ).toMatchObject({
      sourceKind: "trusted_wiki",
      credibility: "trusted_wiki",
    });
    expect(
      classifyWebSource("https://wiki.biligame.com/ys/首页"),
    ).toMatchObject({
      sourceKind: "trusted_wiki",
      credibility: "trusted_wiki",
    });
    expect(classifyWebSource("https://tieba.baidu.com/f?kw=原神")).toMatchObject({
      sourceKind: "community",
      credibility: "community",
    });
  });

  it("drops model-planned queries that drift away from the core entity", () => {
    const plan = normalizeSearchPlan(
      {
        coreEntities: ["法尔伽"],
        aliases: ["Varka"],
        intent: "identity",
        queries: ["法尔伽 原神 身份", "巴尔是谁", "Varka current status"],
      },
      "法尔伽是谁",
    );

    expect(plan.queries).toEqual([
      "法尔伽 原神 身份",
      "Varka current status",
    ]);
  });

  it("searches Chinese and English wiki providers and ranks trusted evidence", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.searchParams.get("prop") === "extracts") {
        return new Response(JSON.stringify({ query: { pages: {} } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.hostname === "genshin-impact.fandom.com") {
        const isZh = url.pathname.startsWith("/zh/");
        return new Response(
          JSON.stringify({
            query: {
              search: [
                {
                  title: isZh ? "桑多涅" : "Sandrone",
                  snippet: isZh ? "中文片段" : "English snippet",
                  pageid: isZh ? 2002 : 1001,
                },
              ],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.hostname === "wiki.biligame.com") {
        return new Response(
          JSON.stringify({
            query: {
              search: [
                {
                  title: "桑多涅",
                  snippet: "BWiki 中文片段",
                  pageid: 3003,
                },
              ],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ query: { search: [] } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const results = await searchWebEvidence("桑多涅 阿兰", "zh-CN");
    const calledHosts = fetchMock.mock.calls.map((call) =>
      new URL(String(call[0])).hostname,
    );

    expect(calledHosts).toContain("genshin-impact.fandom.com");
    expect(
      fetchMock.mock.calls.some((call) => String(call[0]).includes("/zh/api.php")),
    ).toBe(true);
    expect(calledHosts).toContain("wiki.biligame.com");
    expect(results.length).toBeGreaterThanOrEqual(3);
    expect(results.every((result) => result.sourceKind === "trusted_wiki")).toBe(
      true,
    );
    expect(results[0]?.sourceName).toContain("Wiki");
  });

  it("keeps arbitrary identity searches locked to the model-selected entity", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.hostname === "html.duckduckgo.com") {
        return new Response("", { status: 200 });
      }
      if (url.searchParams.get("prop") === "extracts") {
        return new Response(JSON.stringify({ query: { pages: {} } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      const query = url.searchParams.get("srsearch");
      if (query === "法尔伽 原神 身份") {
        return new Response(
          JSON.stringify({
            query: {
              search: [
                {
                  title: "巴尔",
                  snippet: "与法尔伽无关的角色页面。",
                  pageid: 9000,
                },
                {
                  title: "欧洛伦",
                  snippet: "另一位角色的资料。",
                  pageid: 9001,
                },
                {
                  title: "法尔伽",
                  snippet: "法尔伽是西风骑士团相关角色。",
                  pageid: 9002,
                },
              ],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ query: { search: [] } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const results = await searchWebEvidence("法尔伽是谁", "zh-CN", {
      plan: {
        coreEntities: ["法尔伽"],
        aliases: ["Varka"],
        intent: "identity",
        queries: ["法尔伽 原神 身份", "Varka Genshin identity"],
      },
    });
    const searchedQueries = fetchMock.mock.calls.map((call) =>
      new URL(String(call[0])).searchParams.get("srsearch"),
    );

    expect(searchedQueries).toContain("法尔伽 原神 身份");
    expect(searchedQueries).not.toContain("巴尔");
    expect(searchedQueries).not.toContain("欧洛伦");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((result) => result.title === "法尔伽")).toBe(true);
    expect(results.some((result) => result.title === "巴尔")).toBe(false);
    expect(results.some((result) => result.title === "欧洛伦")).toBe(false);
  });

  it("prefers pages matching multiple relationship entities over single-entity pages", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.searchParams.get("prop") === "extracts") {
        return new Response(JSON.stringify({ query: { pages: {} } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      const query = url.searchParams.get("srsearch");
      if (query === "桑多涅 阿兰") {
        return new Response(
          JSON.stringify({
            query: {
              search: [
                {
                  title: "桑多涅",
                  snippet: "只命中桑多涅。",
                  pageid: 9101,
                },
                {
                  title: "枫丹",
                  snippet: "同时提到桑多涅与阿兰的造物关系。",
                  pageid: 9102,
                },
              ],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ query: { search: [] } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const results = await searchWebEvidence("桑多涅 阿兰", "zh-CN", {
      plan: {
        coreEntities: ["桑多涅", "阿兰"],
        aliases: [],
        intent: "relationship",
        queries: ["桑多涅 阿兰"],
      },
    });

    expect(results[0]?.title).toBe("枫丹");
    expect(results[0]?.excerpt).toContain("造物关系");
  });

  it("includes general web results but ranks them below trusted wiki evidence", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.hostname === "html.duckduckgo.com") {
        return new Response(
          `<a class="result__a" href="https://tieba.baidu.com/p/123">贴吧讨论</a>
           <a class="result__snippet">玩家讨论桑多涅和阿兰关系。</a>`,
          { status: 200, headers: { "Content-Type": "text/html" } },
        );
      }
      if (url.searchParams.get("prop") === "extracts") {
        return new Response(JSON.stringify({ query: { pages: {} } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({
          query: {
            search: [
              {
                title: "桑多涅",
                snippet: "可信 Wiki 命中桑多涅和阿兰。",
                pageid: 9201,
              },
            ],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const results = await searchWebEvidence("桑多涅 阿兰", "zh-CN");

    expect(
      fetchMock.mock.calls.some(
        (call) => new URL(String(call[0])).hostname === "html.duckduckgo.com",
      ),
    ).toBe(true);
    expect(results[0]?.sourceKind).toBe("trusted_wiki");
    expect(results.some((result) => result.sourceKind === "community")).toBe(
      true,
    );
  });

  it("expands Chinese Signora death questions to English quest evidence and parsed page text", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const query = url.searchParams.get("srsearch");
      if (url.searchParams.get("action") === "parse") {
        return new Response(
          JSON.stringify({
            parse: {
              title: "Duel Before the Throne",
              pageid: 85571,
              text: {
                "*": "<p>After a vicious battle, Signora finally lies defeated at your hands. As per the rules of a duel before the throne, the vanquished will be executed by the Raiden Shogun.</p>",
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.searchParams.get("prop") === "extracts") {
        return new Response(
          JSON.stringify({
            query: { pages: { "85571": { pageid: 85571, extract: "" } } },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (query === "女士为什么死在稻妻了") {
        return new Response(
          JSON.stringify({
            query: {
              search: [
                {
                  title: "巴爾",
                  snippet: "稻妻和死亡的弱相关命中。",
                  pageid: 8001,
                },
              ],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (query === "La Signora duel before the throne") {
        return new Response(
          JSON.stringify({
            query: {
              search: [
                {
                  title: "Duel Before the Throne",
                  snippet: "",
                  pageid: 85571,
                },
              ],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ query: { search: [] } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const results = await searchWebEvidence("女士为什么死在稻妻了", "zh-CN", {
      plan: {
        coreEntities: ["女士"],
        aliases: ["La Signora", "Signora"],
        intent: "story",
        queries: [
          "女士为什么死在稻妻了",
          "La Signora duel before the throne",
        ],
      },
    });
    const searchedQueries = fetchMock.mock.calls.map((call) =>
      new URL(String(call[0])).searchParams.get("srsearch"),
    );

    expect(searchedQueries).toContain("La Signora duel before the throne");
    expect(results[0]?.title).toBe("Duel Before the Throne");
    expect(results[0]?.excerpt).toContain("executed by the Raiden Shogun");
  });

  it("emits trace events for web search progress", async () => {
    const traceEvents: Array<{ stage: string; status: string; detail?: string }> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.hostname === "html.duckduckgo.com") {
        return new Response("", { status: 200 });
      }
      if (url.searchParams.get("prop") === "extracts") {
        return new Response(JSON.stringify({ query: { pages: {} } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({
          query: {
            search: [
              {
                title: "Duel Before the Throne",
                snippet: "Defeat Signora in a duel before the throne.",
                pageid: 85571,
              },
            ],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await searchWebEvidence("La Signora duel before the throne", "en", {
      emitTrace: (event) => {
        traceEvents.push(event);
      },
    });

    expect(traceEvents.some((event) => event.stage === "search")).toBe(true);
    expect(traceEvents.some((event) => event.status === "complete")).toBe(true);
    expect(traceEvents.some((event) => event.detail?.includes("Duel Before"))).toBe(
      true,
    );
  });
});
