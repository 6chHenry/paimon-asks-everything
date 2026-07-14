import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  canUseModelKnowledgeFallback,
  generateModelKnowledgeAnswer,
} from "@/lib/model-knowledge";

const originalEnv = { ...process.env };

const policyBase = {
  category: "character" as const,
  intent: "relationship" as const,
  confirmedHighRisk: false,
};

describe("model knowledge fallback policy", () => {
  it.each([
    {
      question: "雷电将军与雷电影是什么关系？",
      input: policyBase,
      expected: true,
    },
    {
      question: "冰之女皇领导谁？",
      input: { ...policyBase, intent: "identity" as const },
      expected: true,
    },
    {
      question: "婕德经历了怎样的成长？",
      input: { ...policyBase, intent: "story" as const, storyScope: "character_arc" as const },
      expected: false,
    },
    {
      question: "讲讲婕德的完整剧情和结局",
      input: { ...policyBase, category: "story" as const, intent: "story" as const },
      expected: false,
    },
    {
      question: "爱可菲现在实装了吗？",
      input: { ...policyBase, intent: "current_status" as const },
      expected: false,
    },
    {
      question: "下个卡池是谁？",
      input: { ...policyBase, intent: "identity" as const },
      expected: false,
    },
    {
      question: "爆料里说了什么？",
      input: { ...policyBase, category: "story" as const, intent: "general" as const },
      expected: false,
    },
    {
      question: "两人从未见过吗？",
      input: policyBase,
      expected: false,
    },
    {
      question: "冰之女皇领导谁？",
      input: { ...policyBase, intent: "identity" as const, confirmedHighRisk: true },
      expected: false,
    },
  ])("returns $expected for $question", ({ question, input, expected }) => {
    expect(canUseModelKnowledgeFallback({ question, ...input })).toBe(expected);
  });
});

describe("model knowledge response validation", () => {
  beforeEach(() => {
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_BASE_URL = "https://api.example.test";
    delete process.env.https_proxy;
    delete process.env.HTTPS_PROXY;
    delete process.env.http_proxy;
    delete process.env.HTTP_PROXY;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
  });

  function mockCompletion(content: string) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ choices: [{ message: { content } }] }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
  }

  it("accepts up to four clean paragraphs without citation ids", async () => {
    mockCompletion(
      JSON.stringify({
        paragraphs: [
          { text: "雷电将军是雷电影制造的人偶，用来代替她治理稻妻。" },
          { text: "两者共享将军这一身份，但并不是两个普通人类角色。" },
        ],
      }),
    );

    await expect(
      generateModelKnowledgeAnswer({
        question: "雷电将军与雷电影是什么关系？",
        language: "zh-CN",
      }),
    ).resolves.toEqual({
      paragraphs: [
        {
          text: "雷电将军是雷电影制造的人偶，用来代替她治理稻妻。",
          citationIds: [],
        },
        {
          text: "两者共享将军这一身份，但并不是两个普通人类角色。",
          citationIds: [],
        },
      ],
    });
  });

  it.each([
    ["wrong language", { paragraphs: [{ text: "这是中文回答。" }] }, "en"],
    ["URL", { paragraphs: [{ text: "详情见 https://example.com/page。" }] }, "zh-CN"],
    ["source marker", { paragraphs: [{ text: "她是统治者。[source-1]" }] }, "zh-CN"],
    ["empty paragraphs", { paragraphs: [] }, "zh-CN"],
    [
      "more than four paragraphs",
      { paragraphs: Array.from({ length: 5 }, (_, index) => ({ text: `第${index + 1}段说明。` })) },
      "zh-CN",
    ],
  ])("rejects %s", async (_name, payload, language) => {
    mockCompletion(JSON.stringify(payload));

    await expect(
      generateModelKnowledgeAnswer({
        question: language === "en" ? "Who is Paimon?" : "冰之女皇领导谁？",
        language: language as "zh-CN" | "en",
      }),
    ).resolves.toBeNull();
  });

  it("rejects malformed JSON", async () => {
    mockCompletion("not json");

    await expect(
      generateModelKnowledgeAnswer({
        question: "冰之女皇领导谁？",
        language: "zh-CN",
      }),
    ).resolves.toBeNull();
  });
});
