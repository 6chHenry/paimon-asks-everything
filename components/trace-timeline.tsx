"use client";

import {
  CheckCircle2,
  ChevronDown,
  LoaderCircle,
  Search,
  Sparkle,
} from "lucide-react";
import type { Language } from "@/lib/domain";
import type { TraceEvent } from "@/lib/trace";
import { t } from "@/lib/i18n";

function stageLabel(stage: TraceEvent["stage"], language: Language) {
  const labels: Record<TraceEvent["stage"], [string, string]> = {
    classify: ["理解问题", "Understand"],
    spoiler: ["剧透边界", "Spoilers"],
    retrieval: ["本地知识", "Local knowledge"],
    search: ["联网检索", "Web search"],
    tool: ["工具调用", "Tool call"],
    generate: ["组织回答", "Compose"],
    final: ["完成", "Final"],
  };
  const item = labels[stage];
  return language === "zh-CN" ? item[0] : item[1];
}
function TraceIcon({ event }: { event: TraceEvent }) {
  if (event.status === "complete") return <CheckCircle2 size={15} />;
  if (event.stage === "search" || event.stage === "tool") return <Search size={15} />;
  if (event.status === "running") return <LoaderCircle className="spin" size={15} />;
  return <Sparkle size={15} />;
}

export function TraceTimeline({
  events,
  language,
  collapsed,
}: {
  events: TraceEvent[];
  language: Language;
  collapsed: boolean;
}) {
  if (!events.length) return null;
  const completed = events.filter((event) => event.status === "complete").length;
  const searches = events.filter((event) => event.stage === "search").length;

  return (
    <details className="trace-timeline" open={!collapsed}>
      <summary>
        <span className="trace-orb">
          {collapsed ? <CheckCircle2 size={16} /> : <LoaderCircle className="spin" size={16} />}
        </span>
        <span>
          <strong>
            {collapsed
              ? t(language, "派蒙查到了这些", "What Paimon checked")
              : t(language, "派蒙正在查资料！", "Paimon is checking!")}
          </strong>
          <small>
            {t(
              language,
              `已完成 ${completed} 步 · 检索 ${searches} 次`,
              `${completed} completed · ${searches} search step(s)`,
            )}
          </small>
        </span>
        <ChevronDown size={16} />
      </summary>
      <div className="trace-list">
        {events.map((event) => (
          <div key={event.id} className={`trace-item ${event.status}`}>
            <span className="trace-step-icon"><TraceIcon event={event} /></span>
            <span className="trace-step-copy">
              <b>{stageLabel(event.stage, language)}</b>
              <span>{event.message}</span>
              {event.detail ? <small>{event.detail}</small> : null}
            </span>
          </div>
        ))}
      </div>
    </details>
  );
}

