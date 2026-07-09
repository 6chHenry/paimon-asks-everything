import { describe, expect, it } from "vitest";
import {
  computeReleaseDecisions,
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
