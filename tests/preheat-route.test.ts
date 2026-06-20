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
});
