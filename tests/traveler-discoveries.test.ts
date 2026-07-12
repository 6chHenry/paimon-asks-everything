import { describe, expect, it } from "vitest";
import {
  buildClueCardText,
  discoverNode,
  emptyDiscoveries,
  hasUnlockedClueCard,
  noteIndexForDate,
  parseDiscoveries,
} from "@/lib/traveler-discoveries";

describe("traveler discoveries", () => {
  it("picks a stable daily note and keeps dates in range", () => {
    expect(noteIndexForDate(new Date("2026-07-10T03:00:00"), 3)).toBe(
      noteIndexForDate(new Date("2026-07-10T23:59:00"), 3),
    );
    expect(noteIndexForDate(new Date("2026-07-10"), 3)).toBeGreaterThanOrEqual(0);
    expect(noteIndexForDate(new Date("2026-07-10"), 3)).toBeLessThan(3);
    expect(noteIndexForDate(new Date("2026-07-10"), 0)).toBe(0);
  });

  it("deduplicates nodes and unlocks the clue card at three discoveries", () => {
    const twice = discoverNode(
      discoverNode(emptyDiscoveries, "tsaritsa"),
      "tsaritsa",
    );
    expect(twice.visitedNodeIds).toEqual(["tsaritsa"]);
    expect(
      hasUnlockedClueCard(
        discoverNode(discoverNode(twice, "pierro"), "capitano"),
      ),
    ).toBe(true);
  });

  it("parses only valid persisted discovery fields", () => {
    expect(parseDiscoveries("not json")).toEqual(emptyDiscoveries);
    expect(
      parseDiscoveries(
        JSON.stringify({
          visitedNodeIds: ["tsaritsa", 5, "pierro"],
          paimonEasterEggFound: true,
        }),
      ),
    ).toEqual({
      visitedNodeIds: ["tsaritsa", "pierro"],
      paimonEasterEggFound: true,
    });
  });

  it("creates a spoiler-safe bilingual clue-card message", () => {
    const discoveries = {
      ...emptyDiscoveries,
      visitedNodeIds: ["tsaritsa", "pierro", "capitano"],
    };
    expect(buildClueCardText(discoveries, "zh-CN")).toContain("3");
    expect(buildClueCardText(discoveries, "en")).toContain("3");
  });
});
