import { describe, expect, it } from "vitest";
import {
  computeReleaseDecisions,
  decisionKindLabelZh,
  type ReleaseInsightsInput,
} from "@/lib/release-insights";

const baseInput: ReleaseInsightsInput = {
  total: 12,
  liveCount: 4,
  historicalCount: 8,
  lastUpdated: "2026-07-09T10:00:00.000Z",
  languages: [{ key: "zh-CN", count: 12 }],
  profiles: [
    { key: "returning", count: 5 },
    { key: "story", count: 4 },
    { key: "exploration", count: 3 },
  ],
  topics: [{ key: "tsaritsa_goal", count: 5 }],
  signals: [],
  preheat: {
    total: 60,
    historicalCount: 40,
    liveCount: 20,
    topics: [{ key: "tsaritsa-known-unknown", count: 30 }],
    timelineNodes: [],
    relationNodes: [{ key: "tsaritsa", count: 30 }],
  },
};

describe("release insight localization", () => {
  it("labels meeting decisions in Chinese", () => {
    expect(decisionKindLabelZh("amplify")).toBe("放大");
    expect(decisionKindLabelZh("explain")).toBe("解释");
    expect(decisionKindLabelZh("hold")).toBe("暂缓");
  });

  it("keeps generated Chinese recommendations free of internal profile keys", () => {
    const result = computeReleaseDecisions(baseInput);
    const recommendation = result.actions.find(
      (action) => action.topicId === "tsaritsa_goal",
    );

    expect(recommendation?.format).toBe("social_post");
    expect(recommendation?.recommendedActionZh).toContain("社媒内容");
    expect(recommendation?.recommendedActionZh).toContain("回归玩家");
    expect(recommendation?.recommendedActionZh).toContain("剧情党玩家");
    expect(recommendation?.recommendedActionZh).toContain("探索型玩家");
    expect(recommendation?.recommendedActionZh).not.toMatch(
      /\b(returning|story|exploration|all)\b/,
    );
  });
});

describe("release decision classification", () => {
  it("classifies a high-risk topic as an explanation action with verification", () => {
    const result = computeReleaseDecisions({
      ...baseInput,
      topics: [{ key: "tsaritsa_goal", count: 20 }],
      preheat: {
        ...baseInput.preheat,
        topics: [{ key: "tsaritsa-known-unknown", count: 20 }],
        relationNodes: [],
      },
    });
    const action = result.actions.find((item) => item.topicId === "tsaritsa_goal");
    expect(action?.decisionKind).toBe("explain");
    expect(action?.recommendedActionZh).toContain("FAQ");
    expect(action?.verificationZh).toContain("重复提问");
    expect(action?.evidenceRefs.length).toBeGreaterThan(0);
  });

  it("marks low-sample topics as hold instead of amplifying them", () => {
    const result = computeReleaseDecisions({
      ...baseInput,
      total: 2,
      historicalCount: 2,
      liveCount: 0,
      topics: [{ key: "tsaritsa_goal", count: 1 }],
      preheat: { ...baseInput.preheat, total: 1, historicalCount: 1, liveCount: 0, topics: [] },
    });
    const action = result.actions.find((item) => item.topicId === "tsaritsa_goal");
    expect(action?.decisionKind).toBe("hold");
    expect(action?.recommendedActionZh).toContain("观察");
  });
});
