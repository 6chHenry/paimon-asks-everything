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

function isModelKnowledgeRequest(init?: RequestInit) {
  if (typeof init?.body !== "string") return false;
  try {
    const body = JSON.parse(init.body) as {
      messages?: Array<{ content?: unknown }>;
    };
    return body.messages?.some(
      (message) =>
        typeof message.content === "string" &&
        message.content.includes("stable Genshin Impact knowledge already known"),
    );
  } catch {
    return false;
  }
}

function emptyNetworkResponse(input: RequestInfo | URL) {
  const url = new URL(String(input));
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
}

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
    expect(result.citations).toHaveLength(1);
    expect(result.citations.every((citation) => !citation.external)).toBe(true);
    expect(result.verificationStatus).toBe("verified");
    expect(result.answer).not.toMatch(
      /枫丹植物原型大考据|枫丹美食原型与其背后的故事|雷穆斯话音落下|跳转到内容 主菜单|编辑入门/u,
    );
    expect(result.eventRecorded).toBe(true);
  });

  it("answers a generic mechanical puzzle with verified layered local guidance", async () => {
    const fetchMock = vi.mocked(fetch);
    const result = await runAgent(
      {
        ...base,
        profile: "exploration",
        spoilerPreference: "none",
        focus: ["gameplay"],
        question: "这个机械机关我卡住了，先给一点提示。",
      },
      { recordEvent: false },
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.status).toBe("answered");
    expect(result.answerMode).toBe("layered_hint");
    expect(result.verificationStatus).toBe("verified");
    expect(result.citations).toHaveLength(1);
    expect(result.citations.every((citation) => !citation.external)).toBe(true);
    expect(result.answer).toMatch(/观察|颜色|运动规律|能量|顺序/u);
    expect(result.answer).not.toMatch(
      /供能超载而失能|应急能源进行低限度的战斗行动|进入「荡除模式」|液流动量|攻坚特化型机关|压制特化型机关|秘源机兵·统御械/u,
    );
  });

  it("answers the Tsaritsa-Harbinger relationship from one verified local fact", async () => {
    const fetchMock = vi.mocked(fetch);
    const result = await runAgent(
      {
        ...base,
        focus: ["story", "character"],
        question: "冰之女皇与愚人众执行官之间是什么关系？",
      },
      { recordEvent: false },
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.status).toBe("answered");
    expect(result.verificationStatus).toBe("verified");
    expect(result.confidence).toBe("high");
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0]).toMatchObject({
      id: "source-1",
      external: false,
      sourceKind: "trusted_wiki",
    });
    expect(result.answer).toContain("最高领导者");
    expect(result.answer).toContain("个人动机并不完全相同");
  });

  it("uses bounded model knowledge for a stable zero-evidence relationship", async () => {
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_BASE_URL = "https://api.example.test";
    delete process.env.https_proxy;
    delete process.env.HTTPS_PROXY;
    delete process.env.http_proxy;
    delete process.env.HTTP_PROXY;
    let modelKnowledgeCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input));
        if (url.hostname === "api.example.test") {
          if (isModelKnowledgeRequest(init)) {
            modelKnowledgeCalls += 1;
            return new Response(
              JSON.stringify({
                choices: [
                  {
                    message: {
                      content: JSON.stringify({
                        paragraphs: [
                          {
                            text: "雷电将军是雷电影制造的人偶，用来代替她治理稻妻。",
                          },
                          {
                            text: "两者共享将军这一身份，但雷电影是创造者与真实意识主体。",
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
          return new Response(
            JSON.stringify({ choices: [{ message: { content: "not json" } }] }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return emptyNetworkResponse(input);
      }),
    );

    const result = await runAgent(
      {
        ...base,
        focus: ["story", "character"],
        question: "雷电将军与雷电影是什么关系？",
      },
      { recordEvent: false },
    );

    expect(modelKnowledgeCalls).toBe(1);
    expect(result.status).toBe("answered");
    expect(result.verificationStatus).toBe("model_knowledge");
    expect(result.answerMode).toBe("limited_answer");
    expect(result.confidence).toBe("low");
    expect(result.citations).toEqual([]);
    expect(result.claims).toEqual([]);
    expect(result.usedExternalSources).toBe(false);
    expect(result.answer).toContain("雷电影制造的人偶");
  });

  it.each([
    ["current implementation", "爱可菲现在实装了吗？", false],
    ["character arc", "婕德经历了怎样的成长？", true],
    ["full ending", "讲讲婕德的完整剧情和结局", true],
    ["leak", "爆料里说了什么？", false],
    [
      "strong negative",
      "雷电将军与雷电影是什么关系，两人从未见过吗？",
      false,
    ],
  ])("does not use model knowledge for %s", async (_name, question, confirmedHighRisk) => {
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_BASE_URL = "https://api.example.test";
    delete process.env.https_proxy;
    delete process.env.HTTPS_PROXY;
    delete process.env.http_proxy;
    delete process.env.HTTP_PROXY;
    let modelKnowledgeCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input));
        if (url.hostname === "api.example.test") {
          if (isModelKnowledgeRequest(init)) modelKnowledgeCalls += 1;
          return new Response(
            JSON.stringify({ choices: [{ message: { content: "not json" } }] }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return emptyNetworkResponse(input);
      }),
    );

    await runAgent(
      { ...base, focus: ["story", "character"], question },
      { recordEvent: false, confirmedHighRisk },
    );

    expect(modelKnowledgeCalls).toBe(0);
  });

  it("does not use model knowledge after cancellation", async () => {
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_BASE_URL = "https://api.example.test";
    delete process.env.https_proxy;
    delete process.env.HTTPS_PROXY;
    delete process.env.http_proxy;
    delete process.env.HTTP_PROXY;
    const controller = new AbortController();
    controller.abort();
    let modelKnowledgeCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input));
        if (url.hostname === "api.example.test") {
          if (isModelKnowledgeRequest(init)) modelKnowledgeCalls += 1;
          return new Response(
            JSON.stringify({ choices: [{ message: { content: "not json" } }] }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return emptyNetworkResponse(input);
      }),
    );

    const result = await runAgent(
      {
        ...base,
        focus: ["story", "character"],
        question: "雷电将军与雷电影是什么关系？",
      },
      { recordEvent: false, signal: controller.signal },
    );

    expect(modelKnowledgeCalls).toBe(0);
    expect(result.status).toBe("insufficient_evidence");
  });

  it("keeps the safe boundary when model knowledge JSON is invalid", async () => {
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_BASE_URL = "https://api.example.test";
    delete process.env.https_proxy;
    delete process.env.HTTPS_PROXY;
    delete process.env.http_proxy;
    delete process.env.HTTP_PROXY;
    let modelKnowledgeCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input));
        if (url.hostname === "api.example.test") {
          if (isModelKnowledgeRequest(init)) modelKnowledgeCalls += 1;
          return new Response(
            JSON.stringify({ choices: [{ message: { content: "not json" } }] }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return emptyNetworkResponse(input);
      }),
    );

    const result = await runAgent(
      {
        ...base,
        focus: ["story", "character"],
        question: "雷电将军与雷电影是什么关系？",
      },
      { recordEvent: false },
    );

    expect(modelKnowledgeCalls).toBe(1);
    expect(result.status).toBe("insufficient_evidence");
    expect(result.answer).toBe("唔……派蒙还没找到可靠资料。先不乱下结论啦。");
    expect(result.verificationStatus).toBeUndefined();
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
    expect(result.verificationStatus).toBeUndefined();
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

  it.each([
    "婕德经历了怎么的变化？",
    "婕德经历了怎样的变化？",
    "婕德有什么成长？",
    "婕德是如何转变的？",
  ])(
    "requires spoiler confirmation for a character-arc question: %s",
    async (question) => {
      const result = await runAgent(
        {
          ...base,
          profile: "story",
          progress: "sumeru",
          spoilerPreference: "full",
          focus: ["story", "character"],
          question,
        },
        { recordEvent: false },
      );

      expect(result.status).toBe("spoiler_confirmation_required");
      expect(result.confirmationToken).toBeTruthy();
      expect(result.spoilerAction).toBe("confirmation_required");
    },
  );

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

  it("answers a Chinese question in Chinese even when UI preference is English", async () => {
    const result = await runAgent(
      {
        ...base,
        language: "en",
        focus: ["story", "character"],
        question: "桑多涅和阿兰是什么关系？",
      },
      { recordEvent: false },
    );

    expect(result.language).toBe("zh-CN");
    expect(result.answer).toMatch(/[\u3400-\u9fff]/u);
    expect(result.answer).toContain("桑多涅");
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
    let modelKnowledgeCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input));
        if (url.hostname === "api.example.test") {
          if (isModelKnowledgeRequest(init)) modelKnowledgeCalls += 1;
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
    expect(modelKnowledgeCalls).toBe(0);
  });

  it("treats directly cited trusted wiki evidence as medium confidence, not speculation", async () => {
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_BASE_URL = "https://api.example.test";
    process.env.LLM_MODEL = "deepseek-v4-flash";
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
                  title: "御前决斗",
                  snippet:
                    "女士在御前决斗中败北，随后被雷电将军处决。",
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
    expect(result.verificationStatus).toBeUndefined();
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
