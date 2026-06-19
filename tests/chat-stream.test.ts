import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/chat/stream/route";

const originalEnv = { ...process.env };

describe("chat stream route", () => {
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

  it("streams trace events before the final result", async () => {
    const response = await POST(
      new Request("http://localhost/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: "桑多涅和阿兰的关系",
          language: "zh-CN",
          profile: "story",
          progress: "fontaine",
          spoilerPreference: "low",
          focus: ["story", "character"],
          allowQuestionTextStorage: false,
          sessionId: "stream-test-session",
        }),
      }),
    );

    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
    const body = await response.text();

    expect(body).toContain("event: trace");
    expect(body).toContain("event: result");
    expect(body.indexOf("event: trace")).toBeLessThan(body.indexOf("event: result"));
  });
});
