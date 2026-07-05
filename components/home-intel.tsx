"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpenCheck,
  Compass,
  ExternalLink,
  MessageCircleMore,
  Play,
  Settings2,
  Sparkles,
} from "lucide-react";
import { ChoiceGrid, Field } from "@/components/field";
import { PreheatNote } from "@/components/preheat-note";
import { SnezhnayaGraphPreview } from "@/components/snezhnaya-graph-preview";
import { preheatTopics } from "@/data/preheat-topics";
import { clientPath } from "@/lib/client-path";
import type {
  Focus,
  Language,
  PreheatDepth,
  PreheatTopic,
  Profile,
  Progress,
} from "@/lib/domain";
import { labels, t } from "@/lib/i18n";
import type { SnezhnayaGraphData } from "@/lib/snezhnaya-graph";
import { localize } from "@/lib/snezhnaya-graph";

export function HomeVideoCarousel({
  language,
  graph,
}: {
  language: Language;
  graph: SnezhnayaGraphData;
}) {
  const [videoIndex, setVideoIndex] = useState(0);
  const [manualControl, setManualControl] = useState(false);
  const video = graph.videos[videoIndex] ?? graph.videos[0];

  useEffect(() => {
    if (manualControl || graph.videos.length <= 1) return;
    const timer = window.setInterval(() => {
      setVideoIndex((current) => (current + 1) % graph.videos.length);
    }, 5200);
    return () => window.clearInterval(timer);
  }, [graph.videos.length, manualControl]);

  function selectVideo(index: number) {
    setManualControl(true);
    setVideoIndex(index);
  }

  if (!video) return null;

  return (
    <section className="home-video-carousel reveal">
      <a
        className="home-video-stage"
        href={video.youtubeUrls[language]}
        target="_blank"
        rel="noreferrer"
        style={{ backgroundImage: `url(${video.coverImageUrl})` }}
        aria-label={localize(video.title, language)}
      >
        <span className="home-video-kicker">
          <Play size={16} />
          {t(language, "至冬影像", "Snezhnaya footage")}
        </span>
        <div className="home-video-title">
          <small>{String(videoIndex + 1).padStart(2, "0")} / {String(graph.videos.length).padStart(2, "0")}</small>
          <strong>{localize(video.title, language)}</strong>
        </div>
      </a>
      <div className="home-video-links">
        <a href={video.youtubeUrls[language]} target="_blank" rel="noreferrer">
          <Play size={15} />
          YouTube
        </a>
        <a href={video.miyousheUrl} target="_blank" rel="noreferrer">
          <ExternalLink size={15} />
          {t(language, "米游社", "Miyoushe")}
        </a>
      </div>
      <div className="home-video-dots" aria-label={t(language, "切换视频", "Switch video")}>
        {graph.videos.map((item, index) => (
          <button
            type="button"
            key={localize(item.title, "en")}
            className={index === videoIndex ? "active" : undefined}
            onClick={() => selectVideo(index)}
            aria-label={localize(item.title, language)}
          />
        ))}
      </div>
    </section>
  );
}

export function HomeHeroIntel({
  language,
  graphHref,
  graph,
}: {
  language: Language;
  graphHref: string;
  graph: SnezhnayaGraphData;
}) {
  return (
    <section className="home-hero-intel">
      <div className="home-hero-copy reveal">
        <span className="eyebrow">
          <Sparkles size={14} />
          {t(language, "剧情快速回顾", "Story catch-up")}
        </span>
        <h1>
          {t(language, "旅行者，", "Traveler")}
          <em>
            {t(
              language,
              "先从至冬关系图谱开始。",
              "Start from the Snezhnaya relationship map.",
            )}
          </em>
        </h1>
        <div className="home-hero-actions">
          <a className="secondary-button" href={clientPath("/preheat")}>
            {t(language, "进入预热", "Enter preheat")}
          </a>
        </div>
        <div className="home-brief-strip">
          {preheatTopics.slice(0, 3).map((topic, index) => (
            <a
              key={topic.id}
              href={clientPath(
                `/preheat?topicId=${encodeURIComponent(topic.id)}&depth=guided`,
              )}
            >
              <small>{String(index + 1).padStart(2, "0")}</small>
              <span>{language === "zh-CN" ? topic.titleZh : topic.titleEn}</span>
            </a>
          ))}
        </div>
      </div>
      <div className="home-hero-graph reveal delay-1">
        <SnezhnayaGraphPreview
          graph={graph}
          language={language}
          href={graphHref}
        />
      </div>
    </section>
  );
}

export function HomeCharacterDossier({
  language,
  graph,
  onSelectNode,
}: {
  language: Language;
  graph: SnezhnayaGraphData;
  onSelectNode?: (nodeId: string) => void;
}) {
  const dossierNodes = [
    ...graph.nodes.filter(
      (node) => node.imageUrl && node.graphGroup === "harbinger",
    ),
    ...graph.nodes.filter(
      (node) => node.imageUrl && node.graphGroup !== "harbinger",
    ),
  ].slice(0, 6);
  const graphActionLabel = t(language, "查看图谱区域", "View graph area");

  return (
    <section className="home-character-dossier reveal">
      <div className="home-section-heading">
        <span className="section-index">01 / DOSSIER</span>
        <h2>{t(language, "角色档案优先级", "Character dossier priority")}</h2>
      </div>
      <div className="home-dossier-grid">
        {dossierNodes.map((node) => (
          <button
            type="button"
            key={node.id}
            className="home-dossier-card"
            onClick={() => onSelectNode?.(node.id)}
            aria-label={`${graphActionLabel}: ${localize(node.label, language)}`}
          >
            {node.imageUrl ? (
              <Image
                src={node.imageUrl}
                alt={localize(node.label, language)}
                width={156}
                height={156}
                unoptimized
              />
            ) : null}
            <span className="home-dossier-meta">
              {node.harbingerRank
                ? t(language, `第 ${node.harbingerRank} 席`, `Seat ${node.harbingerRank}`)
                : t(language, "关键节点", "Key node")}
            </span>
            <strong>{localize(node.label, language)}</strong>
            <small>{localize(node.summary, language)}</small>
            <span className="home-dossier-action">{graphActionLabel}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

export function HomeGraphSummary({
  language,
  graphHref,
  graph,
}: {
  language: Language;
  graphHref: string;
  graph: SnezhnayaGraphData;
}) {
  const harbingers = graph.nodes.filter(
    (node) => node.graphGroup === "harbinger",
  ).length;
  const evidenceNodes = graph.nodes.filter((node) => node.clues.length).length;

  return (
    <section className="home-graph-summary reveal">
      <div>
        <span className="eyebrow">
          <BookOpenCheck size={14} />
          {t(language, "关系图摘要", "Graph summary")}
        </span>
        <h2>{t(language, "从宏观势力到单点证据", "From factions to evidence points")}</h2>
      </div>
      <dl>
        <div>
          <dt>{graph.nodes.length}</dt>
          <dd>{t(language, "节点", "Nodes")}</dd>
        </div>
        <div>
          <dt>{harbingers}</dt>
          <dd>{t(language, "执行官节点", "Harbingers")}</dd>
        </div>
        <div>
          <dt>{evidenceNodes}</dt>
          <dd>{t(language, "带证据节点", "Evidence nodes")}</dd>
        </div>
      </dl>
      <a className="secondary-button home-graph-summary-link" href={graphHref}>
        {t(language, "查看完整图谱", "View full map")}
        <ArrowRight size={17} />
      </a>
    </section>
  );
}

export function HomePreheatBrief({
  topic,
  language,
  selectedDepth,
  onSelectDepth,
  onStart,
}: {
  topic: PreheatTopic;
  language: Language;
  selectedDepth: PreheatDepth;
  onSelectDepth: (depth: PreheatDepth) => void;
  onStart: () => void;
}) {
  return (
    <section className="home-preheat-brief reveal">
      <PreheatNote
        topic={topic}
        language={language}
        selectedDepth={selectedDepth}
        onSelectDepth={onSelectDepth}
        onStart={onStart}
      />
      <aside className="home-preheat-rule">
        <Compass size={24} />
        <strong>{t(language, "今日导览原则", "Today's guide rule")}</strong>
      </aside>
    </section>
  );
}

export function HomeAskEntry({ language }: { language: Language }) {
  return (
    <section className="home-ask-entry reveal">
      <div>
        <span className="eyebrow">
          <MessageCircleMore size={14} />
          {t(language, "还没想明白？", "Still uncertain?")}
        </span>
        <h2>{t(language, "把问题交给派蒙", "Ask Paimon directly")}</h2>
      </div>
      <a className="primary-button" href={clientPath("/ask")}>
        {t(language, "去提问", "Ask now")}
        <ArrowRight size={17} />
      </a>
    </section>
  );
}

export function TravelerContextDrawer({
  language,
  profile,
  progress,
  focus,
  allowQuestionTextStorage,
  profileItems,
  progressItems,
  onSelectProfile,
  onSelectProgress,
  onToggleFocus,
  onToggleStorage,
}: {
  language: Language;
  profile: Profile;
  progress: Progress;
  focus: Focus[];
  allowQuestionTextStorage: boolean;
  profileItems: Array<{ value: Profile; label: string; description?: string }>;
  progressItems: Array<{ value: Progress; label: string }>;
  onSelectProfile: (profile: Profile) => void;
  onSelectProgress: (progress: Progress) => void;
  onToggleFocus: (focus: Focus) => void;
  onToggleStorage: (allowed: boolean) => void;
}) {
  return (
    <section className="traveler-context-drawer reveal">
      <div className="home-progress-card">
        <div>
          <Compass size={20} />
          <span>{t(language, "最新完成主线", "Latest completed main quest")}</span>
          <strong>{labels.progress[progress][language]}</strong>
        </div>
        <label>
          <span>
            {t(
              language,
              "选择你最新完成的地区主线",
              "Choose the latest region main quest you completed",
            )}
          </span>
          <select
            value={progress}
            onChange={(event) => onSelectProgress(event.target.value as Progress)}
          >
            {progressItems.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <details>
        <summary>
          <span>
            <Settings2 size={16} />
            {t(language, "调整旅行者状态", "Adjust Traveler context")}
          </span>
          <small>
            {labels.profile[profile][language]} / {labels.progress[progress][language]}
          </small>
        </summary>
        <div className="settings-body">
          <Field
            label={t(language, "你更像哪类玩家？", "What kind of player are you?")}
          >
            <ChoiceGrid
              items={profileItems}
              value={profile}
              onChange={(value) => onSelectProfile(value as Profile)}
              columns={5}
            />
          </Field>
          <Field
            label={t(language, "回答更关注什么？", "What should answers emphasize?")}
            hint={t(language, "可以多选", "Choose more than one")}
          >
            <div className="focus-row">
              {(Object.keys(labels.focus) as Focus[]).map((item) => (
                <button
                  type="button"
                  key={item}
                  className={focus.includes(item) ? "pill active" : "pill"}
                  onClick={() => onToggleFocus(item)}
                >
                  {labels.focus[item][language]}
                </button>
              ))}
            </div>
          </Field>
          <label className="switch-label">
            <input
              type="checkbox"
              checked={allowQuestionTextStorage}
              onChange={(event) => onToggleStorage(event.target.checked)}
            />
            <span className="switch" />
            <span>
              <strong>
                {t(language, "允许保存我主动提交的问题", "Allow saving questions I submit")}
              </strong>
              <small>
                {t(
                  language,
                  "关闭时只记录匿名分类",
                  "When off, only anonymous categories are stored",
                )}
              </small>
            </span>
          </label>
        </div>
      </details>
    </section>
  );
}
