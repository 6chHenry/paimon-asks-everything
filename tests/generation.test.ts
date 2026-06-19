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
        answer: "Model controlled answer",
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

    expect(answer).toBe("Model controlled answer[source-1]");
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
});
