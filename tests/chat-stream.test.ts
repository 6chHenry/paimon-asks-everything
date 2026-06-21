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

  it("streams the answer before supplementary resources finish", async () => {
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
    expect(body).toContain("event: answer");
    expect(body).toContain("event: resources");
    expect(body).toContain("event: done");
    expect(body.indexOf("event: trace")).toBeLessThan(body.indexOf("event: answer"));
    expect(body.indexOf("event: answer")).toBeLessThan(
      body.indexOf("event: resources"),
    );
  });

  it("keeps streaming trace events after spoiler confirmation", async () => {
    const requestBody = {
      question: "法尔伽传说任务故事梗概",
      language: "zh-CN",
      profile: "story",
      progress: "nodkrai",
      spoilerPreference: "full",
      focus: ["story", "character"],
      allowQuestionTextStorage: false,
      sessionId: "stream-spoiler-session",
    };
    const firstResponse = await POST(
      new Request("http://localhost/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      }),
    );
    const firstBody = await firstResponse.text();
    const answerBlock = firstBody
      .split("\n\n")
      .find((block) => block.includes("event: answer"));
    const answerData = answerBlock
      ?.split("\n")
      .find((line) => line.startsWith("data: "))
      ?.slice(6);
    const confirmation = answerData
      ? (JSON.parse(answerData) as { confirmationToken?: string })
      : {};

    expect(confirmation.confirmationToken).toBeTruthy();

    const confirmedResponse = await POST(
      new Request("http://localhost/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...requestBody,
          confirmationToken: confirmation.confirmationToken,
        }),
      }),
    );
    const confirmedBody = await confirmedResponse.text();

    expect(confirmedResponse.headers.get("Content-Type")).toContain(
      "text/event-stream",
    );
    expect(confirmedBody).toContain("event: trace");
    expect(confirmedBody).toContain("event: answer");
    expect(confirmedBody).toContain("event: done");
    expect(confirmedBody).not.toContain("spoiler_confirmation_required");
  });
});
