import { afterEach, describe, expect, it, vi } from "vitest";
import {
  generateGroundedAnswer,
  generateGroundedResponse,
} from "@/lib/generation";
import type { Citation, KnowledgeEntry } from "@/lib/domain";

const originalEnv = { ...process.env };

function mockChatCompletion(content: string) {
  const fetchMock = vi.fn(async () =>
    new Response(
      JSON.stringify({ choices: [{ message: { content } }] }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const entry: KnowledgeEntry = {
  id: "sandrone-public-en",
  conceptId: "sandrone-public",
  language: "en",
  title: "Sandrone public identity",
  content: "Sandrone is a Fatui Harbinger associated with machinery.",
  summary: "Sandrone is publicly associated with machinery.",
  aliases: ["Sandrone"],
  tags: ["sandrone"],
  contentType: "character",
  spoilerLevel: 0,
  minimumProgress: "mondstadt",
  factStatus: "official_explicit",
  source: {
    title: "Character introduction",
    url: "https://example.com/sandrone",
    sourceName: "Genshin Impact",
    sourceKind: "official",
  },
  reviewed: true,
};

const externalCitation: Citation = {
  id: "external-1",
  title: "Liben",
  url: "https://genshin-impact.fandom.com/wiki/Liben",
  sourceName: "Genshin Impact Wiki",
  sourceKind: "trusted_wiki",
  credibility: "trusted_wiki",
  factStatus: "trusted_secondary",
  excerpt: "Liben is a traveling merchant.",
  external: true,
  crossLanguage: false,
};

const escoffierCitation: Citation = {
  id: "external-1",
  title: "爱可菲是谁？爱可菲传说任务剧情解析",
  url: "https://example.com/escoffier-video",
  sourceName: "视频资料",
  sourceKind: "trusted_wiki",
  credibility: "trusted_wiki",
  factStatus: "trusted_secondary",
  excerpt:
    "爱可菲是原神中的角色。资料围绕她的传说任务展开，讲述她的身份背景、相关人物关系，以及传说任务中围绕料理、责任和个人选择展开的剧情。",
  external: true,
  crossLanguage: false,
};

const raidenCitation: Citation = {
  id: "external-1",
  title: "雷电将军",
  url: "https://genshin-impact.fandom.com/zh/wiki/雷电将军",
  sourceName: "Genshin Impact Wiki 中文",
  sourceKind: "trusted_wiki",
  credibility: "trusted_wiki",
  factStatus: "trusted_secondary",
  excerpt: "雷电将军是雷电影制造的人偶，用来代替她治理稻妻并追求永恒；雷电影本人是稻妻的雷神。",
  external: true,
  crossLanguage: false,
};

describe("grounded generation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
  });

  it("calls the configured OpenAI-compatible chat API for controlled evidence", async () => {
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_BASE_URL = "https://api.example.test";
    process.env.LLM_MODEL = "deepseek-v4-flash";
    delete process.env.https_proxy;
    delete process.env.HTTPS_PROXY;
    delete process.env.http_proxy;
    delete process.env.HTTP_PROXY;
    const fetchMock = mockChatCompletion(
      JSON.stringify({
        answer: "Sandrone is publicly associated with machinery.",
        citedSourceIds: ["source-1"],
      }),
    );

    const answer = await generateGroundedAnswer({
      question: "What is officially known about Sandrone?",
      language: "en",
      profile: "story",
      entries: [entry],
      external: [],
    });

    expect(answer).toBe("Sandrone is publicly associated with machinery.[source-1]");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("calls the configured OpenAI-compatible chat API even when evidence comes from external search", async () => {
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_BASE_URL = "https://api.example.test";
    process.env.LLM_MODEL = "deepseek-v4-flash";
    delete process.env.https_proxy;
    delete process.env.HTTPS_PROXY;
    delete process.env.http_proxy;
    delete process.env.HTTP_PROXY;
    const fetchMock = mockChatCompletion(
      JSON.stringify({
        answer: "女士（愚人众执行官「仆人」）被处决。",
        citedSourceIds: ["external-1"],
      }),
    );

    const answer = await generateGroundedAnswer({
      question: "女士为什么死在稻妻了？",
      language: "zh-CN",
      profile: "returning",
      entries: [],
      external: [externalCitation],
    });

    expect(answer).toBe("愚人众执行官「女士」被处决。[external-1]");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back when a structured model answer cites sources outside supplied evidence", async () => {
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_BASE_URL = "https://api.example.test";
    process.env.LLM_MODEL = "deepseek-v4-flash";
    delete process.env.https_proxy;
    delete process.env.HTTPS_PROXY;
    delete process.env.http_proxy;
    delete process.env.HTTP_PROXY;
    mockChatCompletion(
      JSON.stringify({
        answer: "Unsupported answer",
        citedSourceIds: ["made-up-source"],
      }),
    );

    const answer = await generateGroundedAnswer({
      question: "What is officially known about Sandrone?",
      language: "en",
      profile: "story",
      entries: [entry],
      external: [],
    });

    expect(answer).not.toBe("Unsupported answer");
    expect(answer).toContain("Sandrone");
  });

  it("rejects Chinese model text for English answers", async () => {
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_BASE_URL = "https://api.example.test";
    process.env.LLM_MODEL = "deepseek-v4-flash";
    delete process.env.https_proxy;
    delete process.env.HTTPS_PROXY;
    delete process.env.http_proxy;
    delete process.env.HTTP_PROXY;
    mockChatCompletion(
      JSON.stringify({
        answer: "桑多涅是阿兰晚年的造物。",
        citedSourceIds: ["source-1"],
      }),
    );

    const answer = await generateGroundedAnswer({
      question: "What is officially known about Sandrone?",
      language: "en",
      profile: "story",
      entries: [entry],
      external: [],
    });

    expect(answer).not.toMatch(/[\u3400-\u9fff]/u);
    expect(answer).toContain("Sandrone");
  });

  it("turns external evidence into a direct answer when model output is unusable", async () => {
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_BASE_URL = "https://api.example.test";
    process.env.LLM_MODEL = "deepseek-v4-flash";
    delete process.env.https_proxy;
    delete process.env.HTTPS_PROXY;
    delete process.env.http_proxy;
    delete process.env.HTTP_PROXY;
    mockChatCompletion(
      JSON.stringify({
        answer: "可以！不用把旧内容全部补完。来源都放在下面啦。",
        citedSourceIds: ["external-1"],
      }),
    );

    const answer = await generateGroundedAnswer({
      question: "爱可菲是谁，她的传说任务讲了什么",
      language: "zh-CN",
      profile: "returning",
      entries: [],
      external: [escoffierCitation],
    });

    expect(answer).toContain("爱可菲");
    expect(answer).toContain("传说任务");
    expect(answer).toContain("身份背景");
    expect(answer).not.toContain("不用把旧内容全部补完");
    expect(answer).not.toContain("来源都放在下面");
  });

  it("rejects an off-topic model answer even when it cites a valid source id", async () => {
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_BASE_URL = "https://api.example.test";
    process.env.LLM_MODEL = "deepseek-v4-flash";
    delete process.env.https_proxy;
    delete process.env.HTTPS_PROXY;
    delete process.env.http_proxy;
    delete process.env.HTTP_PROXY;
    mockChatCompletion(
      JSON.stringify({
        answer: "桑多涅是阿兰晚年的造物，形象与记忆源自玛丽安。",
        citedSourceIds: ["external-1"],
      }),
    );

    const answer = await generateGroundedAnswer({
      question: "雷电将军和雷电影的关系",
      language: "zh-CN",
      profile: "returning",
      entries: [],
      external: [raidenCitation],
    });

    expect(answer).toContain("雷电将军");
    expect(answer).toContain("雷电影");
    expect(answer).not.toContain("桑多涅");
    expect(answer).not.toContain("阿兰");
  });

  it("runs a DeepSeek search tool loop and returns cited web evidence", async () => {
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_BASE_URL = "https://api.example.test";
    process.env.LLM_MODEL = "deepseek-v4-flash";
    delete process.env.https_proxy;
    delete process.env.HTTPS_PROXY;
    delete process.env.http_proxy;
    delete process.env.HTTP_PROXY;
    let llmCalls = 0;
    const traceEvents: Array<{ stage: string; message: string }> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.hostname === "api.example.test") {
        llmCalls += 1;
        if (llmCalls === 1) {
          return new Response(
            JSON.stringify({
              choices: [
                {
                  finish_reason: "tool_calls",
                  message: {
                    content: null,
                    tool_calls: [
                      {
                        id: "call-search-1",
                        type: "function",
                        function: {
                          name: "search_web_evidence",
                          arguments: JSON.stringify({
                            coreEntities: ["桑多涅", "阿兰"],
                            aliases: ["Sandrone", "Alain Guillotin"],
                            intent: "relationship",
                            queries: ["桑多涅 阿兰 关系"],
                            language: "zh-CN",
                          }),
                        },
                      },
                    ],
                  },
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    answer: "桑多涅是阿兰晚年的造物。",
                    citedSourceIds: ["source-1", "external-1"],
                    confidence: "high",
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
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
                snippet: "桑多涅与阿兰、玛丽安有关。",
                pageid: 2002,
              },
            ],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateGroundedResponse({
      question: "桑多涅和阿兰的关系",
      language: "zh-CN",
      profile: "story",
      entries: [entry],
      external: [],
      emitTrace: (event) => {
        traceEvents.push(event);
      },
    });

    expect(llmCalls).toBe(2);
    const firstLlmCall = fetchMock.mock.calls.find(
      (call) => new URL(String(call[0])).hostname === "api.example.test",
    ) as [RequestInfo | URL, RequestInit] | undefined;
    expect(firstLlmCall).toBeTruthy();
    const firstLlmBody = JSON.parse(
      String(firstLlmCall?.[1].body),
    ) as { thinking?: { type?: string }; tool_choice?: string };
    expect(firstLlmBody.thinking).toEqual({ type: "disabled" });
    expect(firstLlmBody.tool_choice).toBe("required");
    expect(String(firstLlmCall?.[1].body)).toContain("月之七");
    expect(String(firstLlmCall?.[1].body)).toContain("2026-07-01");
    expect(result.answer).toBe("桑多涅是阿兰晚年的造物。[source-1][external-1]");
    expect(result.external.length).toBeGreaterThan(0);
    expect(result.external[0]?.sourceKind).toBe("trusted_wiki");
    expect(result.searchPlan.coreEntities).toEqual(["桑多涅", "阿兰"]);
    expect(traceEvents.map((event) => event.stage)).toEqual(
      expect.arrayContaining(["tool", "search", "generate"]),
    );
  });

  it("uses community video evidence instead of returning a source-only answer", async () => {
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_BASE_URL = "https://api.example.test";
    process.env.LLM_MODEL = "deepseek-v4-flash";
    delete process.env.https_proxy;
    delete process.env.HTTPS_PROXY;
    delete process.env.http_proxy;
    delete process.env.HTTP_PROXY;
    let llmCalls = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.hostname === "api.example.test") {
        llmCalls += 1;
        if (llmCalls === 1) {
          return new Response(
            JSON.stringify({
              choices: [
                {
                  finish_reason: "tool_calls",
                  message: {
                    content: null,
                    tool_calls: [
                      {
                        id: "call-search-escoffier",
                        type: "function",
                        function: {
                          name: "search_web_evidence",
                          arguments: JSON.stringify({
                            coreEntities: ["爱可菲"],
                            aliases: ["Escoffier"],
                            intent: "story",
                            queries: ["爱可菲 原神 传说任务"],
                            language: "zh-CN",
                          }),
                        },
                      },
                    ],
                  },
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    answer: "可以！不用把旧内容全部补完。来源都放在下面啦。",
                    citedSourceIds: ["external-1"],
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
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

    const result = await generateGroundedResponse({
      question: "爱可菲是谁，她的传说任务讲了什么",
      language: "zh-CN",
      profile: "returning",
      entries: [],
      external: [],
    });

    expect(llmCalls).toBe(2);
    expect(result.answer).toContain("爱可菲");
    expect(result.answer).toContain("传说任务");
    expect(result.answer).toContain("身份背景");
    expect(result.answer).not.toContain("不用把旧内容全部补完");
    expect(result.answer).not.toContain("来源都放在下面");
    expect(result.external[0]?.sourceKind).toBe("community");
    expect(result.citedSourceIds).toEqual(["external-1"]);
  });

  it("falls back to the user question when the model plans a search for an unrelated subject", async () => {
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_BASE_URL = "https://api.example.test";
    process.env.LLM_MODEL = "deepseek-v4-flash";
    delete process.env.https_proxy;
    delete process.env.HTTPS_PROXY;
    delete process.env.http_proxy;
    delete process.env.HTTP_PROXY;
    let llmCalls = 0;
    const searchedQueries: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.hostname === "api.example.test") {
        llmCalls += 1;
        if (llmCalls === 1) {
          return new Response(
            JSON.stringify({
              choices: [
                {
                  finish_reason: "tool_calls",
                  message: {
                    content: null,
                    tool_calls: [
                      {
                        id: "call-search-drift",
                        type: "function",
                        function: {
                          name: "search_web_evidence",
                          arguments: JSON.stringify({
                            coreEntities: ["桑多涅", "阿兰"],
                            aliases: ["Sandrone", "Alain Guillotin"],
                            intent: "relationship",
                            queries: ["桑多涅 阿兰 关系"],
                            language: "zh-CN",
                          }),
                        },
                      },
                    ],
                  },
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    answer: "雷电将军是雷电影制造的人偶。",
                    citedSourceIds: ["external-1"],
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.hostname === "html.duckduckgo.com" || url.hostname === "search.yahoo.com") {
        searchedQueries.push(
          url.searchParams.get("q") ?? url.searchParams.get("p") ?? "",
        );
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
      searchedQueries.push(url.searchParams.get("srsearch") ?? "");
      const query = url.searchParams.get("srsearch") ?? "";
      return new Response(
        JSON.stringify({
          query: {
            search: query.includes("桑多涅")
              ? [
                  {
                    title: "桑多涅",
                    snippet: "桑多涅与阿兰、玛丽安有关。",
                    pageid: 2002,
                  },
                ]
              : [
                  {
                    title: "雷电将军",
                    snippet: "雷电将军是雷电影制造的人偶。",
                    pageid: 1001,
                  },
                ],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateGroundedResponse({
      question: "雷电将军和雷电影的关系",
      language: "zh-CN",
      profile: "returning",
      entries: [],
      external: [],
    });

    expect(llmCalls).toBe(2);
    expect(result.searchPlan.coreEntities).toEqual([]);
    expect(searchedQueries.some((query) => query.includes("桑多涅"))).toBe(false);
    expect(searchedQueries.some((query) => query.includes("雷电将军"))).toBe(true);
    expect(result.external[0]?.title).toBe("雷电将军");
    expect(result.answer).toContain("雷电将军");
    expect(result.answer).not.toContain("桑多涅");
  });
});
