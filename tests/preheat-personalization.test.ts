import { describe, expect, it } from "vitest";
import {
  buildPreheatPresentation,
  rankPreheatEntries,
  rankSuggestedQuestions,
} from "@/lib/preheat-personalization";
import type { KnowledgeEntry } from "@/lib/domain";

const query = {
  depth: "guided" as const,
  profile: "returning" as const,
  progress: "sumeru" as const,
  focus: ["story"] as const,
};
const timeline = [
  { id: "mondstadt-gnosis", region: "mondstadt" as const, locked: false, relationGraphId: "mondstadt", participantIds: ["venti"] },
  { id: "sumeru-gnoses", region: "sumeru" as const, locked: false, relationGraphId: "sumeru", participantIds: ["nahida", "dottore"] },
  { id: "fontaine-gnosis", region: "fontaine" as const, locked: true, relationGraphId: "fontaine", participantIds: ["arlecchino"] },
];
const graphs = { sumeru: { id: "sumeru", nodes: [{ id: "nahida" }, { id: "dottore" }] } };
const entry = (id: string, contentType: KnowledgeEntry["contentType"], tags: string[]) =>
  ({ id, conceptId: id, contentType, tags } as KnowledgeEntry);

describe("preheat personalization", () => {
  it("gives profiles visibly different presentation contracts", () => {
    const newcomer = buildPreheatPresentation({ ...query, profile: "new" }, timeline, graphs);
    const story = buildPreheatPresentation({ ...query, profile: "story" }, timeline, graphs);
    const casual = buildPreheatPresentation({ ...query, profile: "casual" }, timeline, graphs);
    expect(newcomer.defaultTimelineId).toBe("mondstadt-gnosis");
    expect(story.narrationLimit).toBeGreaterThan(casual.narrationLimit);
    expect(story.sectionOrder).not.toEqual(newcomer.sectionOrder);
    expect(casual.collapsedSections).toEqual(["timeline", "relations"]);
  });

  it("never selects a locked timeline node", () => {
    expect(buildPreheatPresentation(query, timeline, graphs).defaultTimelineId).toBe("sumeru-gnoses");
  });

  it("uses character focus to choose a visible participant", () => {
    const result = buildPreheatPresentation({ ...query, profile: "story", focus: ["character"] }, timeline, graphs);
    expect(result.defaultRelationGraphId).toBe("sumeru");
    expect(["nahida", "dottore"]).toContain(result.defaultRelationNodeId);
  });

  it("ranks multi-focus content independently of click order", () => {
    const entries = [entry("story", "story", ["gnosis"]), entry("character", "character", ["fatui"]), entry("overview", "version_overview", ["unknown"])];
    const first = rankPreheatEntries(entries, { ...query, focus: ["character", "story"] });
    const second = rankPreheatEntries(entries, { ...query, focus: ["story", "character"] });
    expect(first.map((item) => item.id)).toEqual(second.map((item) => item.id));
  });

  it("ranks character and overview questions differently", () => {
    const questions = ["纳西妲为什么与博士谈判？", "须弥节点怎样改变整个事件链？", "这一版本最需要知道什么？"];
    expect(rankSuggestedQuestions(questions, ["character"], "story")[0]).toContain("纳西妲");
    expect(rankSuggestedQuestions(questions, ["overview"], "casual")[0]).toContain("版本");
  });
});
