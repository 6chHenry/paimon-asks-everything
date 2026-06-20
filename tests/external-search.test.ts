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

  it("falls through to parsed wiki page text when extracts are empty even if snippets exist", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.searchParams.get("action") === "parse") {
        return new Response(
          JSON.stringify({
            parse: {
              pageid: 3001,
              title: "Skirk",
              text: {
                "*": "<p>Skirk is a powerful warrior from beyond Teyvat. Her origin is tied to the stars and the Abyss.</p>",
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.searchParams.get("prop") === "extracts") {
        return new Response(
          JSON.stringify({
            query: { pages: { "3001": { pageid: 3001, extract: "" } } },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          query: {
            search: [
              {
                title: "Skirk",
                snippet: "search snippet only",
                pageid: 3001,
              },
            ],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const results = await searchWhitelistedWiki("Skirk origin", "en");

    expect(results[0]?.excerpt).toContain("beyond Teyvat");
    expect(results[0]?.excerpt).not.toContain("search snippet only");
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
    expect(
      classifyWebSource("https://baike.mihoyo.com/ys/obc/content/1/detail"),
    ).toMatchObject({
      sourceKind: "trusted_wiki",
      credibility: "trusted_wiki",
    });
    expect(
      classifyWebSource("https://wiki.hoyolab.com/pc/genshin/entry/1"),
    ).toMatchObject({
      sourceKind: "trusted_wiki",
      credibility: "trusted_wiki",
    });
    expect(
      classifyWebSource("https://www.miyoushe.com/ys/article/1"),
    ).toMatchObject({
      sourceKind: "community",
      credibility: "community",
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

  it("rejects a model search plan whose selected subject is absent from the user question", () => {
    const plan = normalizeSearchPlan(
      {
        coreEntities: ["桑多涅", "阿兰"],
        aliases: ["Sandrone", "Alain Guillotin"],
        intent: "relationship",
        queries: ["桑多涅 阿兰 关系"],
      },
      "雷电将军和雷电影的关系",
    );

    expect(plan.coreEntities).toEqual([]);
    expect(plan.aliases).toEqual([]);
    expect(plan.queries).toEqual(["雷电将军和雷电影的关系"]);
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
      if (query === "法尔伽" || query === "Varka") {
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

    expect(searchedQueries).toContain("法尔伽");
    expect(searchedQueries).toContain("Varka");
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

  it("keeps relevant long-tail community video hits when wiki search is empty", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.hostname === "html.duckduckgo.com") {
        return new Response(
          `<a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.bilibili.com%2Fvideo%2FBV1escoffier">爱可菲是谁？爱可菲传说任务剧情解析</a>
           <div class="result__snippet">爱可菲是原神中的角色。资料围绕她的传说任务展开，讲述她的身份背景、相关人物关系，以及传说任务中围绕料理、责任和个人选择展开的剧情。</div>`,
          { status: 200, headers: { "Content-Type": "text/html" } },
        );
      }
      if (url.searchParams.get("prop") === "extracts") {
        return new Response(JSON.stringify({ query: { pages: {} } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ query: { search: [] } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const results = await searchWebEvidence(
      "爱可菲是谁，她的传说任务讲了什么",
      "zh-CN",
      {
        plan: {
          coreEntities: ["爱可菲"],
          aliases: ["Escoffier"],
          intent: "story",
          queries: ["爱可菲 原神 传说任务"],
        },
      },
    );

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.title).toContain("爱可菲");
    expect(results[0]?.sourceKind).toBe("community");
    expect(results[0]?.excerpt).toContain("身份背景");
  });

  it("opens general web results and promotes page body passages over search snippets", async () => {
    const fetchedUrls: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      fetchedUrls.push(url.toString());
      if (url.hostname === "html.duckduckgo.com") {
        return new Response(
          `<a class="result__a" href="https://example.com/skirk-origin">丝柯克是外星人吗？</a>
           <div class="result__snippet">这里只是搜索摘要，没有足够证据。</div>`,
          { status: 200, headers: { "Content-Type": "text/html" } },
        );
      }
      if (url.hostname === "example.com") {
        return new Response(
          `<html><head><title>丝柯克来源考据</title></head>
           <body><main><p>丝柯克是来自提瓦特之外的强大战士，这一点在剧情资料中已有明确说明。她的身份与星海、深渊和苏尔特洛奇相关。</p></main></body></html>`,
          { status: 200, headers: { "Content-Type": "text/html" } },
        );
      }
      if (url.searchParams.get("prop") === "extracts") {
        return new Response(JSON.stringify({ query: { pages: {} } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ query: { search: [] } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const results = await searchWebEvidence("丝柯克是外星人吗", "zh-CN", {
      plan: {
        coreEntities: ["丝柯克"],
        aliases: ["Skirk"],
        intent: "identity",
        queries: ["丝柯克 外星人", "丝柯克 提瓦特之外"],
      },
    });

    expect(fetchedUrls.some((url) => url === "https://example.com/skirk-origin")).toBe(
      true,
    );
    expect(results[0]?.excerpt).toContain("提瓦特之外");
    expect(results[0]?.excerpt).not.toContain("这里只是搜索摘要");
  });

  it("expands identity claim questions into claim-bearing web searches", async () => {
    const searchedQueries: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.hostname === "html.duckduckgo.com") {
        const query = url.searchParams.get("q") ?? "";
        searchedQueries.push(query);
        if (query.includes("提瓦特之外")) {
          return new Response(
            `<a class="result__a" href="https://example.com/skirk-beyond-teyvat">丝柯克来自提瓦特之外</a>
             <div class="result__snippet">丝柯克的身份与提瓦特之外、星海和深渊有关。</div>`,
            { status: 200, headers: { "Content-Type": "text/html" } },
          );
        }
        return new Response("", { status: 200 });
      }
      if (url.hostname === "example.com") {
        return new Response(
          `<main><p>丝柯克来自提瓦特之外，并非普通的提瓦特本土角色；资料将她与星海和深渊联系起来。</p></main>`,
          { status: 200, headers: { "Content-Type": "text/html" } },
        );
      }
      if (url.searchParams.get("prop") === "extracts") {
        return new Response(JSON.stringify({ query: { pages: {} } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ query: { search: [] } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const results = await searchWebEvidence("丝柯克是外星人吗", "zh-CN", {
      plan: {
        coreEntities: ["丝柯克"],
        aliases: ["Skirk"],
        intent: "identity",
        queries: ["丝柯克是外星人吗"],
      },
    });

    expect(searchedQueries.some((query) => query.includes("提瓦特之外"))).toBe(
      true,
    );
    expect(results[0]?.excerpt).toContain("提瓦特之外");
  });

  it("matches simplified Chinese questions to traditional Chinese wiki titles", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.hostname === "html.duckduckgo.com") {
        return new Response("", { status: 200 });
      }
      if (url.searchParams.get("prop") === "extracts") {
        return new Response(
          JSON.stringify({
            query: {
              pages: {
                "9036": {
                  pageid: 9036,
                  extract: "愛可菲是原神中的角色，相关资料介绍她的身份和传说任务。",
                },
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          query: {
            search: [
              {
                title: "愛可菲",
                snippet: "",
                pageid: 9036,
              },
            ],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const results = await searchWebEvidence(
      "爱可菲是谁，她的传说任务讲了什么",
      "zh-CN",
      {
        plan: {
          coreEntities: ["爱可菲"],
          aliases: ["Escoffier"],
          intent: "story",
          queries: ["爱可菲 原神 角色介绍"],
        },
      },
    );

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.title).toBe("愛可菲");
    expect(results[0]?.sourceKind).toBe("trusted_wiki");
    expect(results[0]?.excerpt).toContain("传说任务");
  });

  it("expands story questions toward neutral story text instead of gameplay guides", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.hostname === "html.duckduckgo.com") {
        const query = url.searchParams.get("q") ?? "";
        if (query.includes("剧情文本")) {
          return new Response(
            `<a class="result__a" href="https://baike.mihoyo.com/ys/obc/content/999/detail">爱可菲传说任务剧情文本</a>
             <div class="result__snippet">爱可菲的传说任务围绕德波大饭店、灰河与料理对决展开，整理任务对白与剧情事件。</div>`,
            { status: 200, headers: { "Content-Type": "text/html" } },
          );
        }
        return new Response("", { status: 200 });
      }
      if (url.searchParams.get("prop") === "extracts") {
        return new Response(
          JSON.stringify({
            query: {
              pages: {
                "9036": {
                  pageid: 9036,
                  extract: "愛可菲是原神中的角色，来自枫丹，是料理名厨。",
                },
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          query: {
            search: [
              {
                title: "愛可菲",
                snippet: "",
                pageid: 9036,
              },
            ],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const results = await searchWebEvidence(
      "爱可菲是谁，她的传说任务讲了什么",
      "zh-CN",
      {
        plan: {
          coreEntities: ["爱可菲"],
          aliases: [],
          intent: "story",
          queries: ["爱可菲 原神 角色介绍"],
        },
      },
    );
    const webQueries = fetchMock.mock.calls
      .map((call) => new URL(String(call[0])))
      .filter((url) => url.hostname === "html.duckduckgo.com")
      .map((url) => url.searchParams.get("q"));

    expect(webQueries).toContain("爱可菲 传说任务 剧情文本");
    expect(webQueries.some((query) => query?.includes("图文攻略"))).toBe(false);
    expect(results[0]?.title).toContain("传说任务剧情文本");
    expect(results[0]?.sourceKind).toBe("trusted_wiki");
    expect(results[0]?.assessment?.platformKind).toBe(
      "official_operated_wiki",
    );
    expect(results[0]?.excerpt).toContain("料理对决");
  });

  it("blocks Yahoo gameplay-guide fallbacks for story questions", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.hostname === "html.duckduckgo.com") {
        return new Response("", { status: 200 });
      }
      if (url.hostname === "search.yahoo.com") {
        return new Response(
          `<ol><li class="first"><div class="dd algo algo-sr">
            <a href="https://r.search.yahoo.com/_ylt=test/RV=2/RE=1/RO=10/RU=https%3a%2f%2fwww.gamersky.com%2fhandbook%2f202505%2f1923179.shtml/RK=2/RS=test">
              <h3 class="title">&#12298;&#21407;&#31070;&#12299;&#29233;&#21487;&#33778;&#20256;&#35828;&#20219;&#21153;&#29645;&#19978;&#33267;&#29645;&#22270;&#25991;&#25915;&#30053;</h3>
            </a>
            <p>解锁任务后，与娜维娅对话开启；之后前往灰河触发剧情，返回德波大饭店，并进入料理对决。</p>
          </div></li></ol>`,
          { status: 200, headers: { "Content-Type": "text/html" } },
        );
      }
      if (url.searchParams.get("prop") === "extracts") {
        return new Response(JSON.stringify({ query: { pages: {} } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ query: { search: [] } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const results = await searchWebEvidence(
      "爱可菲是谁，她的传说任务讲了什么",
      "zh-CN",
      {
        plan: {
          coreEntities: ["爱可菲"],
          aliases: [],
          intent: "story",
          queries: ["爱可菲 传说任务 剧情"],
        },
      },
    );

    expect(
      results.some((result) =>
        result.url.includes("gamersky.com/handbook/202505/1923179.shtml"),
      ),
    ).toBe(false);
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
