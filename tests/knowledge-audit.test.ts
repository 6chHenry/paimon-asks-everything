import { describe, expect, it } from "vitest";
import { knowledgeEntries } from "@/data/knowledge";

describe("controlled knowledge audit", () => {
  it("does not keep the stale claim that Sandrone and Alain lack a direct relationship", () => {
    const stale = knowledgeEntries.filter((entry) =>
      /不足以把桑多涅直接认定|does not establish that Sandrone/i.test(
        `${entry.content} ${entry.summary}`,
      ),
    );

    expect(stale).toEqual([]);
  });

  it("keeps the Sandrone-Alain relationship as reviewed bilingual controlled knowledge", () => {
    const entries = knowledgeEntries.filter(
      (entry) => entry.conceptId === "sandrone-alain-creation",
    );

    expect(entries).toHaveLength(2);
    expect(entries.every((entry) => entry.reviewed)).toBe(true);
    expect(
      entries.every((entry) => entry.source.sourceKind === "trusted_wiki"),
    ).toBe(true);
  });
});
