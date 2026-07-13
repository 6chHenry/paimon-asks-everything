import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/chat/stream/route";

const originalEnv = { ...process.env };

function eventPayloads(body: string, eventName: string) {
  return body
    .split("\n\n")
    .filter((block) => block.includes(`event: ${eventName}`))
    .map((block) =>
      block
        .split("\n")
        .find((line) => line.startsWith("data: "))
        ?.slice(6),
    )
    .filter((value): value is string => Boolean(value))
    .map((value) => JSON.parse(value) as Record<string, unknown>);
}

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

  it.each([
    "婕德经历了怎么的变化？",
    "婕德经历了怎样的变化？",
  ])("gates and then streams a clean, entity-anchored character arc: %s", async (question) => {
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_BASE_URL = "https://api.example.test";
    process.env.LLM_MODEL = "fixture-model";
    delete process.env.https_proxy;
    delete process.env.HTTPS_PROXY;
    delete process.env.http_proxy;
    delete process.env.HTTP_PROXY;
    const searchedQueries: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input));
        if (url.hostname === "api.example.test") {
          const requestBody = JSON.parse(String(init?.body ?? "{}")) as {
            messages?: Array<{ role?: string; content?: string }>;
          };
          const evidenceMessage = [...(requestBody.messages ?? [])]
            .reverse()
            .find(
              (message) =>
                message.role === "user" &&
                message.content?.includes('"evidence"'),
            );
          const evidencePayload = evidenceMessage?.content
            ? (JSON.parse(evidenceMessage.content) as {
                evidence?: Array<{ id: string; title?: string }>;
              })
            : {};
          const evidence = evidencePayload.evidence ?? [];
          const startId =
            evidence.find((item) => item.title?.includes("永恒的葱茏之梦"))?.id ??
            evidence[0]?.id;
          const endId =
            evidence.find((item) => item.title?.includes("罪恶滔天"))?.id ??
            evidence[1]?.id ??
            startId;
          return new Response(
            JSON.stringify({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      paragraphs: [
                        {
                          text: "婕德最初在失去父亲后渴望新的归属。",
                          citationIds: [startId],
                        },
                        {
                          text: "她随后加入塔尼特，并把这个替代家庭当作安身之处。",
                          citationIds: [startId],
                        },
                        {
                          text: "在遭到操控与背叛后，她终于认清自己落入的陷阱。",
                          citationIds: [endId],
                        },
                        {
                          text: "最终她与虚假的家庭决裂，开始由自己选择前路。",
                          citationIds: [endId],
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
        const query =
          url.searchParams.get("srsearch") ??
          url.searchParams.get("q") ??
          url.searchParams.get("p");
        if (query) searchedQueries.push(query);
        if (url.searchParams.get("prop") === "extracts") {
          return new Response(
            JSON.stringify({
              query: {
                pages: {
                  "7001": {
                    pageid: 7001,
                    extract:
                      "失去父亲后，婕德渴望新的归属。她加入塔尼特，把部族和族长当作替代家庭。",
                  },
                  "7002": {
                    pageid: 7002,
                    extract:
                      "婕德遭到操控与背叛后认清陷阱，与塔尼特决裂，并决定自己选择未来的道路。",
                  },
                  "7003": {
                    pageid: 7003,
                    extract:
                      "Created with Sketch 任务攻略 任务流程 前置任务 后续任务 智慧筑屋,凿成七柱；旅行者创作平台-观测枢-原神wiki旅行者创作平台-观测枢-原神wiki&hellip;",
                  },
                  "7004": {
                    pageid: 7004,
                    extract: "花神的资料索引中偶然列出婕德，但没有叙述她的经历。",
                  },
                  "7005": {
                    pageid: 7005,
                    extract:
                      "婕德：我不会服从。旅行者：我们先离开。派蒙：出口在那里。阿萨里格：拦住他们。芭别尔：执行命令。",
                  },
                  "7006": {
                    pageid: 7006,
                    extract:
                      '首页 > 头像 > 婕德与奔奔 如果是第一次来,按"Ctrl+D"...按右上角“WIKI功能→编辑”...',
                  },
                },
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (url.searchParams.get("action") === "parse") {
          return new Response(JSON.stringify({ parse: { text: { "*": "" } } }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (url.searchParams.get("list") === "search") {
          return new Response(
            JSON.stringify({
              query: {
                search: [
                  {
                    title: "婕德剧情经历：永恒的葱茏之梦",
                    snippet: "婕德的剧情经历始于失去亲人后寻找新的归属，并加入塔尼特。",
                    pageid: 7001,
                  },
                  {
                    title: "婕德结局变化：因为她的罪恶滔天…",
                    snippet: "婕德的结局变化是认清操控与背叛后同塔尼特决裂，选择自己的道路。",
                    pageid: 7002,
                  },
                  {
                    title: "婕德与奔奔-旅行者创作平台-观测枢-原神wiki",
                    snippet:
                      "Created with Sketch 任务攻略 任务流程 前置任务 后续任务&hellip;",
                    pageid: 7003,
                  },
                  {
                    title: "娜布·玛莉卡塔",
                    snippet: "资料索引偶然提到婕德。",
                    pageid: 7004,
                  },
                  {
                    title: "婕德对话记录",
                    snippet: "多人对话逐句记录。",
                    pageid: 7005,
                  },
                  {
                    title: "婕德与奔奔",
                    snippet:
                      '首页 > 头像 > 婕德与奔奔 如果是第一次来,按"Ctrl+D"...按右上角“WIKI功能→编辑”...',
                    pageid: 7006,
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

    const requestBody = {
      question,
      language: "zh-CN",
      profile: "story",
      progress: "sumeru",
      spoilerPreference: "full",
      focus: ["story", "character"],
      allowQuestionTextStorage: false,
      sessionId: `character-arc-${question.includes("怎么") ? "typo" : "standard"}`,
    };
    const firstResponse = await POST(
      new Request("http://localhost/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      }),
    );
    const firstBody = await firstResponse.text();
    const firstAnswer = eventPayloads(firstBody, "answer")[0] as {
      status?: string;
      confirmationToken?: string;
    };

    expect(firstAnswer.status).toBe("spoiler_confirmation_required");
    expect(firstAnswer.confirmationToken).toBeTruthy();

    const confirmedResponse = await POST(
      new Request("http://localhost/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...requestBody,
          confirmationToken: firstAnswer.confirmationToken,
        }),
      }),
    );
    const confirmedBody = await confirmedResponse.text();
    const result = eventPayloads(confirmedBody, "answer")[0] as {
      status?: string;
      answer?: string;
      answerMode?: string;
      citations?: Array<{ id: string; title: string; excerpt: string }>;
      answerParagraphs?: Array<{ citationIds: string[] }>;
    };
    expect(result.status).toBe("answered");
    expect(result.answerMode).toBe("deep_story");
    expect(confirmedBody).toContain("character · story / 婕德");
    expect(confirmedBody).toContain("storyScope=character_arc");
    expect(searchedQueries.length).toBeGreaterThan(0);
    expect(searchedQueries.every((query) => query.includes("婕德"))).toBe(true);
    expect(searchedQueries.some((query) => /经历|变化|剧情|故事|结局/u.test(query))).toBe(
      true,
    );
    expect(Array.from(new Set(searchedQueries))).toEqual([
      question,
      "婕德 剧情 经历",
      "婕德 结局 变化",
    ]);
    expect(result.answer).toContain("失去父亲后");
    expect(result.answer).toContain("替代家庭");
    expect(result.answer).toContain("操控与背叛");
    expect(result.answer).toContain("自己选择前路");
    const answerBearingIds = new Set(
      result.answerParagraphs?.flatMap((paragraph) => paragraph.citationIds) ?? [],
    );
    const citationIds = new Set(
      result.citations?.map((citation) => citation.id) ?? [],
    );
    expect([...answerBearingIds].every((id) => citationIds.has(id))).toBe(true);
    expect(answerBearingIds.size).toBeGreaterThan(0);
    const answerBearingText = (result.citations ?? [])
      .filter((citation) => answerBearingIds.has(citation.id))
      .map((citation) => `${citation.title} ${citation.excerpt}`)
      .join(" ");
    const allCitationText = (result.citations ?? [])
      .map((citation) => `${citation.title} ${citation.excerpt}`)
      .join(" ");
    expect(allCitationText).not.toMatch(/首页\s*>|Ctrl\+D|WIKI功能\s*→\s*编辑/iu);
    expect(`${result.answer} ${answerBearingText}`).not.toMatch(
      /婕德经历了|旅行者创作平台.*旅行者创作平台|&(?:[a-z][a-z0-9]*|#x?[0-9a-z]+);|Created with Sketch|任务攻略\s+任务流程\s+前置任务\s+后续任务|(?:婕德|旅行者|派蒙|阿萨里格|芭别尔)[:：][^。！？]*[。！？](?:婕德|旅行者|派蒙|阿萨里格|芭别尔)[:：]/iu,
    );
  });
});
