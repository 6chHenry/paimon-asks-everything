import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runAgent } from "@/lib/agent";
import {
  ruleUnderstandQuestion,
  searchPlanFromUnderstanding,
} from "@/lib/question-understanding";
import type { ChatRequest } from "@/lib/schemas";

const originalEnv = { ...process.env };

const base: Omit<ChatRequest, "question"> = {
  language: "zh-CN" as const,
  profile: "story" as const,
  progress: "fontaine" as const,
  spoilerPreference: "full" as const,
  focus: ["story", "character"],
  allowQuestionTextStorage: false,
  sessionId: "answer-capability-integration",
};

function isModelKnowledgeRequest(init?: RequestInit) {
  if (typeof init?.body !== "string") return false;
  try {
    const body = JSON.parse(init.body) as {
      messages?: Array<{ content?: unknown }>;
    };
    return Boolean(
      body.messages?.some(
        (message) =>
          typeof message.content === "string" &&
          message.content.includes("stable Genshin Impact knowledge already known"),
      ),
    );
  } catch {
    return false;
  }
}

function emptyResponse(input: RequestInfo | URL) {
  const url = new URL(String(input));
  if (url.pathname.includes("api.php")) {
    return new Response(
      JSON.stringify({ query: { search: [], pages: {} } }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }
  return new Response("", {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
}

describe("answer capability integration", () => {
  beforeEach(() => {
    delete process.env.LLM_API_KEY;
    delete process.env.https_proxy;
    delete process.env.HTTPS_PROXY;
    delete process.env.http_proxy;
    delete process.env.HTTP_PROXY;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => emptyResponse(input)));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
  });

  it("answers the Tsaritsa relation from one same-language controlled fact", async () => {
    const fetchMock = vi.mocked(fetch);
    const result = await runAgent(
      {
        ...base,
        question: "冰之女皇与愚人众执行官之间是什么关系？",
      },
      { recordEvent: false },
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      status: "answered",
      verificationStatus: "verified",
      confidence: "high",
      usedExternalSources: false,
    });
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0]).toMatchObject({
      external: false,
      crossLanguage: false,
      sourceKind: "trusted_wiki",
    });
  });

  it.each([
    "婕德经历了怎样的成长？",
    "婕德经历了怎么的变化？",
  ])("keeps incomplete or dirty Jeht evidence behind the safe boundary: %s", async (question) => {
    const understanding = ruleUnderstandQuestion(question, "zh-CN");
    expect(understanding.intent).toBe("story");
    expect(searchPlanFromUnderstanding(understanding, question).storyScope).toBe(
      "character_arc",
    );

    const gate = await runAgent(
      { ...base, question },
      { recordEvent: false },
    );
    expect(gate.status).toBe("spoiler_confirmation_required");

    const result = await runAgent(
      { ...base, question },
      { recordEvent: false, confirmedHighRisk: true },
    );
    expect(result.status).toBe("insufficient_evidence");
    expect(result.verificationStatus).toBeUndefined();
    expect(result.answer).not.toMatch(
      /Created with Sketch|跳转到内容|主菜单|旅行者创作平台|角色列表|液流动量/u,
    );
  });

  it("returns a coherent verified deep-story answer for a clean four-stage Jeht fixture", async () => {
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_BASE_URL = "https://api.example.test";
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
                          text: "婕德失去父亲后急切地寻找新的归属。",
                          citationIds: ["external-1"],
                        },
                        {
                          text: "她一度把塔尼特和芭别尔当作家人。",
                          citationIds: ["external-2"],
                        },
                        {
                          text: "认清芭别尔的陷害与操控后，她与虚假的家族决裂。",
                          citationIds: ["external-3"],
                        },
                        {
                          text: "最终她不再依附别人给出的身份，决定以自己的名字选择道路。",
                          citationIds: ["external-4"],
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
          return new Response(
            JSON.stringify({
              query: {
                search: [
                  {
                    title: "婕德与父亲",
                    snippet: "婕德失去父亲后渴望新的归属。",
                    pageid: 4101,
                  },
                  {
                    title: "婕德与塔尼特",
                    snippet: "婕德一度把塔尼特和芭别尔视为家人。",
                    pageid: 4102,
                  },
                  {
                    title: "婕德与芭别尔决裂",
                    snippet: "婕德认清芭别尔的陷害与操控后和塔尼特决裂。",
                    pageid: 4103,
                  },
                  {
                    title: "婕德选择自己的道路",
                    snippet: "婕德决定以自己的名字选择未来的道路。",
                    pageid: 4104,
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
      }),
    );

    const result = await runAgent(
      { ...base, question: "婕德经历了怎样的成长？" },
      { recordEvent: false, confirmedHighRisk: true },
    );

    expect(result.status).toBe("answered");
    expect(result.answerMode).toBe("deep_story");
    expect(result.verificationStatus).toBe("verified");
    expect(result.answerParagraphs).toHaveLength(4);
    expect(
      result.answerParagraphs?.every((paragraph) => paragraph.citationIds.length > 0),
    ).toBe(true);
    expect(result.answer).toContain("与虚假的家族决裂");
    expect(result.answer).toContain("以自己的名字选择道路");
    expect(result.answer).not.toMatch(
      /Created with Sketch|跳转到内容|主菜单|旅行者创作平台|角色列表|说：|：.*：/u,
    );
  });

  it("uses low-confidence uncited model knowledge only for the stable Raiden relation", async () => {
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_BASE_URL = "https://api.example.test";
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
                          { text: "雷电将军是雷电影制造、用于治理稻妻的人偶。" },
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
        return emptyResponse(input);
      }),
    );

    const result = await runAgent(
      { ...base, question: "雷电将军与雷电影是什么关系？" },
      { recordEvent: false },
    );

    expect(modelKnowledgeCalls).toBe(1);
    expect(result).toMatchObject({
      status: "answered",
      verificationStatus: "model_knowledge",
      confidence: "low",
      usedExternalSources: false,
    });
    expect(result.citations).toEqual([]);
  });

  it("never uses model knowledge for a current-release question", async () => {
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_BASE_URL = "https://api.example.test";
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
        return emptyResponse(input);
      }),
    );

    const result = await runAgent(
      { ...base, question: "爱可菲现在实装了吗？" },
      { recordEvent: false },
    );

    expect(modelKnowledgeCalls).toBe(0);
    expect(result.verificationStatus).not.toBe("model_knowledge");
  });

  it.each([
    {
      question: "我停在枫丹，现在还能看懂目标版本吗？",
      profile: "returning" as const,
      focus: ["story", "overview"] as const,
      answerMode: "minimal_catch_up",
      required: /机械生命|枫丹科学院|水仙十字|人格|记忆与机器/u,
    },
    {
      question: "这个机械机关我卡住了，先给一点提示。",
      profile: "exploration" as const,
      focus: ["gameplay"] as const,
      answerMode: "layered_hint",
      required: /观察|颜色|运动规律|能量|顺序/u,
    },
  ])("keeps the fixed Chinese quality contract: $answerMode", async (testCase) => {
    const fetchMock = vi.mocked(fetch);
    const result = await runAgent(
      {
        ...base,
        profile: testCase.profile,
        spoilerPreference: "low",
        focus: [...testCase.focus],
        question: testCase.question,
      },
      { recordEvent: false },
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.status).toBe("answered");
    expect(result.answerMode).toBe(testCase.answerMode);
    expect(result.verificationStatus).toBe("verified");
    expect(result.citations).toHaveLength(1);
    expect(result.citations.every((citation) => !citation.external)).toBe(true);
    expect(result.answer).toMatch(testCase.required);
    expect(result.answer).not.toMatch(
      /枫丹植物原型大考据|枫丹美食原型与其背后的故事|雷穆斯话音落下|跳转到内容 主菜单|编辑入门|供能超载而失能|液流动量|攻坚特化型机关|秘源机兵·统御械/u,
    );
  });
});
