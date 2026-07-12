import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  defaultPreheatTopicId,
  preheatTopics,
} from "@/data/preheat-topics";
import {
  getPreheatView,
  isValidPreheatTarget,
  validatePreheatCatalog,
} from "@/lib/preheat";

const base = {
  topicId: "why-fatui-collect-gnoses",
  language: "zh-CN" as const,
  profile: "returning" as const,
  progress: "fontaine" as const,
  spoilerPreference: "low" as const,
  focus: ["story", "overview"] as Array<"story" | "overview">,
};

describe("preheat orchestration", () => {
  it("defaults the player-facing preheat to the seven Gnosis journeys", () => {
    expect(defaultPreheatTopicId).toBe("seven-gnosis-journeys");
    expect(
      preheatTopics.find((topic) => topic.id === defaultPreheatTopicId)
        ?.titleZh,
    ).toBe("七枚神之心分别经历了什么？");
  });

  it("removes developer-facing copy and the public evaluation page", () => {
    const topicsSource = readFileSync(
      path.join(process.cwd(), "data", "preheat-topics.ts"),
      "utf8",
    );
    const previewSource = readFileSync(
      path.join(process.cwd(), "app", "preview", "page.tsx"),
      "utf8",
    );
    const shellSource = readFileSync(
      path.join(process.cwd(), "components", "app-shell.tsx"),
      "utf8",
    );

    expect(topicsSource).not.toContain("暗示和猜想留在详情层");
    expect(previewSource).not.toContain("用固定问题快速检查实体识别");
    expect(shellSource).not.toContain("/evaluation");
    expect(
      existsSync(path.join(process.cwd(), "app", "evaluation", "page.tsx")),
    ).toBe(false);
  });

  it("keeps the curated catalog internally consistent", () => {
    expect(preheatTopics).toHaveLength(3);
    expect(validatePreheatCatalog()).toEqual([]);
  });

  it("gives all preheat topics the same version mystery and a locked question", () => {
    const mysteryIds = new Set(preheatTopics.map((topic) => topic.mysteryId));
    expect(mysteryIds).toEqual(new Set(["nodkrai-main-breakpoint"]));
    for (const topic of preheatTopics) {
      expect(topic.breakpoint.questionZh.trim()).not.toBe("");
      expect(topic.breakpoint.unlockLabelZh).toContain("至冬版本开启");
      expect(topic.breakpoint).not.toHaveProperty("answer");
      expect(topic.breakpoint).not.toHaveProperty("answerZh");
    }
  });

  it("localizes the unresolved breakpoint through an answer-free projection", () => {
    const view = getPreheatView({ ...base, depth: "guided" });

    expect(view.breakpoint).toMatchObject({
      id: "gnosis-final-purpose",
      mysteryId: "nodkrai-main-breakpoint",
      question: "收集神之心最终要启动什么？",
      unlockLabel: "至冬版本开启后揭晓",
    });
    expect(view.breakpoint).not.toHaveProperty("answer");
  });

  it("fills the default topic with an opening promise", () => {
    const topic = preheatTopics.find((item) => item.id === defaultPreheatTopicId);
    expect(topic?.introZh).toContain("已确认");
    expect(topic?.introZh).toContain("未解");
  });

  it("uses the seven-region event chain to shape the default follow-up questions", () => {
    const view = getPreheatView({
      ...base,
      topicId: defaultPreheatTopicId,
      depth: "research",
      progress: "nodkrai",
      spoilerPreference: "full",
    });

    expect(view.timeline).toHaveLength(7);
    for (const node of view.timeline) {
      expect(node.suggestedQuestions).toHaveLength(3);
      expect(node.suggestedQuestions.every((question) => question.length > 8)).toBe(true);
    }
  });

  it("gives every visible local relation node an unlocked detail summary", () => {
    const view = getPreheatView({
      ...base,
      depth: "research",
      progress: "nodkrai",
      spoilerPreference: "full",
    });

    for (const graph of Object.values(view.availableRelationGraphs)) {
      expect(graph.nodes.length, graph.id).toBeGreaterThan(0);
      for (const node of graph.nodes) {
        expect(node.details.length, `${graph.id}:${node.id}`).toBeGreaterThan(0);
        for (const detail of node.details) {
          expect(detail.title.trim(), detail.id).not.toBe("");
          expect(detail.summary.trim(), detail.id).not.toBe("");
          expect(detail.sourceUrl.trim(), detail.id).not.toBe("");
        }
      }
    }
  });

  it("returns two structurally distinct depth views without a model", () => {
    const guided = getPreheatView({ ...base, depth: "guided" });
    const research = getPreheatView({
      ...base,
      depth: "research",
    });

    expect(guided.timeline.length).toBeGreaterThan(0);
    expect(
      guided.evidence.every(
        (entry) => entry.factStatus !== "narrative_implied",
      ),
    ).toBe(true);
    expect(research.evidence.some((entry) => entry.factStatus === "narrative_implied")).toBe(true);
  });

  it("keeps guided mode progress-gated while research mode opens released later regions", () => {
    const guided = getPreheatView({ ...base, depth: "guided" });
    expect(
      guided.timeline.find((node) => node.id === "natlan-gnosis")?.locked,
    ).toBe(true);
    expect(
      guided.timeline.find((node) => node.id === "nodkrai-gnosis")?.locked,
    ).toBe(true);

    const research = getPreheatView({
      ...base,
      depth: "research",
      spoilerPreference: "full",
    });
    expect(
      research.timeline.find((node) => node.id === "natlan-gnosis")?.locked,
    ).toBe(false);
    expect(
      research.timeline.find((node) => node.id === "nodkrai-gnosis")?.locked,
    ).toBe(false);

    const nodkraiComplete = getPreheatView({
      ...base,
      depth: "guided",
      progress: "nodkrai",
      spoilerPreference: "none",
    });
    expect(
      nodkraiComplete.timeline.find((node) => node.id === "nodkrai-gnosis")
        ?.locked,
    ).toBe(false);
  });

  it("keeps depth guidance at the page level instead of inside the narration card", () => {
    const guided = getPreheatView({ ...base, depth: "guided" });
    const research = getPreheatView({
      ...base,
      depth: "research",
      spoilerPreference: "full",
    });

    expect(guided.narration.lead).toBe("");
    expect(research.narration.lead).toBe("");
    expect(guided.contentNotice).toContain("已过剧情回顾");
    expect(research.contentNotice).toContain("完整考据");
  });

  it("validates event targets against the selected topic catalog", () => {
    expect(
      isValidPreheatTarget(
        base.topicId,
        "timeline_node_opened",
        "sumeru-gnoses",
      ),
    ).toBe(true);
    expect(
      isValidPreheatTarget(base.topicId, "relation_node_opened", "dottore"),
    ).toBe(true);
    expect(
      isValidPreheatTarget(base.topicId, "timeline_node_opened", "fake-node"),
    ).toBe(false);
  });

  it("changes presentation by profile without changing spoiler locks", () => {
    const newcomer = getPreheatView({ ...base, depth: "guided", progress: "sumeru", profile: "new", focus: ["story"] });
    const story = getPreheatView({ ...base, depth: "guided", progress: "sumeru", profile: "story", focus: ["character"] });
    expect(newcomer.presentation).not.toEqual(story.presentation);
    expect(newcomer.timeline.find((node) => node.id === "fontaine-gnosis")?.locked).toBe(true);
    expect(story.timeline.find((node) => node.id === "fontaine-gnosis")?.locked).toBe(true);
  });

  it("keeps multi-focus output stable regardless of query order", () => {
    const first = getPreheatView({ ...base, depth: "research", focus: ["character", "story"] });
    const second = getPreheatView({ ...base, depth: "research", focus: ["story", "character"] });
    expect(first.narration.points).toEqual(second.narration.points);
    expect(first.timeline.map((node) => node.suggestedQuestions)).toEqual(
      second.timeline.map((node) => node.suggestedQuestions),
    );
  });
});
