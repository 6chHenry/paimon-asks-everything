import type { ReleaseInsightsInput } from "@/lib/release-insights";
import type {
  ReleaseAction,
  ReleaseDecisionData,
  ComprehensionRisk,
} from "@/lib/release-insights";

type CountItem = { key: string; count: number };

export interface ReleaseExecutiveSummary {
  title: string;
  readout: string;
  nextMove: string;
  evidenceRefs: string[];
}

export interface ReleasePlayerSegment {
  profile: string;
  label: string;
  need: string;
  suggestedSupport: string;
  evidenceRefs: string[];
}

export interface ReleaseOpportunityItem {
  topicId: string;
  topicLabel: string;
  opportunity: number;
  risk: number;
  interpretation: string;
  recommendedMove: string;
  evidenceRefs: string[];
}

export interface ReleaseProductionAction {
  title: string;
  owner: string;
  timing: string;
  action: string;
  acceptanceCriteria: string;
  evidenceRefs: string[];
}

export interface ReleaseAiBriefing {
  mode: "ai" | "rules_fallback";
  generatedAt?: string;
  error?: string;
  executiveSummary: ReleaseExecutiveSummary;
  playerSegments: ReleasePlayerSegment[];
  opportunityMatrix: ReleaseOpportunityItem[];
  productionActions: ReleaseProductionAction[];
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

const PROFILE_LABELS: Record<string, string> = {
  returning: "回归玩家",
  story: "剧情党玩家",
  exploration: "探索型玩家",
  casual: "轻量玩家",
  new: "新玩家",
  all: "全部玩家",
};

const FORMAT_OWNER: Record<string, string> = {
  preheat_feature: "版本预热负责人",
  faq: "剧情文案与客服知识库",
  relationship_map: "剧情设定与网页内容",
  timeline: "剧情设定与运营内容",
  social_post: "社媒运营",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clampText(value: string, max = 96) {
  const trimmed = value.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

function formatRefs(refs: string[]) {
  return refs.length ? refs : ["topic=未归类"];
}

function profileLabel(key: string) {
  return PROFILE_LABELS[key] ?? "未分类玩家";
}

function profileEvidence(input: ReleaseBriefingInput, key: string) {
  const item = input.profiles.find((profile) => profile.key === key);
  return item ? `profile=${item.key}:${item.count}` : "profile=all";
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
  return [
    `risk=${risk.id}`,
    `topic=${risk.topicId}`,
    ...risk.evidenceRefs,
  ];
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

function formatTiming(window: string) {
  if (window === "week_1") return "第 1 周";
  if (window === "week_2") return "第 2 周";
  if (window === "week_3_4") return "第 3–4 周";
  return "先观察，不进排期";
}

function actionAcceptance(action: ReleaseAction) {
  if (action.riskScore >= 55) {
    return "发布前必须能一眼区分“已确认事实”和“尚未公开目的”，否则先不上社媒主推。";
  }
  if (action.format === "faq") {
    return "首屏先给一句结论，下面再放背景、来源和剧透边界，避免玩家为了找答案读完整篇。";
  }
  if (action.format === "relationship_map") {
    return "每条关系都标注事实状态，推测内容不能和确认关系放在同一视觉层级。";
  }
  return "物料正文保留一个明确行动点，并把补充阅读入口放在同一屏内。";
}

function segmentNeed(profile: string, primary: ReleaseAction | null) {
  const topic = primary?.titleZh ?? "当前主线信息";
  if (profile === "returning") {
    return `他们需要先知道进入新版本前必须补哪几段，别把完整旧剧情清单一次性压上来。`;
  }
  if (profile === "story") {
    return `他们会追问「${topic}」的事实边界，尤其在确认事件和动机推测之间需要明确标线。`;
  }
  if (profile === "exploration") {
    return "他们更愿意从关系图、时间线和可点开的证据进入，不适合只给长文解释。";
  }
  if (profile === "new") {
    return "他们卡在名词、阵营和角色称呼上，需要一句话解释和首次出现时的全称。";
  }
  return "他们需要一个低成本入口，先拿到结论，再决定要不要继续看背景。";
}

function segmentSupport(profile: string) {
  if (profile === "returning") {
    return "做“已过剧情回顾”入口，只列进入新版本前最小必要背景，完整考据折叠到次级区域。";
  }
  if (profile === "story") {
    return "给每个核心判断配证据阶梯：明确文本、文本暗示、社区推测分开标。";
  }
  if (profile === "exploration") {
    return "把时间线和关系图做成主入口，让玩家自己点开证据，不要只推静态长图。";
  }
  if (profile === "new") {
    return "在首屏补术语小条，角色首次出现使用“代号／称呼（本名）”格式。";
  }
  return "用 FAQ 承接长尾问题，先给结论，再补背景。";
}

export function buildReleaseBriefingFallback(
  input: ReleaseBriefingInput,
  decisions: ReleaseDecisionData,
  error?: string,
): ReleaseAiBriefing {
  const primary = decisions.primaryAction;
  const topRisk = decisions.risks[0] ?? null;
  const primaryRefs = primary ? evidenceFromAction(primary) : ["topic=未归类"];
  const riskRefs = topRisk ? evidenceFromRisk(topRisk) : [];

  const title = primary
    ? `先处理「${primary.titleZh}」，再扩散相关物料`
    : "样本还不够，先补数据再排期";
  const readout = primary
    ? `当前最高优先级不是单纯热度题：机会分 ${primary.opportunityScore}，风险分 ${primary.riskScore}。玩家已经在追问「${primary.titleZh}」的上下文，发布物料前要把答案入口和事实边界放到同一屏。`
    : "当前样本不足以支撑正式排期。先继续收集玩家提问、预热点击和关系图互动，避免用个别问题倒推版本节奏。";
  const nextMove = topRisk
    ? `先补「${topRisk.titleZh}」对应的解释卡，再安排 ${primary ? formatTiming(primary.window) : "后续"} 的对外内容。`
    : primary
      ? `${formatTiming(primary.window)}发布，验收标准是玩家能在首屏看到结论、背景入口和剧透边界。`
      : "把站内问题样本扩到 10 条以上，再重新生成建议。";

  return {
    mode: "rules_fallback",
    generatedAt: new Date().toISOString(),
    error,
    executiveSummary: {
      title,
      readout,
      nextMove,
      evidenceRefs: formatRefs([...primaryRefs, ...riskRefs].slice(0, 5)),
    },
    playerSegments: input.profiles.slice(0, 4).map((profile) => ({
      profile: profile.key,
      label: profileLabel(profile.key),
      need: segmentNeed(profile.key, primary),
      suggestedSupport: segmentSupport(profile.key),
      evidenceRefs: [profileEvidence(input, profile.key)],
    })),
    opportunityMatrix: decisions.actions.slice(0, 4).map((action) => ({
      topicId: action.topicId,
      topicLabel: action.titleZh,
      opportunity: action.opportunityScore,
      risk: action.riskScore,
      interpretation:
        action.riskScore >= 55
          ? `有传播价值，但不能直接放大；先补事实边界，再做${action.recommendedActionZh}`
          : action.opportunityScore >= 50
            ? "适合进入近期排期，重点是把入口做短，让玩家愿意点进去。"
            : "暂时作为补充内容，不建议占用首发主资源位。",
      recommendedMove: action.recommendedActionZh,
      evidenceRefs: formatRefs(evidenceFromAction(action).slice(0, 5)),
    })),
    productionActions: decisions.actions.slice(0, 3).map((action) => ({
      title: action.titleZh,
      owner: FORMAT_OWNER[action.format] ?? "内容负责人",
      timing: formatTiming(action.window),
      action: action.recommendedActionZh,
      acceptanceCriteria: actionAcceptance(action),
      evidenceRefs: formatRefs(evidenceFromAction(action).slice(0, 4)),
    })),
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
    rule:
      "输出必须全中文，必须自然具体，不能写空泛词。每条判断都要能回答：玩家为什么卡住、制作组要补什么、怎么验收。",
    aggregate: {
      totalQuestions: input.total,
      liveQuestions: input.liveCount,
      profiles: input.profiles,
      languages: input.languages,
      topics: input.topics.slice(0, 8),
      preheatTopics: input.preheat.topics.slice(0, 8),
      timelineNodes: input.preheat.timelineNodes.slice(0, 8),
      relationNodes: input.preheat.relationNodes.slice(0, 8),
      consentedSamples: (input.consentedSamples ?? []).slice(0, 6).map((sample) => ({
        language: sample.language,
        questionText: sample.questionText,
        sourceKind: sample.sourceKind,
      })),
    },
    ruleScores: {
      primaryAction: decisions.primaryAction,
      actions: decisions.actions.slice(0, 6),
      risks: decisions.risks.slice(0, 6),
      dataStatus: decisions.dataStatus,
    },
    allowedEvidenceRefs: [...releaseAllowedEvidenceItems(input, decisions)],
    outputShape: {
      releaseBriefing: {
        executiveSummary: {
          title: "一句具体判断，不要口号",
          readout: "2-3 句，说明现在真正的问题是什么",
          nextMove: "下一步动作，必须能落到页面、物料或审核项",
          evidenceRefs: ["只能从 allowedEvidenceRefs 中选"],
        },
        playerSegments: [
          {
            profile: "returning|story|exploration|casual|new|all",
            label: "中文玩家类型",
            need: "这个人群具体卡在哪里",
            suggestedSupport: "制作组应该补什么，不要泛泛说加强引导",
            evidenceRefs: ["只能从 allowedEvidenceRefs 中选"],
          },
        ],
        opportunityMatrix: [
          {
            topicId: "必须来自 actions/risk 的 topicId",
            topicLabel: "中文主题名",
            opportunity: 0,
            risk: 0,
            interpretation: "为什么这个位置值得或不值得做",
            recommendedMove: "具体动作",
            evidenceRefs: ["只能从 allowedEvidenceRefs 中选"],
          },
        ],
        productionActions: [
          {
            title: "动作标题",
            owner: "负责团队",
            timing: "第几周或观察",
            action: "具体要做什么",
            acceptanceCriteria: "怎么判断做到位",
            evidenceRefs: ["只能从 allowedEvidenceRefs 中选"],
          },
        ],
        missingDataQuestions: ["仍需补采的问题"],
      },
    },
  };
}

function refsAreAllowed(refs: unknown, allowed: Set<string>) {
  return (
    Array.isArray(refs) &&
    refs.length > 0 &&
    refs.length <= 6 &&
    refs.every((ref) => typeof ref === "string" && allowed.has(ref))
  );
}

function validateExecutiveSummary(
  value: unknown,
  allowed: Set<string>,
): ReleaseExecutiveSummary | null {
  if (!isRecord(value)) return null;
  if (
    !isString(value.title) ||
    !isString(value.readout) ||
    !isString(value.nextMove) ||
    !refsAreAllowed(value.evidenceRefs, allowed)
  ) {
    return null;
  }
  return {
    title: clampText(value.title, 48),
    readout: clampText(value.readout, 180),
    nextMove: clampText(value.nextMove, 140),
    evidenceRefs: value.evidenceRefs as string[],
  };
}

function validateSegments(
  value: unknown,
  allowed: Set<string>,
): ReleasePlayerSegment[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 5) return null;
  const segments: ReleasePlayerSegment[] = [];
  for (const raw of value) {
    if (!isRecord(raw)) return null;
    if (
      !isString(raw.profile) ||
      !isString(raw.label) ||
      !isString(raw.need) ||
      !isString(raw.suggestedSupport) ||
      !refsAreAllowed(raw.evidenceRefs, allowed)
    ) {
      return null;
    }
    segments.push({
      profile: raw.profile,
      label: clampText(raw.label, 20),
      need: clampText(raw.need, 140),
      suggestedSupport: clampText(raw.suggestedSupport, 140),
      evidenceRefs: raw.evidenceRefs as string[],
    });
  }
  return segments;
}

function validateMatrix(
  value: unknown,
  allowed: Set<string>,
  knownTopics: Set<string>,
): ReleaseOpportunityItem[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 6) return null;
  const items: ReleaseOpportunityItem[] = [];
  for (const raw of value) {
    if (!isRecord(raw)) return null;
    if (
      !isString(raw.topicId) ||
      !knownTopics.has(raw.topicId) ||
      !isString(raw.topicLabel) ||
      !isNumber(raw.opportunity) ||
      !isNumber(raw.risk) ||
      !isString(raw.interpretation) ||
      !isString(raw.recommendedMove) ||
      !refsAreAllowed(raw.evidenceRefs, allowed)
    ) {
      return null;
    }
    items.push({
      topicId: raw.topicId,
      topicLabel: clampText(raw.topicLabel, 30),
      opportunity: Math.round(raw.opportunity),
      risk: Math.round(raw.risk),
      interpretation: clampText(raw.interpretation, 150),
      recommendedMove: clampText(raw.recommendedMove, 120),
      evidenceRefs: raw.evidenceRefs as string[],
    });
  }
  return items;
}

function validateProductionActions(
  value: unknown,
  allowed: Set<string>,
): ReleaseProductionAction[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 6) return null;
  const actions: ReleaseProductionAction[] = [];
  for (const raw of value) {
    if (!isRecord(raw)) return null;
    if (
      !isString(raw.title) ||
      !isString(raw.owner) ||
      !isString(raw.timing) ||
      !isString(raw.action) ||
      !isString(raw.acceptanceCriteria) ||
      !refsAreAllowed(raw.evidenceRefs, allowed)
    ) {
      return null;
    }
    actions.push({
      title: clampText(raw.title, 36),
      owner: clampText(raw.owner, 24),
      timing: clampText(raw.timing, 20),
      action: clampText(raw.action, 140),
      acceptanceCriteria: clampText(raw.acceptanceCriteria, 160),
      evidenceRefs: raw.evidenceRefs as string[],
    });
  }
  return actions;
}

export function validateReleaseAiBriefing(
  value: unknown,
  input: ReleaseBriefingInput,
  decisions: ReleaseDecisionData,
): ReleaseAiBriefing | null {
  if (!isRecord(value)) return null;
  const briefing = value.releaseBriefing;
  if (!isRecord(briefing)) return null;

  const allowed = releaseAllowedEvidenceItems(input, decisions);
  const knownTopics = new Set(decisions.actions.map((action) => action.topicId));
  decisions.risks.forEach((risk) => knownTopics.add(risk.topicId));

  const executiveSummary = validateExecutiveSummary(
    briefing.executiveSummary,
    allowed,
  );
  const playerSegments = validateSegments(briefing.playerSegments, allowed);
  const opportunityMatrix = validateMatrix(
    briefing.opportunityMatrix,
    allowed,
    knownTopics,
  );
  const productionActions = validateProductionActions(
    briefing.productionActions,
    allowed,
  );
  const missingDataQuestions = Array.isArray(briefing.missingDataQuestions)
    ? briefing.missingDataQuestions
        .filter(isString)
        .slice(0, 5)
        .map((item) => clampText(item, 80))
    : [];

  if (
    !executiveSummary ||
    !playerSegments ||
    !opportunityMatrix ||
    !productionActions ||
    missingDataQuestions.length === 0
  ) {
    return null;
  }

  return {
    mode: "ai",
    generatedAt: new Date().toISOString(),
    executiveSummary,
    playerSegments,
    opportunityMatrix,
    productionActions,
    missingDataQuestions,
  };
}
