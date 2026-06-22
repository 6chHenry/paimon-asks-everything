"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  FileSearch,
  Globe2,
  HelpCircle,
  Layers,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  UsersRound,
  Zap,
} from "lucide-react";
import { usePreferences } from "@/components/preferences-provider";
import { clientPath } from "@/lib/client-path";
import type { Language } from "@/lib/domain";
import { t } from "@/lib/i18n";
import {
  computeReleaseDecisions,
  type ReleaseAction,
  type ReleaseDecisionData,
  type ReleaseFormat,
  type ReleaseInsightsInput,
  type ComprehensionRisk,
} from "@/lib/release-insights";

/* ------------------------------------------------------------------ */
/*  API wrapper                                                        */
/* ------------------------------------------------------------------ */

async function fetchInsights(): Promise<ReleaseInsightsInput> {
  const res = await fetch(clientPath("/api/insights"), { cache: "no-store" });
  if (!res.ok) throw new Error("load_failed");
  const json = (await res.json()) as Record<string, unknown>;

  // The API returns EnrichedInsights which extends aggregateInsights return.
  // We only need the fields defined in ReleaseInsightsInput — pick them out.
  return json as unknown as ReleaseInsightsInput;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const FORMAT_ICONS: Record<ReleaseFormat, typeof Zap> = {
  preheat_feature: Layers,
  faq: HelpCircle,
  relationship_map: Globe2,
  timeline: BarChart3,
  social_post: Sparkles,
};

const FORMAT_NAMES: Record<ReleaseFormat, [string, string]> = {
  preheat_feature: ["预热专题", "Preheat feature"],
  faq: ["FAQ", "FAQ"],
  relationship_map: ["角色关系图", "Relationship map"],
  timeline: ["时间线", "Timeline"],
  social_post: ["社媒内容", "Social post"],
};

const WINDOW_NAMES: Record<string, [string, string]> = {
  week_1: ["第 1 周", "Week 1"],
  week_2: ["第 2 周", "Week 2"],
  week_3_4: ["第 3–4 周", "Weeks 3–4"],
  watch: ["观察", "Watch"],
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high: "var(--green)",
  medium: "var(--gold)",
  low: "var(--coral)",
};

function confidenceDot(level: string) {
  return (
    <span
      className="confidence-dot"
      style={{ background: CONFIDENCE_COLORS[level] ?? "var(--ink-soft)" }}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

export default function ReleaseDecisionPage() {
  const { preferences } = usePreferences();
  const language = preferences.language;
  const isZh = language === "zh-CN";

  const [data, setData] = useState<ReleaseDecisionData | null>(null);
  const [rawInput, setRawInput] = useState<ReleaseInsightsInput | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedActions, setExpandedActions] = useState(false);
  const [expandedRisks, setExpandedRisks] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [showAllEvidence, setShowAllEvidence] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const input = await fetchInsights();
      setRawInput(input);
      setData(computeReleaseDecisions(input));
    } catch {
      setError(t(language, "洞察暂时无法加载。", "Insights could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, [language]);

  useEffect(() => {
    void load();
  }, [load]);

  /* ---- loading ---- */
  if (loading && !data) {
    return (
      <div className="page-loader">
        <LoaderCircle className="spin" />
        {t(language, "正在聚合决策信号…", "Aggregating decision signals…")}
      </div>
    );
  }

  /* ---- error with no cached data ---- */
  if (error && !data) {
    return (
      <div className="release-decision-page page-wrap">
        <div className="error-card">{error}</div>
        <button className="secondary-button" type="button" onClick={() => void load()}>
          <RefreshCw size={16} />
          {t(language, "重试", "Retry")}
        </button>
      </div>
    );
  }

  /* ---- loaded ---- */
  const decisions = data!;
  const visibleActions = expandedActions
    ? decisions.actions
    : decisions.actions.slice(0, decisions.visibleActionCount);
  const visibleRisks = expandedRisks
    ? decisions.risks
    : decisions.risks.slice(0, decisions.visibleRiskCount);

  return (
    <div className="release-decision-page page-wrap">
      {/* ---- Page heading ---- */}
      <header className="release-hero-heading">
        <div>
          <span className="eyebrow">
            <Zap size={14} />
            {t(language, "发行洞察", "Release insights")}
          </span>
          <h1>
            {t(
              language,
              "未来 2–4 周，优先发布什么？",
              "What should we publish in the next 2–4 weeks?",
            )}
          </h1>
          <p>
            {t(
              language,
              "根据玩家提问、预热阅读和关系探索，识别最值得发布的内容，以及发布前必须处理的理解风险。",
              "Based on player questions, preheat reading, and graph exploration — identify what's worth publishing and what comprehension risks to address first.",
            )}
          </p>
        </div>
        <div className="release-hero-toolbar">
          <div className="release-data-status">
            <Clock size={13} />
            <span>
              {t(language, "数据截至", "Data as of")}{" "}
              {new Date(decisions.dataStatus.lastUpdated).toLocaleDateString(
                language,
                { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" },
              )}
            </span>
            <span className="release-data-badge historical">
              {decisions.dataStatus.historicalSamples}{" "}
              {t(language, "历史", "historical")}
            </span>
            <span className="release-data-badge live">
              +{decisions.dataStatus.liveSamples}{" "}
              {t(language, "实时", "live")}
            </span>
          </div>
          <button
            className="secondary-button release-refresh-btn"
            type="button"
            onClick={() => void load()}
          >
            <RefreshCw size={15} className={loading ? "spin" : ""} />
          </button>
        </div>
      </header>

      {/* ---- Layer 1: Hero / primary conclusion ---- */}
      <ReleaseDecisionHero
        primaryAction={decisions.primaryAction}
        topRisk={decisions.risks[0] ?? null}
        dataStatus={decisions.dataStatus}
        language={language}
        isZh={isZh}
        onSelectTopic={setSelectedTopic}
      />

      {/* ---- Layer 2: Schedule ---- */}
      <section className="release-schedule-section">
        <div className="release-section-heading">
          <span className="section-index">02</span>
          <h2>{t(language, "2–4 周内容排期", "2–4 week content schedule")}</h2>
        </div>
        <div className="release-schedule-grid">
          {visibleActions.map((action, i) => (
            <ReleaseActionCard
              key={action.id}
              action={action}
              index={i}
              language={language}
              isZh={isZh}
              isSelected={selectedTopic === action.topicId}
              onSelect={() =>
                setSelectedTopic(
                  selectedTopic === action.topicId ? null : action.topicId,
                )
              }
            />
          ))}
        </div>
        {decisions.actions.length > decisions.visibleActionCount ? (
          <button
            className="release-expand-toggle"
            type="button"
            onClick={() => setExpandedActions(!expandedActions)}
          >
            {expandedActions ? (
              <>
                <ChevronUp size={15} />
                {t(language, "收起", "Show less")}
              </>
            ) : (
              <>
                <ChevronDown size={15} />
                {t(
                  language,
                  `还有 ${decisions.actions.length - decisions.visibleActionCount} 项建议`,
                  `${decisions.actions.length - decisions.visibleActionCount} more suggestions`,
                )}
              </>
            )}
          </button>
        ) : null}
      </section>

      {/* ---- Layer 3: Risks ---- */}
      <section className="release-risks-section">
        <div className="release-section-heading">
          <span className="section-index">03</span>
          <h2>{t(language, "发布前理解风险", "Comprehension risks to address")}</h2>
        </div>
        <div className="release-risks-list">
          {visibleRisks.map((risk) => (
            <ReleaseRiskCard
              key={risk.id}
              risk={risk}
              language={language}
              isZh={isZh}
              isSelected={selectedTopic === risk.topicId}
              onSelect={() =>
                setSelectedTopic(
                  selectedTopic === risk.topicId ? null : risk.topicId,
                )
              }
            />
          ))}
        </div>
        {decisions.risks.length > decisions.visibleRiskCount ? (
          <button
            className="release-expand-toggle"
            type="button"
            onClick={() => setExpandedRisks(!expandedRisks)}
          >
            {expandedRisks ? (
              <>
                <ChevronUp size={15} />
                {t(language, "收起", "Show less")}
              </>
            ) : (
              <>
                <ChevronDown size={15} />
                {t(
                  language,
                  `还有 ${decisions.risks.length - decisions.visibleRiskCount} 项风险`,
                  `${decisions.risks.length - decisions.visibleRiskCount} more risks`,
                )}
              </>
            )}
          </button>
        ) : null}
      </section>

      {/* ---- Layer 4: Evidence workbench ---- */}
      <ReleaseEvidenceBench
        input={rawInput}
        selectedTopic={selectedTopic}
        showAll={showAllEvidence}
        language={language}
        isZh={isZh}
        onToggleAll={() => setShowAllEvidence(!showAllEvidence)}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Layer 1: Hero                                                      */
/* ------------------------------------------------------------------ */

function ReleaseDecisionHero({
  primaryAction,
  topRisk,
  dataStatus,
  language,
  isZh,
  onSelectTopic,
}: {
  primaryAction: ReleaseAction | null;
  topRisk: ComprehensionRisk | null;
  dataStatus: ReleaseDecisionData["dataStatus"];
  language: Language;
  isZh: boolean;
  onSelectTopic: (topicId: string | null) => void;
}) {
  return (
    <section className="release-hero">
      {primaryAction ? (
        <article className="release-hero-primary">
          <span className="release-hero-step">01</span>
          <div className="release-hero-label">
            {t(language, "首要发布建议", "Primary recommendation")}
          </div>
          <h2>
            {isZh ? primaryAction.titleZh : primaryAction.titleEn}
          </h2>
          <div className="release-hero-format">
            {(() => {
              const Icon = FORMAT_ICONS[primaryAction.format];
              return <Icon size={14} />;
            })()}
            <span>
              {isZh
                ? FORMAT_NAMES[primaryAction.format][0]
                : FORMAT_NAMES[primaryAction.format][1]}
            </span>
            <span className="release-hero-format-sep">·</span>
            <UsersRound size={13} />
            <span>{primaryAction.targetProfiles.join(", ")}</span>
            <span className="release-hero-format-sep">·</span>
            <Clock size={13} />
            <span>
              {isZh
                ? WINDOW_NAMES[primaryAction.window][0]
                : WINDOW_NAMES[primaryAction.window][1]}
            </span>
          </div>
          <div className="release-hero-scores">
            <span className="release-score opp">
              <TrendingUp size={13} />
              {t(language, "机会", "Opp")}{" "}
              {primaryAction.opportunityScore}
            </span>
            <span className="release-score risk">
              <ShieldAlert size={13} />
              {t(language, "风险", "Risk")}{" "}
              {primaryAction.riskScore}
            </span>
            <span className="release-score conf">
              {confidenceDot(primaryAction.confidence)}
              {t(language, "信心", "Conf")}{" "}
              {isZh
                ? (primaryAction.confidence === "high"
                    ? "高"
                    : primaryAction.confidence === "medium"
                      ? "中"
                      : "低")
                : primaryAction.confidence}
            </span>
          </div>
          <p className="release-hero-rationale">
            {isZh ? primaryAction.rationaleZh : primaryAction.rationaleEn}
          </p>
          <div className="release-hero-actions">
            <button
              className="release-ghost-button"
              type="button"
              onClick={() => onSelectTopic(primaryAction.topicId)}
            >
              <FileSearch size={14} />
              {t(language, "查看证据", "View evidence")}
            </button>
          </div>
        </article>
      ) : (
        <article className="release-hero-primary release-hero-empty">
          <span className="release-hero-step">01</span>
          <h2>
            {t(
              language,
              "当前数据还不足以形成正式排期",
              "Not enough data for a full schedule yet",
            )}
          </h2>
          <p>
            {t(
              language,
              "建议先观察「七枚神之心」和「角色关系」两个主题，继续收集玩家提问与预热互动。",
              "Start by observing the 'Gnosis journeys' and 'Character relationships' topics while continuing to collect questions and preheat interactions.",
            )}
          </p>
        </article>
      )}

      <aside className="release-hero-risks-aside">
        <div className="release-hero-risk-header">
          <ShieldAlert size={15} />
          {t(language, "理解风险", "Comprehension risks")}
        </div>
        {topRisk ? (
          <div className="release-hero-risk-body">
            <span className={`release-severity-badge ${topRisk.severity}`}>
              {topRisk.severity === "high"
                ? t(language, "高", "High")
                : topRisk.severity === "medium"
                  ? t(language, "中", "Med")
                  : t(language, "低", "Low")}
            </span>
            <p>
              {isZh ? topRisk.misunderstandingZh : topRisk.misunderstandingEn}
            </p>
            <button
              className="release-ghost-button"
              type="button"
              onClick={() => onSelectTopic(topRisk.topicId)}
            >
              <ArrowRight size={13} />
              {t(language, "查看缓解措施", "View mitigation")}
            </button>
          </div>
        ) : (
          <p className="release-hero-risk-empty">
            {t(language, "暂无显著理解风险", "No significant comprehension risks")}
          </p>
        )}

        <div className="release-hero-data-status">
          <div className="release-hero-data-status-line">
            <CheckCircle2 size={13} color="var(--green)" />
            <span>
              {t(language, "站内证据已接入", "Internal evidence connected")}
            </span>
          </div>
          <div className="release-hero-data-status-line pending">
            <Clock size={13} />
            <span>
              {t(
                language,
                "站外趋势暂未接入",
                "External trends not yet connected",
              )}
            </span>
          </div>
        </div>
      </aside>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Layer 2: Action card                                               */
/* ------------------------------------------------------------------ */

function ReleaseActionCard({
  action,
  index,
  language,
  isZh,
  isSelected,
  onSelect,
}: {
  action: ReleaseAction;
  index: number;
  language: Language;
  isZh: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const FormatIcon = FORMAT_ICONS[action.format];
  const windowLabel = isZh
    ? WINDOW_NAMES[action.window][0]
    : WINDOW_NAMES[action.window][1];
  const confidenceLabel =
    action.confidence === "high"
      ? isZh ? "高" : "high"
      : action.confidence === "medium"
        ? isZh ? "中" : "medium"
        : isZh ? "低" : "low";

  return (
    <article
      className={`release-action-card ${isSelected ? "selected" : ""} window-${action.window}`}
      onClick={onSelect}
    >
      <div className="release-action-header">
        <span className="release-action-index">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="release-action-window">{windowLabel}</span>
      </div>
      <div className="release-action-icon">
        <FormatIcon size={18} />
      </div>
      <h3>{isZh ? action.titleZh : action.titleEn}</h3>
      <div className="release-action-meta">
        <span>
          {isZh
            ? FORMAT_NAMES[action.format][0]
            : FORMAT_NAMES[action.format][1]}
        </span>
        <span>{action.targetProfiles.join(", ")}</span>
      </div>
      <div className="release-action-scores">
        <span className="release-score opp">
          {action.opportunityScore}
          <small>{isZh ? "机会" : "opp"}</small>
        </span>
        <span className="release-score risk">
          {action.riskScore}
          <small>{isZh ? "风险" : "risk"}</small>
        </span>
        <span className="release-score conf">
          {confidenceDot(action.confidence)}
          <small>{confidenceLabel}</small>
        </span>
      </div>
      <p className="release-action-rationale">
        {isZh ? action.rationaleZh : action.rationaleEn}
      </p>
      <div className="release-action-footer">
        <span className="release-action-action">
          {isZh ? action.recommendedActionZh : action.recommendedActionEn}
        </span>
      </div>
      {isSelected && (
        <div className="release-action-evidence">
          <strong>
            {t(language, "可复用模块", "Reusable modules")}
          </strong>
          <div className="release-evidence-tags">
            {action.reusableModules.map((mod) => (
              <span key={mod} className="release-evidence-tag">
                {mod.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

/* ------------------------------------------------------------------ */
/*  Layer 3: Risk card                                                 */
/* ------------------------------------------------------------------ */

function ReleaseRiskCard({
  risk,
  language,
  isZh,
  isSelected,
  onSelect,
}: {
  risk: ComprehensionRisk;
  language: Language;
  isZh: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <article
      className={`release-risk-card severity-${risk.severity} ${isSelected ? "selected" : ""}`}
      onClick={onSelect}
    >
      <div className="release-risk-top">
        <span className={`release-severity-badge ${risk.severity}`}>
          {risk.severity === "high"
            ? isZh ? "高风险" : "HIGH"
            : risk.severity === "medium"
              ? isZh ? "中风险" : "MED"
              : isZh ? "低风险" : "LOW"}
        </span>
        <div className="release-risk-title">
          <h4>{isZh ? risk.titleZh : risk.titleEn}</h4>
          <p>{isZh ? risk.misunderstandingZh : risk.misunderstandingEn}</p>
        </div>
        <div className="release-risk-meta">
          <span className="release-score conf">
            {confidenceDot(risk.confidence)}
            <small>
              {risk.confidence === "high"
                ? isZh ? "高信心" : "high conf"
                : risk.confidence === "medium"
                  ? isZh ? "中信心" : "med conf"
                  : isZh ? "低信心" : "low conf"}
            </small>
          </span>
          <button
            className="release-ghost-button"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(!open);
            }}
          >
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>
      {open && (
        <div className="release-risk-mitigation">
          <AlertTriangle size={14} />
          <div>
            <strong>
              {t(language, "缓解措施", "Mitigation")}
            </strong>
            <p>{isZh ? risk.mitigationZh : risk.mitigationEn}</p>
          </div>
        </div>
      )}
      <div className="release-risk-affected">
        <UsersRound size={12} />
        <span>
          {t(language, "影响", "Affects")}:{" "}
          {risk.affectedProfiles.join(", ") || "all"}
        </span>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/*  Layer 4: Evidence workbench                                        */
/* ------------------------------------------------------------------ */

type EvidenceTab = "internal" | "external" | "notes";

function ReleaseEvidenceBench({
  input,
  selectedTopic,
  showAll,
  language,
  isZh,
  onToggleAll,
}: {
  input: ReleaseInsightsInput | null;
  selectedTopic: string | null;
  showAll: boolean;
  language: Language;
  isZh: boolean;
  onToggleAll: () => void;
}) {
  const [tab, setTab] = useState<EvidenceTab>("internal");

  if (!input) return null;

  const relevantTopics = selectedTopic
    ? input.topics.filter((t) => t.key.includes(selectedTopic))
    : showAll
      ? input.topics
      : input.topics.slice(0, 5);

  return (
    <section className="release-evidence-section">
      <div className="release-section-heading">
        <span className="section-index">04</span>
        <h2>
          {t(
            language,
            "为什么得出这些结论",
            "How we reached these conclusions",
          )}
        </h2>
      </div>

      <div className="release-evidence-tabs">
        <button
          type="button"
          className={tab === "internal" ? "active" : ""}
          onClick={() => setTab("internal")}
        >
          <BarChart3 size={14} />
          {t(language, "站内证据", "Internal evidence")}
        </button>
        <button
          type="button"
          className={tab === "external" ? "active" : ""}
          onClick={() => setTab("external")}
        >
          <Globe2 size={14} />
          {t(language, "站外趋势", "External trends")}
        </button>
        <button
          type="button"
          className={tab === "notes" ? "active" : ""}
          onClick={() => setTab("notes")}
        >
          <FileSearch size={14} />
          {t(language, "数据说明", "Data notes")}
        </button>
      </div>

      {tab === "internal" && (
        <div className="release-evidence-internal">
          {/* Topic frequency bars */}
          <div className="release-evidence-chart">
            <h4>
              {t(language, "高频提问主题", "Top question topics")}
            </h4>
            <div className="release-bar-list">
              {relevantTopics.map((topic) => (
                <div key={topic.key} className="release-bar-row">
                  <span className="release-bar-label">
                    {topic.key.replaceAll("_", " ")}
                  </span>
                  <div className="release-bar-track">
                    <i
                      className="release-bar-fill"
                      style={{
                        width: `${Math.max(
                          6,
                          (topic.count / (relevantTopics[0]?.count || 1)) * 100,
                        )}%`,
                      }}
                    />
                  </div>
                  <strong className="release-bar-value">{topic.count}</strong>
                </div>
              ))}
            </div>
          </div>

          {/* Evidence summary */}
          <div className="release-evidence-summary">
            <p>
              {selectedTopic
                ? t(
                    language,
                    `当前聚焦：${selectedTopic}。切换到"全部证据"查看完整统计。`,
                    `Currently focused: ${selectedTopic}. Switch to "All evidence" for full stats.`,
                  )
                : t(
                    language,
                    "选择一个行动卡或风险卡，聚焦查看相关数据。",
                    "Select an action card or risk card to focus the evidence below.",
                  )}
            </p>
            <button
              className="release-ghost-button"
              type="button"
              onClick={onToggleAll}
            >
              {showAll
                ? t(language, "仅显示相关", "Show related only")
                : t(language, "查看全部证据", "View all evidence")}
            </button>
          </div>
        </div>
      )}

      {tab === "external" && (
        <div className="release-evidence-placeholder">
          <Globe2 size={28} />
          <p>
            {t(
              language,
              "暂未接入站外趋势。当前优先级仅依据站内行为，不代表整个玩家社区的总体热度。",
              "External trends are not yet connected. Current priorities reflect in-app behavior only, not overall community sentiment.",
            )}
          </p>
        </div>
      )}

      {tab === "notes" && (
        <div className="release-evidence-notes">
          <div className="release-note-card">
            <strong>
              {t(language, "数据构成", "Data composition")}
            </strong>
            <p>
              {t(
                language,
                `当前结论包含 ${input.historicalCount} 条历史样本和 ${input.liveCount} 条最近增量。`,
                `Current findings include ${input.historicalCount} historical samples and ${input.liveCount} recent live increments.`,
              )}
            </p>
          </div>
          <div className="release-note-card">
            <strong>
              {t(language, "信心说明", "Confidence note")}
            </strong>
            <p>
              {t(
                language,
                "结论说明由规则模板生成。AI 仅用于将计算结果翻译为通俗解释，不修改分数。",
                "Explanations are generated from rule templates. AI is only used to translate scores into plain language; it never modifies scores.",
              )}
            </p>
          </div>
          <div className="release-note-card">
            <strong>
              {t(language, "样本保护", "Sample protection")}
            </strong>
            <p>
              {t(
                language,
                "总样本低于 10 时不给高信心；单类信号低于 3 时仅观察不排期；实时增量低于 5 时不展示增长百分比。",
                "No high confidence below 10 total samples; single signals below 3 are observed only; no growth percentages below 5 live increments.",
              )}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
