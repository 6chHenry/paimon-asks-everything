/**
 * Release Decision Center — scoring engine.
 *
 * Consumes the output of `aggregateInsights` (the existing base insight data)
 * and produces the new data model: release actions, comprehension risks,
 * opportunity / risk scores, and confidence levels.
 *
 * All scores are rule-based and deterministic. AI is never used to modify
 * scores — only to translate them into plain-language explanations (see
 * release-insight-copy.ts).
 */

import {
  listReleaseTopics,
  type ReleaseTopic,
} from "@/data/release-topic-map";

/* ------------------------------------------------------------------ */
/*  Input shape — the minimum fields the engine needs from the API     */
/* ------------------------------------------------------------------ */

export interface ReleaseInsightsInput {
  total: number;
  liveCount: number;
  historicalCount: number;
  lastUpdated: string;
  languages: Array<{ key: string; count: number }>;
  profiles: Array<{ key: string; count: number }>;
  topics: Array<{ key: string; count: number }>;
  signals: Array<{ type: string; topic: string }>;
  preheat: {
    total: number;
    historicalCount: number;
    liveCount: number;
    topics: Array<{ key: string; count: number }>;
    timelineNodes: Array<{ key: string; count: number }>;
    relationNodes: Array<{ key: string; count: number }>;
  };
}

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export type ReleaseFormat =
  | "preheat_feature"
  | "faq"
  | "relationship_map"
  | "timeline"
  | "social_post";

export type ReleaseWindow = "week_1" | "week_2" | "week_3_4" | "watch";

export type Confidence = "high" | "medium" | "low";

export type RiskSeverity = "high" | "medium" | "low" | "insufficient_data";

export interface ReleaseAction {
  id: string;
  topicId: string;
  titleZh: string;
  titleEn: string;
  format: ReleaseFormat;
  window: ReleaseWindow;
  opportunityScore: number;
  riskScore: number;
  confidence: Confidence;
  targetProfiles: string[];
  rationaleZh: string;
  rationaleEn: string;
  recommendedActionZh: string;
  recommendedActionEn: string;
  reusableModules: string[];
  evidenceRefs: string[];
}

export interface ComprehensionRisk {
  id: string;
  topicId: string;
  severity: RiskSeverity;
  confidence: Confidence;
  titleZh: string;
  titleEn: string;
  misunderstandingZh: string;
  misunderstandingEn: string;
  affectedProfiles: string[];
  mitigationZh: string;
  mitigationEn: string;
  evidenceRefs: string[];
}

export interface ReleaseDecisionData {
  /** Primary / highest-priority action. */
  primaryAction: ReleaseAction | null;
  /** Full ranked list of actions. */
  actions: ReleaseAction[];
  /** Risks sorted by severity descending. */
  risks: ComprehensionRisk[];
  /** Data freshness info. */
  dataStatus: {
    lastUpdated: string;
    historicalSamples: number;
    liveSamples: number;
    externalTrends: "not_connected" | "connected";
  };
  /** Which actions are currently visible (top N, rest collapsed). */
  visibleActionCount: number;
  /** Which risks are currently visible. */
  visibleRiskCount: number;
}

/* ------------------------------------------------------------------ */
/*  Scoring helpers                                                    */
/* ------------------------------------------------------------------ */

/** Normalise a value to 0–100. */
function clampScore(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

/** Simple logistic-like scale: maps 0..N to 0..100, saturating at ~30. */
function volumeToScore(count: number, saturation = 30): number {
  const raw = (count / saturation) * 100;
  return clampScore(raw);
}

/** Confidence based on sample sizes and signal consistency. */
function deriveConfidence(
  sampleCount: number,
  signalCount: number,
  liveRatio: number,
): Confidence {
  if (sampleCount < 10) return "low";
  if (sampleCount < 30 && liveRatio < 0.15) return "low";
  if (signalCount >= 2 && sampleCount >= 30) return "high";
  if (signalCount >= 2) return "medium";
  return "low";
}

/* ------------------------------------------------------------------ */
/*  Core computation                                                   */
/* ------------------------------------------------------------------ */

export function computeReleaseDecisions(
  input: ReleaseInsightsInput,
): ReleaseDecisionData {
  const topics = computeTopicScores(input);

  const actions = buildActions(topics, input);
  const risks = buildRisks(topics, input);

  const primaryAction = actions.length > 0 ? actions[0] : null;

  return {
    primaryAction,
    actions,
    risks,
    dataStatus: {
      lastUpdated: input.lastUpdated,
      historicalSamples: input.historicalCount + input.preheat.historicalCount,
      liveSamples: input.liveCount + input.preheat.liveCount,
      externalTrends: "not_connected",
    },
    visibleActionCount: 3,
    visibleRiskCount: 3,
  };
}

/* ------------------------------------------------------------------ */
/*  Topic-level scoring                                                */
/* ------------------------------------------------------------------ */

interface ScoredTopic {
  topic: ReleaseTopic;
  /** Total question count across mapped confusion topics. */
  questionCount: number;
  /** Total preheat interaction count across mapped preheat topics. */
  preheatCount: number;
  /** Total timeline node clicks. */
  timelineClicks: number;
  /** Total graph node interactions (relation clicks + analysis). */
  graphClicks: number;
  /** Number of distinct player profiles engaged. */
  profileCount: number;
  /** Share of live (recent) samples among total. */
  liveRatio: number;
  /** opportunityScore 0–100 */
  opportunityScore: number;
  /** riskScore 0–100 */
  riskScore: number;
  /** confidence */
  confidence: Confidence;
  /** How many distinct signal types contributed. */
  signalCount: number;
}

function computeTopicScores(input: ReleaseInsightsInput): ScoredTopic[] {
  const topics = listReleaseTopics();

  return topics
    .map((topic) => {
      /* ---- Aggregate signals ---- */
      const questionCount = topic.questionTopicIds.reduce(
        (sum, qId) =>
          sum +
          (input.topics.find((t) => t.key === qId)?.count ?? 0),
        0,
      );

      const preheatCount = topic.preheatTopicIds.reduce(
        (sum, pId) =>
          sum +
          (input.preheat.topics.find((t) => t.key === pId)?.count ?? 0),
        0,
      );

      const timelineClicks = topic.timelineNodeIds.reduce(
        (sum, nId) =>
          sum +
          (input.preheat.timelineNodes.find((t) => t.key === nId)?.count ??
            0),
        0,
      );

      const graphClicks = topic.graphNodeIds.reduce(
        (sum, nId) =>
          sum +
          (input.preheat.relationNodes.find((t) => t.key === nId)?.count ??
            0),
        0,
      );

      /* ---- Player profiles engaged ---- */
      const profileCount = input.profiles.length;

      /* ---- Live ratio ---- */
      const totalSamples = questionCount + preheatCount;
      const liveRatio =
        totalSamples > 0
          ? (input.liveCount + input.preheat.liveCount) /
            (input.total + input.preheat.total || 1)
          : 0;

      /* ---- Signal count (types of evidence available) ---- */
      let signalCount = 0;
      if (questionCount > 0) signalCount++;
      if (preheatCount > 0) signalCount++;
      if (timelineClicks > 0) signalCount++;
      if (graphClicks > 0) signalCount++;

      /* ---- opportunityScore ---- */
      // Active interest: preheat + timeline + graph clicks
      const activeInterest = preheatCount + timelineClicks + graphClicks;
      const interestScore = volumeToScore(activeInterest, 25) * 0.3;

      // Understanding need: question volume
      const needScore = volumeToScore(questionCount, 20) * 0.3;

      // Coverage: how many profiles × signal variety
      const coverageRaw =
        (profileCount / 5) * 50 + signalCount * 12.5;
      const coverageScore = clampScore(coverageRaw) * 0.2;

      // Growth: live ratio as a proxy for momentum
      const growthScore = clampScore(liveRatio * 100) * 0.1;

      // Producibility: how many formats are available
      const formatScore =
        clampScore((topic.availableFormats.length / 5) * 100) * 0.1;

      const opportunityScore = clampScore(
        interestScore + needScore + coverageScore + growthScore + formatScore,
      );

      /* ---- riskScore ---- */
      // Follow-up density: high question-to-interest ratio
      const totalInterest = activeInterest || 1;
      const followUpRatio = Math.min(1, questionCount / totalInterest);
      const followUpScore = clampScore(followUpRatio * 100) * 0.3;

      // Fact-vs-speculation risk: based on whether this topic has
      // known/unknown ambiguity (proxied by question + interest both high)
      const factVsSpec =
        questionCount >= 8 && activeInterest >= 12 ? 65 : 25;
      const factScore = factVsSpec * 0.25;

      // Retrieval difficulty: proxied by existing signals about this topic
      const retrievalScore =
        signalCount <= 1 ? 70 : signalCount === 2 ? 40 : 20;
      const retrievalWeighted = retrievalScore * 0.2;

      // Profile concentration: if a single profile dominates
      const profileConcentration = profileCount <= 2 ? 70 : 30;
      const profileWeighted = profileConcentration * 0.15;

      // Language gap: check if this topic appears in signals
      const hasLangGap = input.signals.some(
        (s) =>
          s.type === "language_gap" &&
          topic.questionTopicIds.includes(s.topic),
      );
      const langScore = hasLangGap ? 75 : 15;
      const langWeighted = langScore * 0.1;

      const riskScore = clampScore(
        followUpScore +
          factScore +
          retrievalWeighted +
          profileWeighted +
          langWeighted,
      );

      const confidence = deriveConfidence(
        totalSamples,
        signalCount,
        liveRatio,
      );

      return {
        topic,
        questionCount,
        preheatCount,
        timelineClicks,
        graphClicks,
        profileCount,
        liveRatio,
        opportunityScore,
        riskScore,
        confidence,
        signalCount,
      };
    })
    .filter((t) => t.opportunityScore > 0 || t.riskScore > 0)
    .sort((a, b) => b.opportunityScore - a.opportunityScore);
}

/* ------------------------------------------------------------------ */
/*  Build release actions                                              */
/* ------------------------------------------------------------------ */

const FORMAT_LABELS: Record<ReleaseFormat, [string, string]> = {
  preheat_feature: ["预热专题", "Preheat feature"],
  faq: ["FAQ", "FAQ"],
  relationship_map: ["角色关系图", "Relationship map"],
  timeline: ["时间线", "Timeline"],
  social_post: ["社媒内容", "Social post"],
};

const FORMAT_MODULES: Record<ReleaseFormat, string[]> = {
  preheat_feature: ["preheat", "timeline", "wiki_profile"],
  faq: ["faq"],
  relationship_map: ["relationship_graph", "wiki_profile"],
  timeline: ["timeline"],
  social_post: ["wiki_profile"],
};

function pickBestFormat(topic: ReleaseTopic, scored: ScoredTopic): ReleaseFormat {
  const available = topic.availableFormats;
  if (available.length === 0) return "faq";

  // High opportunity + high risk → comprehensive formats
  if (scored.opportunityScore >= 50 && scored.riskScore >= 50) {
    return (
      (available.includes("preheat_feature")
        ? "preheat_feature"
        : available.includes("timeline")
          ? "timeline"
          : available[0]) as ReleaseFormat
    );
  }

  // High opportunity + low risk → amplify (social or timeline)
  if (scored.opportunityScore >= 50 && scored.riskScore < 40) {
    return (
      (available.includes("timeline")
        ? "timeline"
        : available.includes("social_post")
          ? "social_post"
          : available[0]) as ReleaseFormat
    );
  }

  // Low opportunity + high risk → FAQ (explain, don't amplify)
  if (scored.opportunityScore < 40 && scored.riskScore >= 50) {
    return "faq";
  }

  // Default: first available
  return available[0] as ReleaseFormat;
}

function assignWindow(
  scored: ScoredTopic,
  index: number,
): ReleaseWindow {
  if (scored.confidence === "low" || scored.opportunityScore < 20) return "watch";
  if (index === 0) return "week_1";
  if (index === 1) return "week_2";
  return "week_3_4";
}

function buildTargetProfiles(scored: ScoredTopic): string[] {
  const profiles: string[] = [];
  if (scored.questionCount >= 5) profiles.push("returning");
  if (scored.preheatCount >= 5) profiles.push("story");
  if (scored.timelineClicks >= 3) profiles.push("story");
  if (scored.graphClicks >= 3) profiles.push("exploration");
  if (profiles.length === 0) profiles.push("all");
  return [...new Set(profiles)];
}

function buildActions(
  scoredTopics: ScoredTopic[],
  input: ReleaseInsightsInput,
): ReleaseAction[] {
  return scoredTopics.slice(0, 6).map((scored, index) => {
    const format = pickBestFormat(scored.topic, scored);
    const window = assignWindow(scored, index);
    const profiles = buildTargetProfiles(scored);
    const formatLabel = FORMAT_LABELS[format];

    const rationaleZh =
      scored.signalCount >= 2
        ? `玩家不仅频繁点开「${scored.topic.labelZh}」，还持续追问相关内容，因此它同时具备热度和解释需求。`
        : scored.questionCount > 0
          ? `玩家在「${scored.topic.labelZh}」上反复提问，说明现有信息不足以让玩家顺利理解。`
          : `玩家对「${scored.topic.labelZh}」表现出主动兴趣，适合放大传播。`;

    const rationaleEn =
      scored.signalCount >= 2
        ? `Players are both clicking into "${scored.topic.labelEn}" and asking follow-up questions — it has both heat and a need for explanation.`
        : scored.questionCount > 0
          ? `Players keep asking about "${scored.topic.labelEn}" — existing content isn't making it clear.`
          : `Players show active interest in "${scored.topic.labelEn}" — great for amplification.`;

    const recommendedActionZh =
      format === "preheat_feature"
        ? `组合：${scored.topic.availableFormats
            .map((f) => FORMAT_LABELS[f][0])
            .join(" + ")}。建议第 ${window === "week_1" ? "1" : window === "week_2" ? "2" : "3"} 周发布。`
        : format === "faq"
          ? `制作一篇 FAQ，先给结论再列背景。建议第 ${window === "week_1" ? "1" : window === "week_2" ? "2" : "3"} 周发布。`
          : `建议以 ${formatLabel[0]} 形式发布，目标 ${profiles.join("、")} 玩家。`;

    const recommendedActionEn =
      format === "preheat_feature"
        ? `Combine: ${scored.topic.availableFormats.map((f) => FORMAT_LABELS[f][1]).join(" + ")}. Publish ${window === "week_1" ? "week 1" : window === "week_2" ? "week 2" : "week 3"}.`
        : `Publish a FAQ — lead with the conclusion, then background. Publish ${window === "week_1" ? "week 1" : window === "week_2" ? "week 2" : "week 3"}.`;

    return {
      id: `action-${scored.topic.id}-${format}`,
      topicId: scored.topic.id,
      titleZh: scored.topic.labelZh,
      titleEn: scored.topic.labelEn,
      format,
      window,
      opportunityScore: scored.opportunityScore,
      riskScore: scored.riskScore,
      confidence: scored.confidence,
      targetProfiles: profiles,
      rationaleZh,
      rationaleEn,
      recommendedActionZh,
      recommendedActionEn,
      reusableModules: FORMAT_MODULES[format],
      evidenceRefs: [
        ...(scored.questionCount > 0
          ? [`questions:${scored.questionCount}`]
          : []),
        ...(scored.preheatCount > 0
          ? [`preheat:${scored.preheatCount}`]
          : []),
        ...(scored.timelineClicks > 0
          ? [`timeline:${scored.timelineClicks}`]
          : []),
        ...(scored.graphClicks > 0
          ? [`graph:${scored.graphClicks}`]
          : []),
      ],
    };
  });
}

/* ------------------------------------------------------------------ */
/*  Build comprehension risks                                          */
/* ------------------------------------------------------------------ */

function buildRisks(
  scoredTopics: ScoredTopic[],
  input: ReleaseInsightsInput,
): ComprehensionRisk[] {
  const risks: ComprehensionRisk[] = [];

  for (const scored of scoredTopics) {
    // Only topics with meaningful risk
    if (scored.riskScore < 20) continue;

    const profiles = buildTargetProfiles(scored);

    // Determine risk type
    const isEventVsMotive =
      scored.questionCount >= 6 && scored.preheatCount >= 8;
    const isNameConfusion =
      scored.topic.id === "harbinger_hierarchy";
    const isKnownUnknown =
      scored.topic.id === "gnosis_purpose" ||
      scored.topic.id === "tsaritsa_goal";

    const severity: RiskSeverity =
      scored.riskScore >= 60
        ? "high"
        : scored.riskScore >= 35
          ? "medium"
          : "low";

    let misunderstandingZh: string;
    let misunderstandingEn: string;
    let mitigationZh: string;
    let mitigationEn: string;

    if (isEventVsMotive) {
      misunderstandingZh = `玩家能看到「${scored.topic.labelZh}」确认发生的事件，但会继续追问「为什么」，说明事件专题不能代替动机解释。`;
      misunderstandingEn = `Players can see the confirmed events around "${scored.topic.labelEn}" but keep asking "why" — a timeline of events does not replace a motive explanation.`;
      mitigationZh = `在时间线顶部增加「已确认事件 / 尚未公开目的」双栏说明，明确区分事实与推测。`;
      mitigationEn = `Add a "confirmed events / undisclosed purpose" two-column card at the top of the timeline.`;
    } else if (isNameConfusion) {
      misunderstandingZh = `玩家容易混淆执行官名、面具代号、本名和旧名，尤其是在社区讨论中使用不同称呼时。`;
      misunderstandingEn = `Players mix up Harbinger titles, mask names, real names, and former names, especially when different communities use different terms.`;
      mitigationZh = `所有角色内容统一使用「执行官代号／面具名（本名）」格式，社媒短文首次出现角色时标注全称。`;
      mitigationEn = `Use a consistent "Harbinger title / mask name (real name)" format everywhere; social posts should spell out the full name on first reference.`;
    } else if (isKnownUnknown) {
      misunderstandingZh = `玩家容易把已经确认的行动（收集神之心）误读为最终用途已公开。`;
      misunderstandingEn = `Players may mistake a confirmed action (collecting Gnoses) for a disclosed end purpose.`;
      mitigationZh = `发布「已知 / 未知」双栏内容卡：左侧只列确认事件，右侧明确标注仍未公开的用途、代价与步骤。`;
      mitigationEn = `Publish a "known / unknown" card: confirmed events on the left, undisclosed use, cost, and steps on the right.`;
    } else {
      misunderstandingZh = `关于「${scored.topic.labelZh}」的提问集中在事实边界上，现有内容可能没有把关键信息放在足够显眼的位置。`;
      misunderstandingEn = `Questions about "${scored.topic.labelEn}" cluster around factual boundaries — key context may not be prominent enough.`;
      mitigationZh = `将该主题关键背景整理为短 FAQ，放在相关内容入口处。`;
      mitigationEn = `Surface key context as a short FAQ at the relevant content entry points.`;
    }

    const severityLabel =
      severity === "high"
        ? "发布前必须补充解释或事实边界"
        : severity === "medium"
          ? "可发布，但需要 FAQ 或剧透提示"
          : "可以直接放大兴趣，重点优化传播形式";

    risks.push({
      id: `risk-${scored.topic.id}`,
      topicId: scored.topic.id,
      severity,
      confidence: scored.confidence,
      titleZh: `${scored.topic.labelZh} — ${severityLabel}`,
      titleEn: `${scored.topic.labelEn} — ${severity === "high" ? "must address before publishing" : severity === "medium" ? "publishable with FAQ/spoiler tips" : "safe to amplify, optimize format"}`,
      misunderstandingZh,
      misunderstandingEn,
      affectedProfiles: profiles,
      mitigationZh,
      mitigationEn,
      evidenceRefs: [
        `risk_score:${scored.riskScore}`,
        `questions:${scored.questionCount}`,
      ],
    });
  }

  // Sort by severity: high → medium → low
  const severityOrder: Record<RiskSeverity, number> = {
    high: 0,
    medium: 1,
    low: 2,
    insufficient_data: 3,
  };
  risks.sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity],
  );

  return risks;
}
