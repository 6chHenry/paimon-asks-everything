import { describe, expect, it } from "vitest";
import { factionKnowledgeEntries } from "@/data/faction-knowledge";

describe("faction knowledge", () => {
  it("provides one reviewed bilingual atomic fact for the Tsaritsa relationship", () => {
    expect(factionKnowledgeEntries).toHaveLength(2);
    expect(
      factionKnowledgeEntries.map((entry) => entry.language).sort(),
    ).toEqual(["en", "zh-CN"]);
    for (const entry of factionKnowledgeEntries) {
      expect(entry.reviewed).toBe(true);
      expect(entry.tags).toEqual(
        expect.arrayContaining([
          "relationship",
          "organization",
          "atomic-fact",
        ]),
      );
      expect(entry.spoilerLevel).toBeLessThanOrEqual(1);
      expect(entry.source.sourceKind).toBe("trusted_wiki");
    }
  });
});
