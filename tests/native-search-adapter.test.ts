import { afterEach, describe, expect, it, vi } from "vitest";
import {
  adaptNativeSearchResults,
  searchNativeReadingResources,
} from "@/lib/native-search-adapter";
import { normalizeSearchPlan } from "@/lib/external-search";
import { generateGroundedResponse } from "@/lib/generation";

describe("native search adapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.LLM_API_STYLE;
    delete process.env.LLM_API_KEY;
  });

  it("deduplicates URLs and keeps relevant trusted Chinese sources", () => {
    const question = "冰之女皇与愚人众执行官之间是什么关系？";
    const plan = normalizeSearchPlan({
      coreEntities: ["冰之女皇"], aliases: ["女皇"], intent: "relationship", queries: [question],
    }, question);
    const citations = adaptNativeSearchResults([
      { title: "冰之女皇", url: "https://baike.baidu.com/item/冰之女皇" },
      { title: "冰之女皇重复", url: "https://baike.baidu.com/item/冰之女皇#history" },
      { title: "搜索页", url: "https://duckduckgo.com/?q=冰之女皇" },
      { title: "无关人物", url: "https://example.com/unrelated" },
    ], { question, language: "zh-CN", plan });
    expect(citations).toHaveLength(1);
    expect(citations[0]).toMatchObject({
      sourceName: "百度百科",
      sourceKind: "trusted_wiki",
      credibility: "trusted_wiki",
      excerpt: "DeepSeek 原生搜索返回的相关页面",
      external: true,
      crossLanguage: false,
    });
  });

  it("uses the request-level Anthropic route for native search", async () => {
    process.env.LLM_API_STYLE = "openai";
    process.env.LLM_API_KEY = "test-key";
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      content: [
        { type: "web_search_tool_result", content: [{
          type: "web_search_result",
          title: "冰之女皇与愚人众执行官",
          url: "https://baike.baidu.com/item/冰之女皇",
          snippet: "冰之女皇是愚人众执行官效忠的最高统领。",
        }] },
        { type: "text", text: "冰之女皇是愚人众执行官的最高统领，执行官向她效忠并执行跨国任务。" },
      ],
      stop_reason: "end_turn",
      usage: { server_tool_use: { web_search_requests: 1 } },
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const question = "冰之女皇与愚人众执行官之间是什么关系？";
    const result = await generateGroundedResponse({
      question,
      apiStyle: "anthropic",
      language: "zh-CN",
      profile: "story",
      entries: [],
      external: [],
      category: "story",
    });
    expect(String(fetchMock.mock.calls[0][0])).toContain("/anthropic/v1/messages");
    expect(result.answer).toContain("最高统领");
    expect(result.external[0]).toMatchObject({ sourceName: "百度百科", credibility: "trusted_wiki" });
    expect(result.diagnostics?.searchProvider).toBe("deepseek_native");
  });

  it("performs one bounded native search for supplementary resources", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify({
        content: [
          { type: "web_search_tool_result", content: [{
            type: "web_search_result",
            title: "丝柯克角色介绍",
            url: "https://genshin.hoyoverse.com/zh/news/detail/skirk",
            snippet: "丝柯克角色公开资料。",
          }] },
          { type: "text", text: "已找到可选资料。" },
        ],
        stop_reason: "end_turn",
      }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const question = "丝柯克是谁？";
    const searchPlan = normalizeSearchPlan({
      coreEntities: ["丝柯克"], aliases: ["Skirk"], intent: "identity", queries: ["丝柯克 身份"],
    }, question);
    const citations = await searchNativeReadingResources({
      question,
      language: "zh-CN",
      searchPlan,
      queries: ["丝柯克 角色介绍", "丝柯克 角色演示"],
      apiKey: "test-key",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-v4-flash",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.tools).toEqual([expect.objectContaining({ max_uses: 1 })]);
    expect(citations).toHaveLength(1);
    expect(citations[0].sourceKind).toBe("official");
  });
});
