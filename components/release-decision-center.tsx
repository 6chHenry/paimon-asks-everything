"use client";

import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileSearch,
  Globe2,
  HelpCircle,
  Layers,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Table2,
  UsersRound,
  Zap,
} from "lucide-react";
import { getReleaseTopic } from "@/data/release-topic-map";
import { clientPath } from "@/lib/client-path";
import type {
  ReleaseFormat,
  ReleaseInsightsInput,
} from "@/lib/release-insights";
import type {
  ReleaseAiBriefing,
  ReleaseAiRecommendation,
} from "@/lib/release-ai-briefing";

type ReleaseDecisionPayload = ReleaseInsightsInput & {
  releaseBriefing?: ReleaseAiBriefing;
};

const FORMAT_ICONS: Record<ReleaseFormat, typeof Zap> = {
  preheat_feature: Layers,
  faq: HelpCircle,
  relationship_map: Globe2,
  timeline: BarChart3,
  social_post: Sparkles,
};

const FORMAT_NAMES: Record<ReleaseFormat, string> = {
  preheat_feature: "预热专题",
  faq: "FAQ",
  relationship_map: "角色关系图",
  timeline: "时间线",
  social_post: "社媒内容",
};

const WINDOW_NAMES: Record<string, string> = {
  week_1: "第 1 周",
  week_2: "第 2 周",
  week_3_4: "第 3–4 周",
  watch: "继续观察",
};

const PROFILE_NAMES: Record<string, string> = {
  returning: "回归玩家",
  story: "剧情党玩家",
  exploration: "探索型玩家",
  casual: "轻量玩家",
  new: "新玩家",
  all: "全部玩家",
};

const MODULE_NAMES: Record<string, string> = {
  preheat: "版本预热页",
  timeline: "时间线模块",
  wiki_profile: "资料卡模块",
  faq: "问答模块",
  relationship_graph: "关系图模块",
};

const EVIDENCE_SOURCE_NAMES: Record<string, string> = {
  questions: "玩家提问",
  preheat: "预热阅读",
  timeline: "时间线点击",
  graph: "关系图互动",
};

async function fetchInsights(): Promise<ReleaseDecisionPayload> {
  const response = await fetch(clientPath("/api/insights"), {
    cache: "no-store",
  });
  if (!response.ok) throw new Error("load_failed");
  return (await response.json()) as ReleaseDecisionPayload;
}

function formatProfiles(profiles: string[]) {
  return profiles
    .map((profile) => PROFILE_NAMES[profile] ?? "未分类玩家")
    .join("、");
}

function topicLabel(key: string) {
  const registered = getReleaseTopic(key);
  if (registered) return registered.labelZh;

  const labels: Record<string, string> = {
    gnosis_journey: "神之心流转",
    gnosis_purpose: "愚人众收集神之心的目的",
    gnosis_collection_purpose: "愚人众收集神之心的目的",
    tsaritsa_goal: "冰之女皇目标",
    sandrone_identity: "桑多涅身份与关系",
    fontaine_catch_up: "枫丹回归补课",
    terminology: "术语理解",
    gnosis_third_descender: "神之心与第三降临者",
    harbinger_hierarchy: "执行官层级与名称",
    "seven-gnosis-journeys": "七枚神之心流转",
    "why-fatui-collect-gnoses": "愚人众收集神之心的目的",
    "tsaritsa-known-unknown": "冰之女皇已知与未知",
  };
  return labels[key] ?? "未归类主题";
}

function firstSentence(text: string, maxLength = 88) {
  const compact = text.replace(/\s+/gu, " ").trim();
  const sentence = compact.match(/^.*?[。！？]/u)?.[0] ?? compact;
  return sentence.length > maxLength
    ? `${sentence.slice(0, maxLength - 1)}…`
    : sentence;
}

function evidenceLabel(ref: string) {
  if (ref.includes("=")) {
    return {
      source: "结构化信号",
      detail: releaseEvidenceLabel(ref),
    };
  }
  const [source, count] = ref.split(":");
  return {
    source: EVIDENCE_SOURCE_NAMES[source] ?? "其他站内证据",
    detail: count ? `${count} 次` : "已接入",
  };
}

function releaseEvidenceLabel(ref: string) {
  if (ref.startsWith("topic=")) return `主题：${topicLabel(ref.slice(6))}`;
  if (ref.startsWith("profile=")) {
    const [profile, count] = ref.slice(8).split(":");
    return `${PROFILE_NAMES[profile] ?? "未分类玩家"}${count ? `：${count}` : ""}`;
  }
  if (ref.startsWith("preheat=")) {
    const [topic, count] = ref.slice(8).split(":");
    return `预热：${topicLabel(topic)}${count ? ` ${count}` : ""}`;
  }
  if (ref.startsWith("timeline=")) {
    const [node, count] = ref.slice(9).split(":");
    return `时间线：${topicLabel(node)}${count ? ` ${count}` : ""}`;
  }
  if (ref.startsWith("graph=")) {
    const [node, count] = ref.slice(6).split(":");
    return `关系图：${topicLabel(node)}${count ? ` ${count}` : ""}`;
  }
  return ref;
}

function modeLabel(briefing: ReleaseAiBriefing | null) {
  return briefing?.mode === "ai" ? "AI 建议" : "AI 建议 · 规则备用";
}

export default function ReleaseDecisionPage() {
  const [rawInput, setRawInput] = useState<ReleaseDecisionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [referenceOpen, setReferenceOpen] = useState(false);
  const referenceRef = useRef<HTMLElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const input = await fetchInsights();
      setRawInput(input);
      setActiveIndex(0);
    } catch {
      setError("洞察暂时无法加载。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !rawInput) {
    return (
      <div className="page-loader">
        <LoaderCircle className="spin" />
        正在整理发行建议…
      </div>
    );
  }

  if (error && !rawInput) {
    return (
      <div className="release-decision-page page-wrap">
        <div className="error-card">{error}</div>
        <button className="secondary-button" type="button" onClick={() => void load()}>
          <RefreshCw size={16} />
          重试
        </button>
      </div>
    );
  }

  const briefing = rawInput?.releaseBriefing ?? null;
  const recommendations = rawInput?.releaseBriefing?.recommendations ?? [];
  const safeIndex = recommendations.length
    ? activeIndex % recommendations.length
    : 0;
  const currentRecommendation = recommendations[safeIndex] ?? null;

  const showEvidence = () => {
    setReferenceOpen(true);
    window.setTimeout(() => {
      referenceRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  };

  return (
    <main className="release-decision-page page-wrap">
      <header className="release-intro">
        <h1>
          未来 2–4 周，<span>优先发布什么？</span>
        </h1>
        <div className="release-ai-status">
          <Sparkles size={15} aria-hidden="true" />
          <strong>{modeLabel(briefing)}</strong>
          <span>基于站内玩家行为</span>
          <span aria-hidden="true">·</span>
          <span>
            {new Date(rawInput!.lastUpdated).toLocaleDateString(
              "zh-CN",
              { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" },
            )}
            更新
          </span>
          <button
            className="release-refresh-button"
            type="button"
            aria-label="刷新发行建议"
            onClick={() => void load()}
          >
            <RefreshCw size={15} className={loading ? "spin" : ""} />
          </button>
        </div>
      </header>

      <RecommendationStack
        recommendations={recommendations}
        activeIndex={safeIndex}
        onSelect={setActiveIndex}
        onShowEvidence={showEvidence}
      />

      <DeveloperReference
        sectionRef={referenceRef}
        open={referenceOpen}
        onToggle={() => setReferenceOpen((value) => !value)}
        recommendation={currentRecommendation}
        input={rawInput}
        briefing={briefing}
      />
    </main>
  );
}

function RecommendationStack({
  recommendations,
  activeIndex,
  onSelect,
  onShowEvidence,
}: {
  recommendations: ReleaseAiRecommendation[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onShowEvidence: () => void;
}) {
  if (!recommendations.length) {
    return (
      <section className="release-recommendation-stack release-recommendation-empty">
        <article className="release-recommendation-card">
          <span className="release-card-kicker">当前判断</span>
          <h2>样本还不够，先补数据再排期</h2>
          <p>继续收集玩家提问、预热点击和关系图互动，再生成正式建议。</p>
        </article>
      </section>
    );
  }

  const recommendation = recommendations[activeIndex];
  const previousIndex =
    (activeIndex - 1 + recommendations.length) % recommendations.length;
  const nextIndex = (activeIndex + 1) % recommendations.length;
  const secondBackIndex = (activeIndex + 2) % recommendations.length;
  const FormatIcon = FORMAT_ICONS[recommendation.format];

  return (
    <section className="release-recommendation-stack" aria-label="AI 发行建议">
      <div className="release-stack-stage">
        {recommendations.length > 2 ? (
          <button
            className="release-stack-back release-stack-back-two"
            type="button"
            aria-label={`查看建议：${recommendations[secondBackIndex].title}`}
            onClick={() => onSelect(secondBackIndex)}
          />
        ) : null}
        {recommendations.length > 1 ? (
          <button
            className="release-stack-back release-stack-back-one"
            type="button"
            aria-label={`查看建议：${recommendations[nextIndex].title}`}
            onClick={() => onSelect(nextIndex)}
          />
        ) : null}

        <article className="release-recommendation-card" key={recommendation.id}>
          <header className="release-card-header">
            <span className="release-card-kicker">
              建议 {String(activeIndex + 1).padStart(2, "0")}
            </span>
            <span className="release-card-format">
              <FormatIcon size={15} aria-hidden="true" />
              {FORMAT_NAMES[recommendation.format]}
            </span>
          </header>

          <h2>{recommendation.title}</h2>
          <p className="release-card-action">
            {firstSentence(recommendation.action)}
          </p>

          <div className="release-card-meta">
            <span>
              <Clock size={15} aria-hidden="true" />
              {WINDOW_NAMES[recommendation.window]}
            </span>
            <span>
              <UsersRound size={15} aria-hidden="true" />
              主要影响：{formatProfiles(recommendation.targetProfiles)}
            </span>
          </div>

          <div className="release-reason-list">
            <div className="release-reason-row">
              <strong>玩家需要</strong>
              <p>{firstSentence(recommendation.playerNeed)}</p>
            </div>
            <div className="release-reason-row">
              <strong>现在发布</strong>
              <p>{firstSentence(recommendation.whyNow)}</p>
            </div>
            <div className="release-reason-row release-reason-caution">
              <strong>注意边界</strong>
              <p>{firstSentence(recommendation.caution)}</p>
            </div>
          </div>

          <button
            className="release-evidence-link"
            type="button"
            onClick={onShowEvidence}
          >
            <FileSearch size={16} aria-hidden="true" />
            查看依据
            <ArrowRight size={15} aria-hidden="true" />
          </button>
        </article>
      </div>

      {recommendations.length > 1 ? (
        <nav className="release-stack-controls" aria-label="切换发行建议">
          <button
            type="button"
            aria-label="上一条建议"
            onClick={() => onSelect(previousIndex)}
          >
            <ArrowLeft size={17} />
          </button>
          <div className="release-stack-selectors">
            {recommendations.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={index === activeIndex ? "active" : ""}
                aria-label={`查看建议 ${index + 1}：${item.title}`}
                aria-current={index === activeIndex ? "true" : undefined}
                onClick={() => onSelect(index)}
              >
                {String(index + 1).padStart(2, "0")}
              </button>
            ))}
          </div>
          <span className="release-stack-count">
            {activeIndex + 1} / {recommendations.length}
          </span>
          <button
            type="button"
            aria-label="下一条建议"
            onClick={() => onSelect(nextIndex)}
          >
            <ArrowRight size={17} />
          </button>
        </nav>
      ) : null}
    </section>
  );
}

function DeveloperReference({
  sectionRef,
  open,
  onToggle,
  recommendation,
  input,
  briefing,
}: {
  sectionRef: RefObject<HTMLElement | null>;
  open: boolean;
  onToggle: () => void;
  recommendation: ReleaseAiRecommendation | null;
  input: ReleaseDecisionPayload | null;
  briefing: ReleaseAiBriefing | null;
}) {
  if (!input) return null;

  const topics = input.topics.slice(0, 8);
  const maxTopicCount = topics[0]?.count || 1;
  const aiRefs = briefing?.mode === "ai" ? recommendation?.evidenceRefs ?? [] : [];

  return (
    <section ref={sectionRef} className="release-developer-reference">
      <button
        className="release-reference-toggle"
        type="button"
        aria-expanded={open}
        aria-controls="release-reference-content"
        onClick={onToggle}
      >
        <span className="release-reference-mark">
          <Table2 size={18} aria-hidden="true" />
        </span>
        <span>
          <strong>开发组参考</strong>
          <small>查看数据、证据与判断方法</small>
        </span>
        <ChevronDown size={19} className={open ? "open" : ""} />
      </button>

      {open ? (
        <div id="release-reference-content" className="release-reference-content">
          <section className="release-reference-current">
            <header className="release-reference-heading">
              <span>01</span>
              <div>
                <h2>当前建议依据</h2>
                <p>这里的数据会跟随上方正在查看的建议切换。</p>
              </div>
            </header>

            {recommendation ? (
              <div className="release-current-grid">
                <article>
                  <span>建议动作</span>
                  <h3>{recommendation.title}</h3>
                  <p>{recommendation.action}</p>
                  <strong>验证方法</strong>
                  <p>{recommendation.verification}</p>
                </article>
                <aside>
                  <span>需要留意</span>
                  <h3>注意边界</h3>
                  <p>{recommendation.caution}</p>
                </aside>
              </div>
            ) : (
              <p className="release-reference-empty">当前没有可供排期的正式建议。</p>
            )}

            {recommendation ? (
              <div className="release-reference-meta-grid">
                <div>
                  <strong>相关玩家</strong>
                  <div className="release-reference-tags">
                    {recommendation.targetProfiles.map((profile) => (
                      <span key={profile}>{PROFILE_NAMES[profile] ?? profile}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <strong>可复用模块</strong>
                  <div className="release-reference-tags">
                    {recommendation.reusableModules.map((moduleId) => (
                      <span key={moduleId}>{MODULE_NAMES[moduleId] ?? moduleId}</span>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          <section className="release-reference-section">
            <header className="release-reference-heading">
              <span>02</span>
              <div>
                <h2>主题热度</h2>
                <p>只保留一张核心图表，用来查看玩家问题集中在哪些主题。</p>
              </div>
            </header>
            <div className="release-reference-chart">
              {topics.map((topic) => (
                <div className="release-reference-bar" key={topic.key}>
                  <span>{topicLabel(topic.key)}</span>
                  <div>
                    <i style={{ width: `${Math.max(5, (topic.count / maxTopicCount) * 100)}%` }} />
                  </div>
                  <strong>{topic.count}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="release-reference-section">
            <header className="release-reference-heading">
              <span>03</span>
              <div>
                <h2>证据明细</h2>
                <p>用于复核当前建议，不在主卡上展示这些数字。</p>
              </div>
            </header>
            <div className="release-reference-tables">
              <div className="release-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>站内证据</th>
                      <th>记录</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(recommendation?.evidenceRefs ?? []).map((evidence) => {
                      const row = evidenceLabel(evidence);
                      return (
                        <tr key={evidence}>
                          <td>{row.source}</td>
                          <td>{row.detail}</td>
                        </tr>
                      );
                    })}
                    {!recommendation?.evidenceRefs.length ? (
                      <tr>
                        <td colSpan={2}>暂无当前建议证据。</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <div className="release-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>相关玩家</th>
                      <th>样本</th>
                    </tr>
                  </thead>
                  <tbody>
                    {input.profiles.map((profile) => (
                      <tr key={profile.key}>
                        <td>{PROFILE_NAMES[profile.key] ?? "未分类玩家"}</td>
                        <td>{profile.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {aiRefs.length ? (
              <p className="release-ai-reference-line">
                <CheckCircle2 size={15} aria-hidden="true" />
                AI 引用：{aiRefs.map(releaseEvidenceLabel).join("；")}
              </p>
            ) : null}
          </section>

          <section className="release-reference-section">
            <header className="release-reference-heading">
              <span>04</span>
              <div>
                <h2>判断规则与数据缺口</h2>
                <p>这些信息用于开发组复核，不参与首屏阅读。</p>
              </div>
            </header>
            <div className="release-reference-notes">
              <article>
                <strong>样本构成</strong>
                <p>
                  当前包含 {input.historicalCount + input.preheat.historicalCount} 条历史样本和 {input.liveCount + input.preheat.liveCount} 条最近增量。
                </p>
              </article>
              <article>
                <strong>样本保护</strong>
                <p>总样本低于 10 时不给高信心；单类信号低于 3 时只观察，不进入排期。</p>
              </article>
              <article>
                <strong>站外趋势</strong>
                <p>暂未接入。当前建议只反映站内行为，不代表整个玩家社区的总体热度。</p>
              </article>
            </div>

            {briefing?.missingDataQuestions.length ? (
              <div className="release-missing-data">
                <div>
                  <ShieldAlert size={17} aria-hidden="true" />
                  <strong>下一轮需要补采</strong>
                </div>
                <ul>
                  {briefing.missingDataQuestions.map((question) => (
                    <li key={question}>{question}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </section>
  );
}
