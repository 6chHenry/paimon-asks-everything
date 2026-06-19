"use client";

import {
  BookOpenText,
  ExternalLink,
  FileText,
  PlayCircle,
  ShieldAlert,
} from "lucide-react";
import type { Language, ReadingResource } from "@/lib/domain";
import { t } from "@/lib/i18n";

function ResourceIcon({ resource }: { resource: ReadingResource }) {
  if (
    resource.kind === "official_video" ||
    resource.kind === "analysis_video"
  ) {
    return <PlayCircle size={18} />;
  }
  if (resource.kind === "discussion") return <BookOpenText size={18} />;
  return <FileText size={18} />;
}

function kindLabel(resource: ReadingResource, language: Language) {
  const values = {
    official_video: ["官方视频", "Official video"],
    official_text: ["剧情文本索引", "Story text index"],
    story_guide: ["故事梳理", "Story guide"],
    analysis_video: ["解析视频", "Analysis video"],
    discussion: ["社区讨论", "Community discussion"],
  } as const;
  return values[resource.kind][language === "zh-CN" ? 0 : 1];
}

function spoilerLabel(level: ReadingResource["spoilerLevel"], language: Language) {
  if (level >= 3) return t(language, "高剧透", "Major spoilers");
  if (level === 2) return t(language, "中度剧透", "Moderate spoilers");
  return t(language, "轻度剧透", "Light spoilers");
}

export function ReadingAppendix({
  resources,
  language,
}: {
  resources: ReadingResource[];
  language: Language;
}) {
  if (!resources.length) return null;
  const official = resources.filter((item) => item.authority === "official");
  const optional = resources.filter((item) => item.authority !== "official");

  function ResourceCard({ resource }: { resource: ReadingResource }) {
    return (
      <a
        className={`reading-card authority-${resource.authority}`}
        href={resource.url}
        target="_blank"
        rel="noreferrer"
      >
        <span className="reading-icon"><ResourceIcon resource={resource} /></span>
        <span className="reading-copy">
          <span className="reading-meta">
            <b>{kindLabel(resource, language)}</b>
            <i>{resource.platform}</i>
          </span>
          <strong>{resource.title}</strong>
          <small>{resource.reason}</small>
          <span className={`spoiler-label level-${resource.spoilerLevel}`}>
            <ShieldAlert size={11} />
            {spoilerLabel(resource.spoilerLevel, language)}
          </span>
        </span>
        <ExternalLink size={15} />
      </a>
    );
  }

  return (
    <section className="reading-appendix">
      <div className="reading-heading">
        <div>
          <span className="section-index">EXTRA</span>
          <h3>{t(language, "还想继续看？", "Want to keep exploring?")}</h3>
        </div>
        <p>
          {t(
            language,
            "社区内容是二次解读，请选择性观看。",
            "Community links are optional interpretations.",
          )}
        </p>
      </div>
      {official.length ? (
        <div className="reading-group">
          <h4>{t(language, "官方内容", "Official content")}</h4>
          <div className="reading-grid">
            {official.map((resource) => (
              <ResourceCard key={resource.id} resource={resource} />
            ))}
          </div>
        </div>
      ) : null}
      {optional.length ? (
        <div className="reading-group optional">
          <h4>{t(language, "选择性阅读与观看", "Optional reading & viewing")}</h4>
          <div className="reading-grid">
            {optional.map((resource) => (
              <ResourceCard key={resource.id} resource={resource} />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
