import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/preheat/route";

describe("preheat GET route", () => {
  it("returns a deterministic curated view", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/preheat?topicId=why-fatui-collect-gnoses&depth=guided&language=en&profile=returning&progress=fontaine&spoilerPreference=low",
      ),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      topic: { id: string };
      timeline: unknown[];
    };
    expect(payload.topic.id).toBe("why-fatui-collect-gnoses");
    expect(payload.timeline.length).toBeGreaterThan(0);
  });

  it("rejects invalid depth values", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/preheat?topicId=why-fatui-collect-gnoses&depth=everything&language=en",
      ),
    );
    expect(response.status).toBe(400);
  });

  it("accepts Nod-Krai as the latest completed mainline region", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/preheat?topicId=seven-gnosis-journeys&depth=guided&language=zh-CN&profile=story&progress=nodkrai&spoilerPreference=none",
      ),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      timeline: Array<{ id: string; locked: boolean }>;
    };
    expect(
      payload.timeline.find((node) => node.id === "nodkrai-gnosis"),
    ).toMatchObject({ locked: false });
  });

  it("returns a question-led breakpoint without an answer", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/preheat?topicId=seven-gnosis-journeys&depth=guided&language=zh-CN&profile=story&progress=fontaine&spoilerPreference=low",
      ),
    );
    const payload = (await response.json()) as {
      breakpoint: { question: string; unlockLabel: string; boundary: string } &
        Record<string, unknown>;
    };
    expect(response.status).toBe(200);
    expect(payload.breakpoint.question).toContain("神之心");
    expect(payload.breakpoint.unlockLabel).toContain("至冬版本开启");
    expect(payload.breakpoint.boundary).toContain("仍未解");
    expect(payload.breakpoint).not.toHaveProperty("answer");
  });

  it("accepts multiple focus values and returns a presentation contract", async () => {
    const response = await GET(new Request(
      "http://localhost/api/preheat?topicId=seven-gnosis-journeys&depth=guided&language=zh-CN&profile=story&progress=sumeru&spoilerPreference=low&focus=character,story",
    ));
    const payload = await response.json() as {
      presentation: { defaultTimelineId?: string; sectionOrder: string[] };
    };
    expect(response.status).toBe(200);
    expect(payload.presentation.defaultTimelineId).toBe("sumeru-gnoses");
    expect(payload.presentation.sectionOrder).toEqual(["brief", "timeline", "relations"]);
  });

  it("rejects an invalid focus value", async () => {
    const response = await GET(new Request(
      "http://localhost/api/preheat?topicId=seven-gnosis-journeys&depth=guided&language=en&focus=story,secrets",
    ));
    expect(response.status).toBe(400);
  });

  it("uses stable default focuses when focus is omitted", async () => {
    const response = await GET(new Request(
      "http://localhost/api/preheat?topicId=seven-gnosis-journeys&depth=guided&language=en",
    ));
    expect(response.status).toBe(200);
    expect((await response.json()).presentation).toBeDefined();
  });
});
