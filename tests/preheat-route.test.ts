import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/preheat/route";

function request(overrides = "") {
  return new Request(
    `http://localhost/api/preheat?topicId=seven-gnosis-journeys&depth=guided&language=zh-CN&profile=returning&progress=sumeru&spoilerPreference=low${overrides}`,
  );
}

describe("preheat GET route", () => {
  it("returns each visible role payload", async () => {
    for (const profile of ["new", "returning", "story"]) {
      const response = await GET(request(`&profile=${profile}`));
      expect(response.status, profile).toBe(200);
      expect((await response.json()).kind, profile).toBe(profile);
    }
  });

  it("normalizes legacy profiles to returning", async () => {
    for (const profile of ["exploration", "casual"]) {
      const response = await GET(request(`&profile=${profile}`));
      expect(response.status, profile).toBe(200);
      expect((await response.json()).kind, profile).toBe("returning");
    }
  });

  it("returns a region-required payload for an unknown region", async () => {
    const response = await GET(request("&profile=new&progress=unknown"));
    expect(response.status).toBe(200);
    expect((await response.json()).kind).toBe("region_required");
  });

  it("accepts old depth and focus parameters without changing the role", async () => {
    const response = await GET(request("&profile=new&depth=research&focus=character,story"));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.kind).toBe("new");
    expect(payload).not.toHaveProperty("timeline");
  });

  it("rejects invalid depth and focus values", async () => {
    expect((await GET(request("&depth=everything"))).status).toBe(400);
    expect((await GET(request("&focus=story,secrets"))).status).toBe(400);
  });

  it("does not expose a removed unresolved breakpoint", async () => {
    const response = await GET(request("&profile=story"));
    const payload = (await response.json()) as Record<string, unknown>;
    expect(response.status).toBe(200);
    expect(payload).not.toHaveProperty("breakpoint");
  });
});
