import { z } from "zod";
import channelAttributionArtifact from "@/artifacts/release-lab/channel-attribution.json";
import pvUpliftArtifact from "@/artifacts/release-lab/pv-uplift.json";

const finiteNumber = z.number().finite();
const rate = finiteNumber.min(0).max(1);
const syntheticMode = z.literal("synthetic_randomized_experiment");

const treatmentMetadataSchema = z
  .object({
    id: z.string().min(1),
    labelZh: z.string().min(1),
    labelEn: z.string().min(1),
    creativeAngleZh: z.string().min(1),
  })
  .strict();

const treatmentEstimateSchema = z
  .object({
    treatmentId: z.string().min(1),
    labelZh: z.string().min(1),
    expectedD30Rate: rate,
    upliftPoints: finiteNumber,
    ci95Low: finiteNumber,
    ci95High: finiteNumber,
  })
  .strict()
  .refine((value) => value.ci95Low <= value.ci95High, {
    message: "PV confidence interval must be ordered",
  });

const segmentDecisionSchema = z
  .object({
    segmentId: z.string().min(1),
    labelZh: z.string().min(1),
    labelEn: z.string().min(1),
    testSamples: z.number().int().positive(),
    decision: z.enum(["target", "hold"]),
    recommendedTreatmentId: z.string().min(1),
    recommendedTreatmentLabelZh: z.string().min(1),
    recommendedUplift: z
      .object({
        points: finiteNumber,
        ci95Low: finiteNumber,
        ci95High: finiteNumber,
      })
      .strict(),
    holdoutRate: rate,
    reasonCodesZh: z.array(z.string().min(1)).min(1),
    treatments: z.array(treatmentEstimateSchema).min(2),
  })
  .strict();

export const pvUpliftReportSchema = z
  .object({
    schemaVersion: z.literal("release-lab.pv-uplift.v1"),
    modelVersion: z.string().min(1),
    dataMode: syntheticMode,
    disclosureZh: z.string().min(1),
    outcome: z
      .object({
        primary: z.literal("retained_d30"),
        supporting: z.array(z.enum(["retained_d7", "ltv_d30"])).min(1),
        featureWindowZh: z.string().min(1),
        labelWindowZh: z.string().min(1),
      })
      .strict(),
    methodology: z
      .object({
        estimand: z.string().min(1),
        model: z.string().min(1),
        assignment: z.string().min(1),
        featureColumns: z.array(z.string().min(1)).min(1),
        confidenceInterval: z.string().min(1),
        decisionThresholdPoints: finiteNumber.positive(),
      })
      .strict(),
    treatments: z.array(treatmentMetadataSchema).min(2),
    segments: z.array(segmentDecisionSchema).min(1),
    evaluation: z
      .object({
        trainSamples: z.number().int().positive(),
        testSamples: z.number().int().positive(),
        randomizedPropensity: rate.positive(),
        policyValue: rate,
        controlValue: rate,
        incrementalPolicyValuePoints: finiteNumber,
        treatmentMetrics: z
          .array(
            z
              .object({
                treatmentId: z.string().min(1),
                labelZh: z.string().min(1),
                auuc: finiteNumber,
              })
              .strict(),
          )
          .min(1),
      })
      .strict(),
  })
  .strict()
  .superRefine((report, context) => {
    const treatmentIds = new Set(
      report.treatments.map((treatment) => treatment.id),
    );
    if (!treatmentIds.has("control")) {
      context.addIssue({
        code: "custom",
        message: "PV report must include a no-contact control",
      });
    }
    for (const segment of report.segments) {
      if (!treatmentIds.has(segment.recommendedTreatmentId)) {
        context.addIssue({
          code: "custom",
          message: `Unknown treatment for segment ${segment.segmentId}`,
        });
      }
      if (
        segment.decision === "target"
        && segment.recommendedUplift.ci95Low
          < report.methodology.decisionThresholdPoints
      ) {
        context.addIssue({
          code: "custom",
          message: `Unsafe targeting interval for segment ${segment.segmentId}`,
        });
      }
      if (
        segment.decision === "hold"
        && segment.recommendedTreatmentId !== "control"
      ) {
        context.addIssue({
          code: "custom",
          message: `Hold decision must use control for segment ${segment.segmentId}`,
        });
      }
    }
  });

const channelGroupSchema = z
  .object({
    groupId: z.enum([
      "control",
      "influencer_only",
      "expo_only",
      "both",
    ]),
    labelZh: z.string().min(1),
    influencer: z.boolean(),
    expo: z.boolean(),
    sampleSize: z.number().int().positive(),
    reservationRate: rate,
    activationRate: rate,
    d7RetentionRate: rate,
    d30RetentionRate: rate,
    averageLtv30: finiteNumber.nonnegative(),
  })
  .strict();

const intervalSchema = z
  .object({
    ci95Low: finiteNumber,
    ci95High: finiteNumber,
  })
  .strict()
  .refine((value) => value.ci95Low <= value.ci95High, {
    message: "Confidence interval must be ordered",
  });

const allocationSchema = z
  .object({
    directPoints: finiteNumber,
    marginalWithOtherPoints: finiteNumber,
    shapleyPoints: finiteNumber,
    allocationShare: rate,
    ci95Low: finiteNumber,
    ci95High: finiteNumber,
  })
  .strict();

export const channelAttributionReportSchema = z
  .object({
    schemaVersion: z.literal("release-lab.channel-attribution.v1"),
    experimentVersion: z.string().min(1),
    dataMode: syntheticMode,
    evidenceStrength: z.literal("randomized_demo"),
    disclosureZh: z.string().min(1),
    estimand: z.string().min(1),
    assignment: z
      .object({
        method: z.literal("randomized_factorial"),
        cellPropensity: z.literal(0.25),
        sampleSize: z.number().int().positive(),
      })
      .strict(),
    groups: z.array(channelGroupSchema).length(4),
    d30Retention: z
      .object({
        baselineRate: rate,
        jointRate: rate,
        jointUpliftPoints: finiteNumber,
        jointInterval: intervalSchema,
        interactionPoints: finiteNumber,
        interactionInterval: intervalSchema,
        shareDenominator: z.literal("joint_incremental_uplift"),
        allocationDisclosureZh: z.string().min(1),
        influencer: allocationSchema,
        expo: allocationSchema,
      })
      .strict(),
    methodology: z
      .object({
        mainEffectZh: z.string().min(1),
        interactionZh: z.string().min(1),
        allocationZh: z.string().min(1),
        confidenceInterval: z.string().min(1),
        productionFallbackZh: z.string().min(1),
      })
      .strict(),
  })
  .strict()
  .superRefine((report, context) => {
    const groupIds = new Set(report.groups.map((group) => group.groupId));
    for (const groupId of [
      "control",
      "influencer_only",
      "expo_only",
      "both",
    ]) {
      if (!groupIds.has(groupId as (typeof report.groups)[number]["groupId"])) {
        context.addIssue({
          code: "custom",
          message: `Missing randomized cell ${groupId}`,
        });
      }
    }
    const allocated =
      report.d30Retention.influencer.shapleyPoints
      + report.d30Retention.expo.shapleyPoints;
    if (Math.abs(allocated - report.d30Retention.jointUpliftPoints) > 0.001) {
      context.addIssue({
        code: "custom",
        message: "Shapley components must sum to joint uplift",
      });
    }
  });

export type PvUpliftReport = z.infer<typeof pvUpliftReportSchema>;
export type ChannelAttributionReport = z.infer<
  typeof channelAttributionReportSchema
>;

export interface ReleaseLabReport {
  pvUplift: PvUpliftReport;
  channelAttribution: ChannelAttributionReport;
}

let cachedReport: ReleaseLabReport | null = null;

export function loadReleaseLabReport(): ReleaseLabReport {
  if (cachedReport) return cachedReport;

  cachedReport = {
    pvUplift: pvUpliftReportSchema.parse(pvUpliftArtifact),
    channelAttribution: channelAttributionReportSchema.parse(
      channelAttributionArtifact,
    ),
  };
  return cachedReport;
}
