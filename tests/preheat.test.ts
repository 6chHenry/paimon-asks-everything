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
    expect(guided.contentNotice).toContain("3 分钟");
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
});
