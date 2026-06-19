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
    expect(item.citations.length).toBeGreaterThan(0);
    expect(item.checkFailures).toEqual([]);
  });
});
