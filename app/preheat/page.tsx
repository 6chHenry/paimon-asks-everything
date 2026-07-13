"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  CircleAlert,
  Compass,
  LoaderCircle,
  Network,
} from "lucide-react";
import { TravelerContextDrawer } from "@/components/home-intel";
import { PreheatNote } from "@/components/preheat-note";
import {
  NewPlayerPreheat,
  RegionRequiredPreheat,
  ReturningPlayerPreheat,
  StoryPlayerPreheat,
} from "@/components/preheat-role-views";
import { ProgressButtonGroup } from "@/components/progress-button-group";
import { usePreferences } from "@/components/preferences-provider";
import {
  defaultPreheatTopicId,
  preheatTopics,
} from "@/data/preheat-topics";
import { clientPath } from "@/lib/client-path";
import type { Profile, Progress } from "@/lib/domain";
import { labels, t } from "@/lib/i18n";
import type { PreheatView, StoryPlayerPreheatView } from "@/lib/preheat";
import type { PreheatSection } from "@/lib/preheat-personalization";
import {
  visibleProfiles,
  type VisibleProfile,
} from "@/lib/visible-profiles";

const profileDescriptions: Record<VisibleProfile, [string, string]> = {
  new: ["通俗认识地区、阵营与剧情起点", "Plain-language region, factions, and story setup"],
  returning: ["回顾所选地区并留下后续引子", "Recap the selected region and carry forward open threads"],
  story: ["展开全部剧情、证据与人物关系", "Open the complete story, evidence, and relationships"],
};

export default function PreheatPage() {
  const { preferences, setPreferences } = usePreferences();
  const language = preferences.language;
  const isZh = language === "zh-CN";
  const [topicId, setTopicId] = useState(defaultPreheatTopicId);
  const [data, setData] = useState<PreheatView | null>(null);
  const [selectedTimelineId, setSelectedTimelineId] = useState<string>();
  const [graphId, setGraphId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [noteOpened, setNoteOpened] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [expandedSections, setExpandedSections] = useState<PreheatSection[]>([
    "timeline",
    "brief",
    "relations",
  ]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setTopicId(params.get("topicId") || defaultPreheatTopicId);
  }, []);

  const record = useCallback(
    async (
      interactionKind: "timeline_node_opened" | "relation_node_opened",
      targetId: string,
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
        setData(next);
        if (next.kind === "story") {
          setSelectedTimelineId(next.presentation.defaultTimelineId);
          setGraphId(
            next.presentation.defaultRelationGraphId ?? next.relationGraph.id,
          );
          setExpandedSections(
            next.presentation.sectionOrder.filter(
              (section) =>
                !next.presentation.collapsedSections.includes(section),
            ),
          );
        } else {
          setSelectedTimelineId(undefined);
          setGraphId(undefined);
        }
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
    language,
    preferences.profile,
    preferences.progress,
    preferences.spoilerPreference,
    reloadKey,
    topicId,
  ]);

  const currentTopic =
    preheatTopics.find((item) => item.id === topicId) ??
    preheatTopics.find((item) => item.id === defaultPreheatTopicId) ??
    preheatTopics[0];
  const progressItems = (Object.keys(labels.progress) as Progress[]).map(
    (value) => ({ value, label: labels.progress[value][language] }),
  );
  const profileItems: Array<{
    value: Profile;
    label: string;
    description: string;
  }> = visibleProfiles.map((value) => ({
    value,
    label: labels.profile[value][language],
    description: profileDescriptions[value][isZh ? 0 : 1],
  }));

  const toggleSection = (section: PreheatSection) =>
    setExpandedSections((current) =>
      current.includes(section)
        ? current.filter((item) => item !== section)
        : [...current, section],
    );

  function openCurrentNote() {
    setNoteOpened(true);
    window.requestAnimationFrame(() => {
      document
        .querySelector(".preheat-result-panel")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function selectStoryTimeline(
    item: StoryPlayerPreheatView["timeline"][number],
  ) {
    setSelectedTimelineId(item.id);
    setGraphId(item.relationGraphId);
    void record("timeline_node_opened", item.id);
  }

  return (
    <div className="preheat-page preheat-intel-page page-wrap">
      <PreheatNote
        topic={currentTopic}
        language={language}
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
            <ProgressButtonGroup
              items={progressItems}
              value={preferences.progress}
              onChange={(progress) =>
                setPreferences((current) => ({ ...current, progress }))
              }
            />
          </div>
        </section>

        <TravelerContextDrawer
          language={language}
          profile={preferences.profile}
          progress={preferences.progress}
          allowQuestionTextStorage={preferences.allowQuestionTextStorage}
          profileItems={profileItems}
          onSelectProfile={(profile) =>
            setPreferences((current) => ({ ...current, profile }))
          }
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
          {t(language, "正在整理地区线索...", "Arranging regional threads...")}
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
          {t(language, "正在更新所选内容…", "Updating the selected content…")}
        </div>
      ) : null}

      {noteOpened && data ? (
        <>
          <div className="content-notice preheat-result-panel">
            {data.contentNotice}
          </div>

          {data.kind === "region_required" ? (
            <RegionRequiredPreheat language={language} />
          ) : null}
          {data.kind === "new" ? (
            <NewPlayerPreheat view={data} language={language} />
          ) : null}
          {data.kind === "returning" ? (
            <ReturningPlayerPreheat
              view={data}
              language={language}
              topicId={topicId}
              onRelationNodeSelect={(nodeId) =>
                void record("relation_node_opened", nodeId)
              }
            />
          ) : null}
          {data.kind === "story" ? (
            <StoryPlayerPreheat
              view={data}
              language={language}
              topicId={topicId}
              selectedTimelineId={selectedTimelineId}
              graphId={graphId}
              expandedSections={expandedSections}
              onToggleSection={toggleSection}
              onTimelineSelect={selectStoryTimeline}
              onRelationNodeSelect={(nodeId) =>
                void record("relation_node_opened", nodeId)
              }
            />
          ) : null}

          <div className="preheat-to-insights">
            <Network size={18} />
            <span>
              {t(
                language,
                "地区、身份与节点交互只按匿名分类记录；问题文本仍只在你授权时保存。",
                "Region, profile, and node interactions are recorded only as anonymous categories; question text is stored only with consent.",
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
