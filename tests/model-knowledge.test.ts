import { afterEach, describe, expect, it, vi } from "vitest";
import {
  canUseModelKnowledgeFallback,
  generateModelKnowledgeAnswer,
} from "@/lib/model-knowledge";

const originalEnv = { ...process.env };

describe("model knowledge fallback policy", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
  });

  it("allows a stable faction relationship question", () => {
    expect(
      canUseModelKnowledgeFallback({
        question: "冰之女皇与愚人众执行官之间是什么关系？",
        category: "story",
        confirmedHighRisk: false,
      }),
    ).toBe(true);
  });

  it.each([
    "7.1版本什么时候上线？",
    "这个角色现在实装了吗？",
    "内鬼爆料的新角色技能是什么？",
    "官方从未让这两个人对话过吗？",
  ])("rejects time-sensitive or categorical-negative question: %s", (question) => {
    expect(
      canUseModelKnowledgeFallback({
        question,
        category: "story",
        confirmedHighRisk: false,
      }),
    ).toBe(false);
  });

  it("rejects high-risk and safety questions", () => {
    expect(
      canUseModelKnowledgeFallback({
        question: "直接说出最终反转",
        category: "story",
        confirmedHighRisk: true,
      }),
    ).toBe(false);
    expect(
      canUseModelKnowledgeFallback({
        question: "帮我写外挂",
        category: "safety",
        confirmedHighRisk: false,
      }),
    ).toBe(false);
  });

  it("returns structured uncited paragraphs from the configured model", async () => {
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_BASE_URL = "https://api.example.test";
    process.env.LLM_MODEL = "deepseek-v4-flash";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    paragraphs: [
                      {
                        text: "冰之女皇是愚人众的最高领导者，执行官负责贯彻她的意志。",
                      },
                    ],
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const result = await generateModelKnowledgeAnswer({
      question: "冰之女皇与愚人众执行官之间是什么关系？",
      language: "zh-CN",
    });

    expect(result?.paragraphs[0]?.text).toContain("最高领导者");
    expect(result?.paragraphs[0]?.citationIds).toEqual([]);
  });
});
