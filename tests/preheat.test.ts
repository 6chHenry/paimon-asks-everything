import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { namedProgress } from "@/data/preheat-region-guides";
import {
  defaultPreheatTopicId,
  preheatTopics,
} from "@/data/preheat-topics";
import { gnosisTimeline } from "@/data/gnosis-timeline";
import {
  getPreheatView,
  isValidPreheatTarget,
  validatePreheatCatalog,
} from "@/lib/preheat";

const base = {
  topicId: defaultPreheatTopicId,
  depth: "guided" as const,
  language: "zh-CN" as const,
  profile: "returning" as const,
  progress: "sumeru" as const,
  spoilerPreference: "low" as const,
  focus: ["story", "overview"] as Array<"story" | "overview">,
};

describe("preheat orchestration", () => {
  it("keeps the curated catalogs internally consistent", () => {
    expect(defaultPreheatTopicId).toBe("seven-gnosis-journeys");
    expect(preheatTopics).toHaveLength(3);
    expect(validatePreheatCatalog()).toEqual([]);
  });

  it("keeps all 21 region questions anchored in the timeline catalog", () => {
    expect(gnosisTimeline).toHaveLength(7);
    expect(gnosisTimeline.flatMap((node) => node.suggestedQuestionsZh)).toHaveLength(21);
    for (const node of gnosisTimeline) {
      expect(node.suggestedQuestionsZh).toHaveLength(3);
      expect(node.suggestedQuestionsEn).toHaveLength(3);
    }
  });

  it("does not restore the removed unresolved breakpoint", () => {
    const source = readFileSync(
      path.join(process.cwd(), "app", "preheat", "page.tsx"),
      "utf8",
    );
    expect(getPreheatView(base)).not.toHaveProperty("breakpoint");
    expect(source).not.toContain("PreheatBreakpointCard");
  });

  it("requests a named region instead of inventing generic personalization", () => {
    const view = getPreheatView({ ...base, progress: "unknown" });
    expect(view.kind).toBe("region_required");
    expect(view.selectedRegion).toBe("unknown");
    expect(view).not.toHaveProperty("timeline");
    expect(view).not.toHaveProperty("guide");
  });

  it("does not send story payloads to new players", () => {
    const view = getPreheatView({
      ...base,
      profile: "new",
      progress: "sumeru",
      depth: "research",
      spoilerPreference: "full",
    });
    expect(view.kind).toBe("new");
    if (view.kind !== "new") throw new Error("expected new view");
    expect(view.guide.factions.length).toBeGreaterThanOrEqual(3);
    expect(view.guide.storySteps).toHaveLength(3);
    expect(view).not.toHaveProperty("timeline");
    expect(view).not.toHaveProperty("availableRelationGraphs");
    expect(view).not.toHaveProperty("evidence");
  });

  it("recaps only the selected region for returning players", () => {
    const view = getPreheatView({
      ...base,
      profile: "returning",
      progress: "sumeru",
      depth: "research",
    });
    expect(view.kind).toBe("returning");
    if (view.kind !== "returning") throw new Error("expected returning view");
    expect(view.region).toBe("sumeru");
    expect(view.recap.points.length).toBeGreaterThanOrEqual(3);
    expect(view.recap.hooks.every((hook) => /[？?]$/.test(hook))).toBe(true);
    expect(view.recap.relationGraph?.id).toBe("sumeru-gnoses-graph");
    expect(view).not.toHaveProperty("availableRelationGraphs");
  });

  it("opens the complete released event chain for story players", () => {
    const view = getPreheatView({
      ...base,
      profile: "story",
      progress: "sumeru",
      depth: "guided",
      spoilerPreference: "none",
    });
    expect(view.kind).toBe("story");
    if (view.kind !== "story") throw new Error("expected story view");
    expect(view.timeline).toHaveLength(7);
    expect(view.timeline.every((node) => !node.locked)).toBe(true);
    expect(view.presentation.defaultTimelineId).toBe("sumeru-gnoses");
    expect(view.evidence.some((entry) => entry.factStatus === "narrative_implied")).toBe(true);
    expect(Object.keys(view.availableRelationGraphs).length).toBeGreaterThan(1);
  });

  it("makes legacy depth and focus inputs irrelevant to role content", () => {
    const guided = getPreheatView({ ...base, profile: "new", depth: "guided", focus: ["story"] });
    const research = getPreheatView({ ...base, profile: "new", depth: "research", focus: ["gameplay"] });
    expect(guided).toEqual(research);
  });

  it("returns a valid result for every named region and visible profile", () => {
    for (const progress of namedProgress) {
      expect(getPreheatView({ ...base, progress, profile: "new" }).kind, progress).toBe("new");
      expect(getPreheatView({ ...base, progress, profile: "returning" }).kind, progress).toBe("returning");
      expect(getPreheatView({ ...base, progress, profile: "story" }).kind, progress).toBe("story");
    }
  });

  it("validates interaction targets against the topic catalog", () => {
    expect(isValidPreheatTarget(base.topicId, "timeline_node_opened", "sumeru-gnoses")).toBe(true);
    expect(isValidPreheatTarget(base.topicId, "relation_node_opened", "dottore")).toBe(true);
    expect(isValidPreheatTarget(base.topicId, "timeline_node_opened", "fake-node")).toBe(false);
  });
});
