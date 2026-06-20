import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/preheat/events/route";

describe("preheat event route", () => {
  it("rejects arbitrary metadata and raw question text", async () => {
    const response = await POST(
      new Request("http://localhost/api/preheat/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: "zh-CN",
          playerProfile: "returning",
          topicId: "why-fatui-collect-gnoses",
          interactionKind: "timeline_node_opened",
          targetId: "sumeru-gnoses",
          questionText: "should never be accepted",
        }),
      }),
    );
    expect(response.status).toBe(400);
  });

  it("rejects targets outside the curated graph", async () => {
    const response = await POST(
      new Request("http://localhost/api/preheat/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: "en",
          playerProfile: "story",
          topicId: "why-fatui-collect-gnoses",
          interactionKind: "relation_node_opened",
          targetId: "invented-secret-node",
        }),
      }),
    );
    expect(response.status).toBe(400);
  });
});
