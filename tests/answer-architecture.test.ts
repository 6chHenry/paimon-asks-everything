import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runAgent } from "@/lib/agent";

const originalEnv = { ...process.env };

const base = {
  language: "zh-CN" as const,
  profile: "returning" as const,
  progress: "mondstadt" as const,
  spoilerPreference: "low" as const,
  focus: ["story", "character"] as const,
  allowQuestionTextStorage: false,
  sessionId: "answer-architecture-regression",
};

function emptySearchResponse(input: RequestInfo | URL) {
  const url = new URL(String(input));
  if (
    url.hostname === "html.duckduckgo.com" ||
    url.hostname === "search.yahoo.com" ||
    url.hostname === "www.sogou.com"
  ) {
    return new Response("", {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  }

  return new Response(
    JSON.stringify({ query: { search: [], pages: {} } }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

describe("answer retrieval architecture", () => {
  beforeEach(() => {
    delete process.env.LLM_API_KEY;
    delete process.env.https_proxy;
    delete process.env.HTTPS_PROXY;
    delete process.env.http_proxy;
    delete process.env.HTTP_PROXY;
    vi.stubGlobal("fetch", vi.fn(emptySearchResponse));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
  });

  it("answers the Tsaritsa-Harbingers question from spoiler-safe atomic evidence", async () => {
    const result = await runAgent(
      {
        ...base,
        focus: [...base.focus],
        question: "冰之女皇与愚人众执行官之间是什么关系？",
      },
      { recordEvent: false },
    );

    expect(result.status).toBe("answered");
    expect(result.verificationStatus).toBe("verified");
    expect(result.answer).toContain("冰之女皇");
    expect(result.answer).toContain("执行官");
    expect(result.answer).toMatch(/领导|效忠/);
    expect(result.citations.length).toBeGreaterThan(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("labels a stable long-tail relation as model knowledge when search is empty", async () => {
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_BASE_URL = "https://api.example.test";
    process.env.LLM_MODEL = "deepseek-v4-flash";
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
                          text: "雷电将军是雷电影制造的人偶，代替她治理稻妻；雷电影本人则是稻妻的雷神。",
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
        return emptySearchResponse(input);
      }),
    );

    const result = await runAgent(
      {
        ...base,
        focus: [...base.focus],
        question: "雷电将军和雷电影是什么关系？",
      },
      { recordEvent: false },
    );

    expect(result.status).toBe("answered");
    expect(result.verificationStatus).toBe("model_knowledge");
    expect(result.confidence).toBe("low");
    expect(result.citations).toEqual([]);
    expect(result.answer).toContain("雷电");
  });

  it("does not use model knowledge for current release-status questions", async () => {
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_BASE_URL = "https://api.example.test";
    process.env.LLM_MODEL = "deepseek-v4-flash";
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
                      paragraphs: [{ text: "爱可菲已经实装。" }],
                    }),
                  },
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return emptySearchResponse(input);
      }),
    );

    const result = await runAgent(
      {
        ...base,
        focus: [...base.focus],
        question: "爱可菲现在实装了吗？",
      },
      { recordEvent: false },
    );

    expect(result.status).toBe("insufficient_evidence");
    expect(result.verificationStatus).toBe("partially_verified");
    expect(result.answer).not.toContain("已经实装");
  });
});
