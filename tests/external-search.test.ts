import { afterEach, describe, expect, it, vi } from "vitest";
import {
  classifyWebSource,
  isCharacterStoryQuestEvidence,
  normalizeSearchPlan,
  selectCandidatesForAssessment,
  searchGeneralWeb,
  searchWebEvidence,
  searchWhitelistedWiki,
} from "@/lib/external-search";
import type { Citation } from "@/lib/domain";

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

  it("does not treat a prerequisite mention as Story Quest plot evidence", () => {
    expect(
      isCharacterStoryQuestEvidence(
        {
          id: "prerequisite-only",
          title: "法尔伽·劳碌之故",
          url: "https://wiki.biligame.com/ys/法尔伽·劳碌之故",
          sourceName: "原神WIKI_BWIKI",
          sourceKind: "trusted_wiki",
          credibility: "trusted_wiki",
          factStatus: "trusted_secondary",
          excerpt:
            "任务条件：完成法尔伽传说任务第一幕「致予远征之人」。随后与西蒙对话。",
          external: true,
          crossLanguage: false,
        },
        {
          coreEntities: ["法尔伽"],
          aliases: ["Varka"],
          intent: "story",
          storyScope: "character_story_quest",
          queries: ["法尔伽传说任务故事梗概"],
        },
      ),
    ).toBe(false);
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

  it("uses only Chinese Wiki providers when Chinese evidence is already sufficient", async () => {
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
    expect(
      fetchMock.mock.calls.some((call) => {
        const url = new URL(String(call[0]));
        return (
          url.hostname === "genshin-impact.fandom.com" &&
          url.pathname === "/api.php"
        );
      }),
    ).toBe(false);
    expect(calledHosts).toContain("wiki.biligame.com");
    expect(results.length).toBeGreaterThanOrEqual(2);
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
    expect(searchedQueries).toContain("Varka identity origin");
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

  it("broadens relationship searches to community analysis when official media snippets lack the relationship facts", async () => {
    const searchedQueries: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.hostname === "html.duckduckgo.com") {
        const query = url.searchParams.get("q") ?? "";
        searchedQueries.push(query);
        if (/富人 博士.*(?:PV|对话|剧情解析|剧情 实录|官方文本)/u.test(query)) {
          return new Response(
            `<a class="result__a" href="https://www.gamersky.com/news/202605/2146352.shtml">《原神》的新主线剧情竟成了戒烟宣传片？</a>
             <div class="result__snippet">剧情PV展示博士和富人的对话。博士提到他给富人换上的肺；富人掌管北国银行，也资助博士的研究。</div>
             <a class="result__a" href="https://www.bilibili.com/video/BV1DrL26REm2/">富人的肺还是博士给换的</a>
             <div class="result__snippet">博士与富人的对话，富人的肺还是博士给换的，博士甚至又想出来了个实验点子。</div>`,
            { status: 200, headers: { "Content-Type": "text/html" } },
          );
        }
        if (/baike\.mihoyo\.com/u.test(query)) {
          return new Response(
            `<a class="result__a" href="https://baike.mihoyo.com/ys/obc/content/508795/detail">剧情PV-「不向光者」</a>
             <div class="result__snippet">CV：「富人」潘塔罗涅——梁达伟 「博士」多托雷——吴磊</div>`,
            { status: 200, headers: { "Content-Type": "text/html" } },
          );
        }
        return new Response("", { status: 200, headers: { "Content-Type": "text/html" } });
      }
      if (url.hostname === "www.gamersky.com") {
        return new Response(
          `<html><body><main><p>在剧情PV中，博士多托雷与富人潘塔罗涅对话。博士说富人糟蹋了他特意换上的肺，富人则长期以北国银行的财力支持博士研究。</p></main></body></html>`,
          { status: 200, headers: { "Content-Type": "text/html" } },
        );
      }
      if (url.hostname === "www.bilibili.com") {
        return new Response(
          `<html><body><title>富人的肺还是博士给换的</title><p>博士与富人的对话，富人的肺还是博士给换的。</p></body></html>`,
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

    const results = await searchWebEvidence("富人和博士是什么关系", "zh-CN", {
      plan: {
        coreEntities: ["富人", "博士"],
        aliases: ["Pantalone", "Dottore", "潘塔罗涅", "多托雷"],
        intent: "relationship",
        storyScope: "character_story_quest",
        queries: [
          "富人 潘塔罗涅 剧情",
          "富人 传说任务",
          "富人 传说任务 中文WIKI 剧情",
          "site:zhihu.com 富人 传说任务 剧情",
          "富人 博士 关系",
        ],
      },
    });

    expect(
      searchedQueries.some((query) =>
        /富人 博士.*(?:PV|对话|剧情解析|剧情 实录|官方文本)/u.test(query),
      ),
    ).toBe(true);
    expect(searchedQueries).toEqual(
      expect.arrayContaining([
        "富人 博士 换肺",
        "富人 博士 北国银行 资助",
        "富人 博士 合作 研究",
      ]),
    );
    expect(results.some((result) => /换上的肺|资助博士/u.test(result.excerpt))).toBe(true);
    expect(results.some((result) => result.sourceKind === "community")).toBe(true);
  });

  it("reserves assessment slots for direct relationship interactions", () => {
    const plan = normalizeSearchPlan(
      {
        coreEntities: ["富人", "博士"],
        aliases: ["Pantalone", "Dottore", "潘塔罗涅", "多托雷"],
        intent: "relationship",
        queries: ["富人 博士 关系"],
      },
      "富人和博士是什么关系？",
    );
    const genericWikiResults: Citation[] = Array.from(
      { length: 18 },
      (_, index) => ({
        id: `wiki-${index}`,
        title: index === 0 ? "愚人众十一执行官" : `至冬资料索引 ${index}`,
        url: `https://genshin-impact.fandom.com/zh/wiki/reference-${index}`,
        sourceName: "Genshin Impact Wiki 中文",
        sourceKind: "trusted_wiki",
        credibility: "trusted_wiki",
        factStatus: "trusted_secondary",
        excerpt:
          "富人和博士都是愚人众执行官。本页收录执行官名单、席位和角色索引。",
        external: true,
        crossLanguage: false,
        assessment: {
          platformKind: "general_web",
          publisherKind: "verified_aggregator",
          contentKind: "neutral_reference",
          authority: "curated_reference",
          signals: ["verified-reference-wiki"],
          confidence: "medium",
        },
      }),
    );
    const directDialogue: Citation = {
      id: "dialogue",
      title: "富人与博士主线完整对话",
      url: "https://www.bilibili.com/video/BV-direct-dialogue/",
      sourceName: "bilibili",
      sourceKind: "community",
      credibility: "community",
      factStatus: "community_analysis",
      excerpt:
        "剧情实录中，博士说富人糟蹋了他特意换上的肺；富人表示北国银行长期资助博士的研究。",
      external: true,
      crossLanguage: false,
      assessment: {
        platformKind: "video_platform",
        publisherKind: "unknown",
        contentKind: "game_text_reference",
        authority: "community_analysis",
        signals: ["story-cut-reference"],
        confidence: "low",
      },
    };

    const selected = selectCandidatesForAssessment(
      [...genericWikiResults, directDialogue],
      plan,
      "富人和博士是什么关系？",
      16,
    );

    expect(selected).toHaveLength(16);
    expect(
      selected.some((citation) => citation.url.includes("BV-direct-dialogue")),
    ).toBe(true);
  });

  it("uses Sogou as a Chinese web-search fallback for direct interaction evidence", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input));
        if (url.hostname === "www.sogou.com") {
          return new Response(
            `<div class="rb">
              <h3 class="vr-title"><a href="/link?url=direct-story">富人与博士主线对话</a></h3>
              <div class="text-layout">博士曾为富人换肺，富人通过北国银行长期资助博士研究。</div>
            </div>`,
            { status: 200, headers: { "Content-Type": "text/html" } },
          );
        }
        return new Response("", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        });
      }),
    );

    const results = await searchGeneralWeb("富人 博士 换肺", {
      enrich: false,
    });

    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "富人与博士主线对话",
          excerpt: expect.stringContaining("北国银行长期资助博士研究"),
        }),
      ]),
    );
  });

  it("keeps Pantalone-Dottore search terms scoped to that relationship", async () => {
    const searchedQueries: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input));
        if (url.hostname === "html.duckduckgo.com") {
          searchedQueries.push(url.searchParams.get("q") ?? "");
          return new Response("", {
            status: 200,
            headers: { "Content-Type": "text/html" },
          });
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
      }),
    );

    await searchWebEvidence("雷电将军和雷电影是什么关系", "zh-CN", {
      plan: {
        coreEntities: ["雷电将军", "雷电影"],
        aliases: ["Raiden Shogun", "Raiden Ei"],
        intent: "relationship",
        queries: ["雷电将军 雷电影 关系"],
      },
    });

    expect(
      searchedQueries.some((query) =>
        /换肺|北国银行|合作 研究/u.test(query),
      ),
    ).toBe(false);
  });

  it("does not let a community analysis video become the only Story Quest evidence", async () => {
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

    expect(results).toEqual([]);
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

  it("searches wiki providers for identity claim expansions instead of stopping at profile pages", async () => {
    const wikiQueries: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.hostname === "html.duckduckgo.com" || url.hostname === "search.yahoo.com") {
        return new Response("", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        });
      }
      if (url.searchParams.get("prop") === "extracts") {
        const pageIds = url.searchParams.get("pageids") ?? "";
        return new Response(
          JSON.stringify({
            query: {
              pages: Object.fromEntries(
                pageIds.split("|").filter(Boolean).map((pageid) => [
                  pageid,
                  { pageid: Number(pageid), extract: "" },
                ]),
              ),
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.searchParams.get("action") === "parse") {
        const pageid = url.searchParams.get("pageid");
        return new Response(
          JSON.stringify({
            parse: {
              pageid: Number(pageid),
              title: pageid === "3002" ? "丝柯克" : "Skirk/Profile",
              text: {
                "*":
                  pageid === "3002"
                    ? "<p>丝柯克来自提瓦特之外，她的经历与星海、深渊和苏尔特洛奇有关。</p>"
                    : "<p>Skirk wanders Teyvat like a shadow and avoids contact with people.</p>",
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.searchParams.get("list") === "search") {
        const query = url.searchParams.get("srsearch") ?? "";
        wikiQueries.push(query);
        if (query.includes("提瓦特之外")) {
          return new Response(
            JSON.stringify({
              query: {
                search: [
                  {
                    title: "丝柯克",
                    snippet: "丝柯克来自提瓦特之外。",
                    pageid: 3002,
                  },
                ],
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (query === "丝柯克" || query === "Skirk") {
          return new Response(
            JSON.stringify({
              query: {
                search: [
                  {
                    title: "Skirk/Profile",
                    snippet:
                      "She wanders Teyvat like a shadow, avoiding contact with people.",
                    pageid: 3001,
                  },
                ],
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
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

    expect(wikiQueries.some((query) => query.includes("提瓦特之外"))).toBe(true);
    expect(results[0]?.title).toBe("丝柯克");
    expect(results[0]?.excerpt).toContain("提瓦特之外");
    expect(results[0]?.title).not.toBe("Skirk/Profile");
  });

  it("keeps trusted quest text pages for identity claims even when the page title is not the character name", async () => {
    const searchedQueries: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.hostname === "html.duckduckgo.com") {
        const query = url.searchParams.get("q") ?? "";
        searchedQueries.push(query);
        if (query.includes("传说任务") || query.includes("星球")) {
          return new Response(
            `<a class="result__a" href="https://wiki.biligame.com/ys/%E6%98%9F%E4%B8%8E%E5%A4%9C%E7%9A%84%E4%BD%8E%E8%AF%AD">星与夜的低语 - 原神WIKI_BWIKI</a>
             <div class="result__snippet">丝柯克传说任务剧情文本提到她来自遥远的星球。</div>`,
            { status: 200, headers: { "Content-Type": "text/html" } },
          );
        }
        return new Response("", { status: 200 });
      }
      if (url.hostname === "search.yahoo.com") {
        return new Response("", { status: 200 });
      }
      if (
        url.hostname === "wiki.biligame.com" &&
        !url.searchParams.has("action") &&
        decodeURIComponent(url.pathname).includes("星与夜的低语")
      ) {
        return new Response(
          `<main>
            <h1>星与夜的低语</h1>
            <p>任务剧情中，丝柯克回忆自己的故乡并非提瓦特，而是来自另一个遥远的星球。</p>
            <p>极恶骑打开了提瓦特的世界边界，把她送进了提瓦特。</p>
          </main>`,
          { status: 200, headers: { "Content-Type": "text/html" } },
        );
      }
      if (url.hostname === "wiki.biligame.com" && !url.searchParams.has("action")) {
        return new Response("<main><p>丝柯克是角色页面，欢迎来到原神WIKI。</p></main>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        });
      }
      if (url.searchParams.get("prop") === "extracts") {
        const pageIds = url.searchParams.get("pageids") ?? "";
        return new Response(
          JSON.stringify({
            query: {
              pages: Object.fromEntries(
                pageIds.split("|").filter(Boolean).map((pageid) => [
                  pageid,
                  {
                    pageid: Number(pageid),
                    extract: "丝柯克是角色页面，欢迎来到原神WIKI。",
                  },
                ]),
              ),
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.searchParams.get("action") === "parse") {
        return new Response(
          JSON.stringify({
            parse: {
              text: {
                "*": "<p>丝柯克是角色页面，欢迎来到原神WIKI。</p>",
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.searchParams.get("list") === "search") {
        return new Response(
          JSON.stringify({
            query: {
              search: [
                {
                  title: "丝柯克",
                  snippet: "欢迎来到原神WIKI。",
                  pageid: 3001,
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

    const results = await searchWebEvidence("丝柯克是外星人吗", "zh-CN", {
      plan: {
        coreEntities: ["丝柯克"],
        aliases: ["Skirk"],
        intent: "identity",
        queries: ["丝柯克是外星人吗"],
      },
    });

    expect(searchedQueries.some((query) => query.includes("传说任务"))).toBe(true);
    expect(results[0]).toMatchObject({
      title: "星与夜的低语 - 原神WIKI_BWIKI",
      sourceKind: "trusted_wiki",
      credibility: "trusted_wiki",
    });
    expect(results[0]?.excerpt).toContain("另一个遥远的星球");
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
                  extract:
                    "愛可菲是原神中的角色。她的傳說任務第一幕為角色任務，相關頁面整理了任務劇情。",
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
                  title: "愛可菲傳說任務",
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
    expect(results[0]?.title).toBe("愛可菲傳說任務");
    expect(results[0]?.sourceKind).toBe("trusted_wiki");
    expect(results[0]?.excerpt).toMatch(/传说任务|傳說任務/u);
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

  it("uses English quest pages only as clues and returns Chinese confirmation", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const query = url.searchParams.get("srsearch");
      if (url.hostname === "html.duckduckgo.com") {
        const webQuery = url.searchParams.get("q") ?? "";
        if (webQuery.includes("Duel Before the Throne")) {
          return new Response(
            `<a class="result__a" href="https://wiki.biligame.com/ys/%E5%BE%A1%E5%89%8D%E5%86%B3%E6%96%97">御前决斗</a>
             <div class="result__snippet">女士在御前决斗中败北，随后被雷电将军处决。</div>`,
            { status: 200, headers: { "Content-Type": "text/html" } },
          );
        }
        return new Response("", { status: 200 });
      }
      if (url.hostname === "search.yahoo.com") {
        return new Response("", { status: 200 });
      }
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
      if (
        url.pathname === "/api.php" &&
        query === "La Signora story quest storyline"
      ) {
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

    expect(searchedQueries).toContain("La Signora story quest storyline");
    expect(results[0]?.title).toBe("御前决斗");
    expect(results[0]?.excerpt).toContain("被雷电将军处决");
    expect(results.every((result) => result.crossLanguage === false)).toBe(true);
  });

  it("converts English Story Quest clues into Chinese evidence and hides the English pages", async () => {
    const wikiQueries: string[] = [];
    const webQueries: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (
        url.hostname === "html.duckduckgo.com" ||
        url.hostname === "search.yahoo.com"
      ) {
        const webQuery = url.searchParams.get("q") ?? "";
        if (url.hostname === "html.duckduckgo.com") webQueries.push(webQuery);
        if (
          url.hostname === "html.duckduckgo.com" &&
          (webQuery.includes("To Those Who Embark on the Expedition") ||
            webQuery.includes("Lupus Majoris Chapter") ||
            webQuery.includes("天狼之章"))
        ) {
          return new Response(
            `<a class="result__a" href="https://baike.mihoyo.com/ys/obc/content/777/detail">法尔伽传说任务·致踏上远征之人</a>
             <div class="result__snippet">法尔伽传说任务第一幕讲述远征军归途、罗兰与安德留斯的冲突，以及法尔伽最终在风起地苏醒。</div>`,
            { status: 200, headers: { "Content-Type": "text/html" } },
          );
        }
        return new Response("", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        });
      }
      if (url.searchParams.get("prop") === "extracts") {
        const pageIds = url.searchParams.get("pageids") ?? "";
        const pages: Record<string, { pageid: number; extract: string }> = {};
        if (pageIds.includes("442550")) {
          pages["442550"] = {
            pageid: 442550,
            extract:
              "Lupus Majoris Chapter is Varka's Story Quest chapter. Act I is To Those Who Embark on the Expedition, whose summary follows the expedition's final battle and return.",
          };
        }
        if (pageIds.includes("443589")) {
          pages["443589"] = {
            pageid: 443589,
            extract:
              "To Those Who Embark on the Expedition is the first act of Varka's Story Quest, the Lupus Majoris Chapter. It contains Triumphant Warrior, Fated Warrior, and Lonely Warrior.",
          };
        }
        if (pageIds.includes("9001")) {
          pages["9001"] = {
            pageid: 9001,
            extract: "Varka's Secret Stash of Cash is a quest item.",
          };
        }
        return new Response(JSON.stringify({ query: { pages } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.searchParams.get("action") === "parse") {
        const page = url.searchParams.get("page") ?? "";
        if (page === "Lupus Majoris Chapter") {
          return new Response(
            JSON.stringify({
              parse: {
                text: {
                  "*":
                    "<p>Other Languages</p><p>Chinese (Simplified) 天狼之章 Tiānláng zhī Zhāng Chinese (Traditional) 天狼之章</p>",
                },
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response(
          JSON.stringify({ parse: { text: { "*": "" } } }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      const query = url.searchParams.get("srsearch") ?? "";
      wikiQueries.push(query);
      if (
        url.pathname === "/api.php" &&
        query.toLowerCase() === "varka story quest plot"
      ) {
        return new Response(
          JSON.stringify({
            query: {
              search: [
                { title: "Lupus Majoris Chapter", snippet: "", pageid: 442550 },
                {
                  title: "To Those Who Embark on the Expedition",
                  snippet: "",
                  pageid: 443589,
                },
                {
                  title: "Varka's Secret Stash of Cash (2)",
                  snippet: "A quest item associated with Varka.",
                  pageid: 9001,
                },
              ],
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
                title: "Varka's Secret Stash of Cash (2)",
                snippet: "A quest item associated with Varka.",
                pageid: 9001,
              },
            ],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const results = await searchWebEvidence(
      "法尔伽传说任务故事梗概",
      "zh-CN",
      {
        plan: {
          coreEntities: ["法尔伽"],
          aliases: ["Varka"],
          intent: "story",
          storyScope: "character_story_quest",
          queries: ["法尔伽传说任务故事梗概", "Varka story quest"],
        },
      },
    );

    expect(wikiQueries).toContain("Varka story quest plot");
    expect(webQueries.some((query) => query.includes("天狼之章"))).toBe(true);
    expect(
      webQueries.every(
        (query) =>
          /[\u3400-\u9fff]/u.test(query) || /^site:/iu.test(query),
      ),
    ).toBe(true);
    expect(webQueries).not.toContain("Varka story quest");
    expect(results[0]?.title).toBe("法尔伽传说任务·致踏上远征之人");
    expect(results[0]?.url).toContain("baike.mihoyo.com");
    expect(results[0]?.excerpt).toContain("最终在风起地苏醒");
    expect(results.every((result) => result.crossLanguage === false)).toBe(true);
    expect(
      results.some((result) => result.title === "Lupus Majoris Chapter"),
    ).toBe(false);
    expect(
      results.some((result) => result.title.includes("Secret Stash")),
    ).toBe(false);
    expect(results[0]?.assessment?.platformKind).toBe(
      "official_operated_wiki",
    );
    expect(wikiQueries).not.toContain("Varka story quest chapter");
  });

  it("opens a Chinese wiki page directly when web search misses a localized Story Quest title", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (
        url.hostname === "html.duckduckgo.com" ||
        url.hostname === "search.yahoo.com"
      ) {
        return new Response("", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        });
      }
      if (
        url.hostname === "wiki.biligame.com" &&
        url.searchParams.get("action") === "parse" &&
        url.searchParams.get("page")?.includes("天狼之章")
      ) {
        return new Response(
          JSON.stringify({
            parse: {
              title: "天狼之章",
              text: {
                "*": `<main>
                  <h1>天狼之章</h1>
                  <p>天狼之章是法尔伽的传说任务章节，第一幕为「致踏上远征之人」。</p>
                  <p>本幕任务包括凯旋的远征者、命运的远征者与孤独的远征者。</p>
                </main>`,
              },
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json; charset=utf-8" },
          },
        );
      }
      if (url.searchParams.get("prop") === "extracts") {
        const pages =
          url.searchParams.get("pageids")?.includes("442550") === true
            ? {
                "442550": {
                  pageid: 442550,
                  extract:
                    "Lupus Majoris Chapter is Varka's Story Quest chapter.",
                },
              }
            : {};
        return new Response(JSON.stringify({ query: { pages } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.searchParams.get("action") === "parse") {
        return new Response(
          JSON.stringify({
            parse: {
              text: {
                "*":
                  "<p>Chinese (Simplified) 天狼之章 Tiānláng zhī Zhāng</p>",
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (
        url.hostname === "genshin-impact.fandom.com" &&
        url.searchParams.get("srsearch") === "Varka story quest plot"
      ) {
        return new Response(
          JSON.stringify({
            query: {
              search: [
                {
                  title: "Lupus Majoris Chapter",
                  snippet: "Varka's Story Quest chapter.",
                  pageid: 442550,
                },
              ],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ query: { search: [], pages: {} } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const results = await searchWebEvidence(
      "法尔伽传说任务故事梗概",
      "zh-CN",
      {
        plan: {
          coreEntities: ["法尔伽"],
          aliases: ["Varka"],
          intent: "story",
          storyScope: "character_story_quest",
          queries: ["法尔伽传说任务故事梗概"],
        },
      },
    );

    expect(
      fetchMock.mock.calls.some((call) => {
        const url = new URL(String(call[0]));
        return (
          url.hostname === "wiki.biligame.com" &&
          url.searchParams.get("page")?.includes("天狼之章") === true
        );
      }),
    ).toBe(true);
    expect(
      fetchMock.mock.calls.some((call) => {
        const url = new URL(String(call[0]));
        return (
          url.hostname === "wiki.biligame.com" &&
          url.searchParams.get("srsearch") === "法尔伽 传说任务"
        );
      }),
    ).toBe(true);
    expect(results[0]?.title).toContain("天狼之章");
    expect(results[0]?.url).toContain("wiki.biligame.com/ys/");
    expect(results[0]?.excerpt).toContain("法尔伽的传说任务章节");
    expect(results.every((result) => result.crossLanguage === false)).toBe(true);
    expect(
      results.some((result) => result.title === "Lupus Majoris Chapter"),
    ).toBe(false);
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
