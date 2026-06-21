"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpenCheck,
  ChevronRight,
  CircleAlert,
  LoaderCircle,
  Network,
  Sparkles,
} from "lucide-react";
import { GnosisTimeline } from "@/components/gnosis-timeline";
import { RelationMap } from "@/components/relation-map";
import { usePreferences } from "@/components/preferences-provider";
import { clientPath } from "@/lib/client-path";
import type { PreheatDepth } from "@/lib/domain";
import { labels, t } from "@/lib/i18n";
import type { PreheatView } from "@/lib/preheat";

const defaultTopic = "why-fatui-collect-gnoses";

export default function PreheatPage() {
  const { preferences } = usePreferences();
  const language = preferences.language;
  const [topicId, setTopicId] = useState(defaultTopic);
  const [depth, setDepth] = useState<PreheatDepth>("guided");
  const [data, setData] = useState<PreheatView | null>(null);
  const [selectedTimelineId, setSelectedTimelineId] = useState<string>();
  const [graphId, setGraphId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setTopicId(params.get("topicId") || defaultTopic);
    const requestedDepth = params.get("depth");
    if (requestedDepth === "guided" || requestedDepth === "research") {
      setDepth(requestedDepth);
    }
  }, []);

  const record = useCallback(
    async (
      interactionKind:
        | "depth_selected"
        | "timeline_node_opened"
        | "relation_node_opened",
      targetId: string,
      selectedDepth?: PreheatDepth,
    ) => {
      try {
        await fetch(clientPath("/api/preheat/events"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            language,
            playerProfile: preferences.profile,
            topicId,
            interactionKind,
            targetId,
            ...(selectedDepth ? { depth: selectedDepth } : {}),
          }),
        });
      } catch {
        // The experience remains usable if analytics storage is unavailable.
      }
    },
    [language, preferences.profile, topicId],
  );

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({
        topicId,
        depth,
        language,
        profile: preferences.profile,
        progress: preferences.progress,
        spoilerPreference: preferences.spoilerPreference,
      });
      try {
        const response = await fetch(clientPath(`/api/preheat?${params}`), {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("load_failed");
        const next = (await response.json()) as PreheatView;
        const firstAvailable = next.timeline.find((item) => !item.locked);
        setData(next);
        setSelectedTimelineId(firstAvailable?.id);
        setGraphId(firstAvailable?.relationGraphId ?? next.relationGraph.id);
        void record("depth_selected", depth, depth);
      } catch (loadError) {
        if ((loadError as Error).name !== "AbortError") {
          setError(
            t(
              language,
              "纸条暂时没展开，再试一次吧。",
              "The note would not open. Please try again.",
            ),
          );
        }
      } finally {
        setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [
    depth,
    language,
    preferences.profile,
    preferences.progress,
    preferences.spoilerPreference,
    record,
    topicId,
  ]);

  const selectedTimeline = data?.timeline.find(
    (item) => item.id === selectedTimelineId,
  );
  const activeGraph = useMemo(() => {
    if (!data) return null;
    return (
      data.availableRelationGraphs[graphId ?? ""] ?? data.relationGraph
    );
  }, [data, graphId]);

  if (loading && !data) {
    return (
      <div className="page-loader">
        <LoaderCircle className="spin" />
        {t(language, "正在整理神之心事件链…", "Arranging the Gnosis event chain…")}
      </div>
    );
  }

  return (
    <div className="preheat-page page-wrap">
      <section className="preheat-masthead">
        <div>
          <span className="eyebrow">
            <Sparkles size={14} />
            {t(language, "至冬预热题设", "Snezhnaya preheat scenario")}
          </span>
          <h1>{data?.topic.title}</h1>
          <p>{data?.topic.intro}</p>
        </div>
        <div className="preheat-controls">
          <label>
            <span>{t(language, "策划主题", "Curated topic")}</span>
            <select
              value={topicId}
              onChange={(event) => setTopicId(event.target.value)}
            >
              {data?.topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.title}
                </option>
              ))}
            </select>
          </label>
          <div className="depth-tabs">
            {(["guided", "research"] as PreheatDepth[]).map((item) => (
              <button
                type="button"
                key={item}
                className={depth === item ? "active" : undefined}
                onClick={() => setDepth(item)}
              >
                {item === "guided"
                    ? t(language, "3 分钟", "3 min")
                    : t(language, "完整考据", "Research")}
              </button>
            ))}
          </div>
        </div>
      </section>

      {error ? (
        <div className="error-card">
          <CircleAlert size={18} />
          {error}
        </div>
      ) : null}

      {data ? (
        <>
          <div className="content-notice">{data.contentNotice}</div>
          <section className="preheat-workbench">
            <aside className="timeline-column">
              <div className="column-heading">
                <span>01</span>
                <div>
                  <h2>{t(language, "事件链", "Event chain")}</h2>
                  <p>
                    {depth === "guided"
                      ? t(language, "只放确定事件", "Confirmed events only")
                      : t(language, "含后续地区线索", "Includes later-region clues")}
                  </p>
                </div>
              </div>
              <GnosisTimeline
                items={data.timeline}
                selectedId={selectedTimelineId}
                language={language}
                onSelect={(item) => {
                  setSelectedTimelineId(item.id);
                  setGraphId(item.relationGraphId);
                  void record("timeline_node_opened", item.id);
                }}
              />
            </aside>

            <main className="narration-column">
              <div className="column-heading">
                <span>02</span>
                <div>
                  <h2>{data.depth.label}</h2>
                  <p>{data.depth.description}</p>
                </div>
              </div>
              <article className="narration-card">
                <BookOpenCheck size={22} />
                {data.narration.lead ? (
                  <p className="narration-lead">{data.narration.lead}</p>
                ) : null}
                <ol>
                  {data.narration.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ol>
                <small>{data.narration.factBoundary}</small>
              </article>

              {selectedTimeline ? (
                <article className="timeline-detail">
                  <header>
                    <span>
                      {labels.progress[selectedTimeline.region][language]}
                    </span>
                    <h2>{selectedTimeline.title}</h2>
                  </header>
                  {selectedTimeline.locked ? (
                    <p>
                      {t(
                        language,
                        "这个节点超过首页选择的主线进度。切换到“完整考据”会展示完整剧透；也可以回首页更新进度。",
                        "This node is beyond the progress selected on the home page. Switch to Research for full spoilers, or return home to update progress.",
                      )}
                    </p>
                  ) : (
                    <>
                      {selectedTimeline.events.map((entry) => (
                        <div className="evidence-entry confirmed" key={entry.id}>
                          <span>{labels.fact[entry.factStatus][language]}</span>
                          <h3>{entry.title}</h3>
                          <p>{entry.content}</p>
                          <a href={entry.source.url} target="_blank" rel="noreferrer">
                            {entry.source.title}
                            <ChevronRight size={14} />
                          </a>
                        </div>
                      ))}
                      {selectedTimeline.implications.map((entry) => (
                        <div className="evidence-entry implied" key={entry.id}>
                          <span>{labels.fact[entry.factStatus][language]}</span>
                          <h3>{entry.title}</h3>
                          <p>{entry.content}</p>
                        </div>
                      ))}
                    </>
                  )}
                </article>
              ) : null}
            </main>

            <aside className="relations-column">
              <div className="column-heading">
                <span>03</span>
                <div>
                  <h2>{t(language, "局部关系", "Local relations")}</h2>
                  <p>{t(language, "随节点切换", "Follows the selected node")}</p>
                </div>
              </div>
              {activeGraph ? (
                <RelationMap
                  graph={activeGraph}
                  language={language}
                  onNodeSelect={(nodeId) =>
                    void record("relation_node_opened", nodeId)
                  }
                />
              ) : null}
              <div className="followup-box">
                <span>{t(language, "继续问派蒙", "Continue with Paimon")}</span>
                {data.topic.suggestedQuestions.map((question) => (
                  <a
                    key={question}
                    href={clientPath(`/ask?topicId=${encodeURIComponent(
                      topicId,
                    )}&timelineNodeId=${encodeURIComponent(
                      selectedTimelineId ?? "",
                    )}&question=${encodeURIComponent(question)}`)}
                  >
                    <span>{question}</span>
                    <ArrowRight size={14} />
                  </a>
                ))}
              </div>
            </aside>
          </section>
          <div className="preheat-to-insights">
            <Network size={18} />
            <span>
              {t(
                language,
                "刚才的深度选择与节点点击已作为匿名现场增量记录；问题文本仍只在你授权时保存。",
                "Your depth and node selections were recorded as anonymous live increments; question text is still stored only with consent.",
              )}
            </span>
            <a href={clientPath("/insights")}>
              {t(language, "查看发行洞察", "View release insights")}
              <ArrowRight size={15} />
            </a>
          </div>
        </>
      ) : null}
    </div>
  );
}
