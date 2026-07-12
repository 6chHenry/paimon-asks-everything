import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/question-suggestions/route";

const originalEnv = { ...process.env };

function requestFor(
  body: Record<string, unknown>,
  ip = "question-suggestions-test",
) {
  return new Request("http://localhost/api/question-suggestions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-real-ip": ip,
    },
    body: JSON.stringify({
      topicId: "narzissenkreuz-ordo",
      language: "en",
      profile: "story",
      progress: "fontaine",
      spoilerPreference: "low",
      focus: ["story"],
      ...body,
    }),
  });
}

describe("question suggestions route", () => {
  beforeEach(() => {
    delete process.env.LLM_API_KEY;
    globalThis.__paimonRateLimit = new Map();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns same-topic fallback suggestions without an LLM key", async () => {
    const response = await POST(requestFor({}));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      topicId: "narzissenkreuz-ordo",
      source: "fallback",
      questions: expect.any(Array),
    });
  });

  it("rejects malformed JSON and unknown topics", async () => {
    const malformed = await POST(
      new Request("http://localhost/api/question-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      }),
    );
    const unknown = await POST(requestFor({ topicId: "not-in-catalog" }));
    expect(malformed.status).toBe(400);
    expect(unknown.status).toBe(400);
  });

  it("rate limits suggestion generation requests", async () => {
    for (let index = 0; index < 12; index += 1) {
      expect((await POST(requestFor({}, "rate-limit-test"))).status).toBe(200);
    }
    expect((await POST(requestFor({}, "rate-limit-test"))).status).toBe(429);
  });
});
