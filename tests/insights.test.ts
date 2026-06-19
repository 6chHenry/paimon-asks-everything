import { describe, expect, it } from "vitest";
import { historicalEvents } from "@/data/events";
import { aggregateInsights } from "@/lib/insights";

describe("insight aggregation", () => {
  it("derives signals and traceable draft recommendations", () => {
    const result = aggregateInsights(historicalEvents);
    expect(result.total).toBe(historicalEvents.length);
    expect(result.signals.length).toBeGreaterThan(0);
    expect(result.recommendations.length).toBe(result.signals.length);
    expect(result.recommendations.every((item) => item.status === "draft")).toBe(
      true,
    );
  });

  it("summarizes player confusion into plain-language strategy cards", () => {
    const result = aggregateInsights(historicalEvents) as ReturnType<
      typeof aggregateInsights
    > & {
      briefingCards?: Array<{
        titleZh: string;
        plainSummaryZh: string;
        playerNeedZh: string;
        strategyZh: string;
        affectedPlayers: string;
        evidenceItems: string[];
      }>;
    };

    expect(result.briefingCards?.length).toBeGreaterThan(0);
    expect(result.briefingCards?.[0]).toMatchObject({
      titleZh: expect.stringContaining("玩家"),
      plainSummaryZh: expect.stringContaining("困惑"),
      playerNeedZh: expect.any(String),
      strategyZh: expect.any(String),
      affectedPlayers: expect.any(String),
    });
    expect(result.briefingCards?.[0]?.evidenceItems.length).toBeGreaterThan(0);
  });
});
