"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BarChart3,
  FileSearch,
  Globe2,
  Languages,
  LoaderCircle,
  RefreshCw,
  Signal,
  UsersRound,
} from "lucide-react";
import { usePreferences } from "@/components/preferences-provider";
import type {
  InsightBriefingCard,
  InsightSignal,
  Recommendation,
} from "@/lib/insights";
import { t } from "@/lib/i18n";

interface InsightPayload {
  total: number;
  liveCount: number;
  lastUpdated: string;
  languages: Array<{ key: string; count: number }>;
  profiles: Array<{ key: string; count: number }>;
  categories: Array<{ key: string; count: number }>;
  topics: Array<{ key: string; count: number }>;
  briefingCards: InsightBriefingCard[];
  insightsMode: "ai" | "rules_fallback";
  aiGeneratedAt?: string;
  aiError?: string;
  signals: InsightSignal[];
  recommendations: Recommendation[];
  consentedSamples: Array<{
    id: string;
    language: string;
    questionText?: string;
    sourceKind: string;
  }>;
}

const topicLabels: Record<string, [string, string]> = {
  fontaine_catch_up: ["枫丹回归补课", "Fontaine catch-up"],
  sandrone_identity: ["桑多涅身份与关系", "Sandrone identity & ties"],
  layered_puzzle_help: ["分层解谜提示", "Layered puzzle help"],
  terminology: ["术语理解", "Terminology"],
  fontaine_lore: ["枫丹剧情脉络", "Fontaine lore"],
  long_tail_question: ["长尾问题", "Long-tail questions"],
  prohibited_automation: ["违规自动化请求", "Prohibited automation"],
};

function labelFor(key: string, isZh: boolean) {
  return topicLabels[key]?.[isZh ? 0 : 1] ?? key.replaceAll("_", " ");
}

export default function InsightsPage() {
  const { preferences } = usePreferences();
  const language = preferences.language;
  const isZh = language === "zh-CN";
  const [data, setData] = useState<InsightPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/insights", { cache: "no-store" });
      if (!response.ok) throw new Error("load_failed");
      setData((await response.json()) as InsightPayload);
    } catch {
      setError(t(language, "洞察暂时无法加载。", "Insights could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, [language]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return <div className="page-loader"><LoaderCircle className="spin" />{t(language, "正在聚合匿名事件…", "Aggregating anonymous events…")}</div>;
  }

  return (
    <div className="insights-page page-wrap">
      <section className="page-heading">
        <div>
          <span className="eyebrow"><Signal size={14} />{t(language, "发行洞察", "Release insights")}</span>
          <h1>{t(language, "玩家卡在哪里？", "Where are players getting stuck?")}</h1>
        </div>
        <button className="secondary-button" type="button" onClick={() => void load()}>
          <RefreshCw size={16} className={loading ? "spin" : ""} />
          {t(language, "刷新现场增量", "Refresh live events")}
        </button>
      </section>

      {error ? <div className="error-card">{error}</div> : null}
      {data ? (
        <>
          <section className="metric-grid">
            <article>
              <span><BarChart3 size={17} />{t(language, "匿名事件", "Anonymous events")}</span>
              <strong>{data.total}</strong>
              <small>{t(language, `其中 ${data.liveCount} 条现场增量`, `${data.liveCount} live increment(s)`)}</small>
            </article>
            <article>
              <span><Languages size={17} />{t(language, "语言分布", "Language split")}</span>
              <strong>{data.languages.map((item) => `${item.key === "zh-CN" ? "中" : "EN"} ${item.count}`).join(" / ")}</strong>
            </article>
            <article>
              <span><UsersRound size={17} />{t(language, "主要画像", "Leading profile")}</span>
              <strong>{data.profiles[0]?.key ?? "—"}</strong>
              <small>{data.profiles[0]?.count ?? 0} {t(language, "条事件", "events")}</small>
            </article>
            <article>
              <span><RefreshCw size={17} />{t(language, "最近更新", "Last update")}</span>
              <strong>{new Date(data.lastUpdated).toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit" })}</strong>
              <small>{new Date(data.lastUpdated).toLocaleDateString(language)}</small>
            </article>
          </section>

          <section className="briefing-section">
            <div className="section-title">
              <div><span className="section-index">01</span><h2>{t(language, "行动简报", "Action brief")}</h2></div>
              <p>
                <span className={`insight-mode ${data.insightsMode}`}>
                  {data.insightsMode === "ai"
                    ? t(language, "AI 归纳", "AI generated")
                    : t(language, "规则回退", "Rules fallback")}
                </span>
              </p>
            </div>
            <div className="briefing-grid">
              {data.briefingCards.map((card) => (
                <article key={card.id}>
                  <div className="briefing-top">
                    <span className={`signal-strength ${card.priority}`}>{card.priority}</span>
                    <small><Globe2 size={13} />{card.affectedPlayers}</small>
                  </div>
                  <h3>{isZh ? card.titleZh : card.titleEn}</h3>
                  <p>{isZh ? card.plainSummaryZh : card.plainSummaryEn}</p>
                  <div className="briefing-body">
                    <div>
                      <strong>{t(language, "玩家需求", "Player need")}</strong>
                      <span>{isZh ? card.playerNeedZh : card.playerNeedEn}</span>
                    </div>
                    <div>
                      <strong>{t(language, "建议动作", "Recommended action")}</strong>
                      <span>{isZh ? card.strategyZh : card.strategyEn}</span>
                    </div>
                  </div>
                  <details>
                    <summary><FileSearch size={15} />{t(language, "查看聚合证据", "View aggregate evidence")}</summary>
                    <ul>
                      {card.evidenceItems.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </details>
                </article>
              ))}
            </div>
          </section>

          <section className="insight-grid">
            <article className="panel chart-panel">
              <div className="panel-heading">
                <span>02</span>
                <div><h2>{t(language, "困惑主题排行", "Confusion topics")}</h2></div>
              </div>
              <div className="bar-list">
                {data.topics.slice(0, 6).map((item, index) => (
                  <div key={item.key}>
                    <div><span>{labelFor(item.key, isZh)}</span><strong>{item.count}</strong></div>
                    <i style={{ width: `${Math.max(8, (item.count / (data.topics[0]?.count || 1)) * 100)}%` }} />
                    <small>{String(index + 1).padStart(2, "0")}</small>
                  </div>
                ))}
              </div>
            </article>

            <article className="panel category-panel">
              <div className="panel-heading">
                <span>03</span>
                <div><h2>{t(language, "高频问题类别", "Question categories")}</h2></div>
              </div>
              <div className="category-cloud">
                {data.categories.map((item, index) => (
                  <div key={item.key} className={`tone-${(index % 3) + 1}`}>
                    <strong>{item.count}</strong>
                    <span>{item.key.replaceAll("_", " ")}</span>
                    <small>{Math.round((item.count / data.total) * 100)}%</small>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="signal-section">
            <div className="section-title">
              <div><span className="section-index">04</span><h2>{t(language, "发行机会信号", "Release opportunity signals")}</h2></div>
            </div>
            <div className="signal-list">
              {data.signals.map((signal) => (
                <article key={signal.id}>
                  <span className={`signal-strength ${signal.strength}`}>{signal.strength}</span>
                  <div>
                    <small>{signal.type.replaceAll("_", " ")}</small>
                    <h3>{labelFor(signal.topic, isZh)}</h3>
                    <p>{signal.rule}</p>
                  </div>
                  <strong>{signal.evidence}</strong>
                </article>
              ))}
            </div>
          </section>

          <section className="recommendation-section">
            <div className="section-title">
              <div><span className="section-index">05</span><h2>{t(language, "FAQ / 内容调整建议", "FAQ / content recommendations")}</h2></div>
            </div>
            <div className="recommendation-grid">
              {data.recommendations.map((recommendation) => {
                const signal = data.signals.find((item) => item.id === recommendation.signalId);
                return (
                  <article key={recommendation.id}>
                    <div className="recommendation-top">
                      <span>{recommendation.type}</span>
                      <span>{t(language, "待审核草稿", "Draft · review required")}</span>
                    </div>
                    <h3>{isZh ? recommendation.titleZh : recommendation.titleEn}</h3>
                    <p>{isZh ? recommendation.bodyZh : recommendation.bodyEn}</p>
                    <details>
                      <summary><FileSearch size={15} />{t(language, "查看触发证据", "View triggering evidence")}</summary>
                      <div>
                        <strong>{signal?.rule}</strong>
                        <span>{signal?.evidence}</span>
                      </div>
                    </details>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="evidence-drawer">
            <div>
              <span className="section-index">06</span>
              <div>
                <h2>{t(language, "已授权问题样本", "Consented question samples")}</h2>
                <p>{t(language, "仅显示已授权文本。", "Consented text only.")}</p>
              </div>
            </div>
            <div className="sample-list">
              {data.consentedSamples.map((sample) => (
                <article key={sample.id}>
                  <span>{sample.language}</span>
                  <p>{sample.questionText}</p>
                  <small>{sample.sourceKind === "historical_sample" ? t(language, "预置匿名样本", "Seeded anonymous sample") : t(language, "现场增量", "Live increment")}</small>
                </article>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
