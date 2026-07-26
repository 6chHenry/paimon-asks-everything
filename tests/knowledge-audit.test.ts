import { describe, expect, it } from "vitest";
import { knowledgeEntries } from "@/data/knowledge";

describe("controlled knowledge audit", () => {
  it("does not keep stale Sandrone copy or an unconfirmed Alain relationship", () => {
    const sandroneConcepts = new Set([
      "sandrone-public",
      "sandrone-alain-creation",
    ]);
    const stale = knowledgeEntries.filter(
      (entry) =>
        sandroneConcepts.has(entry.conceptId) &&
        /尚未公开|unannounced version plot|长尾问答|only theory|仅是理论|不足以把桑多涅直接认定|does not establish that Sandrone|(?:unconfirmed|not confirmed|uncertain).{0,80}Alain|Alain.{0,80}(?:unconfirmed|not confirmed|uncertain)|阿兰.{0,80}(未确认|尚不确定)|(未确认|尚不确定).{0,80}阿兰/i.test(
          `${entry.content} ${entry.summary}`,
        ),
    );

    expect(stale).toEqual([]);
  });

  it("keeps relationship details out of the spoiler-safe public pair", () => {
    const entries = knowledgeEntries.filter(
      (entry) => entry.conceptId === "sandrone-public",
    );

    expect(entries).toHaveLength(2);
    expect(entries.every((entry) => entry.spoilerLevel === 0)).toBe(true);
    expect(entries.every((entry) => entry.minimumProgress === "mondstadt")).toBe(
      true,
    );
    expect(
      entries.every(
        (entry) =>
          !/Alain|阿兰|Mary-Ann|玛丽安|Pulonia|普隆尼亚/i.test(
            `${entry.title} ${entry.content} ${entry.summary} ${entry.aliases.join(" ")}`,
          ),
      ),
    ).toBe(true);
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
    expect(
      entries.every((entry) => entry.factStatus === "trusted_secondary"),
    ).toBe(true);
    expect(entries.every((entry) => entry.spoilerLevel === 1)).toBe(true);
    expect(entries.every((entry) => entry.minimumProgress === "fontaine")).toBe(
      true,
    );
  });
});
