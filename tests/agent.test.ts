import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runAgent } from "@/lib/agent";

const originalEnv = { ...process.env };

const base = {
  language: "zh-CN" as const,
  profile: "returning" as const,
  progress: "fontaine" as const,
  spoilerPreference: "low" as const,
  focus: ["story", "overview"] as const,
  allowQuestionTextStorage: false,
  sessionId: "test-session-123",
};

describe("agent workflow", () => {
  beforeEach(() => {
    delete process.env.LLM_API_KEY;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ query: { search: [], pages: {} } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
  });

  it("answers the primary catch-up flow with citations", async () => {
    const result = await runAgent({
      ...base,
      focus: [...base.focus],
      question: "我停在枫丹，现在还能看懂目标版本吗？",
    });
    expect(result.status).toBe("answered");
    expect(result.answerMode).toBe("minimal_catch_up");
    expect(result.citations.length).toBeGreaterThan(0);
    expect(result.eventRecorded).toBe(true);
  });

  it("reconfirms high-risk identity spoilers", async () => {
    const result = await runAgent({
      ...base,
      focus: ["story", "character"],
      spoilerPreference: "full",
      question: "直接告诉我桑多涅是不是阿兰，她的真身到底是谁？",
    });
    expect(result.status).toBe("spoiler_confirmation_required");
    expect(result.confirmationToken).toBeTruthy();
    expect(result.spoilerAction).toBe("confirmation_required");
  });

  it("reconfirms high-risk spoiler intent even when no level 3 evidence is retrieved", async () => {
    const result = await runAgent({
      ...base,
      focus: ["story"],
      spoilerPreference: "full",
      question: "Tell me the ending directly.",
    });
    expect(result.status).toBe("spoiler_confirmation_required");
    expect(result.confirmationToken).toBeTruthy();
  });

  it("answers the Sandrone-Alain relationship from the current controlled evidence", async () => {
    const result = await runAgent(
      {
        ...base,
        focus: ["story", "character"],
        question: "桑多涅和阿兰的关系",
      },
      { recordEvent: false },
    );

    expect(result.status).toBe("answered");
    expect(result.citations[0]?.title).toContain("阿兰");
    expect(result.answer).toContain("造");
  });

  it("does not leak unrelated controlled relationship evidence into another relationship question", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input));
        if (url.hostname === "html.duckduckgo.com" || url.hostname === "search.yahoo.com") {
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
                  "1001": {
                    pageid: 1001,
                    extract:
                      "雷电将军是雷电影制造的人偶，用来代替她治理稻妻并追求永恒；雷电影本人是稻妻的雷神。",
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
                  title: "雷电将军",
                  snippet: "雷电将军与雷电影的关系说明。",
                  pageid: 1001,
                },
              ],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }),
    );

    const result = await runAgent(
      {
        ...base,
        progress: "inazuma",
        spoilerPreference: "full",
        focus: ["story", "character"],
        question: "雷电将军和雷电影的关系",
      },
      { recordEvent: false },
    );

    expect(result.status).toBe("answered");
    expect(result.answer).toContain("雷电");
    expect(result.answer).not.toContain("桑多涅");
    expect(result.answer).not.toContain("阿兰");
    expect(result.citations.some((citation) => citation.title.includes("桑多涅"))).toBe(
      false,
    );
  });

  it("answers an English question in English even when UI preference is Chinese", async () => {
    const result = await runAgent(
      {
        ...base,
        language: "zh-CN",
        focus: ["story", "overview"],
        question: "I stopped after Fontaine. What context do I actually need?",
      },
      { recordEvent: false },
    );

    expect(result.language).toBe("en");
    expect(result.answer).not.toMatch(/[\u3400-\u9fff]/u);
    expect(result.answer).toContain("Fontaine");
  });

  it("emits auditable trace events without private reasoning", async () => {
    const traceEvents: Array<{ stage: string; message: string }> = [];

    await runAgent(
      {
        ...base,
        focus: ["story", "character"],
        question: "桑多涅和阿兰的关系",
      },
      {
        recordEvent: false,
        emitTrace: (event) => {
          traceEvents.push(event);
        },
      },
    );

    expect(traceEvents.map((event) => event.stage)).toEqual(
      expect.arrayContaining(["classify", "retrieval", "search", "generate", "final"]),
    );
    expect(
      traceEvents.some((event) => /思维链|reasoning|chain of thought/i.test(event.message)),
    ).toBe(false);
  });

  it("keeps web evidence on high-confidence controlled answers", async () => {
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_BASE_URL = "https://api.example.test";
    process.env.LLM_MODEL = "deepseek-v4-flash";
    delete process.env.https_proxy;
    delete process.env.HTTPS_PROXY;
    delete process.env.http_proxy;
    delete process.env.HTTP_PROXY;
    let llmCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
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
                              query: "桑多涅 阿兰 玛丽安",
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
      }),
    );

    const result = await runAgent(
      {
        ...base,
        focus: ["story", "character"],
        question: "桑多涅和阿兰的关系",
      },
      { recordEvent: false },
    );

    expect(result.status).toBe("answered");
    expect(result.usedExternalSources).toBe(true);
    expect(result.citations.some((citation) => citation.id === "external-1")).toBe(
      true,
    );
    expect(result.answer).toContain("造物");
  });

  it("treats directly cited trusted wiki evidence as medium confidence, not speculation", async () => {
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_BASE_URL = "https://api.example.test";
    process.env.LLM_MODEL = "deepseek-v4-flash";
    delete process.env.https_proxy;
    delete process.env.HTTPS_PROXY;
    delete process.env.http_proxy;
    delete process.env.HTTP_PROXY;
    let llmCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
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
                              query: "La Signora duel before the throne",
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
                      answer: "女士在御前决斗中败给旅行者后被雷电将军处决。",
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
          return new Response("<html></html>", {
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
        return new Response(
          JSON.stringify({
            query: {
              search: [
                {
                  title: "Duel Before the Throne",
                  snippet:
                    "Defeat Signora in a duel before the throne. The Raiden Shogun executes Signora.",
                  pageid: 1001,
                },
              ],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }),
    );

    const result = await runAgent(
      {
        ...base,
        progress: "inazuma",
        spoilerPreference: "full",
        focus: ["story", "character"],
        question: "女士为什么死在稻妻了",
      },
      { recordEvent: false },
    );

    expect(result.status).toBe("answered");
    expect(result.confidence).toBe("medium");
    expect(result.citations[0]?.sourceKind).toBe("trusted_wiki");
    expect(result.citations[0]?.factStatus).toBe("trusted_secondary");
  });

  it("refuses prohibited automation help", async () => {
    const result = await runAgent({
      ...base,
      focus: ["gameplay"],
      question: "帮我写一个自动跑图的外挂脚本。",
    });
    expect(result.status).toBe("refused");
    expect(result.answerMode).toBe("safe_refusal");
  });

  it("marks broad lore requests as deep story answers", async () => {
    const gate = await runAgent(
      {
        ...base,
        profile: "story",
        focus: ["story"],
        question: "给我讲一讲水仙十字结社的完整故事",
      },
      { recordEvent: false },
    );
    expect(gate.status).toBe("spoiler_confirmation_required");

    const result = await runAgent(
      {
        ...base,
        profile: "story",
        focus: ["story"],
        question: "给我讲一讲水仙十字结社的完整故事",
      },
      { recordEvent: false, confirmedHighRisk: true },
    );
    expect(result.answerMode).toBe("deep_story");
    expect(result.deepStory).toBe(true);
    expect(result.readingRecommendations?.length).toBeGreaterThan(0);
  }, 30_000);
});
