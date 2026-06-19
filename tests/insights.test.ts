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
});
