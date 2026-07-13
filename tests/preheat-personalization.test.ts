import { describe, expect, it } from "vitest";
import { preheatRegionGuides } from "@/data/preheat-region-guides";
import {
  normalizeVisibleProfile,
  visibleProfiles,
} from "@/lib/visible-profiles";

describe("preheat role personalization", () => {
  it("exposes only three traveler profiles and migrates legacy values", () => {
    expect(visibleProfiles).toEqual(["new", "returning", "story"]);
    expect(normalizeVisibleProfile("exploration")).toBe("returning");
    expect(normalizeVisibleProfile("casual")).toBe("returning");
    expect(normalizeVisibleProfile("new")).toBe("new");
    expect(normalizeVisibleProfile("story")).toBe("story");
    expect(normalizeVisibleProfile(undefined)).toBe("returning");
  });

  it("provides complete role content for every named region", () => {
    const regions = [
      "mondstadt",
      "liyue",
      "inazuma",
      "sumeru",
      "fontaine",
      "natlan",
      "nodkrai",
      "snezhnaya",
    ];

    expect(Object.keys(preheatRegionGuides)).toEqual(regions);
    for (const region of regions) {
      const guide =
        preheatRegionGuides[region as keyof typeof preheatRegionGuides];
      expect(guide.newPlayer.overview["zh-CN"].length, region).toBeGreaterThan(20);
      expect(guide.newPlayer.factions.length, region).toBeGreaterThanOrEqual(3);
      expect(guide.newPlayer.storySteps, region).toHaveLength(3);
      expect(
        guide.returningPlayer.recapPoints.length,
        region,
      ).toBeGreaterThanOrEqual(3);
      expect(
        guide.returningPlayer.hooks.length,
        region,
      ).toBeGreaterThanOrEqual(2);
      expect(
        guide.returningPlayer.hooks.every(
          (hook) => /[？?]$/.test(hook["zh-CN"]) && /[?]$/.test(hook.en),
        ),
        region,
      ).toBe(true);
    }
  });

  it("maps every released Gnosis region to its existing event node", () => {
    for (const region of [
      "mondstadt",
      "liyue",
      "inazuma",
      "sumeru",
      "fontaine",
      "natlan",
      "nodkrai",
    ] as const) {
      expect(preheatRegionGuides[region].timelineNodeId, region).toBeTruthy();
      expect(preheatRegionGuides[region].relationGraphId, region).toBeTruthy();
    }
    expect(preheatRegionGuides.snezhnaya.timelineNodeId).toBeUndefined();
  });
});
