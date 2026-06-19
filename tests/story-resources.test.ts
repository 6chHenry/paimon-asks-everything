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
      const query = new URL(String(input)).searchParams.get("q") ?? "";
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
    const queries = fetchMock.mock.calls.map((call) =>
      new URL(String(call[0])).searchParams.get("q"),
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
});
