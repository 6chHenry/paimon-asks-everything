import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
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

  it("removes the unresolved breakpoint from the catalog and response", () => {
    const view = getPreheatView({ ...base, depth: "guided" });
    const topicSource = readFileSync(
      path.join(process.cwd(), "data", "preheat-topics.ts"),
      "utf8",
    );
    const pageSource = readFileSync(
      path.join(process.cwd(), "app", "preheat", "page.tsx"),
      "utf8",
    );
    const cssSource = readFileSync(
      path.join(process.cwd(), "app", "globals.css"),
      "utf8",
    );

    expect(view).not.toHaveProperty("breakpoint");
    expect(topicSource).not.toContain("mysteryId");
    expect(topicSource).not.toContain("breakpoint:");
    expect(pageSource).not.toContain("PreheatBreakpointCard");
    expect(cssSource).not.toContain(".preheat-breakpoint");
  });

  it("keeps the default topic focused on confirmed events", () => {
    const topic = preheatTopics.find((item) => item.id === defaultPreheatTopicId);
    expect(topic?.introZh).toContain("已确认");
    expect(topic?.introZh).not.toContain("未解");
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

  it("keeps all 21 event-chain questions anchored to released story facts", () => {
    const expectedQuestions = {
      "mondstadt-gnosis": [
        "风神之心是在什么情境下被女士夺走的？",
        "风神之心被夺后，剧情已确认由谁掌握？",
        "蒙德的夺取与璃月的契约交付，在取得方式上有哪些明确差异？",
      ],
      "liyue-gnosis": [
        "钟离交付岩神之心时，剧情明确说明了哪些契约边界？",
        "岩神之心由谁依契约领取？",
        "璃月主线中，钟离假死、送仙典仪与契约交付的事件顺序是什么？",
      ],
      "inazuma-gnosis": [
        "雷电影为何将雷神之心交由八重神子保管？",
        "八重神子为何把雷神之心交给散兵？",
        "散兵带走雷神之心后，须弥主线中它如何回到纳西妲手中？",
      ],
      "sumeru-gnoses": [
        "纳西妲与博士谈判时，雷神之心交换了什么？",
        "草神之心交付博士换取了什么信息？",
        "谈判结束后，雷、草两枚神之心的已确认保管方是谁？",
      ],
      "fontaine-gnosis": [
        "在枫丹危机后，谁把水神之心交给仆人，剧情给出的交付理由是什么？",
        "水神之心交接时，交付者、接受者与已确认背景各是什么？",
        "水神之心交出前，芙卡洛斯、那维莱特与谕示裁定枢机分别扮演什么角色？",
      ],
      "natlan-gnosis": [
        "队长在纳塔最初承担的火神之心任务是什么？",
        "纳塔主线结束时，队长为何没有带走火神之心？",
        "玛薇卡如何把火神之心纳入应对深渊危机的计划？",
      ],
      "nodkrai-gnosis": [
        "火神之心已确认由谁交给纳西妲借用？",
        "纳西妲为何借用火神之心焚毁受腐蚀的世界树？",
        "焚毁受腐蚀的世界树后，火神之心的已确认状态是什么？",
      ],
    } as const;

    expect(gnosisTimeline).toHaveLength(7);
    expect(gnosisTimeline.flatMap((node) => node.suggestedQuestionsZh)).toHaveLength(21);
    for (const node of gnosisTimeline) {
      expect(node.suggestedQuestionsZh).toEqual(expectedQuestions[node.id as keyof typeof expectedQuestions]);
    }
    const englishQuestions = gnosisTimeline.flatMap((node) => node.suggestedQuestionsEn).join("\n");
    expect(englishQuestions).not.toContain("Focalors give the Hydro Gnosis");
    expect(englishQuestions).not.toContain("Pyro Gnosis during the burning of Irminsul");
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
