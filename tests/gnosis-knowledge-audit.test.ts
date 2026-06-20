import { describe, expect, it } from "vitest";
import { gnosisKnowledgeEntries } from "@/data/gnosis-knowledge";
import { gnosisTimeline } from "@/data/gnosis-timeline";

describe("Gnosis controlled knowledge audit", () => {
  it("keeps one reviewed Chinese and English entry per concept", () => {
    const grouped = Object.groupBy(
      gnosisKnowledgeEntries,
      (entry) => entry.conceptId,
    );
    expect(Object.keys(grouped)).toHaveLength(12);
    for (const entries of Object.values(grouped)) {
      expect(entries).toHaveLength(2);
      expect(entries?.map((entry) => entry.language).sort()).toEqual([
        "en",
        "zh-CN",
      ]);
      expect(entries?.every((entry) => entry.reviewed)).toBe(true);
      expect(entries?.every((entry) => entry.source.title.trim())).toBe(true);
      expect(entries?.every((entry) => entry.source.url.trim())).toBe(true);
    }
  });

  it("uses only explicit events in the main timeline", () => {
    for (const node of gnosisTimeline) {
      for (const conceptId of node.eventConceptIds) {
        const entries = gnosisKnowledgeEntries.filter(
          (entry) => entry.conceptId === conceptId,
        );
        expect(entries).toHaveLength(2);
        expect(
          entries.every((entry) => entry.factStatus === "official_explicit"),
        ).toBe(true);
      }
    }
  });

  it("contains no leak, datamine, or test-server evidence", () => {
    const prohibited = /leak|datamine|test server|测试服|泄露|内鬼/i;
    expect(
      gnosisKnowledgeEntries.filter((entry) =>
        prohibited.test(
          `${entry.content} ${entry.source.title} ${entry.source.url}`,
        ),
      ),
    ).toEqual([]);
  });

  it("records the released Nod-Krai Pyro Gnosis outcome separately from Natlan", () => {
    const natlan = gnosisKnowledgeEntries.filter(
      (entry) => entry.conceptId === "gnosis-natlan",
    );
    const nodkrai = gnosisKnowledgeEntries.filter(
      (entry) => entry.conceptId === "gnosis-nodkrai",
    );

    expect(natlan).toHaveLength(2);
    expect(natlan[0]?.summary).toMatch(/没有强夺|did not seize/i);
    expect(nodkrai).toHaveLength(2);
    expect(nodkrai.every((entry) => entry.minimumProgress === "nodkrai")).toBe(
      true,
    );
    expect(nodkrai[0]?.summary).toMatch(/下落不明|unaccounted for/i);
  });
});
