import { afterEach, describe, expect, it, vi } from "vitest";
import { isDeepStoryIntent } from "@/lib/classification";
import {
  readingQueries,
  recommendStoryResources,
} from "@/lib/story-resources";

describe("deep story guidance", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("detects broad story requests but not explicit short answers", () => {
    expect(
      isDeepStoryIntent("给我讲一讲水仙十字结社", "story"),
    ).toBe(true);
    expect(
      isDeepStoryIntent("简单说说水仙十字结社，不要剧透", "story"),
    ).toBe(false);
    expect(isDeepStoryIntent("给我讲讲法尔伽", "other")).toBe(true);
  });

  it("discovers official character videos from the generic entity plan", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.hostname === "www.bilibili.com") {
        return new Response(
          `<script>window.__INITIAL_STATE__={"owner":{"mid":401742377,"name":"原神"}}</script>
           <span>原神官方账号</span>`,
          { status: 200, headers: { "Content-Type": "text/html" } },
        );
      }
      const params = url.searchParams;
      const query = params.get("q") ?? params.get("p") ?? "";
      const title = query.includes("角色预告")
        ? "原神官方：桑多涅角色预告"
        : "原神官方：桑多涅角色演示";
      return new Response(
        `<a class="result__a" href="https://www.bilibili.com/video/BV1example/">${title}</a>
         <a class="result__snippet">原神官方角色视频</a>`,
        { status: 200, headers: { "Content-Type": "text/html" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const searchPlan = {
      coreEntities: ["桑多涅"],
      aliases: ["木偶"],
      intent: "identity" as const,
      queries: ["桑多涅 身份"],
    };
    const resources = await recommendStoryResources(
      "桑多涅是谁",
      "zh-CN",
      { liveSearch: true, searchPlan },
    );
    expect(resources[0]?.authority).toBe("official");
    expect(resources[0]?.kind).toBe("official_video");
    const queries = fetchMock.mock.calls
      .map((call) => new URL(String(call[0])))
      .filter(
        (url) =>
          url.hostname === "html.duckduckgo.com" ||
          url.hostname === "search.yahoo.com",
      )
      .map(
        (url) =>
          url.searchParams.get("q") ?? url.searchParams.get("p"),
      );
    expect(queries.every((query) => query?.includes("桑多涅"))).toBe(true);
    expect(
      readingQueries("任意人物是谁", "zh-CN", {
        coreEntities: ["任意人物"],
        aliases: [],
        intent: "identity",
        queries: ["任意人物 身份"],
      }).every((query) => query.includes("任意人物")),
    ).toBe(true);
  });

  it("keeps live reading resource ids unique across multiple search queries", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.hostname !== "search.yahoo.com") {
        return new Response("", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        });
      }
      const query = url.searchParams.get("p") ?? "";
      const suffix = query.includes("角色PV")
        ? "pv"
        : query.includes("角色演示")
          ? "demo"
          : "trailer";
      return new Response(
        `<a href="https://www.bilibili.com/video/BV-${suffix}/"><h3 class="title">原神官方：桑多涅${suffix}</h3></a>
         <p>原神官方角色视频</p>`,
        { status: 200, headers: { "Content-Type": "text/html" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const resources = await recommendStoryResources("桑多涅是谁", "zh-CN", {
      liveSearch: true,
      searchPlan: {
        coreEntities: ["桑多涅"],
        aliases: [],
        intent: "identity",
        queries: ["桑多涅 身份"],
      },
    });
    const ids = resources.map((item) => item.id);

    expect(ids.length).toBeGreaterThan(1);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps Narzissenkreuz community guides explicitly non-official", async () => {
    const resources = await recommendStoryResources(
      "给我讲一讲水仙十字结社",
      "zh-CN",
      { liveSearch: false },
    );
    expect(resources.some((item) => item.kind === "official_text")).toBe(true);
    expect(resources.map((item) => item.url)).toEqual(
      expect.arrayContaining([
        "https://www.bilibili.com/video/BV1EN411u7wM/",
        "https://zhuanlan.zhihu.com/p/668052393",
      ]),
    );
    expect(
      resources
        .filter((item) => item.kind === "analysis_video")
        .every((item) => item.authority === "community"),
    ).toBe(true);
  });

  it("reuses answer citations before launching another live search", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const resources = await recommendStoryResources("丝柯克是谁", "zh-CN", {
      liveSearch: true,
      searchPlan: {
        coreEntities: ["丝柯克"],
        aliases: ["Skirk"],
        intent: "identity",
        queries: ["丝柯克 身份"],
      },
      citations: [
        {
          id: "external-1",
          title: "丝柯克 - 原神 - HoYoWiki",
          url: "https://wiki.hoyolab.com/pc/genshin/entry/skirk",
          sourceName: "HoYoWiki",
          sourceKind: "trusted_wiki",
          credibility: "trusted_wiki",
          factStatus: "trusted_secondary",
          excerpt: "丝柯克是来自星海的剑士。",
          external: true,
          crossLanguage: false,
        },
        {
          id: "external-2",
          title: "丝柯克角色介绍",
          url: "https://genshin.hoyoverse.com/zh/news/detail/skirk",
          sourceName: "原神官网",
          sourceKind: "official",
          credibility: "official",
          factStatus: "official_explicit",
          excerpt: "丝柯克角色公开资料。",
          external: true,
          crossLanguage: false,
        },
      ],
    });

    expect(resources).toHaveLength(2);
    expect(resources[0]?.authority).toBe("official");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
