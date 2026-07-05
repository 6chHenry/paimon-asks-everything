"use client";

import Image from "next/image";
import {
  ArrowRight,
  BookOpenCheck,
  Compass,
  MessageCircleMore,
  Play,
  Settings2,
  Sparkles,
  UsersRound,
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
        <p>
          {t(
            language,
            "把愚人众、神之心、旧秩序与角色去向放在一张情报桌上，先看全局，再进入轻剧透导览。",
            "Place the Fatui, Gnoses, old order, and character fates on one intelligence desk. Read the map first, then enter a light-spoiler guide.",
          )}
        </p>
        <div className="home-hero-actions">
          <a className="primary-button" href={graphHref}>
            {t(language, "打开关系图", "Open relationship map")}
            <ArrowRight size={17} />
          </a>
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

export function HomeVideoFeature({
  language,
  graph,
}: {
  language: Language;
  graph: SnezhnayaGraphData;
}) {
  const video = graph.videos[0];

  return (
    <section className="home-video-feature reveal delay-2">
      <div
        className="home-video-cover"
        style={{ backgroundImage: `url(${video.coverImageUrl})` }}
      >
        <span>
          <Play size={16} />
          {t(language, "官方视频索引", "Official video index")}
        </span>
      </div>
      <div className="home-video-copy">
        <span className="section-index">01 / VIDEO</span>
        <h2>{localize(video.title, language)}</h2>
        <p>{localize(video.description, language)}</p>
        <a
          className="secondary-button"
          href={video.youtubeUrls[language]}
          target="_blank"
          rel="noreferrer"
        >
          YouTube
          <ArrowRight size={16} />
        </a>
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

  return (
    <section className="home-character-dossier reveal">
      <div className="home-section-heading">
        <span className="section-index">02 / DOSSIER</span>
        <h2>{t(language, "角色档案优先级", "Character dossier priority")}</h2>
        <p>
          {t(
            language,
            "先看有头像与执行官身份的节点，快速建立人物坐标。",
            "Harbinger nodes with portraits come first, giving the cast a quick visual coordinate system.",
          )}
        </p>
      </div>
      <div className="home-dossier-grid">
        {dossierNodes.map((node) => (
          <button
            type="button"
            key={node.id}
            className="home-dossier-card"
            onClick={() => onSelectNode?.(node.id)}
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
            <span>
              {node.harbingerRank
                ? t(language, `第 ${node.harbingerRank} 席`, `Seat ${node.harbingerRank}`)
                : t(language, "关键节点", "Key node")}
            </span>
            <strong>{localize(node.label, language)}</strong>
            <small>{localize(node.summary, language)}</small>
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
        <p>
          {t(
            language,
            "完整图谱保留交互分析，首页只给你最强入口、关键角色和阅读顺序。",
            "The full map keeps relationship analysis. The homepage gives the strongest entry, key cast, and reading order.",
          )}
        </p>
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
      <a className="primary-button" href={graphHref}>
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
        <p>
          {t(
            language,
            "轻剧透会按旅行者状态锁定后续地区；完整考据会展开已实装的后续内容。",
            "Light spoilers lock later regions by Traveler context. Research view opens released later content.",
          )}
        </p>
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
        <p>
          {t(
            language,
            "从当前进度、剧透偏好和关注点出发，把线索整理成可追问的答案。",
            "Use your progress, spoiler preference, and focus areas to turn loose clues into follow-up answers.",
          )}
        </p>
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
