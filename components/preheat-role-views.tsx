"use client";

import {
  ArrowRight,
  BookOpenCheck,
  ChevronRight,
  Compass,
  Landmark,
  Route,
  UsersRound,
} from "lucide-react";
import { GnosisTimeline } from "@/components/gnosis-timeline";
import { RelationMap } from "@/components/relation-map";
import { clientPath } from "@/lib/client-path";
import type { Language } from "@/lib/domain";
import { labels, t } from "@/lib/i18n";
import type {
  NewPlayerPreheatView,
  ReturningPlayerPreheatView,
  StoryPlayerPreheatView,
} from "@/lib/preheat";
import type { PreheatSection } from "@/lib/preheat-personalization";

export function RegionRequiredPreheat({ language }: { language: Language }) {
  return (
    <section className="preheat-role-view preheat-region-required">
      <Compass size={26} />
      <div>
        <h2>{t(language, "先选择一个地区", "Choose a region first")}</h2>
        <p>
          {t(
            language,
            "地区会决定入门介绍、剧情回顾与关系图的默认焦点。",
            "Your region determines the primer, catch-up, and default relationship focus.",
          )}
        </p>
      </div>
    </section>
  );
}

export function NewPlayerPreheat({
  view,
  language,
}: {
  view: NewPlayerPreheatView;
  language: Language;
}) {
  return (
    <section className="preheat-role-view new-player-preheat">
      <article className="preheat-region-overview">
        <span className="preheat-role-kicker">
          <Landmark size={16} />
          {t(language, "地区速览", "Region overview")}
        </span>
        <h2>{labels.progress[view.region][language]}</h2>
        <p>{view.guide.overview}</p>
      </article>

      <section className="preheat-role-section">
        <header>
          <UsersRound size={20} />
          <div>
            <h2>{t(language, "需要认识的阵营", "Factions to know")}</h2>
            <p>{t(language, "只解释身份与立场，不透露结局", "Identities and roles without outcomes")}</p>
          </div>
        </header>
        <div className="preheat-faction-grid">
          {view.guide.factions.map((faction, index) => (
            <article key={faction.name}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{faction.name}</h3>
              <p>{faction.role}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="preheat-role-section">
        <header>
          <Route size={20} />
          <div>
            <h2>{t(language, "无剧透剧情脉络", "Spoiler-free story path")}</h2>
            <p>{t(language, "起点、矛盾与旅行方向", "Setup, tension, and direction")}</p>
          </div>
        </header>
        <ol className="preheat-story-steps">
          {view.guide.storySteps.map((step, index) => (
            <li key={step}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <p>{step}</p>
            </li>
          ))}
        </ol>
      </section>
    </section>
  );
}

export function ReturningPlayerPreheat({
  view,
  language,
  topicId,
  onRelationNodeSelect,
}: {
  view: ReturningPlayerPreheatView;
  language: Language;
  topicId: string;
  onRelationNodeSelect: (nodeId: string) => void;
}) {
  return (
    <section className="preheat-role-view returning-player-preheat">
      <section className="preheat-role-section">
        <header>
          <BookOpenCheck size={20} />
          <div>
            <h2>
              {labels.progress[view.region][language]} · {t(language, "剧情回顾", "Story catch-up")}
            </h2>
            <p>{t(language, "按原因、行动和影响重新串联", "Reconnected through cause, action, and impact")}</p>
          </div>
        </header>
        <div className="preheat-recap-grid">
          {view.recap.points.map((point, index) => (
            <article key={point.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{point.title}</h3>
              <p>{point.body}</p>
            </article>
          ))}
        </div>
      </section>

      {view.recap.relationGraph?.nodes.length ? (
        <section className="preheat-role-section preheat-local-relations">
          <header>
            <UsersRound size={20} />
            <div>
              <h2>{t(language, "关键人物关系", "Key relationships")}</h2>
              <p>{t(language, "只显示与所选地区直接相关的节点", "Only nodes tied directly to the selected region")}</p>
            </div>
          </header>
          <RelationMap
            graph={view.recap.relationGraph}
            language={language}
            onNodeSelect={onRelationNodeSelect}
          />
        </section>
      ) : null}

      <section className="preheat-role-section preheat-hooks">
        <header>
          <Compass size={20} />
          <div>
            <h2>{t(language, "从这里继续期待", "Questions to carry forward")}</h2>
            <p>{t(language, "只提出问题，不提前给出后续答案", "Questions only, without giving away later answers")}</p>
          </div>
        </header>
        <div>
          {view.recap.hooks.map((question) => (
            <a
              key={question}
              href={clientPath(
                `/ask?topicId=${encodeURIComponent(topicId)}&question=${encodeURIComponent(question)}`,
              )}
            >
              <span>{question}</span>
              <ArrowRight size={16} />
            </a>
          ))}
        </div>
      </section>
    </section>
  );
}

export function StoryPlayerPreheat({
  view,
  language,
  topicId,
  selectedTimelineId,
  graphId,
  expandedSections,
  onToggleSection,
  onTimelineSelect,
  onRelationNodeSelect,
}: {
  view: StoryPlayerPreheatView;
  language: Language;
  topicId: string;
  selectedTimelineId?: string;
  graphId?: string;
  expandedSections: PreheatSection[];
  onToggleSection: (section: PreheatSection) => void;
  onTimelineSelect: (item: StoryPlayerPreheatView["timeline"][number]) => void;
  onRelationNodeSelect: (nodeId: string) => void;
}) {
  const selectedTimeline = view.timeline.find(
    (item) => item.id === selectedTimelineId,
  );
  const activeGraph =
    view.availableRelationGraphs[graphId ?? ""] ?? view.relationGraph;
  const sectionNumber = (section: PreheatSection) =>
    String(view.presentation.sectionOrder.indexOf(section) + 1).padStart(2, "0");

  return (
    <section
      className="preheat-role-view preheat-workbench preheat-intel-workbench story-player-preheat"
      data-section-order={view.presentation.sectionOrder.join("-")}
    >
      <aside className="timeline-column">
        <RoleColumnHeading
          number={sectionNumber("timeline")}
          title={t(language, "完整事件链", "Complete event chain")}
          description={t(language, "全部已实装地区", "All released regions")}
          expanded={expandedSections.includes("timeline")}
          language={language}
          onToggle={() => onToggleSection("timeline")}
        />
        <div className="preheat-section-body" hidden={!expandedSections.includes("timeline")}>
          <GnosisTimeline
            items={view.timeline}
            selectedId={selectedTimelineId}
            language={language}
            onSelect={onTimelineSelect}
          />
        </div>
      </aside>

      <main className="narration-column">
        <RoleColumnHeading
          number={sectionNumber("brief")}
          title={t(language, "详细剧情记录", "Detailed story record")}
          description={t(language, "背景、过程、结果与来源", "Context, events, outcomes, and sources")}
          expanded={expandedSections.includes("brief")}
          language={language}
          onToggle={() => onToggleSection("brief")}
        />
        <div className="preheat-section-body" hidden={!expandedSections.includes("brief")}>
          <article className="narration-card">
            <BookOpenCheck size={22} />
            <ol>
              {view.narration.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ol>
          </article>

          {selectedTimeline ? (
            <article className="timeline-detail">
              <header>
                <span>{labels.progress[selectedTimeline.region][language]}</span>
                <h2>{selectedTimeline.title}</h2>
              </header>
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
            </article>
          ) : null}
        </div>
      </main>

      <aside className="relations-column">
        <RoleColumnHeading
          number={sectionNumber("relations")}
          title={t(language, "完整关系图", "Complete relationship map")}
          description={t(language, "随事件节点切换", "Follows the selected event")}
          expanded={expandedSections.includes("relations")}
          language={language}
          onToggle={() => onToggleSection("relations")}
        />
        <div className="preheat-section-body" hidden={!expandedSections.includes("relations")}>
          <RelationMap
            graph={activeGraph}
            language={language}
            selectedNodeId={view.presentation.defaultRelationNodeId}
            onNodeSelect={onRelationNodeSelect}
          />
          <div className="followup-box">
            <span>{t(language, "继续问派蒙", "Continue with Paimon")}</span>
            {(selectedTimeline?.suggestedQuestions ?? view.topicQuestions).map(
              (question) => (
                <a
                  key={question}
                  href={clientPath(
                    `/ask?topicId=${encodeURIComponent(topicId)}&timelineNodeId=${encodeURIComponent(selectedTimelineId ?? "")}&question=${encodeURIComponent(question)}`,
                  )}
                >
                  <span>{question}</span>
                  <ArrowRight size={14} />
                </a>
              ),
            )}
          </div>
        </div>
      </aside>
    </section>
  );
}

function RoleColumnHeading({
  number,
  title,
  description,
  expanded,
  language,
  onToggle,
}: {
  number: string;
  title: string;
  description: string;
  expanded: boolean;
  language: Language;
  onToggle: () => void;
}) {
  return (
    <div className="column-heading">
      <span>{number}</span>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <button
        type="button"
        className="section-collapse-toggle"
        aria-expanded={expanded}
        onClick={onToggle}
      >
        {expanded ? t(language, "收起", "Collapse") : t(language, "展开", "Expand")}
      </button>
    </div>
  );
}
