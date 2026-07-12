"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpenCheck,
  ChevronRight,
  CircleAlert,
  Compass,
  LoaderCircle,
  Network,
} from "lucide-react";
import { GnosisTimeline } from "@/components/gnosis-timeline";
import { TravelerContextDrawer } from "@/components/home-intel";
import { PreheatNote } from "@/components/preheat-note";
import { PreheatBreakpointCard } from "@/components/preheat-breakpoint";
import { ProgressButtonGroup } from "@/components/progress-button-group";
import { RelationMap } from "@/components/relation-map";
import { usePreferences } from "@/components/preferences-provider";
import {
  defaultPreheatTopicId,
  preheatTopics,
} from "@/data/preheat-topics";
import { clientPath } from "@/lib/client-path";
import type { Focus, PreheatDepth, Profile, Progress } from "@/lib/domain";
import { labels, t } from "@/lib/i18n";
import type { PreheatView } from "@/lib/preheat";
import type { PreheatSection } from "@/lib/preheat-personalization";

const profileDescriptions = {
  new: ["先解释阵营和术语", "Explain factions and terms first"],
  returning: ["只补进入至冬前的必要背景", "Only the context needed before Snezhnaya"],
  story: ["展开证据、人物与伏笔", "Open evidence, characters, and threads"],
  exploration: ["轻量理解大世界文本", "Light context from world text"],
  casual: ["先看核心卖点", "Start with the main hook"],
};

export default function PreheatPage() {
  const { preferences, setPreferences } = usePreferences();
  const language = preferences.language;
  const isZh = language === "zh-CN";
  const [topicId, setTopicId] = useState(defaultPreheatTopicId);
  const [depth, setDepth] = useState<PreheatDepth>("guided");
  const [data, setData] = useState<PreheatView | null>(null);
  const [selectedTimelineId, setSelectedTimelineId] = useState<string>();
  const [graphId, setGraphId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [noteOpened, setNoteOpened] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [expandedSections, setExpandedSections] = useState<PreheatSection[]>([
    "timeline", "brief", "relations",
  ]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setTopicId(params.get("topicId") || defaultPreheatTopicId);
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
        focus: preferences.focus.join(","),
      });
      try {
        const response = await fetch(clientPath(`/api/preheat?${params}`), {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("load_failed");
        const next = (await response.json()) as PreheatView;
        setData(next);
        setSelectedTimelineId(next.presentation.defaultTimelineId);
        setGraphId(next.presentation.defaultRelationGraphId ?? next.relationGraph.id);
        setExpandedSections(next.presentation.sectionOrder.filter(
          (section) => !next.presentation.collapsedSections.includes(section),
        ));
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
    preferences.focus,
    preferences.progress,
    preferences.spoilerPreference,
    record,
    reloadKey,
    topicId,
  ]);

  const selectedTimeline = data?.timeline.find(
    (item) => item.id === selectedTimelineId,
  );
  const activeGraph = useMemo(() => {
    if (!data) return null;
    return data.availableRelationGraphs[graphId ?? ""] ?? data.relationGraph;
  }, [data, graphId]);
  const currentTopic =
    preheatTopics.find((item) => item.id === topicId) ??
    preheatTopics.find((item) => item.id === defaultPreheatTopicId) ??
    preheatTopics[0];
  const sectionOrder = data?.presentation.sectionOrder.join("-");
  const sectionNumber = (section: PreheatSection) =>
    String((data?.presentation.sectionOrder.indexOf(section) ?? 0) + 1).padStart(2, "0");
  const toggleSection = (section: PreheatSection) =>
    setExpandedSections((current) => current.includes(section)
      ? current.filter((item) => item !== section)
      : [...current, section]);
  const progressItems = (Object.keys(labels.progress) as Progress[]).map(
    (value) => ({ value, label: labels.progress[value][language] }),
  );
  const profileItems = (Object.keys(labels.profile) as Profile[]).map(
    (value) => ({
      value,
      label: labels.profile[value][language],
      description: profileDescriptions[value][isZh ? 0 : 1],
    }),
  );

  function toggleFocus(focus: Focus) {
    setPreferences((current) => {
      const exists = current.focus.includes(focus);
      const next = exists
        ? current.focus.filter((item) => item !== focus)
        : [...current.focus, focus];
      return { ...current, focus: next.length ? next : [focus] };
    });
  }

  function openCurrentNote() {
    setNoteOpened(true);
    window.requestAnimationFrame(() => {
      document
        .querySelector(".preheat-result-panel")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <div className="preheat-page preheat-intel-page page-wrap">
      <PreheatNote
        topic={currentTopic}
        language={language}
        selectedDepth={depth}
        onSelectDepth={setDepth}
        onStart={openCurrentNote}
      />

      <section className="preheat-settings-panel" aria-label="Preheat settings">
      <section className="home-progress-card preheat-progress-card">
        <div>
          <Compass size={20} />
          <span>{t(language, "最新完成主线", "Latest completed main quest")}</span>
          <strong>{labels.progress[preferences.progress][language]}</strong>
        </div>
        <div className="preheat-progress-control">
          <span>
            {t(
              language,
              "选择你最新完成的地区主线",
              "Choose the latest region main quest you completed",
            )}
          </span>
          <ProgressButtonGroup items={progressItems} value={preferences.progress}
            onChange={(progress) => setPreferences((current) => ({ ...current, progress }))} />
        </div>
      </section>

      <TravelerContextDrawer
        language={language}
        profile={preferences.profile}
        progress={preferences.progress}
        focus={preferences.focus}
        allowQuestionTextStorage={preferences.allowQuestionTextStorage}
        profileItems={profileItems}
        onSelectProfile={(profile) =>
          setPreferences((current) => ({ ...current, profile }))
        }
        onToggleFocus={toggleFocus}
        onToggleStorage={(allowQuestionTextStorage) =>
          setPreferences((current) => ({
            ...current,
            allowQuestionTextStorage,
          }))
        }
      />
      </section>

      {noteOpened && loading && !data ? (
        <div className="page-loader preheat-result-panel">
          <LoaderCircle className="spin" />
          {t(language, "正在整理神之心事件链...", "Arranging the Gnosis event chain...")}
        </div>
      ) : null}

      {noteOpened && error ? (
        <div className="error-card preheat-result-panel" role="alert">
          <CircleAlert size={18} />
          <span>{error}</span>
          <button type="button" onClick={() => setReloadKey((value) => value + 1)}>
            {t(language, "重试", "Retry")}
          </button>
        </div>
      ) : null}

      {noteOpened && loading && data ? (
        <div className="preheat-refresh-status" role="status" aria-live="polite">
          <LoaderCircle className="spin" size={15} />
          {t(language, "正在重新整理路线…", "Rearranging your route…")}
        </div>
      ) : null}

      {noteOpened && data ? (
        <>
          <div className="content-notice preheat-result-panel">{data.contentNotice}</div>
          <section className="preheat-workbench preheat-intel-workbench"
            data-section-order={sectionOrder}>
            <aside className="timeline-column">
              <div className="column-heading">
                <span>{sectionNumber("timeline")}</span>
                <div>
                  <h2>{t(language, "事件链", "Event chain")}</h2>
                  <p>
                    {depth === "guided"
                      ? t(language, "只放确定事件", "Confirmed events only")
                      : t(language, "包含后续地区线索", "Includes later-region clues")}
                  </p>
                </div>
                <button type="button" className="section-collapse-toggle"
                  aria-expanded={expandedSections.includes("timeline")}
                  onClick={() => toggleSection("timeline")}>
                  {expandedSections.includes("timeline") ? t(language, "收起", "Collapse") : t(language, "展开", "Expand")}
                </button>
              </div>
              <div className="preheat-section-body" hidden={!expandedSections.includes("timeline")}>
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
              </div>
            </aside>

            <main className="narration-column">
              <div className="column-heading">
                <span>{sectionNumber("brief")}</span>
                <div>
                  <h2>{data.depth.label}</h2>
                  <p>{data.depth.description}</p>
                </div>
                <button type="button" className="section-collapse-toggle"
                  aria-expanded={expandedSections.includes("brief")}
                  onClick={() => toggleSection("brief")}>
                  {expandedSections.includes("brief") ? t(language, "收起", "Collapse") : t(language, "展开", "Expand")}
                </button>
              </div>
              <div className="preheat-section-body" hidden={!expandedSections.includes("brief")}>
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
                {data.narration.factBoundary ? (
                  <small>{data.narration.factBoundary}</small>
                ) : null}
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
                        "This node is beyond the selected main-quest progress. Switch to Research for full spoilers, or update your progress above.",
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
              <PreheatBreakpointCard
                breakpoint={data.breakpoint}
                askHref={clientPath(
                  `/ask?topicId=${encodeURIComponent(topicId)}&timelineNodeId=${encodeURIComponent(
                    selectedTimelineId ?? "",
                  )}&question=${encodeURIComponent(data.breakpoint.question)}`,
                )}
              />
              </div>
            </main>

            <aside className="relations-column">
              <div className="column-heading">
                <span>{sectionNumber("relations")}</span>
                <div>
                  <h2>{t(language, "局部关系", "Local relations")}</h2>
                  <p>{t(language, "随节点切换", "Follows the selected node")}</p>
                </div>
                <button type="button" className="section-collapse-toggle"
                  aria-expanded={expandedSections.includes("relations")}
                  onClick={() => toggleSection("relations")}>
                  {expandedSections.includes("relations") ? t(language, "收起", "Collapse") : t(language, "展开", "Expand")}
                </button>
              </div>
              <div className="preheat-section-body" hidden={!expandedSections.includes("relations")}>
              {activeGraph ? (
                <RelationMap
                  graph={activeGraph}
                  language={language}
                  selectedNodeId={data.presentation.defaultRelationNodeId}
                  onNodeSelect={(nodeId) =>
                    void record("relation_node_opened", nodeId)
                  }
                />
              ) : null}
              <div className="followup-box">
                <span>{t(language, "继续问派蒙", "Continue with Paimon")}</span>
                {(selectedTimeline?.suggestedQuestions ?? data.topic.suggestedQuestions).map((question) => (
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
