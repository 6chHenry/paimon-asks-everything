import type {
  ComprehensionRisk,
  ReleaseAction,
  ReleaseDecisionData,
  ReleaseFormat,
  ReleaseInsightsInput,
  ReleaseWindow,
} from "@/lib/release-insights";

type CountItem = { key: string; count: number };

export interface ReleaseAiRecommendation {
  id: string;
  topicId: string;
  title: string;
  action: string;
  format: ReleaseFormat;
  window: ReleaseWindow;
  targetProfiles: string[];
  playerNeed: string;
  whyNow: string;
  caution: string;
  verification: string;
  reusableModules: string[];
  evidenceRefs: string[];
}

export interface ReleaseAiBriefing {
  mode: "ai" | "rules_fallback";
  generatedAt?: string;
  error?: string;
  recommendations: ReleaseAiRecommendation[];
  missingDataQuestions: string[];
}

export type ReleaseBriefingInput = ReleaseInsightsInput & {
  categories?: CountItem[];
  consentedSamples?: Array<{
    language: string;
    questionText?: string;
    sourceKind: string;
  }>;
};

const RELEASE_FORMATS = new Set<ReleaseFormat>([
  "preheat_feature",
  "faq",
  "relationship_map",
  "timeline",
  "social_post",
]);

const RELEASE_WINDOWS = new Set<ReleaseWindow>([
  "week_1",
  "week_2",
  "week_3_4",
  "watch",
]);

const PROFILE_KEYS = new Set([
  "returning",
  "story",
  "exploration",
  "casual",
  "new",
  "all",
]);

const MODULE_KEYS = new Set([
  "preheat",
  "timeline",
  "wiki_profile",
  "faq",
  "relationship_graph",
]);

const PROFILE_LABELS: Record<string, string> = {
  returning: "回归玩家",
  story: "剧情党玩家",
  exploration: "探索型玩家",
  casual: "轻量玩家",
  new: "新玩家",
  all: "全部玩家",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function clampText(value: string, max: number) {
  const trimmed = value.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

function stringArray(
  value: unknown,
  allowed: Set<string>,
  max: number,
): string[] | null {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > max ||
    !value.every((item) => typeof item === "string" && allowed.has(item))
  ) {
    return null;
  }
  return [...new Set(value as string[])];
}

function evidenceFromAction(action: ReleaseAction) {
  return [
    `action=${action.id}`,
    `topic=${action.topicId}`,
    `score=${action.topicId}:opportunity:${action.opportunityScore}`,
    `score=${action.topicId}:risk:${action.riskScore}`,
    ...action.evidenceRefs,
  ];
}

function evidenceFromRisk(risk: ComprehensionRisk) {
  return [`risk=${risk.id}`, `topic=${risk.topicId}`, ...risk.evidenceRefs];
}

export function releaseAllowedEvidenceItems(
  input: ReleaseBriefingInput,
  decisions: ReleaseDecisionData,
) {
  return new Set([
    ...input.topics.map((topic) => `topic=${topic.key}`),
    ...input.profiles.map((profile) => `profile=${profile.key}:${profile.count}`),
    ...input.languages.map((language) => `language=${language.key}:${language.count}`),
    ...(input.categories ?? []).map(
      (category) => `category=${category.key}:${category.count}`,
    ),
    ...input.preheat.topics.map((topic) => `preheat=${topic.key}:${topic.count}`),
    ...input.preheat.timelineNodes.map(
      (node) => `timeline=${node.key}:${node.count}`,
    ),
    ...input.preheat.relationNodes.map(
      (node) => `graph=${node.key}:${node.count}`,
    ),
    ...decisions.actions.flatMap(evidenceFromAction),
    ...decisions.risks.flatMap(evidenceFromRisk),
  ]);
}

function fallbackTitle(action: ReleaseAction) {
  if (action.decisionKind === "hold") return `暂缓「${action.titleZh}」排期`;
  if (action.decisionKind === "explain") return `先解释「${action.titleZh}」`;
  return `优先发布「${action.titleZh}」`;
}

function fallbackNeed(action: ReleaseAction) {
  const profiles = action.targetProfiles
    .map((profile) => PROFILE_LABELS[profile] ?? "相关玩家")
    .join("、");
  return `${profiles || "相关玩家"}需要先拿到「${action.titleZh}」的一句清楚结论，再决定是否继续看背景。`;
}

function fallbackCaution(
  action: ReleaseAction,
  risks: ComprehensionRisk[],
) {
  const risk = risks.find((item) => item.topicId === action.topicId);
  if (risk) return risk.misunderstandingZh;
  if (action.decisionKind === "hold") {
    return "样本不足时不要把个别问题当成整体玩家需求。";
  }
  return "当前没有发现必须先处理的明显理解风险。";
}

function fallbackRecommendation(
  action: ReleaseAction,
  risks: ComprehensionRisk[],
): ReleaseAiRecommendation {
  return {
    id: `rules-${action.id}`,
    topicId: action.topicId,
    title: fallbackTitle(action),
    action: action.recommendedActionZh,
    format: action.format,
    window: action.window,
    targetProfiles: action.targetProfiles,
    playerNeed: fallbackNeed(action),
    whyNow:
      action.decisionKind === "hold"
        ? "当前信号还不稳定，先继续观察，不急着占用近期发布资源。"
        : action.rationaleZh,
    caution: fallbackCaution(action, risks),
    verification: action.verificationZh,
    reusableModules: action.reusableModules,
    evidenceRefs: evidenceFromAction(action).slice(0, 6),
  };
}

export function buildReleaseBriefingFallback(
  input: ReleaseBriefingInput,
  decisions: ReleaseDecisionData,
  error?: string,
): ReleaseAiBriefing {
  const recommendations = decisions.actions
    .slice(0, 3)
    .map((action) => fallbackRecommendation(action, decisions.risks));

  return {
    mode: "rules_fallback",
    generatedAt: new Date().toISOString(),
    error,
    recommendations,
    missingDataQuestions: [
      "站外社区是否也在问同一件事，还是站内路径造成的局部高频？",
      "这些问题来自看完预热后的玩家，还是还没进入预热页的玩家？",
      "同一主题下，玩家最常卡住的是事实、动机、角色称呼，还是剧透边界？",
    ],
  };
}

export function buildReleaseBriefingPrompt(
  input: ReleaseBriefingInput,
  decisions: ReleaseDecisionData,
) {
  return {
    language: "zh-CN",
    audience: "中国游戏制作组、发行、剧情文案、社媒运营",
    objective:
      "根据站内玩家行为，独立判断未来 2–4 周最值得讨论和执行的三条发行建议。三条建议必须由你选择、排序和撰写。",
    rules: [
      "输出必须全中文，通俗、简短、具体，避免空泛的商业表达。",
      "必须正好输出三条建议；每条都要回答做什么、何时做、给谁看、玩家为什么需要、为什么是现在、要注意什么、如何验收。",
      "ruleSignals 只用于辅助判断和安全边界，不是固定排名；不要照抄规则动作，也不必沿用规则顺序。",
      "只能引用 allowedEvidenceRefs 中的字符串，不能虚构主题、玩家样本、趋势或数据。",
      "三条建议的 id 必须互不相同。",
    ],
    aggregate: {
      totalQuestions: input.total,
      liveQuestions: input.liveCount,
      profiles: input.profiles,
      languages: input.languages,
      categories: input.categories ?? [],
      topics: input.topics.slice(0, 8),
      signals: input.signals,
      preheatTopics: input.preheat.topics.slice(0, 8),
      timelineNodes: input.preheat.timelineNodes.slice(0, 8),
      relationNodes: input.preheat.relationNodes.slice(0, 8),
      consentedSamples: (input.consentedSamples ?? []).slice(0, 6).map((sample) => ({
        language: sample.language,
        questionText: sample.questionText,
        sourceKind: sample.sourceKind,
      })),
    },
    ruleSignals: {
      note: "仅作参考和兜底，不要求模型复述或按此排序。",
      actions: decisions.actions.slice(0, 6),
      risks: decisions.risks.slice(0, 6),
      dataStatus: decisions.dataStatus,
    },
    allowedValues: {
      topicIds: decisions.actions.map((action) => action.topicId),
      formats: [...RELEASE_FORMATS],
      windows: [...RELEASE_WINDOWS],
      targetProfiles: [...PROFILE_KEYS],
      reusableModules: [...MODULE_KEYS],
    },
    allowedEvidenceRefs: [...releaseAllowedEvidenceItems(input, decisions)],
    outputShape: {
      releaseBriefing: {
        recommendations: [
          {
            id: "ai-unique-id",
            topicId: "必须来自 allowedValues.topicIds",
            title: "一句可直接用于筹备会讨论的建议标题",
            action: "具体要制作或发布什么",
            format: "必须来自 allowedValues.formats",
            window: "必须来自 allowedValues.windows",
            targetProfiles: ["必须来自 allowedValues.targetProfiles"],
            playerNeed: "玩家具体卡在哪里或想得到什么",
            whyNow: "哪些数据说明现在值得做",
            caution: "最容易误导、剧透或浪费资源的边界",
            verification: "发布后如何判断建议做到位",
            reusableModules: ["必须来自 allowedValues.reusableModules"],
            evidenceRefs: ["只能从 allowedEvidenceRefs 中选"],
          },
        ],
        missingDataQuestions: ["仍需补采的问题，1–3 条"],
      },
    },
  };
}

function validateRecommendation(
  value: unknown,
  knownTopics: Set<string>,
  allowedEvidence: Set<string>,
): ReleaseAiRecommendation | null {
  if (!isRecord(value)) return null;
  if (
    !isString(value.id) ||
    !isString(value.topicId) ||
    !knownTopics.has(value.topicId) ||
    !isString(value.title) ||
    !isString(value.action) ||
    !isString(value.format) ||
    !RELEASE_FORMATS.has(value.format as ReleaseFormat) ||
    !isString(value.window) ||
    !RELEASE_WINDOWS.has(value.window as ReleaseWindow) ||
    !isString(value.playerNeed) ||
    !isString(value.whyNow) ||
    !isString(value.caution) ||
    !isString(value.verification)
  ) {
    return null;
  }

  const targetProfiles = stringArray(value.targetProfiles, PROFILE_KEYS, 4);
  const reusableModules = stringArray(value.reusableModules, MODULE_KEYS, 5);
  const evidenceRefs = stringArray(value.evidenceRefs, allowedEvidence, 6);
  if (!targetProfiles || !reusableModules || !evidenceRefs) return null;

  return {
    id: clampText(value.id, 64),
    topicId: value.topicId,
    title: clampText(value.title, 48),
    action: clampText(value.action, 140),
    format: value.format as ReleaseFormat,
    window: value.window as ReleaseWindow,
    targetProfiles,
    playerNeed: clampText(value.playerNeed, 120),
    whyNow: clampText(value.whyNow, 140),
    caution: clampText(value.caution, 120),
    verification: clampText(value.verification, 160),
    reusableModules,
    evidenceRefs,
  };
}

export function validateReleaseAiBriefing(
  value: unknown,
  input: ReleaseBriefingInput,
  decisions: ReleaseDecisionData,
): ReleaseAiBriefing | null {
  if (!isRecord(value) || !isRecord(value.releaseBriefing)) return null;
  const briefing = value.releaseBriefing;
  if (!Array.isArray(briefing.recommendations) || briefing.recommendations.length !== 3) {
    return null;
  }

  const knownTopics = new Set(decisions.actions.map((action) => action.topicId));
  const allowedEvidence = releaseAllowedEvidenceItems(input, decisions);
  const recommendations = briefing.recommendations.map((recommendation) =>
    validateRecommendation(recommendation, knownTopics, allowedEvidence),
  );
  if (recommendations.some((recommendation) => recommendation === null)) return null;

  const normalized = recommendations as ReleaseAiRecommendation[];
  if (new Set(normalized.map((recommendation) => recommendation.id)).size !== 3) {
    return null;
  }

  const missingDataQuestions = Array.isArray(briefing.missingDataQuestions)
    ? briefing.missingDataQuestions
        .filter(isString)
        .slice(0, 3)
        .map((question) => clampText(question, 80))
    : [];

  return {
    mode: "ai",
    generatedAt: new Date().toISOString(),
    recommendations: normalized,
    missingDataQuestions,
  };
}
