import { describe, expect, it } from "vitest";
import { loadReleaseLabReport } from "@/lib/release-lab";

describe("release lab artifact contract", () => {
  it("loads truthfully labelled synthetic reports", () => {
    const report = loadReleaseLabReport();

    expect(report.pvUplift.dataMode).toBe(
      "synthetic_randomized_experiment",
    );
    expect(report.channelAttribution.dataMode).toBe(
      "synthetic_randomized_experiment",
    );
    expect(report.channelAttribution.evidenceStrength).toBe(
      "randomized_demo",
    );
    expect(report.channelAttribution.groups).toHaveLength(4);
  });

  it("only targets segments whose interval clears zero and the business threshold", () => {
    const report = loadReleaseLabReport();
    const threshold =
      report.pvUplift.methodology.decisionThresholdPoints;

    for (const segment of report.pvUplift.segments) {
      if (segment.decision === "target") {
        expect(segment.recommendedTreatmentId).not.toBe("control");
        expect(segment.recommendedUplift.ci95Low).toBeGreaterThanOrEqual(
          threshold,
        );
      } else {
        expect(segment.recommendedTreatmentId).toBe("control");
      }
    }
  });

  it("keeps Shapley allocation scoped to joint incremental uplift", () => {
    const decomposition = loadReleaseLabReport().channelAttribution
      .d30Retention;

    expect(decomposition.shareDenominator).toBe(
      "joint_incremental_uplift",
    );
    expect(
      decomposition.influencer.shapleyPoints
        + decomposition.expo.shapleyPoints,
    ).toBeCloseTo(decomposition.jointUpliftPoints, 4);
    expect(
      decomposition.influencer.allocationShare
        + decomposition.expo.allocationShare,
    ).toBeCloseTo(1, 6);
  });

  it("never leaks outcome or treatment fields into PV features", () => {
    const features =
      loadReleaseLabReport().pvUplift.methodology.featureColumns;

    expect(features).not.toContain("retained_d30");
    expect(features).not.toContain("retained_d7");
    expect(features).not.toContain("ltv_d30");
    expect(features).not.toContain("treatment");
  });
});
