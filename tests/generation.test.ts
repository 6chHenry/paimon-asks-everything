import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateGroundedAnswer,
  generateGroundedResponse,
} from "@/lib/generation";
import { factionKnowledgeEntries } from "@/data/faction-knowledge";
import { knowledgeEntries } from "@/data/knowledge";
import type { Citation, KnowledgeEntry } from "@/lib/domain";
import { ruleUnderstandQuestion } from "@/lib/question-understanding";

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
  beforeEach(() => {
    process.env.LLM_API_STYLE = "openai";
  });

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

  it("filters generic and gameplay snippets from direct identity fallbacks", async () => {
    const genericCitation: Citation = {
      id: "external-1",
      title: "原神WIKI",
      url: "https://wiki.biligame.com/ys/",
      sourceName: "原神WIKI_BWIKI",
      sourceKind: "trusted_wiki",
      credibility: "trusted_wiki",
      factStatus: "trusted_secondary",
      excerpt:
        "欢迎来到原神WIKI，这是开放编辑由玩家制作的游戏数据库，整合了详细原神相关图鉴资料和攻略内容。",
      external: true,
      crossLanguage: false,
    };
    const gameplayCitation: Citation = {
      id: "external-2",
      title: "丝柯克/技能",
      url: "https://wiki.biligame.com/ys/丝柯克/技能",
      sourceName: "原神WIKI_BWIKI",
      sourceKind: "trusted_wiki",
      credibility: "trusted_wiki",
      factStatus: "trusted_secondary",
      excerpt:
        "长按 丝柯克获得45点蛇之狡谋，并将持续快速移动，在该状态下提高丝柯克的抗打断能力。",
      external: true,
      crossLanguage: false,
    };
    const identityCitation: Citation = {
      id: "external-3",
      title: "丝柯克",
      url: "https://wiki.biligame.com/ys/丝柯克",
      sourceName: "原神WIKI_BWIKI",
      sourceKind: "trusted_wiki",
      credibility: "trusted_wiki",
      factStatus: "trusted_secondary",
      excerpt:
        "丝柯克是来历不明的强大战士，她自称是坎瑞亚五大罪人之一苏尔特洛奇的弟子。",
      external: true,
      crossLanguage: false,
    };

    const answer = await generateGroundedAnswer({
      question: "丝柯克是外星人吗",
      language: "zh-CN",
      profile: "returning",
      entries: [],
      external: [genericCitation, gameplayCitation, identityCitation],
    });

    expect(answer).toContain("丝柯克");
    expect(answer).toContain("来历不明");
    expect(answer).not.toContain("欢迎来到原神WIKI");
    expect(answer).not.toContain("长按");
    expect(answer).not.toContain("蛇之狡谋");
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

  it("does not generate Story Quest facts from a community analysis video alone", async () => {
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

    expect(llmCalls).toBe(3);
    expect(result.external).toEqual([]);
    expect(result.citedSourceIds).toEqual([]);
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
    expect(result.searchPlan.coreEntities).toEqual(["雷电将军", "雷电影"]);
    expect(searchedQueries.some((query) => query.includes("桑多涅"))).toBe(false);
    expect(searchedQueries.some((query) => query.includes("雷电将军"))).toBe(true);
    expect(result.external[0]?.title).toBe("雷电将军");
    expect(result.answer).toContain("雷电将军");
    expect(result.answer).not.toContain("桑多涅");
  });

  it("uses reconciled question understanding to anchor alias-only questions", async () => {
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
                        id: "call-search-alias",
                        type: "function",
                        function: {
                          name: "search_web_evidence",
                          arguments: JSON.stringify({
                            coreEntities: [],
                            aliases: [],
                            intent: "story",
                            storyScope: "character_story_quest",
                            queries: ["关系 原神"],
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
                    answer: "雷电将军是雷电影制造的人偶。[external-1]",
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
      return new Response(
        JSON.stringify({
          query: {
            search: [
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
      question: "将军和影的关系",
      language: "zh-CN",
      profile: "returning",
      entries: [],
      external: [],
      understanding: {
        entities: [
          { canonical: "雷电将军", aliases: ["将军"], kind: "character" },
          { canonical: "雷电影", aliases: ["影"], kind: "character" },
        ],
        ruleEntities: [
          { canonical: "将军", aliases: [], kind: "character" },
          { canonical: "影", aliases: [], kind: "character" },
        ],
        modelEntities: [
          { canonical: "雷电将军", aliases: ["将军"], kind: "character" },
          { canonical: "雷电影", aliases: ["影"], kind: "character" },
        ],
        intent: "relationship",
        queries: ["雷电将军 雷电影 关系"],
        classification: {
          questionCategory: "character",
          confusionTopic: "雷电将军",
        },
        agreement: "confirmed",
      },
    });

    expect(llmCalls).toBe(2);
    expect(result.searchPlan.coreEntities).toEqual(["雷电将军", "雷电影"]);
    expect(result.searchPlan.intent).toBe("relationship");
    expect(result.searchPlan.storyScope).toBeUndefined();
    expect(
      searchedQueries.some((query) => query.includes("雷电将军 雷电影 PV 对话")),
    ).toBe(true);
    expect(searchedQueries.some((query) => query.includes("雷电将军"))).toBe(true);
    expect(result.answer).toContain("雷电将军");
  });

  it("merges local character anchors into weak model search plans", async () => {
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
                        id: "call-search-skirk",
                        type: "function",
                        function: {
                          name: "search_web_evidence",
                          arguments: JSON.stringify({
                            coreEntities: [],
                            aliases: [],
                            intent: "general",
                            queries: ["外星人 原神"],
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
                    answer: "丝柯克来自星海。[external-1]",
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
        return new Response(
          JSON.stringify({
            query: {
              pages: {
                "3001": {
                  pageid: 3001,
                  extract: "丝柯克是来自星海的神秘剑客。",
                },
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      searchedQueries.push(url.searchParams.get("srsearch") ?? "");
      return new Response(
        JSON.stringify({
          query: {
            search: [
              {
                title: "丝柯克",
                snippet: "丝柯克是来自星海的神秘剑客。",
                pageid: 3001,
              },
            ],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateGroundedResponse({
      question: "丝柯克是外星人",
      language: "zh-CN",
      profile: "returning",
      entries: [],
      external: [],
    });

    expect(llmCalls).toBe(2);
    expect(result.searchPlan.coreEntities).toEqual(["丝柯克"]);
    expect(result.searchPlan.aliases).toEqual(["Skirk"]);
    expect(result.searchPlan.intent).toBe("identity");
    expect(searchedQueries.some((query) => query.includes("丝柯克"))).toBe(true);
    expect(result.answer).toContain("丝柯克");
  });

  it("uses inferred question anchors when no lexicon entry exists", async () => {
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
                        id: "call-search-generic",
                        type: "function",
                        function: {
                          name: "search_web_evidence",
                          arguments: JSON.stringify({
                            coreEntities: [],
                            aliases: [],
                            intent: "general",
                            queries: ["外星人 原神"],
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
                    answer: "赫利俄斯来自星海。[external-1]",
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
        return new Response(
          JSON.stringify({
            query: {
              pages: {
                "4001": {
                  pageid: 4001,
                  extract: "赫利俄斯来自星海。",
                },
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      searchedQueries.push(url.searchParams.get("srsearch") ?? "");
      return new Response(
        JSON.stringify({
          query: {
            search: [
              {
                title: "赫利俄斯",
                snippet: "赫利俄斯来自星海。",
                pageid: 4001,
              },
            ],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateGroundedResponse({
      question: "赫利俄斯是外星人",
      language: "zh-CN",
      profile: "returning",
      entries: [],
      external: [],
    });

    expect(llmCalls).toBe(2);
    expect(result.searchPlan.coreEntities).toEqual(["赫利俄斯"]);
    expect(result.searchPlan.intent).toBe("identity");
    expect(searchedQueries.some((query) => query.includes("赫利俄斯"))).toBe(true);
    expect(result.answer).toContain("赫利俄斯");
  });

  it("does not turn generic wiki or gameplay snippets into identity fallback answers", async () => {
    delete process.env.LLM_API_KEY;
    delete process.env.https_proxy;
    delete process.env.HTTPS_PROXY;
    delete process.env.http_proxy;
    delete process.env.HTTP_PROXY;
    const searchedQueries: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.searchParams.get("prop") === "extracts") {
        return new Response(JSON.stringify({ query: { pages: {} } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.searchParams.get("list") === "search") {
        searchedQueries.push(url.searchParams.get("srsearch") ?? "");
        return new Response(
          JSON.stringify({
            query: {
              search: [
                {
                  title: "原神WIKI",
                  snippet:
                    "欢迎来到原神WIKI，这是开放编辑由玩家制作的游戏数据库，整合了详细原神相关图鉴资料和攻略内容。",
                  pageid: 1,
                },
                {
                  title: "丝柯克/技能",
                  snippet:
                    "长按 丝柯克获得45点蛇之狡谋，并将持续快速移动，提高丝柯克的抗打断能力。",
                  pageid: 2,
                },
                {
                  title: "丝柯克",
                  snippet:
                    "丝柯克是来历不明的强大战士，她自称是坎瑞亚五大罪人之一苏尔特洛奇的弟子。",
                  pageid: 3,
                },
              ],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateGroundedResponse({
      question: "丝柯克是外星人吗",
      language: "zh-CN",
      profile: "returning",
      entries: [],
      external: [],
    });

    expect(
      searchedQueries.every(
        (query) => query.includes("丝柯克") || query.includes("Skirk"),
      ),
    ).toBe(true);
    expect(result.external[0]?.title).toBe("丝柯克");
    expect(result.answer).toContain("丝柯克");
    expect(result.answer).not.toContain("欢迎来到原神WIKI");
    expect(result.answer).not.toContain("长按");
    expect(result.answer).not.toContain("蛇之狡谋");
  });


  it("uses a clean evidence fallback when the first LLM call fails cold", async () => {
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_BASE_URL = "https://api.example.test";
    delete process.env.https_proxy;
    delete process.env.HTTPS_PROXY;
    delete process.env.http_proxy;
    delete process.env.HTTP_PROXY;
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("cold_start_timeout");
      }),
    );
    const zhEntry: KnowledgeEntry = {
      ...entry,
      id: "sandrone-public-zh",
      language: "zh-CN",
      title: "\u6851\u591a\u6d85\u516c\u5f00\u8eab\u4efd",
      content: "\u6851\u591a\u6d85\u662f\u611a\u4eba\u4f17\u6267\u884c\u5b98\uff0c\u4e0e\u673a\u68b0\u9020\u7269\u6709\u660e\u786e\u5173\u8054\u3002",
      summary: "\u6851\u591a\u6d85\u4e0e\u673a\u68b0\u9020\u7269\u6709\u516c\u5f00\u5173\u8054\u3002",
      aliases: ["\u6851\u591a\u6d85"],
    };

    const result = await generateGroundedResponse({
      question: "\u6851\u591a\u6d85\u662f\u8c01",
      language: "zh-CN",
      profile: "new",
      entries: [zhEntry],
      external: [],
    });

    expect(result.answer).toContain("\u5148\u8bf4\u7ed3\u8bba");
    expect(result.answer).toContain("\u6851\u591a\u6d85");
    expect(result.answer).not.toContain("\u934f\u5806");
  });

  it("does not echo dirty external excerpts when a character-arc model call fails cold", async () => {
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_BASE_URL = "https://api.example.test";
    delete process.env.https_proxy;
    delete process.env.HTTPS_PROXY;
    delete process.env.http_proxy;
    delete process.env.HTTP_PROXY;
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("cold_start_timeout");
    }));

    const dirty: Citation = {
      id: "external-1",
      title: "旅行者创作平台-观测枢-原神wiki",
      url: "https://example.com/jeht",
      sourceName: "观测枢",
      sourceKind: "trusted_wiki",
      credibility: "trusted_wiki",
      factStatus: "trusted_secondary",
      excerpt:
        "旅行者创作平台-观测枢-原神wiki旅行者创作平台-观测枢-原神wiki；婕德：她会孤独吗&hellip;婕德：真可惜没能一起去&hellip;",
      external: true,
      crossLanguage: false,
    };

    const result = await generateGroundedResponse({
      question: "婕德经历了怎么的变化？",
      language: "zh-CN",
      profile: "returning",
      entries: [],
      external: [dirty],
      understanding: ruleUnderstandQuestion("婕德经历了怎么的变化？", "zh-CN"),
    });

    expect(result.answer).toBe("派蒙暂时没找到足够可靠的资料，先不乱下结论。");
    expect(result.answer).not.toContain("旅行者创作平台");
    expect(result.answer).not.toContain("&hellip;");
    expect(result.external).toEqual([]);
    expect(
      result.answerParagraphs?.flatMap((paragraph) => paragraph.citationIds) ?? [],
    ).toEqual([]);
  });

  it("drops both final-live browser shell and unresolved search URL failures", async () => {
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_BASE_URL = "https://api.example.test";
    delete process.env.https_proxy;
    delete process.env.HTTPS_PROXY;
    delete process.env.http_proxy;
    delete process.env.HTTP_PROXY;
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("cold_start_timeout");
      }),
    );

    const question = "婕德经历了怎样的变化？";
    const dirty: Citation[] = [
      {
        id: "live-browser-shell",
        title: "角色条目",
        url: "https://example.com/live-browser-shell",
        sourceName: "Reference Wiki",
        sourceKind: "trusted_wiki",
        credibility: "trusted_wiki",
        factStatus: "trusted_secondary",
        excerpt:
          "This site requires JavaScript enabled. Please check your browser settings... 欢迎正在阅读这个条目的旅行者协助 编辑本条目...萌娘百科祝各位旅行者在本站度过愉快的时光!",
        external: true,
        crossLanguage: false,
      },
      {
        id: "unresolved-search-result",
        title: "聊一聊婕德的故事(剧透警告)-原神社区-米游社",
        url: "https://www.yahoo.com/",
        sourceName: "yahoo.com",
        sourceKind: "unknown_web",
        credibility: "unknown_web",
        factStatus: "community_analysis",
        excerpt: "婕德失去亲人后寻找归属，最终选择自己的道路。",
        external: true,
        crossLanguage: false,
      },
    ];
    const result = await generateGroundedResponse({
      question,
      language: "zh-CN",
      profile: "returning",
      entries: [],
      external: dirty,
      understanding: ruleUnderstandQuestion(question, "zh-CN"),
    });

    expect(result.answer).toBe("派蒙暂时没找到足够可靠的资料，先不乱下结论。");
    expect(result.external).toEqual([]);
    expect(result.citedSourceIds).toEqual([]);
    expect(
      result.answerParagraphs?.flatMap((paragraph) => paragraph.citationIds) ?? [],
    ).toEqual([]);
  });

  it("sanitizes a supported external citation before returning it from a cold character-arc fallback", async () => {
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_BASE_URL = "https://api.example.test";
    delete process.env.https_proxy;
    delete process.env.HTTPS_PROXY;
    delete process.env.http_proxy;
    delete process.env.HTTP_PROXY;
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("cold_start_timeout");
    }));

    const supportedRawEntity: Citation = {
      id: "raw-entity",
      title: "婕德&hellip;",
      url: "https://example.com/jeht-arc",
      sourceName: "剧情文本索引",
      sourceKind: "game_text",
      credibility: "official",
      factStatus: "official_explicit",
      excerpt: "婕德失去父亲后渴望归属，后来认清芭别尔的陷害&hellip;",
      external: true,
      crossLanguage: false,
    };

    const question = "婕德经历了怎样的变化？";
    const result = await generateGroundedResponse({
      question,
      language: "zh-CN",
      profile: "returning",
      entries: [],
      external: [supportedRawEntity],
      understanding: ruleUnderstandQuestion(question, "zh-CN"),
    });

    expect(result.answer).toBe(
      "目前找到的资料还不足以稳妥回答“婕德”这个问题。派蒙先不把外部片段硬拼成结论，相关原文保留在下方来源里。",
    );
    expect(result.answer).not.toContain("&hellip;");
    expect(result.external).toHaveLength(1);
    expect(result.external[0]?.title).toBe("婕德…");
    expect(result.external[0]?.excerpt).toContain("陷害…");
    expect(
      result.external.map((citation) => `${citation.title} ${citation.excerpt}`).join(" "),
    ).not.toContain("&hellip;");
    expect(result.external[0]?.url).toBe("https://example.com/jeht-arc");
    expect(result.external[0]?.sourceName).toBe("剧情文本索引");
  });

  it("returns no external or cited evidence when a cold character-arc fallback has only a short transcript", async () => {
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_BASE_URL = "https://api.example.test";
    delete process.env.https_proxy;
    delete process.env.HTTPS_PROXY;
    delete process.env.http_proxy;
    delete process.env.HTTP_PROXY;
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("cold_start_timeout");
    }));

    const question = "婕德经历了怎样的变化？";
    const result = await generateGroundedResponse({
      question,
      language: "zh-CN",
      profile: "returning",
      entries: [],
      external: [
        {
          id: "short-transcript",
          title: "婕德讨论",
          url: "https://example.com/short-transcript",
          sourceName: "社区讨论",
          sourceKind: "community",
          credibility: "community",
          factStatus: "community_analysis",
          excerpt: "派蒙:想念婕德和奔奔了... 冻梨:你还别说，这段剧情确实让人难忘。",
          external: true,
          crossLanguage: false,
        },
      ],
      understanding: ruleUnderstandQuestion(question, "zh-CN"),
    });

    expect(result.answer).toBe("派蒙暂时没找到足够可靠的资料，先不乱下结论。");
    expect(result.external).toEqual([]);
    expect(result.citedSourceIds).toEqual([]);
    expect(
      result.answerParagraphs?.flatMap((paragraph) => paragraph.citationIds) ?? [],
    ).toEqual([]);
  });

  it("returns no external or cited evidence when a cold character-arc fallback has only a promotional listing shell", async () => {
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_BASE_URL = "https://api.example.test";
    delete process.env.https_proxy;
    delete process.env.HTTPS_PROXY;
    delete process.env.http_proxy;
    delete process.env.HTTP_PROXY;
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("cold_start_timeout");
    }));

    const question = "婕德经历了怎样的变化？";
    const result = await generateGroundedResponse({
      question,
      language: "zh-CN",
      profile: "returning",
      entries: [],
      external: [
        {
          id: "delivery-listing-shell",
          title: "沙漠故事视频",
          url: "https://example.com/delivery-listing-shell",
          sourceName: "视频资料",
          sourceKind: "community",
          credibility: "community",
          factStatus: "community_analysis",
          excerpt:
            "更多原神实用攻略教学,爆笑沙雕集锦,你所不知道的原神游戏知识,热门原神游戏视频7*24小时持续更新,尽在哔哩哔哩bilibili 视频播放量 241、弹幕量 0、点赞数 6、投硬币枚数 0...",
          external: true,
          crossLanguage: false,
        },
      ],
      understanding: ruleUnderstandQuestion(question, "zh-CN"),
    });

    expect(result.answer).toBe("派蒙暂时没找到足够可靠的资料，先不乱下结论。");
    expect(result.external).toEqual([]);
    expect(result.citedSourceIds).toEqual([]);
    expect(
      result.answerParagraphs?.flatMap((paragraph) => paragraph.citationIds) ?? [],
    ).toEqual([]);
  });

  it("does not synthesize a verified character arc from community-only stage coverage", async () => {
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_BASE_URL = "https://api.example.test";
    delete process.env.https_proxy;
    delete process.env.HTTPS_PROXY;
    delete process.env.http_proxy;
    delete process.env.HTTP_PROXY;
    let apiCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input));
        if (url.hostname === "api.example.test") {
          apiCalls += 1;
          return new Response(
            JSON.stringify({ choices: [{ message: { content: "not json" } }] }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (url.pathname.includes("api.php")) {
          return new Response(JSON.stringify({ query: { search: [], pages: {} } }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response("", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        });
      }),
    );

    const question = "婕德经历了怎么的变化？";
    const external: Citation[] = [
      {
        id: "community-start",
        title: "婕德成长讨论",
        url: "https://example.com/community-start",
        sourceName: "社区讨论",
        sourceKind: "community",
        credibility: "community",
        factStatus: "community_analysis",
        excerpt: "婕德最初依赖父亲；父亲离世后，她被塔尼特接纳。",
        external: true,
        crossLanguage: false,
      },
      {
        id: "community-end",
        title: "婕德后续讨论",
        url: "https://example.com/community-end",
        sourceName: "社区讨论",
        sourceKind: "community",
        credibility: "community",
        factStatus: "community_analysis",
        excerpt: "她认清芭别尔的背叛后与部族决裂，最终选择自己的道路。",
        external: true,
        crossLanguage: false,
      },
    ];

    const result = await generateGroundedResponse({
      question,
      language: "zh-CN",
      profile: "story",
      entries: [],
      external,
      deepStory: true,
      understanding: ruleUnderstandQuestion(question, "zh-CN"),
    });

    expect(apiCalls).toBe(0);
    expect(result.answer).toContain("资料还不足以稳妥回答");
    expect(result.citedSourceIds).toEqual([]);
    expect(result.external).toHaveLength(2);
  });

  it("keeps a coherent cited character-arc answer from clean Chinese evidence", async () => {
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_BASE_URL = "https://api.example.test";
    delete process.env.https_proxy;
    delete process.env.HTTPS_PROXY;
    delete process.env.http_proxy;
    delete process.env.HTTP_PROXY;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input));
        if (url.hostname === "api.example.test") {
          return new Response(
            JSON.stringify({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      paragraphs: [
                        {
                          text: "婕德在失去父亲后渴望归属。",
                          citationIds: ["external-1"],
                        },
                        {
                          text: "她因此加入塔尼特，并把芭别尔视作家人。",
                          citationIds: ["external-1"],
                        },
                        {
                          text: "认清芭别尔的陷害与操控后，她与虚假的家族决裂。",
                          citationIds: ["external-2"],
                        },
                        {
                          text: "最终她不再依附别人给出的归属，决定选择自己的道路。",
                          citationIds: ["external-2"],
                        },
                      ],
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
        if (url.pathname.includes("api.php")) {
          return new Response(JSON.stringify({ query: { search: [] } }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response("", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        });
      }),
    );

    const citations: Citation[] = [
      {
        id: "arc-start",
        title: "永恒的葱茏之梦",
        url: "https://example.com/arc-start",
        sourceName: "剧情文本索引",
        sourceKind: "game_text",
        credibility: "official",
        factStatus: "official_explicit",
        excerpt: "失去父亲后，婕德渴望新的归属，并把塔尼特和芭别尔视为家人。",
        external: true,
        crossLanguage: false,
      },
      {
        id: "arc-end",
        title: "因为她的罪恶滔天…",
        url: "https://example.com/arc-end",
        sourceName: "剧情文本索引",
        sourceKind: "game_text",
        credibility: "official",
        factStatus: "official_explicit",
        excerpt: "婕德认清芭别尔的陷害后与塔尼特决裂，决定以自己的名字选择道路。",
        external: true,
        crossLanguage: false,
      },
    ];

    const question = "婕德经历了怎样的变化？";
    const result = await generateGroundedResponse({
      question,
      language: "zh-CN",
      profile: "returning",
      entries: [],
      external: citations,
      understanding: ruleUnderstandQuestion(question, "zh-CN"),
    });

    expect(result.answer).toContain("失去父亲后渴望归属");
    expect(result.answer).toContain("认清芭别尔的陷害");
    expect(result.answer).toContain("选择自己的道路");
    expect(result.answer).not.toContain("目前找到的资料还不足以稳妥回答");
    expect(result.answerParagraphs).toHaveLength(4);
    expect(
      result.answerParagraphs?.every((paragraph) => paragraph.citationIds.length > 0),
    ).toBe(true);
    expect(result.answer).not.toContain("旅行者创作平台");
    expect(result.citedSourceIds).toEqual(
      expect.arrayContaining(["external-1", "external-2"]),
    );
  });

  it.each([
    {
      name: "Tsaritsa atomic relationship",
      question: "冰之女皇与愚人众执行官之间是什么关系？",
      category: "character" as const,
      entries: factionKnowledgeEntries.filter(
        (candidate) => candidate.language === "zh-CN",
      ),
    },
    {
      name: "Fontaine catch-up",
      question: "我停在枫丹，现在还能看懂目标版本吗？",
      category: "version_overview" as const,
      entries: knowledgeEntries.filter(
        (candidate) =>
          candidate.conceptId === "fontaine-bridge" &&
          candidate.language === "zh-CN",
      ),
    },
    {
      name: "generic layered puzzle hint",
      question: "这个机械机关我卡住了，先给一点提示。",
      category: "gameplay" as const,
      entries: knowledgeEntries.filter(
        (candidate) =>
          candidate.conceptId === "mechanical-puzzle" &&
          candidate.language === "zh-CN",
      ),
    },
  ])("answers $name locally without calling an API", async (testCase) => {
    process.env.LLM_API_KEY = "test-key";
    delete process.env.https_proxy;
    delete process.env.HTTPS_PROXY;
    delete process.env.http_proxy;
    delete process.env.HTTP_PROXY;
    const fetchMock = vi.fn(() => {
      throw new Error("Local evidence must not call the network");
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateGroundedResponse({
      question: testCase.question,
      language: "zh-CN",
      profile: "returning",
      category: testCase.category,
      entries: testCase.entries,
      external: [],
      understanding: ruleUnderstandQuestion(testCase.question, "zh-CN"),
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.external).toEqual([]);
    expect(result.answer).not.toMatch(/还没找到可靠资料|不乱下结论/u);
    expect(result.citedSourceIds.length).toBeGreaterThan(0);
  });
});
