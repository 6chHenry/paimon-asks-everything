import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runEvaluation } from "@/lib/evaluation";

const originalEnv = { ...process.env };

describe("evaluation detail", () => {
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

  it("returns answer and citation details for human review", async () => {
    const result = await runEvaluation("zh-catch-up");
    const item = result.results[0];

    expect(item.answer).toBeTruthy();
    expect(item.citations).toHaveLength(1);
    expect(item.verificationStatus).toBe("verified");
    expect(item.confidence).toBe("high");
    expect(item.answerMode).toBe("minimal_catch_up");
    expect(item.checks).toMatchObject({
      verification: true,
      mustInclude: true,
      forbiddenAnswer: true,
    });
    expect(item.checkFailures).toEqual([]);
  });

  it("enforces the Chinese layered-hint content contract", async () => {
    const result = await runEvaluation("layered-hint-zh");
    const item = result.results[0];

    expect(item.status).toBe("answered");
    expect(item.verificationStatus).toBe("verified");
    expect(item.answerMode).toBe("layered_hint");
    expect(item.citations).toHaveLength(1);
    expect(item.answer).toMatch(/观察|颜色|运动规律|能量|顺序/u);
    expect(item.checks).toMatchObject({
      verification: true,
      mustInclude: true,
      forbiddenAnswer: true,
    });
    expect(item.checkFailures).toEqual([]);
  });
});
